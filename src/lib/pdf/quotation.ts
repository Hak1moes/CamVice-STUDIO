import jsPDF from 'jspdf'
import type { Quotation, BusinessSettings } from '@/types'
import { drawHeader, drawDocumentTitle, drawInfoRow, drawSectionTitle, drawTable, drawTotalRow, drawDivider, drawFooter, pdfFormatCurrency, checkPageBreak } from './helpers'
import { formatDate } from '@/lib/utils'
import { QUOTATION_STATUS_LABELS } from '@/lib/constants'

export function exportQuotationPDF(quotation: Quotation, settings: BusinessSettings | null) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const margin = 20

  // Header
  let y = drawHeader(pdf, settings)

  // Document title
  y = drawDocumentTitle(pdf, 'QUOTATION', y)

  // Quotation info (two columns)
  const col2X = 120

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Quotation No:', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(quotation.quotation_number, margin + 35, y)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Status:', col2X, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(QUOTATION_STATUS_LABELS[quotation.status] || quotation.status, col2X + 25, y)
  y += 5

  y = drawInfoRow(pdf, 'Date:', formatDate(quotation.created_at), margin, y)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Valid Until:', col2X, y - 5)
  pdf.setFont('helvetica', 'normal')
  pdf.text(formatDate(quotation.valid_until), col2X + 25, y - 5)

  y += 3

  // Divider
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(margin, y, pdf.internal.pageSize.getWidth() - margin, y)
  y += 8

  // Customer info
  y = drawSectionTitle(pdf, 'Bill To', y, margin)
  y = drawInfoRow(pdf, 'Name:', quotation.customer_name, margin, y)
  y = drawInfoRow(pdf, 'Email:', quotation.customer_email, margin, y)
  y = drawInfoRow(pdf, 'Phone:', quotation.customer_phone, margin, y)
  y += 3

  // Rental period
  y = drawSectionTitle(pdf, 'Rental Period', y, margin)
  y = drawInfoRow(pdf, 'Start Date:', formatDate(quotation.rental_start), margin, y)
  y = drawInfoRow(pdf, 'End Date:', formatDate(quotation.rental_end), margin, y)

  const days = quotation.items.length > 0 ? quotation.items[0].days : 0
  y = drawInfoRow(pdf, 'Duration:', `${days} day${days !== 1 ? 's' : ''}`, margin, y)
  y += 5

  // Items table
  y = checkPageBreak(pdf, y, margin, 30)
  y = drawSectionTitle(pdf, 'Equipment / Items', y, margin)

  const headers = ['Item', 'Qty', 'Days', 'Rate (RM)', 'Amount (RM)']
  const colWidths = [65, 15, 15, 35, 40]

  const rows = quotation.items.map(item => [
    item.equipment_name,
    item.quantity.toString(),
    item.days.toString(),
    item.daily_rate.toFixed(2),
    item.subtotal.toFixed(2),
  ])

  y = drawTable(pdf, headers, rows, colWidths, y, margin)
  y += 5

  // Totals
  y = checkPageBreak(pdf, y, margin, 40)
  y = drawTotalRow(pdf, 'Subtotal:', pdfFormatCurrency(quotation.subtotal), y)

  if (quotation.discount_amount > 0) {
    const discountLabel = quotation.discount_type === 'percentage'
      ? `Discount (${quotation.discount_value}%):`
      : 'Discount:'
    y = drawTotalRow(pdf, discountLabel, `- ${pdfFormatCurrency(quotation.discount_amount)}`, y)
  }

  if (quotation.tax_amount > 0) {
    y = drawTotalRow(pdf, `SST (${quotation.tax_rate}%):`, pdfFormatCurrency(quotation.tax_amount), y)
  }

  y = drawDivider(pdf, y)
  y = drawTotalRow(pdf, 'Total:', pdfFormatCurrency(quotation.total_amount), y, true)
  y = drawTotalRow(pdf, 'Security Deposit:', pdfFormatCurrency(quotation.deposit_amount), y)
  y = drawDivider(pdf, y)
  y = drawTotalRow(pdf, 'Grand Total:', pdfFormatCurrency(quotation.total_amount + quotation.deposit_amount), y, true)
  y += 8

  // Notes
  if (quotation.notes) {
    y = checkPageBreak(pdf, y, margin, 20)
    y = drawSectionTitle(pdf, 'Notes', y, margin)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    const noteLines = pdf.splitTextToSize(quotation.notes, pdf.internal.pageSize.getWidth() - margin * 2)
    pdf.text(noteLines, margin, y)
    y += noteLines.length * 4 + 5
  }

  // Terms
  y = checkPageBreak(pdf, y, margin, 20)
  y = drawSectionTitle(pdf, 'Terms & Conditions', y, margin)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)

  const defaultTerms = [
    `This quotation is valid until ${formatDate(quotation.valid_until)}.`,
    'Prices are subject to equipment availability.',
    'A security deposit is required before equipment handover.',
    'Full payment must be made before the rental start date.',
  ]

  const terms = settings?.default_terms?.length ? settings.default_terms : defaultTerms
  terms.forEach((term, i) => {
    y = checkPageBreak(pdf, y, margin, 8)
    const text = `${i + 1}. ${term}`
    const lines = pdf.splitTextToSize(text, pdf.internal.pageSize.getWidth() - margin * 2)
    pdf.text(lines, margin, y)
    y += lines.length * 3.5 + 2
  })

  pdf.setTextColor(0, 0, 0)

  // Footer
  drawFooter(pdf, settings)

  pdf.save(`${quotation.quotation_number}_Quotation.pdf`)
}
