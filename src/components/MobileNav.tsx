'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, CalendarCheck, Receipt, Menu } from 'lucide-react'
import { useState } from 'react'
import { Users, FileText, Briefcase, Settings, LogOut, X } from 'lucide-react'
import Image from 'next/image'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'

const bottomNavItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/equipment', label: 'Equipment', icon: Package },
  { href: '/rentals', label: 'Rentals', icon: CalendarCheck },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
]

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/equipment', label: 'Equipment', icon: Package },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/quotations', label: 'Quotations', icon: FileText },
  { href: '/rentals', label: 'Rentals', icon: CalendarCheck },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/services', label: 'Services', icon: Briefcase },
]

export default function MobileNav({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isActive ? 'text-neutral-900' : 'text-slate-400'}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
          <button onClick={() => setShowMenu(true)} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400">
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Full Menu Drawer */}
      {showMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setShowMenu(false)} />
          <div className="relative w-72 bg-white h-full shadow-2xl slide-in flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image src="/logo.jpeg" alt="CamVice" width={32} height={32} className="rounded-lg" />
                <span className="font-bold text-slate-800">CamVice Studio</span>
              </div>
              <button onClick={() => setShowMenu(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMenu(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${isActive ? 'bg-neutral-100 text-neutral-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                )
              })}
              {user.role === 'admin' && (
                <Link href="/settings" onClick={() => setShowMenu(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${pathname === '/settings' ? 'bg-neutral-100 text-neutral-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <Settings className="w-5 h-5" />
                  Settings
                </Link>
              )}
            </nav>
            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">{user.name?.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={async () => { await signOut(auth); router.push('/') }} className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-500 w-full px-1">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
