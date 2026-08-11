'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import type { AppNotification } from '@/types'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    )
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as AppNotification[]
      setNotifications(data.slice(0, 20))
    })
    return () => unsub()
  }, [userId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 z-50 fade-in max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-800">Notifications</h3>
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">No notifications</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => { markAsRead(n.id); setShowDropdown(false) }}
                  className={`block p-3 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-neutral-50/50' : ''}`}
                >
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
