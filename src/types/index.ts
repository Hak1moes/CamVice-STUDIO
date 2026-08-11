// ==================== User Types ====================

export interface User {
  id: string
  email: string
  name: string
  phone: string
  ic_number: string
  address: string
  role: 'admin' | 'staff' | 'customer'
  avatar_url?: string
  created_at: string
}

// ==================== Equipment Types ====================

export type EquipmentCategory = 'camera' | 'lens' | 'lighting' | 'audio' | 'stabilizer' | 'accessory' | 'package'
export type EquipmentCondition = 'excellent' | 'good' | 'fair' | 'needs_repair'
export type EquipmentStatus = 'available' | 'rented' | 'reserved' | 'maintenance' | 'retired'

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
  brand: string
  model: string
  serial_number: string
  description: string
  daily_rate: number
  weekly_rate?: number
  deposit_amount: number
  condition: EquipmentCondition
  status: EquipmentStatus
  image_urls: string[]
  specs: Record<string, string>
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

// ==================== Customer Types ====================

export type CustomerSource = 'walk_in' | 'online' | 'referral' | 'social_media' | 'repeat'

export interface Customer {
  id: string
  user_id?: string
  name: string
  email: string
  phone: string
  ic_number: string
  address: string
  company_name?: string
  source: CustomerSource
  notes: string
  total_rentals: number
  total_spent: number
  created_by: string
  created_at: string
  updated_at: string
}

// ==================== Rental Types ====================

export type RentalStatus =
  | 'quotation'
  | 'pending_confirmation'
  | 'confirmed'
  | 'agreement_signed'
  | 'invoiced'
  | 'paid'
  | 'equipment_out'
  | 'active'
  | 'overdue'
  | 'returned'
  | 'inspected'
  | 'completed'
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type DepositStatus = 'pending' | 'collected' | 'partially_refunded' | 'refunded' | 'forfeited'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'ewallet' | 'other'

export interface RentalItem {
  equipment_id: string
  equipment_name: string
  serial_number: string
  daily_rate: number
  quantity: number
  days: number
  subtotal: number
  condition_out: EquipmentCondition
  condition_in?: EquipmentCondition | 'damaged'
  condition_notes_out?: string
  condition_notes_in?: string
}

export interface Rental {
  id: string
  rental_number: string
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_email: string
  items: RentalItem[]
  rental_start: string
  rental_end: string
  actual_return_date?: string
  subtotal: number
  discount_type?: 'percentage' | 'fixed'
  discount_value?: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  deposit_amount: number
  deposit_status: DepositStatus
  deposit_refund_amount?: number
  status: RentalStatus
  payment_status: PaymentStatus
  payment_method?: PaymentMethod
  amount_paid: number
  late_fee?: number
  damage_fee?: number
  damage_notes?: string
  notes: string
  terms_accepted: boolean
  terms_accepted_at?: string
  quotation_id?: string
  invoice_id?: string
  created_by: string
  created_at: string
  updated_at: string
}

// ==================== Quotation Types ====================

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'

export interface QuotationItem {
  equipment_id: string
  equipment_name: string
  daily_rate: number
  quantity: number
  days: number
  subtotal: number
}

export interface Quotation {
  id: string
  quotation_number: string
  customer_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  items: QuotationItem[]
  rental_start: string
  rental_end: string
  subtotal: number
  discount_type?: 'percentage' | 'fixed'
  discount_value?: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  deposit_amount: number
  valid_until: string
  status: QuotationStatus
  notes: string
  converted_to_rental_id?: string
  created_by: string
  created_at: string
  updated_at: string
}

// ==================== Invoice Types ====================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled'

export interface InvoiceItem {
  equipment_name: string
  daily_rate: number
  quantity: number
  days: number
  subtotal: number
}

export interface Invoice {
  id: string
  invoice_number: string
  rental_id: string
  rental_number: string
  customer_id: string
  customer_name: string
  customer_email: string
  items: InvoiceItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  deposit_amount: number
  late_fee: number
  damage_fee: number
  grand_total: number
  status: InvoiceStatus
  due_date: string
  paid_amount: number
  payment_date?: string
  payment_method?: string
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

// ==================== Payment Types ====================

export type PaymentType = 'rental' | 'deposit' | 'late_fee' | 'damage_fee' | 'refund'

export interface Payment {
  id: string
  receipt_number: string
  rental_id: string
  invoice_id: string
  customer_id: string
  customer_name: string
  amount: number
  payment_method: PaymentMethod
  payment_type: PaymentType
  reference_number?: string
  notes: string
  created_by: string
  created_at: string
}

// ==================== Service Types ====================

export type ServiceCategory = 'photography' | 'videography' | 'editing' | 'drone' | 'studio' | 'other'
export type PriceUnit = 'per_hour' | 'per_day' | 'per_event' | 'fixed'

export interface Service {
  id: string
  name: string
  category: ServiceCategory
  description: string
  base_price: number
  price_unit: PriceUnit
  duration_hours?: number
  includes: string[]
  image_url?: string
  status: 'active' | 'inactive'
  created_by: string
  created_at: string
  updated_at: string
}

// ==================== Notification Types ====================

export type NotificationType =
  | 'rental_created'
  | 'rental_confirmed'
  | 'payment_received'
  | 'equipment_returned'
  | 'rental_overdue'
  | 'quotation_sent'
  | 'invoice_sent'
  | 'deposit_refunded'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  link: string
  created_at: string
}

// ==================== Business Settings ====================

export interface BusinessSettings {
  business_name: string
  business_address: string
  business_phone: string
  business_email: string
  business_registration: string
  logo_url: string
  bank_name: string
  bank_account: string
  bank_holder: string
  tax_rate: number
  default_terms: string[]
  late_fee_per_day: number
  operating_hours: string
  created_at: string
  updated_at: string
}
