import jsPDF from 'jspdf'
import type { Payment, Rental, BusinessSettings } from '@/types'
import { checkPageBreak, pdfFormatCurrency } from './helpers'
import { formatDate, formatDateTime } from '@/lib/utils'

const DEFAULT_BUSINESS = {
  name: 'Camvice Studio',
  ssm: '202503226884 (JM1030069-X)',
  address: 'F-20-08, F, Pangsapuri Idaman Abadi Fasa 2, 43500, Semenyih, Selangor',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  card: 'Credit/Debit Card',
  ewallet: 'E-Wallet',
  other: 'Other',
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  rental: 'Rental Payment',
  deposit: 'Security Deposit',
  late_fee: 'Late Fee',
  damage_fee: 'Damage Fee',
  refund: 'Refund',
}

export function exportReceiptPDF(payment: Payment, rental: Rental | null, settings: BusinessSettings | null) {
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

  // Right — "RECEIPT" title + meta
  let rY = 20
  pdf.setFontSize(26)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text('RECEIPT', rightMargin, rY, { align: 'right' })
  rY += 10

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text(payment.receipt_number, rightMargin, rY, { align: 'right' })
  rY += 5

  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(90, 90, 90)
  pdf.text(`Date: ${formatDateTime(payment.created_at)}`, rightMargin, rY, { align: 'right' })
  rY += 5

  if (rental) {
    pdf.text(`Rental: ${rental.rental_number}`, rightMargin, rY, { align: 'right' })
    rY += 5
  }

  pdf.setTextColor(0, 0, 0)
  y = Math.max(y, rY) + 5

  // ─── THICK DIVIDER ───────────────────────────────────────────────────────
  pdf.setDrawColor(23, 23, 23)
  pdf.setLineWidth(0.8)
  pdf.line(margin, y, rightMargin, y)
  y += 8

  // ─── RECEIVED FROM ───────────────────────────────────────────────────────
  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(120, 120, 120)
  pdf.text('RECEIVED FROM', margin, y)
  y += 5

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text(payment.customer_name, margin, y)
  y += 5

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(70, 70, 70)
  if (rental?.customer_phone) { pdf.text(rental.customer_phone, margin, y); y += 4 }
  if (rental?.customer_email) { pdf.text(rental.customer_email, margin, y); y += 4 }
  pdf.setTextColor(0, 0, 0)
  y += 6

  // ─── LIGHT DIVIDER ───────────────────────────────────────────────────────
  pdf.setDrawColor(210, 210, 210)
  pdf.setLineWidth(0.3)
  pdf.line(margin, y, rightMargin, y)
  y += 8

  // ─── AMOUNT PAID BOX ─────────────────────────────────────────────────────
  y = checkPageBreak(pdf, y, margin, 50)

  const boxW = pageWidth - margin * 2
  const boxH = 38
  pdf.setFillColor(23, 23, 23)
  pdf.roundedRect(margin, y, boxW, boxH, 3, 3, 'F')

  // Amount label
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(180, 180, 180)
  pdf.text('AMOUNT PAID', margin + 10, y + 10)

  // Big amount
  pdf.setFontSize(28)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text(pdfFormatCurrency(payment.amount), margin + 10, y + 24)

  // Payment method & type (right side)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(180, 180, 180)
  pdf.text('METHOD', rightMargin - 10, y + 10, { align: 'right' })
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text(PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method, rightMargin - 10, y + 17, { align: 'right' })

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(180, 180, 180)
  pdf.text('TYPE', rightMargin - 10, y + 25, { align: 'right' })
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text(PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type, rightMargin - 10, y + 32, { align: 'right' })

  pdf.setTextColor(0, 0, 0)
  y += boxH + 10

  // ─── PAYMENT DETAILS ─────────────────────────────────────────────────────
  y = checkPageBreak(pdf, y, margin, 35)

  const addDetailRow = (label: string, value: string) => {
    pdf.setFontSize(8.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(120, 120, 120)
    pdf.text(label, margin, y)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    pdf.text(value, margin + 45, y)
    pdf.setTextColor(0, 0, 0)
    y += 6
  }

  if (payment.reference_number) {
    addDetailRow('Reference No', payment.reference_number)
  }

  if (rental) {
    addDetailRow('Rental Period', `${formatDate(rental.rental_start)}  –  ${formatDate(rental.rental_end)}`)
    addDetailRow('Items', `${rental.items.length} item${rental.items.length !== 1 ? 's' : ''}`)
  }

  y += 4

  // ─── RENTAL SUMMARY TABLE ────────────────────────────────────────────────
  if (rental) {
    y = checkPageBreak(pdf, y, margin, 40)

    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(120, 120, 120)
    pdf.text('RENTAL SUMMARY', margin, y)
    y += 6

    const colWidths = [112, 28, 30]
    const tableW = colWidths.reduce((a, b) => a + b, 0)
    const rowH = 7

    // Header
    pdf.setFillColor(23, 23, 23)
    pdf.rect(margin, y - 4.5, tableW, rowH, 'F')
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)

    const tHeaders = ['ITEM', 'QTY', 'SUBTOTAL']
    let xPos = margin + 3
    tHeaders.forEach((h, i) => {
      if (i === 0) pdf.text(h, xPos, y)
      else pdf.text(h, xPos + colWidths[i] - 3, y, { align: 'right' })
      xPos += colWidths[i]
    })
    y += rowH - 1
    pdf.setTextColor(0, 0, 0)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)

    rental.items.forEach((item, idx) => {
      y = checkPageBreak(pdf, y, margin, rowH)
      if (idx % 2 === 1) {
        pdf.setFillColor(248, 248, 248)
        pdf.rect(margin, y - 4.5, tableW, rowH, 'F')
      }
      pdf.setDrawColor(230, 230, 230)
      pdf.line(margin, y + rowH - 5, margin + tableW, y + rowH - 5)

      xPos = margin + 3
      const cells = [item.equipment_name, item.quantity.toString(), item.subtotal.toFixed(2)]
      cells.forEach((cell, i) => {
        if (i === 0) {
          const w = pdf.splitTextToSize(cell, colWidths[i] - 6)
          pdf.text(w[0] || '', xPos, y)
        } else {
          pdf.text(cell, xPos + colWidths[i] - 3, y, { align: 'right' })
        }
        xPos += colWidths[i]
      })
      y += rowH
    })

    y += 5

    // Totals
    const lX = rightMargin - 65
    const vX = rightMargin

    const tRow = (label: string, value: string, bold = false, color: [number, number, number] = [80, 80, 80]) => {
      pdf.setFontSize(9)
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      pdf.setTextColor(...color)
      pdf.text(label, lX, y)
      pdf.text(value, vX, y, { align: 'right' })
      pdf.setTextColor(0, 0, 0)
      y += 5
    }

    tRow('Rental Total', pdfFormatCurrency(rental.total_amount))
    tRow('Security Deposit', pdfFormatCurrency(rental.deposit_amount))

    pdf.setDrawColor(23, 23, 23)
    pdf.setLineWidth(0.4)
    pdf.line(lX, y, vX, y)
    y += 5

    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(23, 23, 23)
    pdf.text('AMOUNT PAID', lX, y)
    pdf.text(pdfFormatCurrency(payment.amount), vX, y, { align: 'right' })
    y += 5

    const balance = (rental.total_amount + rental.deposit_amount) - (rental.amount_paid || 0)
    if (balance > 0) {
      pdf.setFontSize(9)
      tRow('Balance Due', pdfFormatCurrency(balance), true, [220, 38, 38])
    } else {
      pdf.setFontSize(9)
      tRow('Balance Due', 'RM 0.00  ✓', false, [22, 163, 74])
    }

    y += 4
  }

  // ─── NOTES ───────────────────────────────────────────────────────────────
  if (payment.notes) {
    y = checkPageBreak(pdf, y, margin, 20)
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(120, 120, 120)
    pdf.text('NOTES', margin, y)
    y += 5
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)
    const noteLines = pdf.splitTextToSize(payment.notes, pageWidth - margin * 2)
    pdf.text(noteLines, margin, y)
    y += noteLines.length * 4 + 6
    pdf.setTextColor(0, 0, 0)
  }

  // ─── THANK YOU ───────────────────────────────────────────────────────────
  const thankY = Math.max(y + 6, pageHeight - 28)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23)
  pdf.text('Thank You for Your Payment!', rightMargin, thankY, { align: 'right' })

  // ─── FOOTER ──────────────────────────────────────────────────────────────
  pdf.setDrawColor(210, 210, 210)
  pdf.setLineWidth(0.3)
  pdf.line(margin, pageHeight - 15, rightMargin, pageHeight - 15)

  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(150, 150, 150)
  pdf.text('This receipt serves as proof of payment.', margin, pageHeight - 10)
  pdf.text(`Generated ${new Date().toLocaleDateString('en-MY')}`, rightMargin, pageHeight - 10, { align: 'right' })

  pdf.save(`${payment.receipt_number}_Receipt.pdf`)
}
