'use client'

import { useState, useEffect, useMemo } from 'react'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { CalendarCheck, Search, Loader2, Package, Download, Eye } from 'lucide-react'
import type { User, Rental, BusinessSettings } from '@/types'
import { RENTAL_STATUS_LABELS, RENTAL_STATUS_COLORS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportAgreementPDF } from '@/lib/pdf/agreement'
import PDFViewerModal from '@/components/PDFViewerModal'

export default function PortalBookingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [rentals, setRentals] = useState<Rental[]>([])
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewingPDF, setViewingPDF] = useState<{ dataUrl: string; title: string; fileName: string } | null>(null)

  useEffect(() => {
    let unsubs: (() => void)[] = []

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)

      const settingsDoc = await getDoc(doc(db, 'business_settings', 'config'))
      if (settingsDoc.exists()) setSettings(settingsDoc.data() as BusinessSettings)

      const customerQuery = query(collection(db, 'customers'), where('email', '==', userData.email))
      const unsubC = onSnapshot(customerQuery, (snap) => {
        const customerIds = snap.docs.map(d => d.id)
        if (customerIds.length === 0) { setLoading(false); return }
        customerIds.forEach(cid => {
          const rq = query(collection(db, 'rentals'), where('customer_id', '==', cid))
          const unsubR = onSnapshot(rq, (rSnap) => {
            const data = rSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Rental[]
            data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            setRentals(data)
            setLoading(false)
          })
          unsubs.push(unsubR)
        })
      })
      unsubs.push(unsubC)
    })
    return () => { unsubAuth(); unsubs.forEach(u => u()) }
  }, [])

  const filteredRentals = useMemo(() => {
    return rentals.filter(r => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && !['active', 'equipment_out', 'paid'].includes(r.status)) return false
        if (statusFilter === 'completed' && r.status !== 'completed') return false
        if (statusFilter === 'pending' && !['pending_confirmation', 'confirmed', 'agreement_signed', 'invoiced'].includes(r.status)) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        return r.rental_number.toLowerCase().includes(q) || r.items.some(i => i.equipment_name.toLowerCase().includes(q))
      }
      return true
    })
  }, [rentals, statusFilter, search])

  const statusTabs = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
  ]

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-neutral-900 animate-spin" /></div>

  return (
    <div className="space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-slate-800">My Bookings</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white" />
        </div>
        <div className="flex gap-2">
          {statusTabs.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === t.value ? 'bg-neutral-900 text-white' : 'text-slate-500 bg-white border border-slate-200 hover:bg-slate-50'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {filteredRentals.length === 0 ? (
        <div className="text-center py-16">
          <CalendarCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRentals.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-800">{r.rental_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RENTAL_STATUS_COLORS[r.status]}`}>{RENTAL_STATUS_LABELS[r.status]}</span>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(r.rental_start)} - {formatDate(r.rental_end)}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.items.map((item, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Package className="w-3 h-3" /> {item.equipment_name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(r.total_amount)}</p>
                    <p className="text-xs text-slate-500">Deposit: {formatCurrency(r.deposit_amount)}</p>
                  </div>
                  <button
                    onClick={() => {
                      const dataUrl = exportAgreementPDF(r, settings, 'datauristring') as string
                      setViewingPDF({ dataUrl, title: `Agreement ${r.rental_number}`, fileName: `${r.rental_number}-agreement.pdf` })
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0"
                  >
                    <Eye className="w-3 h-3" /> View
                  </button>
                  <button onClick={() => exportAgreementPDF(r, settings)} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1 shrink-0">
                    <Download className="w-3 h-3" /> Agreement
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingPDF && (
        <PDFViewerModal
          {...viewingPDF}
          onClose={() => setViewingPDF(null)}
        />
      )}
    </div>
  )
}
