'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebase'
import { collection, onSnapshot } from 'firebase/firestore'
import { Search, Camera, X } from 'lucide-react'
import type { Equipment } from '@/types'
import { EQUIPMENT_CATEGORIES } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  needs_repair: 'Needs Repair',
}

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-emerald-100 text-emerald-700',
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-amber-100 text-amber-700',
  needs_repair: 'bg-red-100 text-red-700',
}

export default function CatalogPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'equipment'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Equipment[]
      // Only show available + reserved equipment (not retired/maintenance)
      const visible = data.filter(e => e.status === 'available' || e.status === 'reserved' || e.status === 'rented')
      visible.sort((a, b) => a.name.localeCompare(b.name))
      setEquipment(visible)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    let result = equipment
    if (categoryFilter !== 'all') {
      result = result.filter(e => e.category === categoryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.brand.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q)
      )
    }
    return result
  }, [equipment, categoryFilter, search])

  const openItem = (item: Equipment) => {
    setSelectedItem(item)
    setSelectedImageIndex(0)
  }

  const closeItem = () => setSelectedItem(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Equipment Catalog</h1>
        <p className="text-sm text-slate-500 mt-1">Browse our available gear for rental</p>
      </div>

      {/* Search + category filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, brand, or model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              categoryFilter === 'all'
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All
          </button>
          {EQUIPMENT_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === cat.value
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No equipment found</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow text-left overflow-hidden"
            >
              {/* Image */}
              <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                {item.image_urls?.[0] ? (
                  <img
                    src={item.image_urls[0]}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Camera className="w-10 h-10 text-slate-300" />
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs text-slate-400 mb-0.5 capitalize">{item.category}</p>
                <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">{item.name}</p>
                {item.brand && <p className="text-xs text-slate-500 mt-0.5">{item.brand} {item.model}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-neutral-900">{formatCurrency(item.daily_rate)}<span className="text-xs font-normal text-slate-400">/day</span></span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    item.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                    item.status === 'reserved' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {item.status === 'available' ? 'Available' : item.status === 'reserved' ? 'Reserved' : 'Rented'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Item detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={closeItem} />
          <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Close button */}
            <button
              onClick={closeItem}
              className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-full shadow-sm"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>

            {/* Main image */}
            <div className="w-full aspect-video bg-slate-100 flex items-center justify-center overflow-hidden rounded-t-2xl">
              {selectedItem.image_urls?.length > 0 ? (
                <img
                  src={selectedItem.image_urls[selectedImageIndex]}
                  alt={selectedItem.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Camera className="w-16 h-16 text-slate-300" />
              )}
            </div>

            {/* Thumbnail strip (if multiple images) */}
            {selectedItem.image_urls?.length > 1 && (
              <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
                {selectedItem.image_urls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImageIndex === i ? 'border-neutral-900' : 'border-slate-200'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {/* Details */}
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 capitalize">{selectedItem.category}</p>
                  <h2 className="text-xl font-bold text-slate-800">{selectedItem.name}</h2>
                  {selectedItem.brand && (
                    <p className="text-sm text-slate-500">{selectedItem.brand} · {selectedItem.model}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-neutral-900">{formatCurrency(selectedItem.daily_rate)}</p>
                  <p className="text-xs text-slate-400">per day</p>
                  {selectedItem.weekly_rate && (
                    <p className="text-sm font-medium text-slate-600 mt-0.5">{formatCurrency(selectedItem.weekly_rate)}<span className="text-xs font-normal text-slate-400">/week</span></p>
                  )}
                </div>
              </div>

              {/* Status + condition badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  selectedItem.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                  selectedItem.status === 'reserved' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {selectedItem.status === 'available' ? 'Available' : selectedItem.status === 'reserved' ? 'Reserved' : 'Rented'}
                </span>
                {selectedItem.condition && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CONDITION_COLORS[selectedItem.condition] || 'bg-slate-100 text-slate-600'}`}>
                    {CONDITION_LABELS[selectedItem.condition] || selectedItem.condition}
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-neutral-100 text-neutral-700">
                  Deposit: {formatCurrency(selectedItem.deposit_amount)}
                </span>
              </div>

              {/* Description */}
              {selectedItem.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{selectedItem.description}</p>
              )}

              {/* Specs */}
              {selectedItem.specs && Object.keys(selectedItem.specs).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Specifications</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedItem.specs).map(([key, val]) => (
                      <div key={key} className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{key}</p>
                        <p className="text-sm font-medium text-slate-700">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center pt-2">
                Contact us to book this equipment
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
