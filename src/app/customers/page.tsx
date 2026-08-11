'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore'
import type { User, Customer, CustomerSource } from '@/types'
import { CUSTOMER_SOURCES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Search,
  Plus,
  X,
  Loader2,
  Users,
  Mail,
  Phone,
  CreditCard,
  Building2,
  MapPin,
  StickyNote,
  Edit3,
  Trash2,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
} from 'lucide-react'

const SOURCE_BADGE_COLORS: Record<CustomerSource, string> = {
  walk_in: 'bg-slate-100 text-slate-700',
  online: 'bg-blue-100 text-blue-700',
  referral: 'bg-emerald-100 text-emerald-700',
  social_media: 'bg-purple-100 text-purple-700',
  repeat: 'bg-amber-100 text-amber-700',
}

const SOURCE_LABELS: Record<CustomerSource, string> = {
  walk_in: 'Walk-in',
  online: 'Online',
  referral: 'Referral',
  social_media: 'Social Media',
  repeat: 'Repeat',
}

type SourceFilter = 'all' | CustomerSource

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  ic_number: '',
  address: '',
  company_name: '',
  source: 'walk_in' as CustomerSource,
  notes: '',
}

export default function CustomersPage() {
  const [user, setUser] = useState<User | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let unsubCustomers: (() => void) | null = null
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)

      unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]
        data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setCustomers(data)
        setLoading(false)
      })
    })
    return () => { unsubAuth(); if (unsubCustomers) unsubCustomers() }
  }, [])

  const filteredCustomers = useMemo(() => {
    let result = customers

    if (sourceFilter !== 'all') {
      result = result.filter(c => c.source === sourceFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      )
    }

    return result
  }, [customers, sourceFilter, search])

  const openCreateModal = () => {
    setEditingCustomer(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      ic_number: customer.ic_number,
      address: customer.address,
      company_name: customer.company_name || '',
      source: customer.source,
      notes: customer.notes,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCustomer(null)
    setFormData(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    try {
      const now = new Date().toISOString()

      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          ic_number: formData.ic_number,
          address: formData.address,
          company_name: formData.company_name || '',
          source: formData.source,
          notes: formData.notes,
          updated_at: now,
        })
      } else {
        await addDoc(collection(db, 'customers'), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          ic_number: formData.ic_number,
          address: formData.address,
          company_name: formData.company_name || '',
          source: formData.source,
          notes: formData.notes,
          total_rentals: 0,
          total_spent: 0,
          created_by: user.id,
          created_at: now,
          updated_at: now,
        })
      }

      closeModal()
    } catch (err) {
      console.error('Error saving customer:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      await deleteDoc(doc(db, 'customers', deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting customer:', err)
    } finally {
      setDeleting(false)
    }
  }

  const sourceFilterTabs: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...CUSTOMER_SOURCES.map(s => ({ value: s.value as SourceFilter, label: s.label })),
  ]

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
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">{customers.length} total customers</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-lg shadow-neutral-900/20 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {sourceFilterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setSourceFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sourceFilter === tab.value
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No customers yet</p>
          <p className="text-sm text-slate-400 mt-1">
            {search || sourceFilter !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Add your first customer to get started'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredCustomers.map(customer => (
            <div
              key={customer.id}
              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Customer Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{customer.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE_COLORS[customer.source]}`}>
                      {SOURCE_LABELS[customer.source]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {customer.email}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {customer.phone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      {customer.ic_number}
                    </span>
                    {customer.company_name && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {customer.company_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="font-medium text-slate-700">{customer.total_rentals}</span>
                      <span className="hidden sm:inline">rentals</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="font-medium text-slate-700">{formatCurrency(customer.total_spent)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(customer)}
                      className="p-2 text-slate-400 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
                      title="Edit customer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(customer)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-800">
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button onClick={closeModal} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Customer full name"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@email.com"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="012-3456789"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* IC Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">IC Number *</label>
                <input
                  type="text"
                  value={formData.ic_number}
                  onChange={(e) => setFormData({ ...formData, ic_number: e.target.value })}
                  placeholder="990101-01-1234"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address *</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                  required
                />
              </div>

              {/* Company Name (Optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Company or organization name"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                />
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source *</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value as CustomerSource })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                  required
                >
                  {CUSTOMER_SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this customer..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
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
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Customer</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteTarget.name}</span>? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
