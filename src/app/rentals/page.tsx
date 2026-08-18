'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore'
import { Search, Plus, CalendarCheck, Eye, Loader2, X, Calendar, Package, Trash2 } from 'lucide-react'
import type { User, Rental, Customer, Equipment, RentalItem } from '@/types'
import { RENTAL_STATUS_LABELS, RENTAL_STATUS_COLORS } from '@/lib/constants'
import { formatCurrency, formatDate, calculateDays, generateDocNumber, calculateSubtotal, calculateDiscount } from '@/lib/utils'

// ==================== Payment status badge colors ====================

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  refunded: 'bg-purple-100 text-purple-700',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  refunded: 'Refunded',
}

// ==================== Filter tab definitions ====================

type StatusTab = 'all' | 'pending' | 'confirmed' | 'active' | 'overdue' | 'returned' | 'completed' | 'cancelled'

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'returned', label: 'Returned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// ==================== Empty rental item builder row ====================

interface RentalItemRow {
  equipment_id: string
  equipment_name: string
  serial_number: string
  daily_rate: number
  quantity: number
  days: number
  subtotal: number
}

const emptyItemRow: RentalItemRow = {
  equipment_id: '',
  equipment_name: '',
  serial_number: '',
  daily_rate: 0,
  quantity: 1,
  days: 1,
  subtotal: 0,
}

// ==================== Main Page Component ====================

export default function RentalsPage() {
  const router = useRouter()

  // Auth & data state
  const [user, setUser] = useState<User | null>(null)
  const [rentals, setRentals] = useState<Rental[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)

  // Search & filter state
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Create form state
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formRentalStart, setFormRentalStart] = useState('')
  const [formRentalEnd, setFormRentalEnd] = useState('')
  const [formItems, setFormItems] = useState<RentalItemRow[]>([{ ...emptyItemRow }])
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'fixed' | ''>('')
  const [formDiscountValue, setFormDiscountValue] = useState<number>(0)
  const [formNotes, setFormNotes] = useState('')
  const [formDeposit, setFormDeposit] = useState(0)

  // ==================== Auth + Real-time Listeners ====================

  useEffect(() => {
    let unsubRentals: (() => void) | null = null
    let unsubCustomers: (() => void) | null = null
    let unsubEquipment: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)

      // Real-time rentals
      unsubRentals = onSnapshot(collection(db, 'rentals'), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Rental[]
        data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setRentals(data)
        setLoading(false)
      })

      // Real-time customers
      unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]
        data.sort((a, b) => a.name.localeCompare(b.name))
        setCustomers(data)
      })

      // Real-time equipment
      unsubEquipment = onSnapshot(collection(db, 'equipment'), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Equipment[]
        data.sort((a, b) => a.name.localeCompare(b.name))
        setEquipment(data)
      })
    })

    return () => {
      unsubAuth()
      if (unsubRentals) unsubRentals()
      if (unsubCustomers) unsubCustomers()
      if (unsubEquipment) unsubEquipment()
    }
  }, [])

  // ==================== Filtering Logic ====================

  const filteredRentals = useMemo(() => {
    let result = rentals

    // Status tab filter
    if (statusTab !== 'all') {
      result = result.filter((r) => {
        switch (statusTab) {
          case 'pending':
            return r.status === 'pending_confirmation' || r.status === 'confirmed' || r.status === 'agreement_signed'
          case 'confirmed':
            return r.status === 'confirmed'
          case 'active':
            return r.status === 'active' || r.status === 'equipment_out' || r.status === 'paid'
          case 'overdue':
            return r.status === 'overdue'
          case 'returned':
            return r.status === 'returned' || r.status === 'inspected'
          case 'completed':
            return r.status === 'completed'
          case 'cancelled':
            return r.status === 'cancelled'
          default:
            return true
        }
      })
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(
        (r) =>
          r.rental_number.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q)
      )
    }

    return result
  }, [rentals, statusTab, search])

  // ==================== Computed Days for Form ====================

  const formDays = useMemo(() => {
    if (!formRentalStart || !formRentalEnd) return 1
    return calculateDays(formRentalStart, formRentalEnd)
  }, [formRentalStart, formRentalEnd])

  // ==================== Items auto-calculation ====================

  const updateItemRow = (index: number, field: keyof RentalItemRow, value: string | number) => {
    setFormItems((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }

      if (field === 'equipment_id') {
        const eq = equipment.find((e) => e.id === value)
        if (eq) {
          row.equipment_id = eq.id
          row.equipment_name = eq.name
          row.serial_number = eq.serial_number
          row.daily_rate = eq.daily_rate
          row.days = formDays
          row.subtotal = eq.daily_rate * row.quantity * formDays
        } else {
          row.equipment_id = ''
          row.equipment_name = ''
          row.serial_number = ''
          row.daily_rate = 0
          row.subtotal = 0
        }
      } else if (field === 'quantity') {
        row.quantity = Math.max(1, Number(value))
        row.subtotal = row.daily_rate * row.quantity * row.days
      } else if (field === 'daily_rate') {
        row.daily_rate = Number(value)
        row.subtotal = row.daily_rate * row.quantity * row.days
      }

      updated[index] = row
      return updated
    })
  }

  // Recalculate days in all items whenever dates change
  useEffect(() => {
    if (!formRentalStart || !formRentalEnd) return
    const days = calculateDays(formRentalStart, formRentalEnd)
    setFormItems((prev) =>
      prev.map((item) => ({
        ...item,
        days,
        subtotal: item.daily_rate * item.quantity * days,
      }))
    )
  }, [formRentalStart, formRentalEnd])

  const addItemRow = () => {
    setFormItems((prev) => [...prev, { ...emptyItemRow, days: formDays }])
  }

  const removeItemRow = (index: number) => {
    setFormItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  // ==================== Form Totals ====================

  const formSubtotal = useMemo(() => calculateSubtotal(formItems), [formItems])

  const formDiscountAmount = useMemo(
    () =>
      calculateDiscount(
        formSubtotal,
        formDiscountType === '' ? undefined : formDiscountType,
        formDiscountValue || undefined
      ),
    [formSubtotal, formDiscountType, formDiscountValue]
  )

  const formTotal = useMemo(() => Math.max(0, formSubtotal - formDiscountAmount), [formSubtotal, formDiscountAmount])

  // Auto-fill deposit from equipment when items change
  useEffect(() => {
    if (!showCreateModal) return
    const auto = formItems.reduce((sum, item) => {
      const eq = equipment.find((e) => e.id === item.equipment_id)
      return sum + (eq?.deposit_amount || 0) * item.quantity
    }, 0)
    setFormDeposit(auto)
  }, [formItems, equipment, showCreateModal])

  // ==================== Open / Close Modal ====================

  const openCreateModal = () => {
    setFormCustomerId('')
    setFormRentalStart('')
    setFormRentalEnd('')
    setFormItems([{ ...emptyItemRow }])
    setFormDiscountType('')
    setFormDiscountValue(0)
    setFormNotes('')
    setFormDeposit(0)
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
  }

  // ==================== Create Rental Handler ====================

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!formCustomerId) return
    if (!formRentalStart || !formRentalEnd) return
    if (formItems.every((item) => !item.equipment_id)) return

    setSaving(true)

    try {
      const customer = customers.find((c) => c.id === formCustomerId)
      if (!customer) return

      const now = new Date().toISOString()

      // Generate rental number
      const existingNumbers = rentals.map((r) => r.rental_number)
      const rentalNumber = await generateDocNumber('RNT', existingNumbers)

      // Build items array (only items with selected equipment)
      const validItems: RentalItem[] = formItems
        .filter((item) => item.equipment_id)
        .map((item) => ({
          equipment_id: item.equipment_id,
          equipment_name: item.equipment_name,
          serial_number: item.serial_number,
          daily_rate: item.daily_rate,
          quantity: item.quantity,
          days: item.days,
          subtotal: item.subtotal,
          condition_out: 'good' as const,
        }))

      const rentalData: Omit<Rental, 'id'> = {
        rental_number: rentalNumber,
        customer_id: formCustomerId,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        items: validItems,
        rental_start: formRentalStart,
        rental_end: formRentalEnd,
        subtotal: formSubtotal,
        discount_type: formDiscountType === '' ? undefined : formDiscountType,
        discount_value: formDiscountValue || undefined,
        discount_amount: formDiscountAmount,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: formTotal,
        deposit_amount: formDeposit,
        deposit_status: 'pending',
        status: 'pending_confirmation',
        payment_status: 'unpaid',
        amount_paid: 0,
        notes: formNotes,
        terms_accepted: false,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      }

      await addDoc(collection(db, 'rentals'), rentalData)
      closeCreateModal()
    } catch (err) {
      console.error('Error creating rental:', err)
    } finally {
      setSaving(false)
    }
  }

  // ==================== Available equipment (not already selected in another row) ====================

  const getAvailableEquipment = (currentIndex: number) => {
    const selectedIds = formItems
      .filter((_, i) => i !== currentIndex)
      .map((item) => item.equipment_id)
      .filter(Boolean)
    return equipment.filter((eq) => !selectedIds.includes(eq.id))
  }

  // ==================== Loading State ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rentals</h1>
          <p className="text-sm text-slate-500 mt-1">{rentals.length} total rentals</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-lg shadow-neutral-900/20 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Rental
        </button>
      </div>

      {/* Search & Filter Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by rental number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusTab === tab.value
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rental List */}
      {filteredRentals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarCheck className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No rentals yet</p>
          <p className="text-sm text-slate-400 mt-1">
            {search || statusTab !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Create your first rental to get started'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredRentals.map((rental) => (
            <div
              key={rental.id}
              onClick={() => router.push(`/rentals/${rental.id}`)}
              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Left: Main info */}
                <div className="flex-1 min-w-0">
                  {/* Rental number + badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800">{rental.rental_number}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        RENTAL_STATUS_COLORS[rental.status] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {RENTAL_STATUS_LABELS[rental.status] || rental.status}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        PAYMENT_STATUS_COLORS[rental.payment_status] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[rental.payment_status] || rental.payment_status}
                    </span>
                  </div>

                  {/* Customer info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{rental.customer_name}</span>
                    <span>{rental.customer_phone}</span>
                  </div>

                  {/* Rental period + items count */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(rental.rental_start)} &rarr; {formatDate(rental.rental_end)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {rental.items.length} item{rental.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Created date */}
                  <p className="text-xs text-slate-400 mt-1.5">
                    Created {formatDate(rental.created_at)}
                  </p>
                </div>

                {/* Right: Amount + action */}
                <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(rental.total_amount)}</p>
                    <p className="text-xs text-slate-400">
                      Deposit: {formatCurrency(rental.deposit_amount)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/rentals/${rental.id}`)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-900 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Detail
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== Create Rental Modal ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeCreateModal} />
          <div className="relative bg-white rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-800">Create Rental</h2>
              <button
                onClick={closeCreateModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateRental} className="p-6 space-y-6">
              {/* Customer Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                  required
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rental Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rental Start *</label>
                  <input
                    type="date"
                    value={formRentalStart}
                    onChange={(e) => setFormRentalStart(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rental End *</label>
                  <input
                    type="date"
                    value={formRentalEnd}
                    onChange={(e) => setFormRentalEnd(e.target.value)}
                    min={formRentalStart || undefined}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    required
                  />
                </div>
              </div>

              {formRentalStart && formRentalEnd && (
                <p className="text-xs text-slate-500 -mt-3">
                  Rental duration: <span className="font-semibold text-slate-700">{formDays} day{formDays !== 1 ? 's' : ''}</span>
                </p>
              )}

              {/* Equipment Items Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Equipment Items *</label>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 hover:text-neutral-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formItems.map((item, index) => (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Item #{index + 1}</span>
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Equipment Selector */}
                      <select
                        value={item.equipment_id}
                        onChange={(e) => updateItemRow(index, 'equipment_id', e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                      >
                        <option value="">Select equipment...</option>
                        {getAvailableEquipment(index).map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.name} ({eq.serial_number}) - {formatCurrency(eq.daily_rate)}/day
                          </option>
                        ))}
                      </select>

                      {item.equipment_id && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Rate/Day (RM)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.daily_rate || ''}
                              onChange={(e) => updateItemRow(index, 'daily_rate', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Subtotal</label>
                            <div className="px-3 py-2 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700">
                              {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discount</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value as 'percentage' | 'fixed' | '')}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                  >
                    <option value="">No discount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (RM)</option>
                  </select>
                  {formDiscountType && (
                    <input
                      type="number"
                      min="0"
                      step={formDiscountType === 'percentage' ? '1' : '0.01'}
                      max={formDiscountType === 'percentage' ? '100' : undefined}
                      placeholder={formDiscountType === 'percentage' ? 'e.g. 10' : 'e.g. 50.00'}
                      value={formDiscountValue || ''}
                      onChange={(e) => setFormDiscountValue(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional notes for this rental..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-700">{formatCurrency(formSubtotal)}</span>
                </div>
                {formDiscountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Discount
                      {formDiscountType === 'percentage' ? ` (${formDiscountValue}%)` : ''}
                    </span>
                    <span className="font-medium text-red-600">-{formatCurrency(formDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-800">Total</span>
                  <span className="text-lg font-bold text-slate-800">{formatCurrency(formTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Deposit</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formDeposit}
                    onChange={(e) => setFormDeposit(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-32 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formCustomerId || !formRentalStart || !formRentalEnd || formItems.every((i) => !i.equipment_id)}
                  className="flex-1 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-lg shadow-neutral-900/20 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Rental
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
