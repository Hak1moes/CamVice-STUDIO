'use client'

import { useState, useEffect, useRef } from 'react'
import { db, storage } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import type { User, Equipment, EquipmentCategory, EquipmentCondition, EquipmentStatus } from '@/types'
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS, EQUIPMENT_STATUSES, CONDITION_COLORS, EQUIPMENT_STATUS_COLORS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import {
  Search,
  Plus,
  X,
  Loader2,
  Camera,
  Pencil,
  Trash2,
  Upload,
  Package,
  Hash,
} from 'lucide-react'

interface EquipmentForm {
  name: string
  category: EquipmentCategory
  brand: string
  model: string
  serial_number: string
  description: string
  daily_rate: number
  weekly_rate: number | ''
  deposit_amount: number
  condition: EquipmentCondition
  status: EquipmentStatus
  notes: string
}

const defaultForm: EquipmentForm = {
  name: '',
  category: 'camera',
  brand: '',
  model: '',
  serial_number: '',
  description: '',
  daily_rate: 0,
  weekly_rate: '',
  deposit_amount: 0,
  condition: 'excellent',
  status: 'available',
  notes: '',
}

const STATUS_FILTERS: { value: EquipmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'Rented' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'maintenance', label: 'Maintenance' },
]

const CATEGORY_FILTERS: { value: EquipmentCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...EQUIPMENT_CATEGORIES,
]

export default function EquipmentPage() {
  const [user, setUser] = useState<User | null>(null)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | 'all'>('all')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EquipmentForm>({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Auth + real-time data
  useEffect(() => {
    let unsubEquipment: (() => void) | null = null
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)

      unsubEquipment = onSnapshot(collection(db, 'equipment'), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Equipment[]
        data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setEquipment(data)
        setLoading(false)
      })
    })
    return () => { unsubAuth(); if (unsubEquipment) unsubEquipment() }
  }, [])

  // Filtered equipment
  const filtered = equipment.filter((item) => {
    const matchesSearch =
      search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.brand.toLowerCase().includes(search.toLowerCase()) ||
      item.model.toLowerCase().includes(search.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter

    return matchesSearch && matchesCategory && matchesStatus
  })

  // Open create modal
  const handleCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  // Open edit modal
  const handleEdit = (item: Equipment) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      category: item.category,
      brand: item.brand,
      model: item.model,
      serial_number: item.serial_number,
      description: item.description,
      daily_rate: item.daily_rate,
      weekly_rate: item.weekly_rate ?? '',
      deposit_amount: item.deposit_amount,
      condition: item.condition,
      status: item.status,
      notes: item.notes,
    })
    setImageFile(null)
    setImagePreview(item.image_urls?.[0] || null)
    setShowModal(true)
  }

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Save (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    try {
      let imageUrls: string[] = []

      // Upload image if selected
      if (imageFile) {
        const timestamp = Date.now()
        const storageRef = ref(storage, `equipment/${timestamp}_${imageFile.name}`)
        await uploadBytes(storageRef, imageFile)
        const url = await getDownloadURL(storageRef)
        imageUrls = [url]
      }

      const now = new Date().toISOString()

      if (editingId) {
        // Update
        const updateData: Record<string, unknown> = {
          name: form.name,
          category: form.category,
          brand: form.brand,
          model: form.model,
          serial_number: form.serial_number,
          description: form.description,
          daily_rate: Number(form.daily_rate),
          deposit_amount: Number(form.deposit_amount),
          condition: form.condition,
          status: form.status,
          notes: form.notes,
          updated_at: now,
        }

        if (form.weekly_rate !== '' && form.weekly_rate !== 0) {
          updateData.weekly_rate = Number(form.weekly_rate)
        }

        if (imageUrls.length > 0) {
          updateData.image_urls = imageUrls
        }

        await updateDoc(doc(db, 'equipment', editingId), updateData)
      } else {
        // Create
        const newEquipment: Omit<Equipment, 'id'> = {
          name: form.name,
          category: form.category,
          brand: form.brand,
          model: form.model,
          serial_number: form.serial_number,
          description: form.description,
          daily_rate: Number(form.daily_rate),
          ...(form.weekly_rate !== '' && form.weekly_rate !== 0 ? { weekly_rate: Number(form.weekly_rate) } : {}),
          deposit_amount: Number(form.deposit_amount),
          condition: form.condition,
          status: form.status,
          image_urls: imageUrls,
          specs: {},
          notes: form.notes,
          created_by: user.id,
          created_at: now,
          updated_at: now,
        }
        await addDoc(collection(db, 'equipment'), newEquipment)
      }

      setShowModal(false)
      setEditingId(null)
      setForm({ ...defaultForm })
      setImageFile(null)
      setImagePreview(null)
    } catch (err) {
      console.error('Error saving equipment:', err)
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'equipment', deleteId))
      setDeleteId(null)
    } catch (err) {
      console.error('Error deleting equipment:', err)
    } finally {
      setDeleting(false)
    }
  }

  // Get category label
  const getCategoryLabel = (value: EquipmentCategory): string => {
    return EQUIPMENT_CATEGORIES.find(c => c.value === value)?.label || value
  }

  // Get condition label
  const getConditionLabel = (value: EquipmentCondition): string => {
    return EQUIPMENT_CONDITIONS.find(c => c.value === value)?.label || value
  }

  // Get status label
  const getStatusLabel = (value: EquipmentStatus): string => {
    return EQUIPMENT_STATUSES.find(s => s.value === value)?.label || value
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Equipment</h1>
          <p className="text-sm text-slate-500 mt-1">
            {equipment.length} total item{equipment.length !== 1 ? 's' : ''} in inventory
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded-xl shadow-lg shadow-neutral-900/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Equipment
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, brand, or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
        />
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              categoryFilter === cat.value
                ? 'bg-neutral-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {STATUS_FILTERS.map((st) => (
          <button
            key={st.value}
            onClick={() => setStatusFilter(st.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === st.value
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Equipment grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No equipment yet</p>
          <p className="text-sm text-slate-400 mt-1">
            {equipment.length > 0 ? 'Try adjusting your filters' : 'Add your first equipment to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="relative w-full h-40 bg-slate-100 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                {item.image_urls?.[0] ? (
                  <img
                    src={item.image_urls[0]}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-10 h-10 text-slate-300" />
                )}
                {/* Category badge */}
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-slate-700">
                  {getCategoryLabel(item.category)}
                </span>
              </div>

              {/* Content */}
              <div className="space-y-2">
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight truncate">{item.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{item.brand}</p>
                </div>

                {/* Rate */}
                <p className="text-lg font-bold text-neutral-900">
                  {formatCurrency(item.daily_rate)}
                  <span className="text-xs font-normal text-slate-400"> /day</span>
                </p>

                {/* Serial number */}
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Hash className="w-3 h-3" />
                  <span className="truncate">{item.serial_number}</span>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${CONDITION_COLORS[item.condition] || 'bg-slate-100 text-slate-600'}`}>
                    {getConditionLabel(item.condition)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${EQUIPMENT_STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-600'}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(item.id)}
                    className="inline-flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Equipment' : 'Add Equipment'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-neutral-400 hover:bg-neutral-50/30 transition-colors overflow-hidden bg-slate-50"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400">Click to upload image</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {imagePreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageFile(null)
                      setImagePreview(null)
                    }}
                    className="mt-1 text-xs text-red-500 hover:text-red-600"
                  >
                    Remove image
                  </button>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sony A7 III Body"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as EquipmentCategory })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                  required
                >
                  {EQUIPMENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    placeholder="e.g. Sony"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model *</label>
                  <input
                    type="text"
                    placeholder="e.g. A7 III"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Serial number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number *</label>
                <input
                  type="text"
                  placeholder="e.g. SN-12345678"
                  value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  placeholder="Brief description of the equipment..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Rates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Daily Rate (RM) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.daily_rate || ''}
                    onChange={(e) => setForm({ ...form, daily_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Weekly Rate (RM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={form.weekly_rate === '' ? '' : form.weekly_rate}
                    onChange={(e) => setForm({ ...form, weekly_rate: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deposit (RM) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.deposit_amount || ''}
                    onChange={(e) => setForm({ ...form, deposit_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Condition & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Condition *</label>
                  <select
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value as EquipmentCondition })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                    required
                  >
                    {EQUIPMENT_CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as EquipmentStatus })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
                    required
                  >
                    {EQUIPMENT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  placeholder="Internal notes about this equipment..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded-xl shadow-lg shadow-neutral-900/20 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Equipment</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete this equipment? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
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
