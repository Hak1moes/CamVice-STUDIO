'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import type { User, Quotation, QuotationItem, Customer, Equipment } from '@/types'
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from '@/lib/constants'
import { formatCurrency, formatDate, calculateDays, generateDocNumber, calculateSubtotal, calculateDiscount, calculateTax } from '@/lib/utils'
import {
  Search,
  Plus,
  X,
  Trash2,
  Edit3,
  Send,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  FileText,
  Loader2,
  Calendar,
  Package,
  MoreVertical,
  ChevronDown,
} from 'lucide-react'

type QuotationStatus = Quotation['status']

const STATUS_TABS: { value: QuotationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
]

interface FormItem {
  equipment_id: string
  equipment_name: string
  daily_rate: number
  deposit_amount: number
  quantity: number
  days: number
  subtotal: number
}

interface FormData {
  customer_id: string
  rental_start: string
  rental_end: string
  valid_until: string
  items: FormItem[]
  discount_type: 'percentage' | 'fixed' | ''
  discount_value: number
  tax_rate: number
  notes: string
}

const emptyFormItem: FormItem = {
  equipment_id: '',
  equipment_name: '',
  daily_rate: 0,
  deposit_amount: 0,
  quantity: 1,
  days: 0,
  subtotal: 0,
}

const initialFormData: FormData = {
  customer_id: '',
  rental_start: '',
  rental_end: '',
  valid_until: '',
  items: [],
  discount_type: '',
  discount_value: 0,
  tax_rate: 0,
  notes: '',
}

export default function QuotationsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all')

  const [showModal, setShowModal] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [saving, setSaving] = useState(false)

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() } as User)
        }
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Realtime listeners
  useEffect(() => {
    const unsubQuotations = onSnapshot(collection(db, 'quotations'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quotation))
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setQuotations(data)
    })

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer))
      setCustomers(data)
    })

    const unsubEquipment = onSnapshot(collection(db, 'equipment'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Equipment))
      setEquipment(data)
    })

    return () => {
      unsubQuotations()
      unsubCustomers()
      unsubEquipment()
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setActiveDropdown(null)
    if (activeDropdown) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [activeDropdown])

  const availableEquipment = useMemo(
    () => equipment.filter((e) => e.status === 'available'),
    [equipment]
  )

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        !searchQuery ||
        q.quotation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [quotations, searchQuery, statusFilter])

  // Auto-calculate days when dates change
  const computedDays = useMemo(() => {
    if (formData.rental_start && formData.rental_end) {
      return calculateDays(formData.rental_start, formData.rental_end)
    }
    return 0
  }, [formData.rental_start, formData.rental_end])

  // Recalculate items when dates change
  useEffect(() => {
    if (computedDays > 0 && formData.items.length > 0) {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({
          ...item,
          days: computedDays,
          subtotal: item.quantity * computedDays * item.daily_rate,
        })),
      }))
    }
  }, [computedDays])

  // Summary calculations
  const summary = useMemo(() => {
    const subtotal = calculateSubtotal(formData.items)
    const discountType = formData.discount_type || undefined
    const discountValue = formData.discount_value || undefined
    const discountAmount = calculateDiscount(subtotal, discountType as 'percentage' | 'fixed' | undefined, discountValue)
    const afterDiscount = subtotal - discountAmount
    const taxAmount = calculateTax(afterDiscount, formData.tax_rate)
    const totalAmount = afterDiscount + taxAmount
    const depositAmount = formData.items.reduce((sum, item) => sum + item.deposit_amount * item.quantity, 0)
    return { subtotal, discountAmount, taxAmount, totalAmount, depositAmount }
  }, [formData.items, formData.discount_type, formData.discount_value, formData.tax_rate])

  const getCustomerById = useCallback(
    (id: string) => customers.find((c) => c.id === id),
    [customers]
  )

  // Open modal for create
  const handleCreate = () => {
    setEditingQuotation(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  // Open modal for edit
  const handleEdit = (quotation: Quotation) => {
    setEditingQuotation(quotation)
    setFormData({
      customer_id: quotation.customer_id,
      rental_start: quotation.rental_start,
      rental_end: quotation.rental_end,
      valid_until: quotation.valid_until,
      items: quotation.items.map((item) => {
        const eq = equipment.find((e) => e.id === item.equipment_id)
        return {
          ...item,
          deposit_amount: eq?.deposit_amount ?? 0,
        }
      }),
      discount_type: quotation.discount_type || '',
      discount_value: quotation.discount_value || 0,
      tax_rate: quotation.tax_rate,
      notes: quotation.notes,
    })
    setShowModal(true)
  }

  // Add item row
  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyFormItem, days: computedDays }],
    }))
  }

  // Remove item row
  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  // Update item row
  const handleItemChange = (index: number, field: string, value: string | number) => {
    setFormData((prev) => {
      const newItems = [...prev.items]
      const item = { ...newItems[index] }

      if (field === 'equipment_id') {
        const eq = availableEquipment.find((e) => e.id === value)
        if (eq) {
          item.equipment_id = eq.id
          item.equipment_name = `${eq.brand} ${eq.model} - ${eq.name}`
          item.daily_rate = eq.daily_rate
          item.deposit_amount = eq.deposit_amount
          item.subtotal = item.quantity * item.days * eq.daily_rate
        }
      } else if (field === 'quantity') {
        item.quantity = Math.max(1, Number(value))
        item.subtotal = item.quantity * item.days * item.daily_rate
      } else if (field === 'daily_rate') {
        item.daily_rate = Math.max(0, Number(value))
        item.subtotal = item.quantity * item.days * item.daily_rate
      }

      newItems[index] = item
      return { ...prev, items: newItems }
    })
  }

  // Save quotation
  const handleSave = async () => {
    if (!user) return
    if (!formData.customer_id || !formData.rental_start || !formData.rental_end || formData.items.length === 0) {
      alert('Please fill in customer, rental dates, and add at least one equipment item.')
      return
    }

    const hasEmptyItems = formData.items.some((item) => !item.equipment_id)
    if (hasEmptyItems) {
      alert('Please select equipment for all items.')
      return
    }

    setSaving(true)
    try {
      const customer = getCustomerById(formData.customer_id)
      if (!customer) {
        alert('Selected customer not found.')
        setSaving(false)
        return
      }

      const quotationItems: QuotationItem[] = formData.items.map((item) => ({
        equipment_id: item.equipment_id,
        equipment_name: item.equipment_name,
        daily_rate: item.daily_rate,
        quantity: item.quantity,
        days: item.days,
        subtotal: item.subtotal,
      }))

      const discountType = formData.discount_type || undefined
      const discountValue = formData.discount_value || undefined

      const docData = {
        customer_id: formData.customer_id,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        items: quotationItems,
        rental_start: formData.rental_start,
        rental_end: formData.rental_end,
        subtotal: summary.subtotal,
        discount_type: discountType || null,
        discount_value: discountValue || 0,
        discount_amount: summary.discountAmount,
        tax_rate: formData.tax_rate,
        tax_amount: summary.taxAmount,
        total_amount: summary.totalAmount,
        deposit_amount: summary.depositAmount,
        valid_until: formData.valid_until,
        notes: formData.notes,
        updated_at: new Date().toISOString(),
      }

      if (editingQuotation) {
        await updateDoc(doc(db, 'quotations', editingQuotation.id), docData)
      } else {
        const allQuotations = quotations.map((q) => q.quotation_number)
        const quotationNumber = await generateDocNumber('QT', allQuotations)

        await addDoc(collection(db, 'quotations'), {
          ...docData,
          quotation_number: quotationNumber,
          status: 'draft',
          created_by: user.name,
          created_at: new Date().toISOString(),
        })
      }

      setShowModal(false)
      setEditingQuotation(null)
      setFormData(initialFormData)
    } catch (err) {
      console.error('Error saving quotation:', err)
      alert('Failed to save quotation. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Update quotation status
  const handleStatusChange = async (quotation: Quotation, newStatus: QuotationStatus) => {
    try {
      await updateDoc(doc(db, 'quotations', quotation.id), {
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update status.')
    }
    setActiveDropdown(null)
  }

  // Delete quotation
  const handleDelete = async (quotation: Quotation) => {
    if (!confirm(`Delete quotation ${quotation.quotation_number}? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, 'quotations', quotation.id))
    } catch (err) {
      console.error('Error deleting quotation:', err)
      alert('Failed to delete quotation.')
    }
    setActiveDropdown(null)
  }

  // Convert to rental
  const handleConvertToRental = async (quotation: Quotation) => {
    if (!user) return
    if (!confirm(`Convert quotation ${quotation.quotation_number} to a rental? This will create a new rental record.`)) return

    try {
      // Get existing rental numbers
      const rentalsSnap = await getDocs(collection(db, 'rentals'))
      const allRentals = rentalsSnap.docs.map((d) => d.data().rental_number as string)
      const rentalNumber = await generateDocNumber('CV', allRentals)

      const rentalDoc = {
        rental_number: rentalNumber,
        customer_id: quotation.customer_id,
        customer_name: quotation.customer_name,
        customer_phone: quotation.customer_phone,
        customer_email: quotation.customer_email,
        items: quotation.items.map((item) => ({
          ...item,
          serial_number: '',
          condition_out: 'good' as const,
        })),
        rental_start: quotation.rental_start,
        rental_end: quotation.rental_end,
        subtotal: quotation.subtotal,
        discount_type: quotation.discount_type,
        discount_value: quotation.discount_value,
        discount_amount: quotation.discount_amount,
        tax_rate: quotation.tax_rate,
        tax_amount: quotation.tax_amount,
        total_amount: quotation.total_amount,
        deposit_amount: quotation.deposit_amount,
        deposit_status: 'pending',
        status: 'pending_confirmation',
        payment_status: 'unpaid',
        amount_paid: 0,
        notes: quotation.notes,
        terms_accepted: false,
        quotation_id: quotation.id,
        created_by: user.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const rentalRef = await addDoc(collection(db, 'rentals'), rentalDoc)

      // Mark quotation as converted
      await updateDoc(doc(db, 'quotations', quotation.id), {
        status: 'converted',
        converted_to_rental_id: rentalRef.id,
        updated_at: new Date().toISOString(),
      })

      alert(`Rental ${rentalNumber} created successfully!`)
    } catch (err) {
      console.error('Error converting to rental:', err)
      alert('Failed to convert to rental. Please try again.')
    }
    setActiveDropdown(null)
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quotations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage rental quotations for customers</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Quotation
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quotation number or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
          />
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-neutral-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              {tab.value !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  {quotations.filter((q) => q.status === tab.value).length}
                </span>
              )}
              {tab.value === 'all' && (
                <span className="ml-1.5 text-xs opacity-70">{quotations.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quotation List */}
      {filteredQuotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No quotations yet</h3>
          <p className="text-sm text-slate-500 mt-1">Create your first quotation</p>
          <button
            onClick={handleCreate}
            className="mt-4 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Quotation
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredQuotations.map((quotation) => (
            <div
              key={quotation.id}
              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Left side */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      {quotation.quotation_number}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        QUOTATION_STATUS_COLORS[quotation.status]
                      }`}
                    >
                      {QUOTATION_STATUS_LABELS[quotation.status]}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-slate-700">
                    {quotation.customer_name}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(quotation.rental_start)} - {formatDate(quotation.rental_end)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {quotation.items.length} item{quotation.items.length !== 1 ? 's' : ''}
                    </span>
                    <span>Created: {formatDate(quotation.created_at)}</span>
                  </div>
                </div>

                {/* Right side - amounts & actions */}
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-800">
                      {formatCurrency(quotation.total_amount)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Deposit: {formatCurrency(quotation.deposit_amount)}
                    </div>
                  </div>

                  {/* Action dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveDropdown(activeDropdown === quotation.id ? null : quotation.id)
                      }}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeDropdown === quotation.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 w-48">
                        {quotation.status === 'draft' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(quotation)
                                setActiveDropdown(null)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Edit3 className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusChange(quotation, 'sent')
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Send className="w-4 h-4" />
                              Mark as Sent
                            </button>
                          </>
                        )}

                        {quotation.status === 'sent' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusChange(quotation, 'accepted')
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Mark as Accepted
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusChange(quotation, 'rejected')
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Mark as Rejected
                            </button>
                          </>
                        )}

                        {quotation.status === 'accepted' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleConvertToRental(quotation)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
                          >
                            <ArrowRightCircle className="w-4 h-4" />
                            Convert to Rental
                          </button>
                        )}

                        {quotation.status === 'draft' && (
                          <>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(quotation)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </>
                        )}

                        {quotation.status === 'converted' && quotation.converted_to_rental_id && (
                          <div className="px-3 py-2 text-xs text-slate-500">
                            Converted to rental
                          </div>
                        )}

                        {(quotation.status === 'rejected' || quotation.status === 'expired') && (
                          <div className="px-3 py-2 text-xs text-slate-500">
                            No actions available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setShowModal(false)
              setEditingQuotation(null)
              setFormData(initialFormData)
            }}
          />

          {/* Modal Content */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-10">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between items-center sticky top-0 z-20">
              <h2 className="text-lg font-bold text-slate-800">
                {editingQuotation ? 'Edit Quotation' : 'New Quotation'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingQuotation(null)
                  setFormData(initialFormData)
                }}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rental Start
                  </label>
                  <input
                    type="date"
                    value={formData.rental_start}
                    onChange={(e) => setFormData({ ...formData, rental_start: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rental End
                  </label>
                  <input
                    type="date"
                    value={formData.rental_end}
                    onChange={(e) => setFormData({ ...formData, rental_end: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  />
                </div>
              </div>

              {computedDays > 0 && (
                <div className="text-xs text-neutral-900 font-medium -mt-2">
                  Rental duration: {computedDays} day{computedDays !== 1 ? 's' : ''}
                </div>
              )}

              {/* Equipment Items Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">Equipment Items</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                {formData.items.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No items added yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click &quot;Add Item&quot; to add equipment to this quotation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div
                        key={index}
                        className="border border-slate-200 rounded-xl p-4 bg-slate-50/50"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                            Item {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Equipment select */}
                        <div className="mb-3">
                          <select
                            value={item.equipment_id}
                            onChange={(e) =>
                              handleItemChange(index, 'equipment_id', e.target.value)
                            }
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                          >
                            <option value="">Select equipment...</option>
                            {availableEquipment.map((eq) => (
                              <option key={eq.id} value={eq.id}>
                                {eq.brand} {eq.model} - {eq.name} ({formatCurrency(eq.daily_rate)}/day)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Row: Qty, Days, Rate, Subtotal */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Quantity</label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(index, 'quantity', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Days</label>
                            <input
                              type="number"
                              value={item.days}
                              readOnly
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">
                              Daily Rate (RM)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.daily_rate}
                              onChange={(e) =>
                                handleItemChange(index, 'daily_rate', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Subtotal</label>
                            <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-700 font-medium">
                              {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discount</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <select
                      value={formData.discount_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discount_type: e.target.value as 'percentage' | 'fixed' | '',
                          discount_value: e.target.value ? formData.discount_value : 0,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                    >
                      <option value="">No Discount</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (RM)</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      step={formData.discount_type === 'percentage' ? 1 : 0.01}
                      max={formData.discount_type === 'percentage' ? 100 : undefined}
                      value={formData.discount_value}
                      onChange={(e) =>
                        setFormData({ ...formData, discount_value: Number(e.target.value) })
                      }
                      disabled={!formData.discount_type}
                      placeholder={
                        formData.discount_type === 'percentage'
                          ? 'Enter percentage'
                          : formData.discount_type === 'fixed'
                          ? 'Enter amount'
                          : 'Select discount type first'
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes for this quotation..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Summary */}
              {formData.items.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Summary</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-700 font-medium">
                      {formatCurrency(summary.subtotal)}
                    </span>
                  </div>
                  {summary.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">
                        Discount
                        {formData.discount_type === 'percentage'
                          ? ` (${formData.discount_value}%)`
                          : ''}
                      </span>
                      <span className="text-red-600 font-medium">
                        -{formatCurrency(summary.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax ({formData.tax_rate}%)</span>
                    <span className="text-slate-700 font-medium">
                      {formatCurrency(summary.taxAmount)}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 mt-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-slate-800">Total Amount</span>
                      <span className="text-slate-800">
                        {formatCurrency(summary.totalAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-slate-500">Deposit Amount</span>
                    <span className="text-amber-600 font-medium">
                      {formatCurrency(summary.depositAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0 z-20">
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingQuotation(null)
                  setFormData(initialFormData)
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-neutral-900 hover:bg-neutral-800 text-white px-6 py-2 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingQuotation ? 'Update Quotation' : 'Create Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
