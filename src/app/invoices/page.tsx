'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore'
import { Search, Receipt, Loader2, X, CreditCard, Eye, Send, Ban } from 'lucide-react'
import type { User, Invoice, Payment } from '@/types'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, PAYMENT_METHODS } from '@/lib/constants'
import { formatCurrency, formatDate, generateDocNumber } from '@/lib/utils'

type StatusFilter = 'all' | Invoice['status']

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function InvoicesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Payment modal state
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  useEffect(() => {
    let unsubInvoices: (() => void) | null = null
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)

      unsubInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Invoice[]
        data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setInvoices(data)
        setLoading(false)
      })
    })
    return () => {
      unsubAuth()
      if (unsubInvoices) unsubInvoices()
    }
  }, [])

  const filteredInvoices = useMemo(() => {
    let result = invoices

    if (statusFilter !== 'all') {
      result = result.filter(inv => inv.status === statusFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_name.toLowerCase().includes(q) ||
        inv.rental_number.toLowerCase().includes(q)
      )
    }

    return result
  }, [invoices, statusFilter, search])

  const openPaymentModal = (invoice: Invoice) => {
    const remaining = invoice.grand_total - invoice.paid_amount
    setPaymentInvoice(invoice)
    setPaymentAmount(remaining.toFixed(2))
    setPaymentMethod('cash')
    setPaymentReference('')
    setPaymentNotes('')
  }

  const closePaymentModal = () => {
    setPaymentInvoice(null)
    setPaymentAmount('')
    setPaymentMethod('cash')
    setPaymentReference('')
    setPaymentNotes('')
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentInvoice || !user) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) return

    const remaining = paymentInvoice.grand_total - paymentInvoice.paid_amount
    if (amount > remaining) return

    setSaving(true)

    try {
      const now = new Date().toISOString()

      // Generate receipt number
      const paymentsSnapshot = await new Promise<string[]>((resolve) => {
        const unsub = onSnapshot(collection(db, 'payments'), (snap) => {
          const numbers = snap.docs.map(d => (d.data() as Payment).receipt_number || '')
          unsub()
          resolve(numbers)
        })
      })
      const receiptNumber = await generateDocNumber('RCP', paymentsSnapshot)

      // Create payment document
      await addDoc(collection(db, 'payments'), {
        receipt_number: receiptNumber,
        rental_id: paymentInvoice.rental_id,
        invoice_id: paymentInvoice.id,
        customer_id: paymentInvoice.customer_id,
        customer_name: paymentInvoice.customer_name,
        amount: amount,
        payment_method: paymentMethod,
        payment_type: 'rental',
        reference_number: paymentReference || '',
        notes: paymentNotes,
        created_by: user.id,
        created_at: now,
      })

      // Update invoice
      const newPaidAmount = paymentInvoice.paid_amount + amount
      const newStatus = newPaidAmount >= paymentInvoice.grand_total ? 'paid' : 'partial'

      await updateDoc(doc(db, 'invoices', paymentInvoice.id), {
        paid_amount: newPaidAmount,
        payment_date: now,
        payment_method: paymentMethod,
        status: newStatus,
        updated_at: now,
      })

      // Update linked rental
      if (paymentInvoice.rental_id) {
        const rentalRef = doc(db, 'rentals', paymentInvoice.rental_id)
        const rentalSnap = await getDoc(rentalRef)
        if (rentalSnap.exists()) {
          const rentalData = rentalSnap.data()
          const newRentalPaid = (rentalData.amount_paid || 0) + amount
          const rentalPaymentStatus = newRentalPaid >= (rentalData.total_amount || 0) ? 'paid' : 'partial'

          await updateDoc(rentalRef, {
            amount_paid: newRentalPaid,
            payment_status: rentalPaymentStatus,
            payment_method: paymentMethod,
            updated_at: now,
          })
        }
      }

      closePaymentModal()
    } catch (err) {
      console.error('Error recording payment:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAsSent = async (invoice: Invoice) => {
    if (!user) return
    setActionLoadingId(invoice.id)
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Error marking invoice as sent:', err)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCancel = async (invoice: Invoice) => {
    if (!user) return
    setActionLoadingId(invoice.id)
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Error cancelling invoice:', err)
    } finally {
      setActionLoadingId(null)
    }
  }

  const getItemsSummary = (items: Invoice['items']) => {
    if (items.length === 0) return 'No items'
    const first = items.slice(0, 2).map(i => i.equipment_name).join(', ')
    if (items.length > 2) {
      return `${first} and ${items.length - 2} more`
    }
    return first
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">{invoices.length} total invoices</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice number, customer name, or rental number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No invoices yet</p>
          <p className="text-sm text-slate-400 mt-1">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Invoices are generated from rentals'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredInvoices.map(invoice => {
            const remaining = invoice.grand_total - invoice.paid_amount
            const progressPercent = invoice.grand_total > 0
              ? Math.min((invoice.paid_amount / invoice.grand_total) * 100, 100)
              : 0
            const isActionLoading = actionLoadingId === invoice.id

            return (
              <div
                key={invoice.id}
                className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-3">
                  {/* Top row: Invoice number, status, and grand total */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800">{invoice.invoice_number}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </span>
                      </div>

                      <button
                        onClick={() => router.push(`/rentals/${invoice.rental_id}`)}
                        className="text-xs text-neutral-900 hover:text-neutral-800 hover:underline mt-0.5"
                      >
                        {invoice.rental_number}
                      </button>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(invoice.grand_total)}</p>
                      {invoice.paid_amount > 0 && invoice.status !== 'paid' && (
                        <p className="text-xs text-slate-500">
                          Paid: {formatCurrency(invoice.paid_amount)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Payment progress bar */}
                  {(invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'paid' || invoice.status === 'overdue') && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Details row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      {invoice.customer_name}
                    </span>
                    <span className="text-slate-400">
                      {getItemsSummary(invoice.items)}
                    </span>
                    <span>
                      Due: {formatDate(invoice.due_date)}
                    </span>
                    <span>
                      Created: {formatDate(invoice.created_at)}
                    </span>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                    {/* View Rental */}
                    <button
                      onClick={() => router.push(`/rentals/${invoice.rental_id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Rental
                    </button>

                    {/* Mark as Sent (draft only) */}
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => handleMarkAsSent(invoice)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Mark as Sent
                      </button>
                    )}

                    {/* Record Payment (sent or partial) */}
                    {(invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue') && (
                      <button
                        onClick={() => openPaymentModal(invoice)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Record Payment
                      </button>
                    )}

                    {/* Cancel (draft or sent) */}
                    {(invoice.status === 'draft' || invoice.status === 'sent') && (
                      <button
                        onClick={() => handleCancel(invoice)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 ml-auto"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closePaymentModal} />
          <div className="relative bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Record Payment</h2>
                <p className="text-xs text-slate-500 mt-0.5">{paymentInvoice.invoice_number}</p>
              </div>
              <button
                onClick={closePaymentModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Summary */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Customer</p>
                  <p className="font-medium text-slate-800">{paymentInvoice.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rental</p>
                  <p className="font-medium text-slate-800">{paymentInvoice.rental_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Grand Total</p>
                  <p className="font-medium text-slate-800">{formatCurrency(paymentInvoice.grand_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Already Paid</p>
                  <p className="font-medium text-slate-800">{formatCurrency(paymentInvoice.paid_amount)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Remaining Balance</p>
                  <p className="text-lg font-bold text-slate-800">
                    {formatCurrency(paymentInvoice.grand_total - paymentInvoice.paid_amount)}
                  </p>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${paymentInvoice.grand_total > 0 ? Math.min((paymentInvoice.paid_amount / paymentInvoice.grand_total) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (RM) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(paymentInvoice.grand_total - paymentInvoice.paid_amount).toFixed(2)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                  required
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reference Number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. bank transfer ref, receipt number"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Additional notes about this payment..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-lg shadow-neutral-900/20 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
