import jsPDF from 'jspdf'
import type { Invoice, Rental, BusinessSettings } from '@/types'
import { drawHeader, drawDocumentTitle, drawInfoRow, drawSectionTitle, drawTable, drawTotalRow, drawDivider, drawFooter, drawBankDetails, pdfFormatCurrency, checkPageBreak } from './helpers'
import { formatDate } from '@/lib/utils'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'

export function exportInvoicePDF(invoice: Invoice, rental: Rental | null, settings: BusinessSettings | null) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const margin = 20

  let y = drawHeader(pdf, settings)
  y = drawDocumentTitle(pdf, 'INVOICE', y)

  // Invoice info
  const col2X = 120

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Invoice No:', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(invoice.invoice_number, margin + 30, y)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Status:', col2X, y)
  pdf.setFont('helvetica', 'normal')
  const statusText = INVOICE_STATUS_LABELS[invoice.status] || invoice.status
  if (invoice.status === 'paid') {
    pdf.setTextColor(22, 163, 74) // green
  } else if (invoice.status === 'overdue') {
    pdf.setTextColor(220, 38, 38) // red
  }
  pdf.text(statusText, col2X + 20, y)
  pdf.setTextColor(0, 0, 0)
  y += 5

  y = drawInfoRow(pdf, 'Date:', formatDate(invoice.created_at), margin, y)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Due Date:', col2X, y - 5)
  pdf.setFont('helvetica', 'normal')
  pdf.text(formatDate(invoice.due_date), col2X + 25, y - 5)

  y = drawInfoRow(pdf, 'Rental No:', invoice.rental_number, margin, y)
  y += 3

  // Divider
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(margin, y, pdf.internal.pageSize.getWidth() - margin, y)
  y += 8

  // Customer info
  y = drawSectionTitle(pdf, 'Bill To', y, margin)
  y = drawInfoRow(pdf, 'Name:', invoice.customer_name, margin, y)
  y = drawInfoRow(pdf, 'Email:', invoice.customer_email, margin, y)

  if (rental) {
    y = drawInfoRow(pdf, 'Phone:', rental.customer_phone, margin, y)
  }
  y += 3

  // Rental period
  if (rental) {
    y = drawSectionTitle(pdf, 'Rental Period', y, margin)
    y = drawInfoRow(pdf, 'Start:', formatDate(rental.rental_start), margin, y)
    y = drawInfoRow(pdf, 'End:', formatDate(rental.rental_end), margin, y)
    y += 5
  }

  // Items table
  y = checkPageBreak(pdf, y, margin, 30)
  y = drawSectionTitle(pdf, 'Items', y, margin)

  const headers = ['Description', 'Qty', 'Days', 'Rate (RM)', 'Amount (RM)']
  const colWidths = [65, 15, 15, 35, 40]

  const rows = invoice.items.map(item => [
    item.equipment_name,
    item.quantity.toString(),
    item.days.toString(),
    item.daily_rate.toFixed(2),
    item.subtotal.toFixed(2),
  ])

  y = drawTable(pdf, headers, rows, colWidths, y, margin)
  y += 5

  // Totals
  y = checkPageBreak(pdf, y, margin, 60)
  y = drawTotalRow(pdf, 'Subtotal:', pdfFormatCurrency(invoice.subtotal), y)

  if (invoice.discount_amount > 0) {
    y = drawTotalRow(pdf, 'Discount:', `- ${pdfFormatCurrency(invoice.discount_amount)}`, y)
  }

  if (invoice.tax_amount > 0) {
    y = drawTotalRow(pdf, 'SST:', pdfFormatCurrency(invoice.tax_amount), y)
  }

  y = drawDivider(pdf, y)
  y = drawTotalRow(pdf, 'Rental Total:', pdfFormatCurrency(invoice.total_amount), y, true)
  y = drawTotalRow(pdf, 'Security Deposit:', pdfFormatCurrency(invoice.deposit_amount), y)

  if (invoice.late_fee > 0) {
    y = drawTotalRow(pdf, 'Late Fee:', pdfFormatCurrency(invoice.late_fee), y)
  }
  if (invoice.damage_fee > 0) {
    y = drawTotalRow(pdf, 'Damage Fee:', pdfFormatCurrency(invoice.damage_fee), y)
  }

  y = drawDivider(pdf, y)
  y = drawTotalRow(pdf, 'Grand Total:', pdfFormatCurrency(invoice.grand_total), y, true)

  if (invoice.paid_amount > 0) {
    y += 2
    y = drawTotalRow(pdf, 'Amount Paid:', pdfFormatCurrency(invoice.paid_amount), y)
    const balance = invoice.grand_total - invoice.paid_amount
    if (balance > 0) {
      y = drawTotalRow(pdf, 'Balance Due:', pdfFormatCurrency(balance), y, true)
    }
  }

  y += 8

  // Bank details
  y = drawBankDetails(pdf, settings, y, margin)

  // Payment terms
  y = checkPageBreak(pdf, y, margin, 25)
  y = drawSectionTitle(pdf, 'Payment Terms', y, margin)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  const paymentTerms = [
    `Payment is due by ${formatDate(invoice.due_date)}.`,
    'Please include the invoice number as payment reference.',
    'Late payments may incur additional charges.',
  ]
  paymentTerms.forEach((term, i) => {
    pdf.text(`${i + 1}. ${term}`, margin, y)
    y += 4
  })
  pdf.setTextColor(0, 0, 0)

  // Notes
  if (invoice.notes) {
    y += 3
    y = checkPageBreak(pdf, y, margin, 15)
    y = drawSectionTitle(pdf, 'Notes', y, margin)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    const noteLines = pdf.splitTextToSize(invoice.notes, pdf.internal.pageSize.getWidth() - margin * 2)
    pdf.text(noteLines, margin, y)
  }

  // PAID stamp
  if (invoice.status === 'paid') {
    const centerX = pdf.internal.pageSize.getWidth() / 2
    const centerY = pdf.internal.pageSize.getHeight() / 2
    pdf.setFontSize(60)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(22, 163, 74)
    pdf.text('PAID', centerX, centerY, { align: 'center', angle: 30 })
    pdf.setTextColor(0, 0, 0)
  }

  drawFooter(pdf, settings)
  pdf.save(`${invoice.invoice_number}_Invoice.pdf`)
}
