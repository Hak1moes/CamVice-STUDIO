import type { EquipmentCategory, EquipmentCondition, EquipmentStatus, RentalStatus, QuotationStatus, InvoiceStatus, CustomerSource, ServiceCategory, PriceUnit } from '@/types'

// ==================== Equipment ====================

export const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'camera', label: 'Camera' },
  { value: 'lens', label: 'Lens' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'audio', label: 'Audio' },
  { value: 'stabilizer', label: 'Stabilizer' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'package', label: 'Package' },
]

export const EQUIPMENT_CONDITIONS: { value: EquipmentCondition; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'needs_repair', label: 'Needs Repair' },
]

export const EQUIPMENT_STATUSES: { value: EquipmentStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'Rented' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
]

// ==================== Rental ====================

export const RENTAL_STATUS_FLOW: RentalStatus[] = [
  'quotation',
  'pending_confirmation',
  'confirmed',
  'agreement_signed',
  'invoiced',
  'paid',
  'equipment_out',
  'active',
  'returned',
  'inspected',
  'completed',
]

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  quotation: 'Quotation',
  pending_confirmation: 'Pending Confirmation',
  confirmed: 'Confirmed',
  agreement_signed: 'Agreement Signed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  equipment_out: 'Equipment Out',
  active: 'Active',
  overdue: 'Overdue',
  returned: 'Returned',
  inspected: 'Inspected',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const RENTAL_STATUS_COLORS: Record<RentalStatus, string> = {
  quotation: 'bg-slate-100 text-slate-700',
  pending_confirmation: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-neutral-100 text-neutral-800',
  agreement_signed: 'bg-indigo-100 text-indigo-700',
  invoiced: 'bg-violet-100 text-violet-700',
  paid: 'bg-emerald-100 text-emerald-700',
  equipment_out: 'bg-cyan-100 text-cyan-700',
  active: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  returned: 'bg-teal-100 text-teal-700',
  inspected: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-700',
}

// ==================== Quotation ====================

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
}

export const QUOTATION_STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-neutral-100 text-neutral-800',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-indigo-100 text-indigo-700',
}

// ==================== Invoice ====================

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  partial: 'Partially Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-neutral-100 text-neutral-800',
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
}

// ==================== Customer ====================

export const CUSTOMER_SOURCES: { value: CustomerSource; label: string }[] = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'online', label: 'Online' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'repeat', label: 'Repeat' },
]

// ==================== Service ====================

export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'photography', label: 'Photography' },
  { value: 'videography', label: 'Videography' },
  { value: 'editing', label: 'Editing' },
  { value: 'drone', label: 'Drone' },
  { value: 'studio', label: 'Studio' },
  { value: 'other', label: 'Other' },
]

export const PRICE_UNITS: { value: PriceUnit; label: string }[] = [
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_event', label: 'Per Event' },
  { value: 'fixed', label: 'Fixed Price' },
]

// ==================== Payment ====================

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'ewallet', label: 'E-Wallet (DuitNow/TNG)' },
  { value: 'other', label: 'Other' },
]

// ==================== Business Defaults ====================

export const DEFAULT_TERMS = [
  'Equipment must be returned by the stated return date and time.',
  'Late returns will be charged at the specified late fee rate per day.',
  'The lessee is fully responsible for any loss, theft, or damage to the equipment during the rental period.',
  'Security deposit will be refunded within 3 working days after equipment is returned in good condition.',
  'Equipment must not be sub-rented or transferred to any third party.',
  'The lessee must use the equipment in a responsible manner and follow all manufacturer guidelines.',
  'Camvice Studio reserves the right to inspect equipment at any time during the rental period.',
  'In case of equipment malfunction not caused by the lessee, a replacement will be provided if available.',
  'Cancellations made less than 24 hours before the rental start date will incur a 50% cancellation fee.',
  'By signing this agreement, the lessee acknowledges and accepts all terms and conditions stated above.',
]

export const ADMIN_EMAILS = ['hakimiraip@gmail.com']

export const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-emerald-100 text-emerald-700',
  good: 'bg-neutral-100 text-neutral-800',
  fair: 'bg-amber-100 text-amber-700',
  needs_repair: 'bg-red-100 text-red-700',
  damaged: 'bg-red-100 text-red-700',
}

export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  rented: 'bg-neutral-100 text-neutral-800',
  reserved: 'bg-amber-100 text-amber-700',
  maintenance: 'bg-orange-100 text-orange-700',
  retired: 'bg-slate-100 text-slate-500',
}
