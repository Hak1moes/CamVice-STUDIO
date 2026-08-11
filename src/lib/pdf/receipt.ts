import jsPDF from 'jspdf'
import type { Payment, Rental, BusinessSettings } from '@/types'
import { drawHeader, drawDocumentTitle, drawInfoRow, drawSectionTitle, drawDivider, drawFooter, pdfFormatCurrency, checkPageBreak } from './helpers'
import { formatDate, formatDateTime } from '@/lib/utils'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  card: 'Credit/Debit Card',
  ewallet: 'E-Wallet',
  other: 'Other',
}

export function exportReceiptPDF(payment: Payment, rental: Rental | null, settings: BusinessSettings | null) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const margin = 20

  let y = drawHeader(pdf, settings)
  y = drawDocumentTitle(pdf, 'PAYMENT RECEIPT', y)

  // Receipt info
  y = drawInfoRow(pdf, 'Receipt No:', payment.receipt_number, margin, y)
  y = drawInfoRow(pdf, 'Date:', formatDateTime(payment.created_at), margin, y)

  if (rental) {
    y = drawInfoRow(pdf, 'Rental No:', rental.rental_number, margin, y)
  }
  y += 3

  // Divider
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(margin, y, pdf.internal.pageSize.getWidth() - margin, y)
  y += 8

  // Customer info
  y = drawSectionTitle(pdf, 'Received From', y, margin)
  y = drawInfoRow(pdf, 'Name:', payment.customer_name, margin, y)

  if (rental) {
    y = drawInfoRow(pdf, 'Phone:', rental.customer_phone, margin, y)
    y = drawInfoRow(pdf, 'Email:', rental.customer_email, margin, y)
  }
  y += 8

  // Payment details box
  y = checkPageBreak(pdf, y, margin, 50)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const boxWidth = pageWidth - margin * 2

  // Box background
  pdf.setFillColor(241, 245, 249) // slate-100
  pdf.roundedRect(margin, y, boxWidth, 45, 3, 3, 'F')

  y += 8
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 41, 59)
  pdf.text('Payment Details', margin + 10, y)
  y += 8

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(71, 85, 105)

  pdf.text('Amount Paid:', margin + 10, y)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(22, 163, 74) // green
  pdf.text(pdfFormatCurrency(payment.amount), margin + 50, y)
  pdf.setTextColor(0, 0, 0)
  y += 8

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(71, 85, 105)
  pdf.text('Payment Method:', margin + 10, y)
  pdf.setFont('helvetica', 'bold')
  pdf.text(PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method, margin + 50, y)
  y += 6

  if (payment.reference_number) {
    pdf.setFont('helvetica', 'normal')
    pdf.text('Reference No:', margin + 10, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(payment.reference_number, margin + 50, y)
    y += 6
  }

  pdf.setFont('helvetica', 'normal')
  pdf.text('Payment Type:', margin + 10, y)
  pdf.setFont('helvetica', 'bold')
  const typeLabels: Record<string, string> = {
    rental: 'Rental Payment',
    deposit: 'Security Deposit',
    late_fee: 'Late Fee',
    damage_fee: 'Damage Fee',
    refund: 'Refund',
  }
  pdf.text(typeLabels[payment.payment_type] || payment.payment_type, margin + 50, y)

  pdf.setTextColor(0, 0, 0)
  y += 15

  // Rental summary if available
  if (rental) {
    y = checkPageBreak(pdf, y, margin, 30)
    y = drawSectionTitle(pdf, 'Rental Summary', y, margin)
    y = drawInfoRow(pdf, 'Period:', `${formatDate(rental.rental_start)} - ${formatDate(rental.rental_end)}`, margin, y)
    y = drawInfoRow(pdf, 'Items:', `${rental.items.length} item${rental.items.length !== 1 ? 's' : ''}`, margin, y)
    y = drawInfoRow(pdf, 'Total:', pdfFormatCurrency(rental.total_amount), margin, y)
    y = drawInfoRow(pdf, 'Deposit:', pdfFormatCurrency(rental.deposit_amount), margin, y)
    y = drawInfoRow(pdf, 'Paid:', pdfFormatCurrency(rental.amount_paid), margin, y)
    y += 5
  }

  // Notes
  if (payment.notes) {
    y = checkPageBreak(pdf, y, margin, 15)
    y = drawSectionTitle(pdf, 'Notes', y, margin)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    const noteLines = pdf.splitTextToSize(payment.notes, pageWidth - margin * 2)
    pdf.text(noteLines, margin, y)
    y += noteLines.length * 4 + 5
  }

  // Thank you message
  y = checkPageBreak(pdf, y, margin, 20)
  y += 10
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 41, 59)
  pdf.text('Thank you for your payment!', pageWidth / 2, y, { align: 'center' })
  y += 5
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  pdf.text('This receipt serves as proof of payment.', pageWidth / 2, y, { align: 'center' })
  pdf.setTextColor(0, 0, 0)

  drawFooter(pdf, settings)
  pdf.save(`${payment.receipt_number}_Receipt.pdf`)
}
