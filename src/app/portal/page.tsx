'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { CalendarCheck, Receipt, DollarSign, Package, Loader2, ArrowRight } from 'lucide-react'
import type { User, Rental, Invoice } from '@/types'
import { RENTAL_STATUS_LABELS, RENTAL_STATUS_COLORS, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function PortalDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [rentals, setRentals] = useState<Rental[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    let unsubs: (() => void)[] = []

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)

      // Get customer doc to find customer_id
      const customerQuery = query(collection(db, 'customers'), where('email', '==', userData.email))
      const unsubCustomers = onSnapshot(customerQuery, (snap) => {
        const customerIds = snap.docs.map(d => d.id)
        if (customerIds.length === 0) { setLoading(false); return }

        // Get rentals for this customer
        customerIds.forEach(customerId => {
          const rentalQuery = query(collection(db, 'rentals'), where('customer_id', '==', customerId))
          const unsubRentals = onSnapshot(rentalQuery, (rSnap) => {
            setRentals(rSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Rental[])
            setLoading(false)
          })
          unsubs.push(unsubRentals)

          const invoiceQuery = query(collection(db, 'invoices'), where('customer_id', '==', customerId))
          const unsubInvoices = onSnapshot(invoiceQuery, (iSnap) => {
            setInvoices(iSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Invoice[])
          })
          unsubs.push(unsubInvoices)
        })
      })
      unsubs.push(unsubCustomers)
    })

    return () => { unsubAuth(); unsubs.forEach(u => u()) }
  }, [])

  const stats = useMemo(() => {
    const activeRentals = rentals.filter(r => ['active', 'equipment_out', 'paid'].includes(r.status))
    const totalSpent = rentals.reduce((sum, r) => sum + r.amount_paid, 0)
    const pendingPayments = invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status))
    return { activeRentals: activeRentals.length, totalRentals: rentals.length, totalSpent, pendingPayments: pendingPayments.length }
  }, [rentals, invoices])

  const recentRentals = useMemo(() => {
    return [...rentals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
  }, [rentals])

  const recentInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
  }, [invoices])

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-neutral-900 animate-spin" /></div>

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {user?.name}</h1>
        <p className="text-sm text-slate-500 mt-1">Your rental overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center"><CalendarCheck className="w-5 h-5 text-neutral-900" /></div>
            <div><p className="text-xs text-slate-500">Active Rentals</p><p className="text-lg font-bold text-slate-800">{stats.activeRentals}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-violet-600" /></div>
            <div><p className="text-xs text-slate-500">Total Rentals</p><p className="text-lg font-bold text-slate-800">{stats.totalRentals}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs text-slate-500">Total Spent</p><p className="text-lg font-bold text-slate-800">{formatCurrency(stats.totalSpent)}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Receipt className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-slate-500">Pending Payments</p><p className="text-lg font-bold text-slate-800">{stats.pendingPayments}</p></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Rentals */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Current Rentals</h3>
            <button onClick={() => router.push('/portal/bookings')} className="text-sm text-neutral-900 hover:underline flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></button>
          </div>
          {recentRentals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No rentals yet</p>
          ) : (
            <div className="space-y-3">
              {recentRentals.map(r => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">{r.rental_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RENTAL_STATUS_COLORS[r.status]}`}>{RENTAL_STATUS_LABELS[r.status]}</span>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(r.rental_start)} - {formatDate(r.rental_end)}</p>
                  <p className="text-xs text-slate-500">{r.items.length} item{r.items.length !== 1 ? 's' : ''} &middot; {formatCurrency(r.total_amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Recent Invoices</h3>
            <button onClick={() => router.push('/portal/invoices')} className="text-sm text-neutral-900 hover:underline flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></button>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map(inv => (
                <div key={inv.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-800">{inv.invoice_number}</span>
                    <p className="text-xs text-slate-500">{formatDate(inv.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(inv.grand_total)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>{INVOICE_STATUS_LABELS[inv.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
