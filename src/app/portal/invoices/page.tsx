'use client'

import { useState, useEffect, useMemo } from 'react'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { Receipt, Loader2, Download } from 'lucide-react'
import type { User, Invoice, Rental, BusinessSettings } from '@/types'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportInvoicePDF } from '@/lib/pdf/invoice'

export default function PortalInvoicesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [settings, setSettings] = useState<BusinessSettings | null>(null)

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
          const iq = query(collection(db, 'invoices'), where('customer_id', '==', cid))
          const unsubI = onSnapshot(iq, (iSnap) => {
            const data = iSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Invoice[]
            data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            setInvoices(data)
            setLoading(false)
          })
          unsubs.push(unsubI)
        })
      })
      unsubs.push(unsubC)
    })
    return () => { unsubAuth(); unsubs.forEach(u => u()) }
  }, [])

  const handleDownloadInvoice = async (invoice: Invoice) => {
    let rental: Rental | null = null
    if (invoice.rental_id) {
      const rentalDoc = await getDoc(doc(db, 'rentals', invoice.rental_id))
      if (rentalDoc.exists()) rental = { id: rentalDoc.id, ...rentalDoc.data() } as Rental
    }
    exportInvoicePDF(invoice, rental, settings)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-neutral-900 animate-spin" /></div>

  return (
    <div className="space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-slate-800">My Invoices</h1>

      {invoices.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-800">{inv.invoice_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>{INVOICE_STATUS_LABELS[inv.status]}</span>
                  </div>
                  <p className="text-xs text-slate-500">Rental: {inv.rental_number} &middot; Due: {formatDate(inv.due_date)}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {inv.items.slice(0, 3).map((item, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{item.equipment_name}</span>
                    ))}
                    {inv.items.length > 3 && <span className="text-xs text-slate-400">+{inv.items.length - 3} more</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(inv.grand_total)}</p>
                    {inv.paid_amount > 0 && inv.paid_amount < inv.grand_total && (
                      <p className="text-xs text-emerald-600">Paid: {formatCurrency(inv.paid_amount)}</p>
                    )}
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((inv.paid_amount / inv.grand_total) * 100, 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDownloadInvoice(inv)} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1 shrink-0">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
