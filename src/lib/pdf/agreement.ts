import jsPDF from 'jspdf'
import type { Rental, BusinessSettings } from '@/types'
import { drawHeader, drawDocumentTitle, drawInfoRow, drawSectionTitle, drawTable, drawTotalRow, drawDivider, drawFooter, pdfFormatCurrency, checkPageBreak } from './helpers'
import { formatDate } from '@/lib/utils'
import { DEFAULT_TERMS } from '@/lib/constants'

export function exportAgreementPDF(rental: Rental, settings: BusinessSettings | null) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const margin = 20
  const pageWidth = pdf.internal.pageSize.getWidth()

  let y = drawHeader(pdf, settings)
  y = drawDocumentTitle(pdf, 'EQUIPMENT RENTAL AGREEMENT', y)

  // Agreement intro
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  const intro = `This Equipment Rental Agreement ("Agreement") is entered into between ${settings?.business_name || 'Camvice Studio'} ("Lessor") and the customer identified below ("Lessee").`
  const introLines = pdf.splitTextToSize(intro, pageWidth - margin * 2)
  pdf.text(introLines, margin, y)
  y += introLines.length * 4 + 5

  // Reference info
  y = drawInfoRow(pdf, 'Rental No:', rental.rental_number, margin, y)
  y = drawInfoRow(pdf, 'Date:', formatDate(rental.created_at), margin, y)
  y += 5

  // Lessee information
  y = drawSectionTitle(pdf, 'Lessee Information', y, margin)
  y = drawInfoRow(pdf, 'Name:', rental.customer_name, margin, y)
  y = drawInfoRow(pdf, 'Phone:', rental.customer_phone, margin, y)
  y = drawInfoRow(pdf, 'Email:', rental.customer_email, margin, y)
  y += 5

  // Rental Period
  y = drawSectionTitle(pdf, 'Rental Period', y, margin)
  y = drawInfoRow(pdf, 'Start Date:', formatDate(rental.rental_start), margin, y)
  y = drawInfoRow(pdf, 'Return Date:', formatDate(rental.rental_end), margin, y)
  const days = rental.items.length > 0 ? rental.items[0].days : 0
  y = drawInfoRow(pdf, 'Duration:', `${days} day${days !== 1 ? 's' : ''}`, margin, y)
  y += 5

  // Equipment table
  y = checkPageBreak(pdf, y, margin, 30)
  y = drawSectionTitle(pdf, 'Equipment Details', y, margin)

  const headers = ['Equipment', 'Serial No', 'Qty', 'Condition', 'Rate/Day', 'Amount']
  const colWidths = [45, 30, 12, 25, 25, 33]

  const rows = rental.items.map(item => [
    item.equipment_name,
    item.serial_number || '-',
    item.quantity.toString(),
    item.condition_out.charAt(0).toUpperCase() + item.condition_out.slice(1),
    item.daily_rate.toFixed(2),
    item.subtotal.toFixed(2),
  ])

  y = drawTable(pdf, headers, rows, colWidths, y, margin)
  y += 5

  // Financial summary
  y = checkPageBreak(pdf, y, margin, 35)
  y = drawSectionTitle(pdf, 'Financial Summary', y, margin)
  y = drawTotalRow(pdf, 'Subtotal:', pdfFormatCurrency(rental.subtotal), y)

  if (rental.discount_amount > 0) {
    y = drawTotalRow(pdf, 'Discount:', `- ${pdfFormatCurrency(rental.discount_amount)}`, y)
  }
  if (rental.tax_amount > 0) {
    y = drawTotalRow(pdf, `SST (${rental.tax_rate}%):`, pdfFormatCurrency(rental.tax_amount), y)
  }

  y = drawDivider(pdf, y)
  y = drawTotalRow(pdf, 'Rental Total:', pdfFormatCurrency(rental.total_amount), y, true)
  y = drawTotalRow(pdf, 'Security Deposit:', pdfFormatCurrency(rental.deposit_amount), y)
  y = drawDivider(pdf, y)
  y = drawTotalRow(pdf, 'Total Payable:', pdfFormatCurrency(rental.total_amount + rental.deposit_amount), y, true)
  y += 10

  // Terms and Conditions
  y = checkPageBreak(pdf, y, margin, 30)
  y = drawSectionTitle(pdf, 'Terms & Conditions', y, margin)

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')

  const terms = settings?.default_terms?.length ? settings.default_terms : DEFAULT_TERMS

  terms.forEach((term, i) => {
    y = checkPageBreak(pdf, y, margin, 10)
    const text = `${i + 1}. ${term}`
    const lines = pdf.splitTextToSize(text, pageWidth - margin * 2)
    pdf.text(lines, margin, y)
    y += lines.length * 3.5 + 2
  })

  y += 10

  // Late fee info
  y = checkPageBreak(pdf, y, margin, 15)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Late Return Fee:', margin, y)
  pdf.setFont('helvetica', 'normal')
  const lateFee = settings?.late_fee_per_day || 50
  pdf.text(`${pdfFormatCurrency(lateFee)} per day`, margin + 35, y)
  y += 10

  // Signature section
  y = checkPageBreak(pdf, y, margin, 50)
  y = drawSectionTitle(pdf, 'Acknowledgement & Signatures', y, margin)

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  const ackText = 'By signing below, the Lessee acknowledges that they have read, understood, and agree to all terms and conditions stated in this agreement. The Lessee confirms receipt of the equipment listed above in the stated condition.'
  const ackLines = pdf.splitTextToSize(ackText, pageWidth - margin * 2)
  pdf.text(ackLines, margin, y)
  y += ackLines.length * 3.5 + 15

  // Lessor signature
  const sigWidth = (pageWidth - margin * 2 - 20) / 2

  pdf.setDrawColor(150, 150, 150)
  pdf.setLineWidth(0.3)

  // Lessor
  pdf.line(margin, y, margin + sigWidth, y)
  y += 5
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Lessor (Authorized Representative)', margin, y)
  y += 4
  pdf.setFont('helvetica', 'normal')
  pdf.text(settings?.business_name || 'Camvice Studio', margin, y)
  y += 4
  pdf.text(`Date: _______________`, margin, y)

  // Lessee
  const lesseeX = margin + sigWidth + 20
  const sigY = y - 13
  pdf.line(lesseeX, sigY, lesseeX + sigWidth, sigY)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Lessee', lesseeX, sigY + 5)
  pdf.setFont('helvetica', 'normal')
  pdf.text(rental.customer_name, lesseeX, sigY + 9)
  pdf.text(`Date: _______________`, lesseeX, sigY + 13)

  drawFooter(pdf, settings)
  pdf.save(`${rental.rental_number}_Agreement.pdf`)
}
