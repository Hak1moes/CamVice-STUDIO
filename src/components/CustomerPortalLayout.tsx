'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { Loader2 } from 'lucide-react'
import CustomerSidebar from './CustomerSidebar'
import CustomerMobileNav from './CustomerMobileNav'
import NotificationBell from './NotificationBell'
import type { User } from '@/types'

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/')
        return
      }

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) {
        await signOut(auth)
        router.push('/')
        return
      }

      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User

      if (userData.role !== 'customer') {
        router.push('/dashboard')
        return
      }

      setUser(userData)
      setLoading(false)

      if (!unsubUserDoc) {
        unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (!snapshot.exists()) {
            signOut(auth).then(() => router.push('/'))
          } else {
            setUser({ id: firebaseUser.uid, ...snapshot.data() } as User)
          }
        })
      }
    })

    return () => {
      unsubAuth()
      if (unsubUserDoc) unsubUserDoc()
    }
  }, [router])

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <CustomerSidebar user={user} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col md:ml-64">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-slate-500">Welcome,</h2>
            <span className="text-sm font-semibold text-slate-800">{user.name}</span>
          </div>
          <NotificationBell userId={user.id} />
        </header>
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <CustomerMobileNav />
    </div>
  )
}
