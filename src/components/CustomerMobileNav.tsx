'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarCheck, Receipt, Camera, UserCircle } from 'lucide-react'

const navItems = [
  { href: '/portal', label: 'Home', icon: LayoutDashboard },
  { href: '/portal/catalog', label: 'Equipment', icon: Camera },
  { href: '/portal/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { href: '/portal/profile', label: 'Profile', icon: UserCircle },
]

export default function CustomerMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href)
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
      </div>
    </nav>
  )
}
