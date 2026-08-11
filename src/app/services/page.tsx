'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore'
import type { User, Service } from '@/types'
import { SERVICE_CATEGORIES, PRICE_UNITS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import {
  Search,
  Plus,
  X,
  Loader2,
  Edit3,
  Trash2,
  Camera,
  Video,
  Scissors,
  Plane,
  Building2,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react'

type ServiceCategory = 'photography' | 'videography' | 'editing' | 'drone' | 'studio' | 'other'

const CATEGORY_ICONS: Record<ServiceCategory, React.ReactNode> = {
  photography: <Camera className="w-4 h-4" />,
  videography: <Video className="w-4 h-4" />,
  editing: <Scissors className="w-4 h-4" />,
  drone: <Plane className="w-4 h-4" />,
  studio: <Building2 className="w-4 h-4" />,
  other: <MoreHorizontal className="w-4 h-4" />,
}

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  photography: 'bg-blue-100 text-blue-700',
  videography: 'bg-purple-100 text-purple-700',
  editing: 'bg-amber-100 text-amber-700',
  drone: 'bg-cyan-100 text-cyan-700',
  studio: 'bg-rose-100 text-rose-700',
  other: 'bg-slate-100 text-slate-700',
}

const EMPTY_FORM = {
  name: '',
  category: 'photography' as ServiceCategory,
  description: '',
  base_price: 0,
  price_unit: 'per_hour' as Service['price_unit'],
  duration_hours: '',
  includes: '',
  status: 'active' as 'active' | 'inactive',
}

export default function ServicesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<Service[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as User)
        }
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Real-time services listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'services'), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Service))
      data.sort((a, b) => a.name.localeCompare(b.name))
      setServices(data)
    })
    return () => unsub()
  }, [])

  const filteredServices = services.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const openCreateModal = () => {
    setEditingService(null)
    setFormData(EMPTY_FORM)
    setShowModal(true)
  }

  const openEditModal = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      category: service.category,
      description: service.description,
      base_price: service.base_price,
      price_unit: service.price_unit,
      duration_hours: service.duration_hours ? String(service.duration_hours) : '',
      includes: service.includes.join('\n'),
      status: service.status,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingService(null)
    setFormData(EMPTY_FORM)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    try {
      const includesArray = formData.includes
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      const serviceData = {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim(),
        base_price: Number(formData.base_price),
        price_unit: formData.price_unit,
        duration_hours: formData.duration_hours ? Number(formData.duration_hours) : null,
        includes: includesArray,
        status: formData.status,
        updated_at: new Date().toISOString(),
      }

      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), serviceData)
      } else {
        await addDoc(collection(db, 'services'), {
          ...serviceData,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
      }

      closeModal()
    } catch (err) {
      console.error('Error saving service:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'services', deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting service:', err)
    } finally {
      setDeleting(false)
    }
  }

  const getPriceUnitLabel = (unit: string) => {
    const found = PRICE_UNITS.find((p) => p.value === unit)
    return found ? found.label : unit
  }

  const getCategoryLabel = (cat: string) => {
    const found = SERVICE_CATEGORIES.find((c) => c.value === cat)
    return found ? found.label : cat
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
          <h1 className="text-2xl font-bold text-slate-800">Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage photography and videography services</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat.value
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {CATEGORY_ICONS[cat.value as ServiceCategory]}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4">
            <Camera className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No services found</h3>
          <p className="text-sm text-slate-500">
            {searchQuery || activeCategory !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Add your first service to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{service.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        CATEGORY_COLORS[service.category]
                      }`}
                    >
                      {CATEGORY_ICONS[service.category]}
                      {getCategoryLabel(service.category)}
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    service.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {service.status === 'active' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {service.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Price */}
              <div className="mb-3">
                <span className="text-xl font-bold text-neutral-900">
                  {formatCurrency(service.base_price)}
                </span>
                <span className="text-xs text-slate-500 ml-1">
                  / {getPriceUnitLabel(service.price_unit)}
                </span>
              </div>

              {/* Description Preview */}
              {service.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{service.description}</p>
              )}

              {/* Duration */}
              {service.duration_hours && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{service.duration_hours} hour{service.duration_hours > 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Includes Preview */}
              {service.includes && service.includes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-600 mb-1">Includes:</p>
                  <ul className="space-y-0.5">
                    {service.includes.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-500 flex items-start gap-1">
                        <span className="text-neutral-800 mt-0.5">&#8226;</span>
                        <span className="line-clamp-1">{item}</span>
                      </li>
                    ))}
                    {service.includes.length > 3 && (
                      <li className="text-xs text-slate-400">
                        +{service.includes.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(service)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(service)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-800">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Wedding Photography"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as ServiceCategory })
                    }
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 appearance-none bg-white"
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the service..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Price and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Base Price (RM) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.base_price}
                    onChange={(e) =>
                      setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Price Unit <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.price_unit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price_unit: e.target.value as Service['price_unit'],
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 appearance-none bg-white"
                    >
                      {PRICE_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duration (Hours)
                  <span className="text-slate-400 font-normal ml-1">- optional</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.duration_hours}
                  onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                  placeholder="e.g. 8"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                />
              </div>

              {/* Includes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Includes
                  <span className="text-slate-400 font-normal ml-1">- one item per line</span>
                </label>
                <textarea
                  value={formData.includes}
                  onChange={(e) => setFormData({ ...formData, includes: e.target.value })}
                  placeholder={"Edited photos\nOnline gallery\nPrint-ready files"}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Service Status</p>
                  <p className="text-xs text-slate-500">
                    {formData.status === 'active'
                      ? 'Service is visible and available'
                      : 'Service is hidden from customers'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      status: formData.status === 'active' ? 'inactive' : 'active',
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.status === 'active' ? 'bg-neutral-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${
                      formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
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
                  className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Service</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-700">{deleteTarget.name}</span>? This
                action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
