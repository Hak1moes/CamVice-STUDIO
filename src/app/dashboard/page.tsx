'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore'
import {
  LayoutDashboard, DollarSign, Package, Users, CalendarCheck,
  AlertTriangle, Plus, FileText, TrendingUp, Clock, Loader2,
  ArrowRight, Camera
} from 'lucide-react'
import type { User, Rental, Equipment, Customer, Payment } from '@/types'
import { RENTAL_STATUS_LABELS, RENTAL_STATUS_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyShort, formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [rentals, setRentals] = useState<Rental[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    let unsubs: (() => void)[] = []

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      setUser({ id: firebaseUser.uid, ...userDoc.data() } as User)

      const unsubRentals = onSnapshot(collection(db, 'rentals'), (snap) => {
        setRentals(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Rental[])
      })
      const unsubEquipment = onSnapshot(collection(db, 'equipment'), (snap) => {
        setEquipment(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Equipment[])
      })
      const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[])
      })
      const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Payment[])
        setLoading(false)
      })

      unsubs = [unsubRentals, unsubEquipment, unsubCustomers, unsubPayments]
    })

    return () => { unsubAuth(); unsubs.forEach(u => u()) }
  }, [])

  const stats = useMemo(() => {
    const totalRevenue = payments
      .filter(p => p.payment_type !== 'refund')
      .reduce((sum, p) => sum + p.amount, 0)

    const activeRentals = rentals.filter(r =>
      ['active', 'equipment_out', 'paid'].includes(r.status)
    )

    const overdueRentals = rentals.filter(r => r.status === 'overdue')

    const availableEquipment = equipment.filter(e => e.status === 'available').length

    return { totalRevenue, activeRentals, overdueRentals, availableEquipment }
  }, [rentals, equipment, payments])

  const popularEquipment = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {}
    rentals.forEach(r => {
      r.items?.forEach(item => {
        if (!counts[item.equipment_id]) {
          counts[item.equipment_id] = { name: item.equipment_name, count: 0 }
        }
        counts[item.equipment_id].count++
      })
    })
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [rentals])

  const recentRentals = useMemo(() => {
    return [...rentals]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
  }, [rentals])

  const monthlyRevenue = useMemo(() => {
    const months: Record<string, number> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[key] = 0
    }
    payments.filter(p => p.payment_type !== 'refund').forEach(p => {
      const d = new Date(p.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (months[key] !== undefined) months[key] += p.amount
    })
    return Object.entries(months).map(([month, amount]) => {
      const [y, m] = month.split('-')
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-MY', { month: 'short' })
      return { label, amount }
    })
  }, [payments])

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.amount), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of your rental business</p>
        </div>
      </div>

      {/* Overdue Alert */}
      {stats.overdueRentals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {stats.overdueRentals.length} overdue rental{stats.overdueRentals.length !== 1 ? 's' : ''} need attention
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Equipment has not been returned past the due date</p>
          </div>
          <button onClick={() => router.push('/rentals')} className="text-sm font-medium text-amber-700 hover:text-amber-800">
            View <ArrowRight className="w-3 h-3 inline" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Revenue</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrencyShort(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-neutral-900" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active Rentals</p>
              <p className="text-lg font-bold text-slate-800">{stats.activeRentals.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Available Equipment</p>
              <p className="text-lg font-bold text-slate-800">{stats.availableEquipment} / {equipment.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Customers</p>
              <p className="text-lg font-bold text-slate-800">{customers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'New Quotation', icon: FileText, href: '/quotations', color: 'bg-neutral-900' },
          { label: 'Add Equipment', icon: Camera, href: '/equipment', color: 'bg-violet-600' },
          { label: 'Add Customer', icon: Users, href: '/customers', color: 'bg-emerald-600' },
          { label: 'New Rental', icon: CalendarCheck, href: '/rentals', color: 'bg-cyan-600' },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => router.push(action.href)}
            className={`${action.color} text-white rounded-xl p-3 flex items-center gap-2 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm`}
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Monthly Revenue</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-end gap-3 h-40">
            {monthlyRevenue.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-[10px] text-slate-500 font-medium">{formatCurrencyShort(m.amount)}</p>
                <div className="w-full rounded-t-lg bg-neutral-100 relative" style={{ height: `${Math.max((m.amount / maxRevenue) * 100, 4)}%` }}>
                  <div className="absolute inset-0 bg-neutral-700 rounded-t-lg" style={{ opacity: m.amount > 0 ? 1 : 0.3 }} />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Equipment */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Popular Equipment</h3>
            <Camera className="w-4 h-4 text-slate-400" />
          </div>
          {popularEquipment.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No rental data yet</p>
          ) : (
            <div className="space-y-3">
              {popularEquipment.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{item.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Rentals */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Recent Rentals</h3>
          <button onClick={() => router.push('/rentals')} className="text-sm text-neutral-900 hover:text-neutral-800 font-medium flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {recentRentals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No rentals yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Rental No</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Customer</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Period</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Amount</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentRentals.map((rental) => (
                  <tr
                    key={rental.id}
                    onClick={() => router.push(`/rentals/${rental.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-800">{rental.rental_number}</td>
                    <td className="py-2.5 px-3 text-slate-600">{rental.customer_name}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">
                      {formatDate(rental.rental_start)} - {formatDate(rental.rental_end)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{formatCurrency(rental.total_amount)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${RENTAL_STATUS_COLORS[rental.status]}`}>
                        {RENTAL_STATUS_LABELS[rental.status]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-xs">{formatDate(rental.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
