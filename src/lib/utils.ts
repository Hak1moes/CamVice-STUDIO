import { format, differenceInDays, differenceInCalendarDays } from 'date-fns'

export function formatCurrency(amount: number): string {
  return `RM ${amount.toFixed(2)}`
}

export function formatCurrencyShort(amount: number): string {
  if (amount >= 1000000) return `RM ${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `RM ${(amount / 1000).toFixed(1)}K`
  return `RM ${amount.toFixed(2)}`
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy')
}

export function calculateDays(start: string, end: string): number {
  const days = differenceInCalendarDays(new Date(end), new Date(start))
  return Math.max(days, 1)
}

export function calculateLateDays(endDate: string, returnDate: string): number {
  const days = differenceInDays(new Date(returnDate), new Date(endDate))
  return Math.max(days, 0)
}

export async function generateDocNumber(prefix: string, existingNumbers: string[]): Promise<string> {
  const year = new Date().getFullYear()
  const yearPrefix = `${prefix}-${year}-`

  const maxNumber = existingNumbers
    .filter(n => n.startsWith(yearPrefix))
    .map(n => {
      const num = parseInt(n.replace(yearPrefix, ''), 10)
      return isNaN(num) ? 0 : num
    })
    .reduce((max, n) => Math.max(max, n), 0)

  const nextNumber = (maxNumber + 1).toString().padStart(4, '0')
  return `${yearPrefix}${nextNumber}`
}

export function calculateSubtotal(items: { subtotal: number }[]): number {
  return items.reduce((sum, item) => sum + item.subtotal, 0)
}

export function calculateDiscount(subtotal: number, discountType?: 'percentage' | 'fixed', discountValue?: number): number {
  if (!discountType || !discountValue) return 0
  if (discountType === 'percentage') return subtotal * (discountValue / 100)
  return Math.min(discountValue, subtotal)
}

export function calculateTax(amount: number, taxRate: number): number {
  return amount * (taxRate / 100)
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
