'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db, googleProvider } from '@/lib/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import Image from 'next/image'
import { Mail, Lock, User, Phone, CreditCard, Eye, EyeOff, Loader2 } from 'lucide-react'
import { ADMIN_EMAILS } from '@/lib/constants'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    ic_number: '',
  })

  const [showCompleteProfile, setShowCompleteProfile] = useState(false)
  const [googleUser, setGoogleUser] = useState<{ uid: string; email: string; displayName: string } | null>(null)
  const [profileData, setProfileData] = useState({ phone: '', ic_number: '' })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          router.push(userData.role === 'customer' ? '/portal' : '/dashboard')
          return
        }
      }
      setCheckingAuth(false)
    })
    return () => unsub()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password)
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          const isAdmin = ADMIN_EMAILS.includes(formData.email.toLowerCase())
          if (isAdmin && userData.role !== 'admin') {
            await setDoc(doc(db, 'users', cred.user.uid), { ...userData, role: 'admin' }, { merge: true })
          }
          router.push(userData.role === 'customer' ? '/portal' : '/dashboard')
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
        const isAdmin = ADMIN_EMAILS.includes(formData.email.toLowerCase())
        await setDoc(doc(db, 'users', cred.user.uid), {
          id: cred.user.uid,
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          ic_number: formData.ic_number,
          address: '',
          role: isAdmin ? 'admin' : 'customer',
          created_at: new Date().toISOString(),
        })
        router.push(isAdmin ? '/dashboard' : '/portal')
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') setError('Invalid email or password.')
      else if (e.code === 'auth/email-already-in-use') setError('Email already registered. Please login instead.')
      else if (e.code === 'auth/weak-password') setError('Password must be at least 6 characters.')
      else setError(e.message || 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const fu = result.user
      const userDoc = await getDoc(doc(db, 'users', fu.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        const isAdmin = ADMIN_EMAILS.includes(fu.email?.toLowerCase() || '')
        if (isAdmin && userData.role !== 'admin') {
          await setDoc(doc(db, 'users', fu.uid), { ...userData, role: 'admin' }, { merge: true })
        }
        router.push(userData.role === 'customer' ? '/portal' : '/dashboard')
      } else {
        setGoogleUser({ uid: fu.uid, email: fu.email || '', displayName: fu.displayName || '' })
        setShowCompleteProfile(true)
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Google sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleUser) return
    setLoading(true)
    setError('')
    try {
      const isAdmin = ADMIN_EMAILS.includes(googleUser.email.toLowerCase())
      await setDoc(doc(db, 'users', googleUser.uid), {
        id: googleUser.uid,
        email: googleUser.email,
        name: googleUser.displayName,
        phone: profileData.phone,
        ic_number: profileData.ic_number,
        address: '',
        role: isAdmin ? 'admin' : 'customer',
        created_at: new Date().toISOString(),
      })
      router.push(isAdmin ? '/dashboard' : '/portal')
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Failed to complete profile.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.jpeg" alt="CamVice" width={80} height={80} className="mx-auto rounded-2xl mb-4" />
          <h1 className="text-2xl font-bold text-white">CamVice Studio</h1>
          <p className="text-neutral-400 text-sm mt-1">Camera Rental Management</p>
        </div>

        {showCompleteProfile && googleUser ? (
          <div className="bg-white rounded-2xl p-6 shadow-2xl fade-in">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Complete Your Profile</h2>
            <p className="text-slate-500 text-sm mb-5">Welcome, {googleUser.displayName}!</p>
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleCompleteProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="tel" placeholder="012-3456789" value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">IC Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="990101-01-1234" value={profileData.ic_number} onChange={(e) => setProfileData({ ...profileData, ic_number: e.target.value })} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-neutral-900 text-white py-2.5 rounded-xl font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Complete Registration
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-2xl fade-in">
            <h2 className="text-lg font-bold text-slate-800 mb-1">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-slate-500 text-sm mb-5">{isLogin ? 'Sign in to your account' : 'Register for a new account'}</p>
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Your full name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="tel" placeholder="012-3456789" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">IC Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="990101-01-1234" value={formData.ic_number} onChange={(e) => setFormData({ ...formData, ic_number: e.target.value })} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" required />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-neutral-900 text-white py-2.5 rounded-xl font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 shadow-lg shadow-neutral-900/30 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <p className="text-center text-sm text-slate-500 mt-5">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setIsLogin(!isLogin); setError(''); setFormData({ email: '', password: '', name: '', phone: '', ic_number: '' }) }} className="text-neutral-900 font-medium hover:underline">
                {isLogin ? 'Register' : 'Sign In'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
