'use client'

import { useState, useEffect } from 'react'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged, updatePassword } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { Loader2, Save, Lock, CheckCircle } from 'lucide-react'
import type { User } from '@/types'

export default function PortalProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({ name: '', phone: '', ic_number: '', address: '' })

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      if (!userDoc.exists()) return
      const userData = { id: firebaseUser.uid, ...userDoc.data() } as User
      setUser(userData)
      setFormData({ name: userData.name || '', phone: userData.phone || '', ic_number: userData.ic_number || '', address: userData.address || '' })
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'users', user.id), {
        name: formData.name,
        phone: formData.phone,
        ic_number: formData.ic_number,
        address: formData.address,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Failed to update profile.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!auth.currentUser || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    setPasswordSaving(true)
    setPasswordError('')
    try {
      await updatePassword(auth.currentUser, newPassword)
      setPasswordSuccess(true)
      setNewPassword('')
      setShowPasswordForm(false)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      if (e.code === 'auth/requires-recent-login') setPasswordError('Please logout and login again before changing password.')
      else setPasswordError(e.message || 'Failed to change password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-neutral-900 animate-spin" /></div>

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>

      {/* Profile Form */}
      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">Personal Information</h3>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
        {saved && <div className="bg-emerald-50 text-emerald-600 text-sm p-3 rounded-lg mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Profile updated successfully</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={user?.email || ''} disabled className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IC Number</label>
            <input type="text" value={formData.ic_number} onChange={(e) => setFormData({ ...formData, ic_number: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <textarea rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none" />
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-neutral-900 hover:bg-neutral-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">Security</h3>
        {passwordSuccess && <div className="bg-emerald-50 text-emerald-600 text-sm p-3 rounded-lg mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Password changed successfully</div>}

        {showPasswordForm ? (
          <div className="space-y-3">
            {passwordError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{passwordError}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input type="password" placeholder="Min. 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowPasswordForm(false); setPasswordError('') }} className="px-4 py-2 rounded-xl text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleChangePassword} disabled={passwordSaving} className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Update Password
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPasswordForm(true)} className="text-sm text-neutral-900 hover:underline flex items-center gap-1">
            <Lock className="w-4 h-4" /> Change Password
          </button>
        )}
      </div>
    </div>
  )
}
