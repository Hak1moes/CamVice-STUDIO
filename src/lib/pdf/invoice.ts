import jsPDF from 'jspdf'
import type { Invoice, Rental, BusinessSettings } from '@/types'
import { checkPageBreak, pdfFormatCurrency } from './helpers'
import { formatDate } from '@/lib/utils'

const DEFAULT_BUSINESS = {
  name: 'Camvice Studio',
  ssm: '202503226884 (JM1030069-X)',
  address: 'F-20-08, F, Pangsapuri Idaman Abadi Fasa 2, 43500, Semenyih, Selangor',
}

export function exportInvoicePDF(invoice: Invoice, rental: Rental | null, settings: BusinessSettings | null, output: 'download' | 'datauristring' = 'download'): string | void {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const rightMargin = pageWidth - margin

  const bizName = settings?.business_name || DEFAULT_BUSINESS.name
  const bizSSM = settings?.business_registration || DEFAULT_BUSINESS.ssm
  const bizAddress = settings?.business_address || DEFAULT_BUSINESS.address
  const bizPhone = settings?.business_phone || ''
  const bizEmail = settings?.business_email || ''

  // ─── HEADER: 2-column ────────────────────────────────────────────────────
  let y = 20
  const rightColStartY = 20

  // Left — business identity
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text(bizName, margin, y)
  y += 7

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(90, 90, 90)

  if (bizSSM) {
    pdf.text(`SSM: ${bizSSM}`, margin, y)
    y += 4
  }

  const addressLines = pdf.splitTextToSize(bizAddress, 85)
  pdf.text(addressLines, margin, y)
  y += addressLines.length * 4

  if (bizPhone) { pdf.text(bizPhone, margin, y); y += 4 }
  if (bizEmail) { pdf.text(bizEmail, margin, y); y += 4 }

  // Right — "INVOICE" + meta
  let rY = rightColStartY
  pdf.setFontSize(30)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text('INVOICE', rightMargin, rY, { align: 'right' })
  rY += 10

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text(invoice.invoice_number, rightMargin, rY, { align: 'right' })
  rY += 5

  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(90, 90, 90)
  pdf.text(`Date: ${formatDate(invoice.created_at)}`, rightMargin, rY, { align: 'right' })
  rY += 5
  pdf.text(`Due: ${formatDate(invoice.due_date)}`, rightMargin, rY, { align: 'right' })
  rY += 5

  if (invoice.status === 'paid') {
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(22, 163, 74)
    pdf.text('● PAID', rightMargin, rY, { align: 'right' })
    rY += 5
  } else if (invoice.status === 'overdue') {
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(220, 38, 38)
    pdf.text('● OVERDUE', rightMargin, rY, { align: 'right' })
    rY += 5
  }

  pdf.setTextColor(0, 0, 0)
  y = Math.max(y, rY) + 5

  // ─── THICK DIVIDER ───────────────────────────────────────────────────────
  pdf.setDrawColor(23, 23, 23)
  pdf.setLineWidth(0.8)
  pdf.line(margin, y, rightMargin, y)
  y += 8

  // ─── BILL TO + RENTAL INFO (2-column) ────────────────────────────────────
  const midX = pageWidth / 2

  // Bill To — left
  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(120, 120, 120)
  pdf.text('BILL TO', margin, y)

  // Rental info — right
  if (rental) {
    pdf.text('RENTAL PERIOD', midX, y)
  }
  y += 5

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text(invoice.customer_name, margin, y)

  if (rental) {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)
    pdf.text(`${formatDate(rental.rental_start)}  –  ${formatDate(rental.rental_end)}`, midX, y)
  }
  y += 5

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(70, 70, 70)

  if (invoice.customer_email) { pdf.text(invoice.customer_email, margin, y); y += 4 }
  if (rental?.customer_phone) { pdf.text(rental.customer_phone, margin, y); y += 4 }

  if (rental && invoice.rental_number) {
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(120, 120, 120)
    const refY = y - (invoice.customer_email ? 8 : 4)
    pdf.text('RENTAL REF', midX, refY + 4)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(60, 60, 60)
    pdf.text(invoice.rental_number, midX, refY + 9)
  }

  pdf.setTextColor(0, 0, 0)
  y += 6

  // ─── LIGHT DIVIDER ───────────────────────────────────────────────────────
  pdf.setDrawColor(210, 210, 210)
  pdf.setLineWidth(0.3)
  pdf.line(margin, y, rightMargin, y)
  y += 8

  // ─── ITEMS TABLE ─────────────────────────────────────────────────────────
  y = checkPageBreak(pdf, y, margin, 30)

  const colWidths = [74, 16, 16, 32, 32]
  const tableWidth = colWidths.reduce((a, b) => a + b, 0)
  const rowH = 7

  // Header — dark bar
  pdf.setFillColor(23, 23, 23)
  pdf.rect(margin, y - 4.5, tableWidth, rowH, 'F')

  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)

  const tableHeaders = ['DESCRIPTION', 'QTY', 'DAYS', 'PRICE (RM)', 'TOTAL (RM)']
  let xPos = margin + 3
  tableHeaders.forEach((h, i) => {
    if (i === 0) {
      pdf.text(h, xPos, y)
    } else {
      pdf.text(h, xPos + colWidths[i] - 3, y, { align: 'right' })
    }
    xPos += colWidths[i]
  })
  y += rowH - 1
  pdf.setTextColor(0, 0, 0)

  // Rows
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)

  invoice.items.forEach((item, idx) => {
    const descLines = pdf.splitTextToSize(item.equipment_name, colWidths[0] - 6)
    const lineH = 4.5
    const dynamicRowH = Math.max(rowH, descLines.length * lineH + 3)

    y = checkPageBreak(pdf, y, margin, dynamicRowH)

    if (idx % 2 === 1) {
      pdf.setFillColor(248, 248, 248)
      pdf.rect(margin, y - 4.5, tableWidth, dynamicRowH, 'F')
    }

    pdf.setDrawColor(230, 230, 230)
    pdf.line(margin, y + dynamicRowH - 5, margin + tableWidth, y + dynamicRowH - 5)

    xPos = margin + 3
    pdf.text(descLines, xPos, y)
    xPos += colWidths[0]

    const numericCells = [
      item.quantity.toString(),
      item.days.toString(),
      item.daily_rate.toFixed(2),
      item.subtotal.toFixed(2),
    ]
    numericCells.forEach((cell, i) => {
      pdf.text(cell, xPos + colWidths[i + 1] - 3, y, { align: 'right' })
      xPos += colWidths[i + 1]
    })

    y += dynamicRowH
  })

  y += 6

  // ─── TOTALS ───────────────────────────────────────────────────────────────
  y = checkPageBreak(pdf, y, margin, 60)

  const labelX = rightMargin - 65
  const valX = rightMargin

  const addTotalRow = (
    label: string,
    value: string,
    bold = false,
    color: [number, number, number] = [60, 60, 60]
  ) => {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setTextColor(...color)
    pdf.text(label, labelX, y)
    pdf.text(value, valX, y, { align: 'right' })
    pdf.setTextColor(0, 0, 0)
    y += 5
  }

  addTotalRow('Subtotal', pdfFormatCurrency(invoice.subtotal))

  if (invoice.discount_amount > 0) {
    addTotalRow('Discount', `- ${pdfFormatCurrency(invoice.discount_amount)}`)
  }
  if (invoice.tax_amount > 0) {
    addTotalRow('SST', pdfFormatCurrency(invoice.tax_amount))
  }
  if (invoice.deposit_amount > 0) {
    addTotalRow('Security Deposit', pdfFormatCurrency(invoice.deposit_amount))
  }
  if (invoice.late_fee > 0) {
    addTotalRow('Late Fee', pdfFormatCurrency(invoice.late_fee), false, [220, 38, 38])
  }
  if (invoice.damage_fee > 0) {
    addTotalRow('Damage Fee', pdfFormatCurrency(invoice.damage_fee), false, [220, 38, 38])
  }

  // Total line
  pdf.setDrawColor(23, 23, 23)
  pdf.setLineWidth(0.5)
  pdf.line(labelX, y, valX, y)
  y += 5

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text('TOTAL', labelX, y)
  pdf.text(pdfFormatCurrency(invoice.grand_total), valX, y, { align: 'right' })
  y += 6

  if (invoice.paid_amount > 0) {
    addTotalRow('Amount Paid', pdfFormatCurrency(invoice.paid_amount), false, [22, 163, 74])
    const balance = invoice.grand_total - invoice.paid_amount
    if (balance > 0) {
      addTotalRow('Balance Due', pdfFormatCurrency(balance), true, [220, 38, 38])
    }
  }

  y += 8

  // ─── NOTES ───────────────────────────────────────────────────────────────
  if (invoice.notes) {
    y = checkPageBreak(pdf, y, margin, 20)
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(120, 120, 120)
    pdf.text('NOTES', margin, y)
    y += 5
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)
    const noteLines = pdf.splitTextToSize(invoice.notes, pageWidth - margin * 2)
    pdf.text(noteLines, margin, y)
    y += noteLines.length * 4 + 6
    pdf.setTextColor(0, 0, 0)
  }

  // ─── PAYMENT INFORMATION BOX ─────────────────────────────────────────────
  if (settings?.bank_name || settings?.bank_account || settings?.bank_holder) {
    y = checkPageBreak(pdf, y, margin, 48)

    const boxH = 46
    pdf.setFillColor(246, 246, 246)
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, 'FD')

    const bx = margin + 6
    const rx = margin + (pageWidth - margin * 2) / 2 + 4
    let by = y + 8

    // Section title
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(120, 120, 120)
    pdf.text('PAYMENT INFORMATION', bx, by)
    by += 7

    // Row 1 — labels (small gray)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(150, 150, 150)
    if (settings?.bank_holder) pdf.text('Account Name', bx, by)
    if (settings?.bank_name) pdf.text('Bank', rx, by)
    by += 4

    // Row 1 — values (bold dark)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    if (settings?.bank_holder) {
      const maxW = rx - bx - 6
      const truncated = pdf.splitTextToSize(settings.bank_holder, maxW)[0] || ''
      pdf.text(truncated, bx, by)
    }
    if (settings?.bank_name) pdf.text(settings.bank_name, rx, by)
    by += 8

    // Row 2 — labels
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(150, 150, 150)
    if (settings?.bank_account) pdf.text('Account No', bx, by)
    if (bizEmail) pdf.text('Email', rx, by)
    by += 4

    // Row 2 — values
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    if (settings?.bank_account) pdf.text(settings.bank_account, bx, by)
    if (bizEmail) {
      const maxW = rightMargin - rx - 4
      const truncated = pdf.splitTextToSize(bizEmail, maxW)[0] || ''
      pdf.text(truncated, rx, by)
    }

    pdf.setTextColor(0, 0, 0)
    y += boxH + 8
  }

  // ─── THANK YOU ───────────────────────────────────────────────────────────
  const thankY = Math.max(y + 6, pageHeight - 28)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text('Thank You!', rightMargin, thankY, { align: 'right' })

  // ─── FOOTER LINE ─────────────────────────────────────────────────────────
  pdf.setDrawColor(210, 210, 210)
  pdf.setLineWidth(0.3)
  pdf.line(margin, pageHeight - 15, rightMargin, pageHeight - 15)

  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(150, 150, 150)
  pdf.text(bizEmail || bizName, margin, pageHeight - 10)
  pdf.text(`Generated ${new Date().toLocaleDateString('en-MY')}`, rightMargin, pageHeight - 10, { align: 'right' })

  if (output === 'datauristring') return pdf.output('datauristring')
  pdf.save(`${invoice.invoice_number}_Invoice.pdf`)
}
