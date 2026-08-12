'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarCheck, Receipt, UserCircle, LogOut, Camera } from 'lucide-react'
import type { User } from '@/types'

const navItems = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/catalog', label: 'Equipment', icon: Camera },
  { href: '/portal/bookings', label: 'My Bookings', icon: CalendarCheck },
  { href: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { href: '/portal/profile', label: 'Profile', icon: UserCircle },
]

interface CustomerSidebarProps {
  user: User
  onLogout: () => void
}

export default function CustomerSidebar({ user, onLogout }: CustomerSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-neutral-950 text-white flex-col z-40">
      <div className="p-5 border-b border-neutral-800">
        <Link href="/portal" className="flex items-center gap-3">
          <Image src="/logo.jpeg" alt="CamVice" width={40} height={40} className="rounded-xl" />
          <div>
            <h1 className="font-bold text-base">CamVice Studio</h1>
            <p className="text-xs text-neutral-500">Customer Portal</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-neutral-900 shadow-lg'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-neutral-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-neutral-800 rounded-full flex items-center justify-center text-sm font-bold">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-neutral-500 truncate">{user.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors w-full px-1">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}
