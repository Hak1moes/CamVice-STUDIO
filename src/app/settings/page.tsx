'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import type { User, BusinessSettings } from '@/types'
import { DEFAULT_TERMS } from '@/lib/constants'
import {
  Loader2,
  Save,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Landmark,
  Clock,
  FileText,
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  ChevronDown,
  X,
  AlertTriangle,
  Check,
  Percent,
  DollarSign,
} from 'lucide-react'

const ROLE_OPTIONS = ['admin', 'staff', 'customer'] as const
type UserRole = (typeof ROLE_OPTIONS)[number]

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  staff: 'bg-blue-100 text-blue-700',
  customer: 'bg-emerald-100 text-emerald-700',
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <ShieldAlert className="w-3.5 h-3.5" />,
  staff: <ShieldCheck className="w-3.5 h-3.5" />,
  customer: <Shield className="w-3.5 h-3.5" />,
}

const EMPTY_SETTINGS: BusinessSettings = {
  business_name: 'Camvice Studio',
  business_address: 'F-20-08, F, Pangsapuri Idaman Abadi Fasa 2, 43500, Semenyih, Selangor',
  business_phone: '',
  business_email: '',
  business_registration: '202503226884 (JM1030069-X)',
  logo_url: '',
  bank_name: '',
  bank_account: '',
  bank_holder: '',
  tax_rate: 0,
  default_terms: DEFAULT_TERMS,
  late_fee_per_day: 0,
  operating_hours: '',
  created_at: '',
  updated_at: '',
}

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Business settings state
  const [settings, setSettings] = useState<BusinessSettings>(EMPTY_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [termsText, setTermsText] = useState('')

  // User management state
  const [users, setUsers] = useState<User[]>([])
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: User; newRole: UserRole } | null>(null)
  const [changingRole, setChangingRole] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState<'business' | 'users'>('business')

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setCurrentUser({ id: firebaseUser.uid, ...userDoc.data() } as User)
        }
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Load business settings
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return

    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'business_settings', 'config'))
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as BusinessSettings
          setSettings(data)
          setTermsText(data.default_terms?.join('\n') || DEFAULT_TERMS.join('\n'))
        } else {
          setSettings(EMPTY_SETTINGS)
          setTermsText(DEFAULT_TERMS.join('\n'))
        }
      } catch (err) {
        console.error('Error loading settings:', err)
      } finally {
        setSettingsLoading(false)
      }
    }

    loadSettings()
  }, [currentUser])

  // Real-time users listener
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return

    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as User))
      data.sort((a, b) => a.name.localeCompare(b.name))
      setUsers(data)
    })
    return () => unsub()
  }, [currentUser])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsSaved(false)

    try {
      const termsArray = termsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      await setDoc(
        doc(db, 'business_settings', 'config'),
        {
          ...settings,
          default_terms: termsArray,
          updated_at: new Date().toISOString(),
          created_at: settings.created_at || new Date().toISOString(),
        },
        { merge: true }
      )

      setSettings((prev) => ({
        ...prev,
        default_terms: termsArray,
      }))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRoleChange = async () => {
    if (!roleChangeTarget) return
    setChangingRole(true)

    try {
      await setDoc(
        doc(db, 'users', roleChangeTarget.user.id),
        { role: roleChangeTarget.newRole },
        { merge: true }
      )
      setRoleChangeTarget(null)
    } catch (err) {
      console.error('Error changing role:', err)
    } finally {
      setChangingRole(false)
    }
  }

  const cycleRole = (user: User) => {
    const currentIndex = ROLE_OPTIONS.indexOf(user.role as UserRole)
    const nextIndex = (currentIndex + 1) % ROLE_OPTIONS.length
    const newRole = ROLE_OPTIONS[nextIndex]
    setRoleChangeTarget({ user, newRole })
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      await deleteDoc(doc(db, 'users', deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting user:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
      </div>
    )
  }

  // Access denied for non-admins
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500">
            You do not have permission to access this page. Only administrators can manage system
            settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage business configuration and users</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('business')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'business'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Business Information
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'users'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          User Management
          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
            {users.length}
          </span>
        </button>
      </div>

      {/* Business Information Section */}
      {activeTab === 'business' && (
        <>
          {settingsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Business Details Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-neutral-900" />
                  Business Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Business Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={settings.business_name}
                      onChange={(e) =>
                        setSettings({ ...settings, business_name: e.target.value })
                      }
                      placeholder="Camvice Studio"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>

                  {/* Business Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        Business Address
                      </span>
                    </label>
                    <textarea
                      value={settings.business_address}
                      onChange={(e) =>
                        setSettings({ ...settings, business_address: e.target.value })
                      }
                      placeholder="Full business address..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        Phone Number
                      </span>
                    </label>
                    <input
                      type="tel"
                      value={settings.business_phone}
                      onChange={(e) =>
                        setSettings({ ...settings, business_phone: e.target.value })
                      }
                      placeholder="012-3456789"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        Email Address
                      </span>
                    </label>
                    <input
                      type="email"
                      value={settings.business_email}
                      onChange={(e) =>
                        setSettings({ ...settings, business_email: e.target.value })
                      }
                      placeholder="info@camvicestudio.com"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>

                  {/* SSM Registration */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        SSM Registration Number
                      </span>
                    </label>
                    <input
                      type="text"
                      value={settings.business_registration}
                      onChange={(e) =>
                        setSettings({ ...settings, business_registration: e.target.value })
                      }
                      placeholder="e.g. 202301012345"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>

                  {/* Operating Hours */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Operating Hours
                      </span>
                    </label>
                    <input
                      type="text"
                      value={settings.operating_hours}
                      onChange={(e) =>
                        setSettings({ ...settings, operating_hours: e.target.value })
                      }
                      placeholder="Mon-Sat 9:00 AM - 6:00 PM"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Banking Details Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-neutral-900" />
                  Banking Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bank Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={settings.bank_name}
                      onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                      placeholder="e.g. Maybank"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>

                  {/* Bank Account */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5" />
                        Account Number
                      </span>
                    </label>
                    <input
                      type="text"
                      value={settings.bank_account}
                      onChange={(e) =>
                        setSettings({ ...settings, bank_account: e.target.value })
                      }
                      placeholder="1234567890"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>

                  {/* Account Holder */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={settings.bank_holder}
                      onChange={(e) =>
                        setSettings({ ...settings, bank_holder: e.target.value })
                      }
                      placeholder="Full name as per bank account"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Rates & Fees Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Percent className="w-5 h-5 text-neutral-900" />
                  Rates & Fees
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tax Rate */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.tax_rate}
                      onChange={(e) =>
                        setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>

                  {/* Late Fee */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        Late Fee Per Day (RM)
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.late_fee_per_day}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          late_fee_per_day: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Default Terms Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-neutral-900" />
                  Default Rental Terms
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Enter each term on a new line. These will be included in rental agreements.
                </p>
                <textarea
                  value={termsText}
                  onChange={(e) => setTermsText(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-slate-800 resize-none"
                />
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 transition-colors disabled:opacity-50"
                >
                  {savingSettings ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Settings
                </button>
                {settingsSaved && (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                    <Check className="w-4 h-4" />
                    Settings saved successfully
                  </span>
                )}
              </div>
            </form>
          )}
        </>
      )}

      {/* User Management Section */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* User Count Summary */}
          <div className="grid grid-cols-3 gap-3">
            {ROLE_OPTIONS.map((role) => {
              const count = users.filter((u) => u.role === role).length
              return (
                <div
                  key={role}
                  className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center"
                >
                  <div
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${ROLE_COLORS[role]}`}
                  >
                    {ROLE_ICONS[role]}
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{count}</p>
                  <p className="text-xs text-slate-500 capitalize">{role}s</p>
                </div>
              )
            })}
          </div>

          {/* Users List */}
          {users.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No users found</h3>
              <p className="text-sm text-slate-500">Users will appear here once they register.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center justify-between gap-4"
                >
                  {/* User Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-slate-600">
                        {user.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <button
                    onClick={() => cycleRole(user)}
                    disabled={user.id === currentUser.id}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-opacity ${
                      ROLE_COLORS[user.role as UserRole]
                    } ${
                      user.id === currentUser.id
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:opacity-80 cursor-pointer'
                    }`}
                    title={
                      user.id === currentUser.id
                        ? 'Cannot change your own role'
                        : `Click to change role`
                    }
                  >
                    {ROLE_ICONS[user.role as UserRole]}
                    <span className="capitalize">{user.role}</span>
                    {user.id !== currentUser.id && (
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    )}
                  </button>

                  {/* Delete Button */}
                  {user.id !== currentUser.id && (
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role Change Confirmation Dialog */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setRoleChangeTarget(null)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Change User Role</h3>
              <p className="text-sm text-slate-500 mb-6">
                Change{' '}
                <span className="font-semibold text-slate-700">{roleChangeTarget.user.name}</span>
                {"'s"} role from{' '}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    ROLE_COLORS[roleChangeTarget.user.role as UserRole]
                  }`}
                >
                  {roleChangeTarget.user.role}
                </span>{' '}
                to{' '}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    ROLE_COLORS[roleChangeTarget.newRole]
                  }`}
                >
                  {roleChangeTarget.newRole}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRoleChangeTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRoleChange}
                  disabled={changingRole}
                  className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-neutral-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {changingRole && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Delete User</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-700">{deleteTarget.name}</span> (
                {deleteTarget.email})? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
