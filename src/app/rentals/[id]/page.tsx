'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { ArrowLeft, Loader2, X, CheckCircle, Circle, AlertCircle, XCircle, Calendar, Package, CreditCard, FileText, ClipboardCheck, Download, Ban, DollarSign, Eye } from 'lucide-react'
import type { User, Rental, RentalItem, Payment, Invoice, BusinessSettings } from '@/types'
import { RENTAL_STATUS_LABELS, RENTAL_STATUS_COLORS, RENTAL_STATUS_FLOW, PAYMENT_METHODS, EQUIPMENT_CONDITIONS } from '@/lib/constants'
import { formatCurrency, formatDate, formatDateTime, calculateLateDays, generateDocNumber } from '@/lib/utils'
import { exportInvoicePDF } from '@/lib/pdf/invoice'
import { exportReceiptPDF } from '@/lib/pdf/receipt'
import { exportAgreementPDF } from '@/lib/pdf/agreement'
import { exportReturnChecklistPDF } from '@/lib/pdf/return-checklist'

// ==================== Status Action Map ====================

const statusActions: Record<string, { label: string; nextStatus: string; color: string }> = {
  pending_confirmation: { label: 'Confirm Booking', nextStatus: 'confirmed', color: 'bg-neutral-900' },
  confirmed: { label: 'Sign Agreement', nextStatus: 'agreement_signed', color: 'bg-indigo-600' },
  agreement_signed: { label: 'Generate Invoice', nextStatus: 'invoiced', color: 'bg-violet-600' },
  invoiced: { label: 'Record Payment', nextStatus: 'paid', color: 'bg-emerald-600' },
  paid: { label: 'Hand Over Equipment', nextStatus: 'equipment_out', color: 'bg-cyan-600' },
  equipment_out: { label: 'Mark as Active', nextStatus: 'active', color: 'bg-green-600' },
  active: { label: 'Process Return', nextStatus: 'returned', color: 'bg-teal-600' },
  overdue: { label: 'Process Return', nextStatus: 'returned', color: 'bg-teal-600' },
  returned: { label: 'Inspect Equipment', nextStatus: 'inspected', color: 'bg-purple-600' },
  inspected: { label: 'Complete Rental', nextStatus: 'completed', color: 'bg-emerald-600' },
}

// ==================== Timeline Steps ====================

const TIMELINE_STEPS = [
  { key: 'quotation', label: 'Quotation' },
  { key: 'pending_confirmation', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'agreement_signed', label: 'Agreement' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid' },
  { key: 'equipment_out', label: 'Equip Out' },
  { key: 'active', label: 'Active' },
  { key: 'returned', label: 'Returned' },
  { key: 'inspected', label: 'Inspected' },
  { key: 'completed', label: 'Completed' },
]

// ==================== Deposit Status Labels ====================

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  collected: 'Collected',
  partially_refunded: 'Partially Refunded',
  refunded: 'Refunded',
  forfeited: 'Forfeited',
}

const DEPOSIT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  collected: 'bg-neutral-100 text-neutral-800',
  partially_refunded: 'bg-teal-100 text-teal-700',
  refunded: 'bg-emerald-100 text-emerald-700',
  forfeited: 'bg-red-100 text-red-700',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  refunded: 'Refunded',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  refunded: 'bg-slate-100 text-slate-700',
}

const CONDITION_IN_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
]

// ==================== Main Component ====================

export default function RentalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rentalId = params.id as string

  // Core state
  const [user, setUser] = useState<User | null>(null)
  const [rental, setRental] = useState<Rental | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'cash' as string,
    reference_number: '',
    notes: '',
  })

  // Inspection modal
  const [showInspectionModal, setShowInspectionModal] = useState(false)
  const [inspectionItems, setInspectionItems] = useState<
    { equipment_name: string; condition_in: string; notes: string }[]
  >([])
  const [inspectionDamageFee, setInspectionDamageFee] = useState(0)
  const [inspectionDamageNotes, setInspectionDamageNotes] = useState('')

  // Cancel confirm
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // ==================== Auth + Data Fetching ====================

  useEffect(() => {
    let unsubRental: (() => void) | null = null
    let unsubPayments: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false)
        return
      }

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) {
        setLoading(false)
        return
      }
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)

      // Load business settings
      const settingsDoc = await getDoc(doc(db, 'business_settings', 'config'))
      if (settingsDoc.exists()) setSettings(settingsDoc.data() as BusinessSettings)

      // Real-time rental doc
      unsubRental = onSnapshot(doc(db, 'rentals', rentalId), (snapshot) => {
        if (snapshot.exists()) {
          setRental({ id: snapshot.id, ...snapshot.data() } as Rental)
        } else {
          setRental(null)
        }
        setLoading(false)
      })

      // Real-time payments
      const paymentsQuery = query(collection(db, 'payments'), where('rental_id', '==', rentalId))
      unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Payment[]
        data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setPayments(data)
      })
    })

    return () => {
      unsubAuth()
      if (unsubRental) unsubRental()
      if (unsubPayments) unsubPayments()
    }
  }, [rentalId])

  // ==================== Computed Values ====================

  const grandTotal = rental
    ? rental.total_amount + (rental.late_fee || 0) + (rental.damage_fee || 0)
    : 0

  const remainingBalance = rental ? grandTotal - rental.amount_paid : 0

  const currentStepIndex = rental
    ? TIMELINE_STEPS.findIndex((s) => s.key === rental.status)
    : -1

  const isCancelled = rental?.status === 'cancelled'
  const isOverdue = rental?.status === 'overdue'
  const isCompleted = rental?.status === 'completed'

  const canCancel = rental
    ? ['quotation', 'pending_confirmation', 'confirmed', 'agreement_signed', 'invoiced', 'paid'].includes(rental.status)
    : false

  // ==================== Status Advance Handlers ====================

  const handleAdvanceStatus = async () => {
    if (!rental || !user) return

    const action = statusActions[rental.status]
    if (!action) return

    // For statuses that need modals, open them instead
    if (rental.status === 'invoiced') {
      setPaymentForm({
        amount: remainingBalance > 0 ? remainingBalance : rental.total_amount,
        payment_method: 'cash',
        reference_number: '',
        notes: '',
      })
      setShowPaymentModal(true)
      return
    }

    if (rental.status === 'returned') {
      setInspectionItems(
        rental.items.map((item) => ({
          equipment_name: item.equipment_name,
          condition_in: 'good',
          notes: '',
        }))
      )
      setInspectionDamageFee(0)
      setInspectionDamageNotes('')
      setShowInspectionModal(true)
      return
    }

    setActionLoading(true)

    try {
      const now = new Date().toISOString()
      const updateData: Record<string, unknown> = {
        status: action.nextStatus,
        updated_at: now,
      }

      // Special handling per status
      if (action.nextStatus === 'agreement_signed') {
        updateData.terms_accepted = true
        updateData.terms_accepted_at = now
      }

      if (action.nextStatus === 'invoiced') {
        // Create invoice doc
        const invoicesSnapshot = await getDocs(collection(db, 'invoices'))
        const existingNumbers = invoicesSnapshot.docs.map(
          (d) => (d.data() as Invoice).invoice_number
        )
        const invoiceNumber = await generateDocNumber('INV', existingNumbers)

        const invoiceData: Omit<Invoice, 'id'> = {
          invoice_number: invoiceNumber,
          rental_id: rental.id,
          rental_number: rental.rental_number,
          customer_id: rental.customer_id,
          customer_name: rental.customer_name,
          customer_email: rental.customer_email,
          items: rental.items.map((item) => ({
            equipment_name: item.equipment_name,
            daily_rate: item.daily_rate,
            quantity: item.quantity,
            days: item.days,
            subtotal: item.subtotal,
          })),
          subtotal: rental.subtotal,
          discount_amount: rental.discount_amount,
          tax_amount: rental.tax_amount,
          total_amount: rental.total_amount,
          deposit_amount: rental.deposit_amount,
          late_fee: rental.late_fee || 0,
          damage_fee: rental.damage_fee || 0,
          grand_total: rental.total_amount,
          status: 'sent',
          due_date: rental.rental_start,
          paid_amount: 0,
          notes: '',
          created_by: user.id,
          created_at: now,
          updated_at: now,
        }

        const invoiceRef = await addDoc(collection(db, 'invoices'), invoiceData)
        updateData.invoice_id = invoiceRef.id
      }

      if (action.nextStatus === 'returned') {
        updateData.actual_return_date = now
        // Calculate late fee if overdue
        const lateDays = calculateLateDays(rental.rental_end, now)
        if (lateDays > 0) {
          // Use a default late fee of RM 50/day if not specified
          const lateFeePerDay = 50
          updateData.late_fee = lateDays * lateFeePerDay
        }
      }

      if (action.nextStatus === 'completed') {
        // Process deposit: refund amount = deposit - damage_fee
        const damageFee = rental.damage_fee || 0
        const depositRefund = Math.max(rental.deposit_amount - damageFee, 0)
        updateData.deposit_refund_amount = depositRefund

        if (damageFee >= rental.deposit_amount) {
          updateData.deposit_status = 'forfeited'
        } else if (damageFee > 0) {
          updateData.deposit_status = 'partially_refunded'
        } else {
          updateData.deposit_status = 'refunded'
        }
      }

      await updateDoc(doc(db, 'rentals', rental.id), updateData)
    } catch (err) {
      console.error('Error advancing status:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // ==================== Payment Submit ====================

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rental || !user) return

    setActionLoading(true)

    try {
      const now = new Date().toISOString()

      // Generate receipt number
      const paymentsSnapshot = await getDocs(collection(db, 'payments'))
      const existingNumbers = paymentsSnapshot.docs.map(
        (d) => (d.data() as Payment).receipt_number
      )
      const receiptNumber = await generateDocNumber('RCP', existingNumbers)

      // Create payment doc
      const paymentData: Omit<Payment, 'id'> = {
        receipt_number: receiptNumber,
        rental_id: rental.id,
        invoice_id: rental.invoice_id || '',
        customer_id: rental.customer_id,
        customer_name: rental.customer_name,
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method as Payment['payment_method'],
        payment_type: 'rental',
        reference_number: paymentForm.reference_number || '',
        notes: paymentForm.notes,
        created_by: user.id,
        created_at: now,
      }

      await addDoc(collection(db, 'payments'), paymentData)

      // Update rental
      const newAmountPaid = rental.amount_paid + paymentForm.amount
      const newPaymentStatus =
        newAmountPaid >= rental.total_amount ? 'paid' : 'partial'

      const rentalUpdate: Record<string, unknown> = {
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
        payment_method: paymentForm.payment_method,
        updated_at: now,
      }

      // Only advance to 'paid' status if fully paid
      if (newAmountPaid >= rental.total_amount) {
        rentalUpdate.status = 'paid'
      }

      await updateDoc(doc(db, 'rentals', rental.id), rentalUpdate)

      // Update invoice if exists
      if (rental.invoice_id) {
        const invoiceUpdate: Record<string, unknown> = {
          paid_amount: newAmountPaid,
          payment_date: now,
          payment_method: paymentForm.payment_method,
          updated_at: now,
        }
        if (newAmountPaid >= rental.total_amount) {
          invoiceUpdate.status = 'paid'
        } else {
          invoiceUpdate.status = 'partial'
        }
        await updateDoc(doc(db, 'invoices', rental.invoice_id), invoiceUpdate)
      }

      setShowPaymentModal(false)
    } catch (err) {
      console.error('Error recording payment:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // ==================== Inspection Submit ====================

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rental || !user) return

    setActionLoading(true)

    try {
      const now = new Date().toISOString()

      // Update items with condition_in values
      const updatedItems = rental.items.map((item, index) => ({
        ...item,
        condition_in: inspectionItems[index]?.condition_in || 'good',
        condition_notes_in: inspectionItems[index]?.notes || '',
      }))

      await updateDoc(doc(db, 'rentals', rental.id), {
        status: 'inspected',
        items: updatedItems,
        damage_fee: inspectionDamageFee,
        damage_notes: inspectionDamageNotes,
        updated_at: now,
      })

      setShowInspectionModal(false)
    } catch (err) {
      console.error('Error saving inspection:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // ==================== Cancel Rental ====================

  const handleCancel = async () => {
    if (!rental || !user) return

    setActionLoading(true)

    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      setShowCancelConfirm(false)
    } catch (err) {
      console.error('Error cancelling rental:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // ==================== Save Notes ====================

  const handleSaveNotes = async () => {
    if (!rental) return
    setSavingNotes(true)

    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        notes: notesValue,
        updated_at: new Date().toISOString(),
      })
      setEditingNotes(false)
    } catch (err) {
      console.error('Error saving notes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  // ==================== PDF Exports ====================

  const handleExportAgreement = () => { if (rental) exportAgreementPDF(rental, settings) }
  const handleExportReturnChecklist = () => { if (rental) exportReturnChecklistPDF(rental, settings) }
  const handleExportInvoice = async () => {
    if (!rental?.invoice_id) return
    const invDoc = await getDoc(doc(db, 'invoices', rental.invoice_id))
    if (invDoc.exists()) exportInvoicePDF({ id: invDoc.id, ...invDoc.data() } as Invoice, rental, settings)
  }
  const handleExportReceipt = (payment: Payment) => { if (rental) exportReceiptPDF(payment, rental, settings) }

  // ==================== Loading State ====================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  // ==================== Not Found ====================

  if (!rental) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Package className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 font-medium">Rental not found</p>
        <button
          onClick={() => router.push('/rentals')}
          className="text-sm text-neutral-900 hover:text-neutral-800 font-medium"
        >
          Back to Rentals
        </button>
      </div>
    )
  }

  // ==================== Render ====================

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* ==================== Header ==================== */}
      <div>
        <button
          onClick={() => router.push('/rentals')}
          className="text-sm text-slate-500 hover:text-neutral-900 flex items-center gap-1 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rentals
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">
                {rental.rental_number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  RENTAL_STATUS_COLORS[rental.status]
                }`}
              >
                {RENTAL_STATUS_LABELS[rental.status]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">
                {rental.customer_name}
              </span>
              {rental.customer_phone && (
                <span>{rental.customer_phone}</span>
              )}
              {rental.customer_email && (
                <span>{rental.customer_email}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExportAgreement} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1"><Download className="w-3 h-3" /> Agreement</button>
            {rental.invoice_id && <button onClick={handleExportInvoice} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1"><Download className="w-3 h-3" /> Invoice</button>}
            {['returned', 'inspected', 'completed'].includes(rental.status) && <button onClick={handleExportReturnChecklist} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1"><Download className="w-3 h-3" /> Return Checklist</button>}
          </div>
        </div>
      </div>

      {/* ==================== Rental Timeline ==================== */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Rental Progress
        </h2>

        <div className="overflow-x-auto">
          <div className="flex items-center min-w-[700px] px-2">
            {TIMELINE_STEPS.map((step, index) => {
              const stepIndex = index
              let stepState: 'completed' | 'current' | 'future' | 'cancelled' | 'overdue' = 'future'

              if (isCancelled) {
                stepState = 'cancelled'
              } else if (isOverdue && step.key === 'active') {
                stepState = 'overdue'
              } else if (stepIndex < currentStepIndex) {
                stepState = 'completed'
              } else if (stepIndex === currentStepIndex) {
                stepState = 'current'
              }

              const isLast = index === TIMELINE_STEPS.length - 1

              return (
                <div key={step.key} className="flex items-center flex-1">
                  {/* Step circle + label */}
                  <div className="flex flex-col items-center">
                    {stepState === 'completed' ? (
                      <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    ) : stepState === 'current' ? (
                      <div className="w-7 h-7 rounded-full border-[3px] border-neutral-900 bg-white flex items-center justify-center animate-pulse">
                        <div className="w-2.5 h-2.5 rounded-full bg-neutral-900" />
                      </div>
                    ) : stepState === 'overdue' ? (
                      <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                    ) : stepState === 'cancelled' ? (
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                        <XCircle className="w-4 h-4 text-slate-400" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center">
                        <Circle className="w-3 h-3 text-slate-300" />
                      </div>
                    )}
                    <span
                      className={`mt-1.5 text-[10px] font-medium text-center leading-tight ${
                        stepState === 'completed' || stepState === 'current'
                          ? 'text-neutral-900'
                          : stepState === 'overdue'
                          ? 'text-red-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      className={`flex-1 h-0.5 mx-1 mt-[-16px] ${
                        stepIndex < currentStepIndex
                          ? 'bg-neutral-900'
                          : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Overdue indicator */}
        {isOverdue && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">
              This rental is overdue. Equipment was due on{' '}
              {formatDate(rental.rental_end)}.
            </span>
          </div>
        )}

        {/* Cancelled indicator */}
        {isCancelled && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <XCircle className="w-4 h-4" />
            <span className="font-medium">This rental has been cancelled.</span>
          </div>
        )}
      </div>

      {/* ==================== Equipment Table ==================== */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Equipment
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-3 px-4 font-medium text-slate-600 rounded-l-lg">
                  Equipment
                </th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">
                  Serial No
                </th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">
                  Qty
                </th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">
                  Days
                </th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">
                  Rate
                </th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">
                  Subtotal
                </th>
                <th className="text-center py-3 px-4 font-medium text-slate-600">
                  Condition Out
                </th>
                <th className="text-center py-3 px-4 font-medium text-slate-600 rounded-r-lg">
                  Condition In
                </th>
              </tr>
            </thead>
            <tbody>
              {rental.items.map((item, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {item.equipment_name}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {item.serial_number}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">
                    {item.days}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {formatCurrency(item.daily_rate)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-slate-800">
                    {formatCurrency(item.subtotal)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-50 text-neutral-800 capitalize">
                      {item.condition_out?.replace('_', ' ') || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.condition_in ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium capitalize ${
                          item.condition_in === 'damaged'
                            ? 'bg-red-100 text-red-700'
                            : item.condition_in === 'excellent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.condition_in === 'good'
                            ? 'bg-neutral-100 text-neutral-800'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.condition_in.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== Pricing Breakdown + Actions ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pricing Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Pricing Breakdown
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-800 font-medium">
                {formatCurrency(rental.subtotal)}
              </span>
            </div>

            {rental.discount_amount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Discount
                  {rental.discount_type === 'percentage' && rental.discount_value
                    ? ` (${rental.discount_value}%)`
                    : ''}
                </span>
                <span className="text-emerald-600 font-medium">
                  -{formatCurrency(rental.discount_amount)}
                </span>
              </div>
            )}

            {rental.tax_amount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Tax ({rental.tax_rate}%)
                </span>
                <span className="text-slate-800 font-medium">
                  {formatCurrency(rental.tax_amount)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
              <span className="text-slate-700 font-semibold">Total Amount</span>
              <span className="text-slate-800 font-bold text-base">
                {formatCurrency(rental.total_amount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2">
                Deposit
                <span
                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    DEPOSIT_STATUS_COLORS[rental.deposit_status] ||
                    'bg-slate-100 text-slate-600'
                  }`}
                >
                  {DEPOSIT_STATUS_LABELS[rental.deposit_status] ||
                    rental.deposit_status}
                </span>
              </span>
              <span className="text-slate-800 font-medium">
                {formatCurrency(rental.deposit_amount)}
              </span>
            </div>

            {(rental.late_fee ?? 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-500">Late Fee</span>
                <span className="text-red-600 font-medium">
                  {formatCurrency(rental.late_fee || 0)}
                </span>
              </div>
            )}

            {(rental.damage_fee ?? 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-500">Damage Fee</span>
                <span className="text-red-600 font-medium">
                  {formatCurrency(rental.damage_fee || 0)}
                </span>
              </div>
            )}

            {((rental.late_fee ?? 0) > 0 || (rental.damage_fee ?? 0) > 0) && (
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
                <span className="text-slate-700 font-semibold">Grand Total</span>
                <span className="text-slate-900 font-bold text-lg">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2">
                Amount Paid
                <span
                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    PAYMENT_STATUS_COLORS[rental.payment_status] ||
                    'bg-slate-100 text-slate-600'
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[rental.payment_status] ||
                    rental.payment_status}
                </span>
              </span>
              <span className="text-emerald-600 font-bold">
                {formatCurrency(rental.amount_paid)}
              </span>
            </div>

            {remainingBalance > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Remaining Balance</span>
                <span className="text-red-600 font-bold">
                  {formatCurrency(remainingBalance)}
                </span>
              </div>
            )}

            {rental.deposit_refund_amount !== undefined && rental.deposit_refund_amount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Deposit Refund</span>
                <span className="text-emerald-600 font-medium">
                  {formatCurrency(rental.deposit_refund_amount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Actions</h2>

          {/* Primary action */}
          {statusActions[rental.status] && !isCancelled && !isCompleted && (
            <button
              onClick={handleAdvanceStatus}
              disabled={actionLoading}
              className={`w-full py-3 px-4 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${
                statusActions[rental.status].color
              } hover:opacity-90`}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {statusActions[rental.status].label}
            </button>
          )}

          {/* Cancel button */}
          {canCancel && !isCancelled && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={actionLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Cancel Rental
            </button>
          )}

          {/* Status info for terminal states */}
          {isCompleted && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg px-4 py-3">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Rental Completed</span>
            </div>
          )}

          {isCancelled && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Rental Cancelled</span>
            </div>
          )}

          {/* Quick info */}
          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Created</span>
              <span className="text-slate-700">{formatDateTime(rental.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated</span>
              <span className="text-slate-700">{formatDateTime(rental.updated_at)}</span>
            </div>
            {rental.actual_return_date && (
              <div className="flex justify-between">
                <span>Returned</span>
                <span className="text-slate-700">
                  {formatDateTime(rental.actual_return_date)}
                </span>
              </div>
            )}
            {rental.terms_accepted && rental.terms_accepted_at && (
              <div className="flex justify-between">
                <span>Terms Accepted</span>
                <span className="text-slate-700">
                  {formatDateTime(rental.terms_accepted_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== Payment History ==================== */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Payment History
        </h2>

        {payments.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No payments recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 rounded-l-lg">
                    Receipt No
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">
                    Method
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 rounded-r-lg">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      {payment.receipt_number}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">
                      {PAYMENT_METHODS.find((m) => m.value === payment.payment_method)?.label ||
                        payment.payment_method}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 capitalize">
                        {payment.payment_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {formatDateTime(payment.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleExportReceipt(payment)} className="text-xs text-neutral-900 hover:underline flex items-center gap-1"><Download className="w-3 h-3" /> PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== Notes Section ==================== */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Notes
          </h2>
          {!editingNotes && (
            <button
              onClick={() => {
                setNotesValue(rental.notes || '')
                setEditingNotes(true)
              }}
              className="text-xs text-neutral-900 hover:text-neutral-800 font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="space-y-3">
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
              placeholder="Add rental notes..."
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setEditingNotes(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-4 py-1.5 text-xs bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 whitespace-pre-wrap">
            {rental.notes || 'No notes added.'}
          </p>
        )}

        {/* Damage notes */}
        {rental.damage_notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-red-600 mb-1">Damage Notes</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {rental.damage_notes}
            </p>
          </div>
        )}
      </div>

      {/* ==================== Record Payment Modal ==================== */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !actionLoading && setShowPaymentModal(false)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Record Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={actionLoading}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (RM) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount || ''}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Remaining balance: {formatCurrency(remainingBalance > 0 ? remainingBalance : 0)}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      payment_method: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                  required
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reference Number{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      reference_number: e.target.value,
                    })
                  }
                  placeholder="Transaction reference or receipt number"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="Additional payment notes..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || paymentForm.amount <= 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-600/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Inspection Modal ==================== */}
      {showInspectionModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !actionLoading && setShowInspectionModal(false)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                Equipment Inspection
              </h2>
              <button
                onClick={() => setShowInspectionModal(false)}
                disabled={actionLoading}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={handleInspectionSubmit}
              className="p-5 space-y-5 max-h-[70vh] overflow-y-auto"
            >
              {/* Per-item inspection */}
              {inspectionItems.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50 rounded-xl space-y-3"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {item.equipment_name}
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Condition In *
                    </label>
                    <select
                      value={item.condition_in}
                      onChange={(e) => {
                        const updated = [...inspectionItems]
                        updated[index] = {
                          ...updated[index],
                          condition_in: e.target.value,
                        }
                        setInspectionItems(updated)
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                      required
                    >
                      {CONDITION_IN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={item.notes}
                      onChange={(e) => {
                        const updated = [...inspectionItems]
                        updated[index] = {
                          ...updated[index],
                          notes: e.target.value,
                        }
                        setInspectionItems(updated)
                      }}
                      rows={2}
                      placeholder="Condition notes for this item..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                    />
                  </div>
                </div>
              ))}

              {/* Damage Fee */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Damage Fee (RM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inspectionDamageFee || ''}
                  onChange={(e) =>
                    setInspectionDamageFee(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                />
              </div>

              {/* Damage Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Damage Notes
                </label>
                <textarea
                  value={inspectionDamageNotes}
                  onChange={(e) => setInspectionDamageNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe any damage found..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInspectionModal(false)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-600/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Cancel Confirmation Modal ==================== */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !actionLoading && setShowCancelConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">
                Cancel Rental
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to cancel rental{' '}
                <span className="font-semibold text-slate-700">
                  {rental.rental_number}
                </span>
                ? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Keep Rental
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cancel Rental
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
