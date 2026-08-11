import jsPDF from 'jspdf'
import type { Rental, BusinessSettings } from '@/types'
import { drawHeader, drawDocumentTitle, drawInfoRow, drawSectionTitle, drawTable, drawTotalRow, drawDivider, drawFooter, pdfFormatCurrency, checkPageBreak } from './helpers'
import { formatDate } from '@/lib/utils'

export function exportReturnChecklistPDF(rental: Rental, settings: BusinessSettings | null) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const margin = 20
  const pageWidth = pdf.internal.pageSize.getWidth()

  let y = drawHeader(pdf, settings)
  y = drawDocumentTitle(pdf, 'EQUIPMENT RETURN CHECKLIST', y)

  // Basic info
  y = drawInfoRow(pdf, 'Rental No:', rental.rental_number, margin, y)
  y = drawInfoRow(pdf, 'Customer:', rental.customer_name, margin, y)
  y = drawInfoRow(pdf, 'Phone:', rental.customer_phone, margin, y)
  y += 3

  // Dates
  y = drawSectionTitle(pdf, 'Rental Dates', y, margin)
  y = drawInfoRow(pdf, 'Start Date:', formatDate(rental.rental_start), margin, y)
  y = drawInfoRow(pdf, 'End Date:', formatDate(rental.rental_end), margin, y)
  y = drawInfoRow(pdf, 'Return Date:', rental.actual_return_date ? formatDate(rental.actual_return_date) : formatDate(new Date().toISOString()), margin, y)

  // Check if late
  const endDate = new Date(rental.rental_end)
  const returnDate = rental.actual_return_date ? new Date(rental.actual_return_date) : new Date()
  const lateDays = Math.max(0, Math.floor((returnDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)))

  if (lateDays > 0) {
    pdf.setTextColor(220, 38, 38) // red
    y = drawInfoRow(pdf, 'Late Days:', `${lateDays} day${lateDays !== 1 ? 's' : ''}`, margin, y)
    pdf.setTextColor(0, 0, 0)
  }
  y += 5

  // Equipment condition table
  y = checkPageBreak(pdf, y, margin, 30)
  y = drawSectionTitle(pdf, 'Equipment Condition', y, margin)

  const headers = ['Equipment', 'Serial No', 'Condition Out', 'Condition In', 'Notes']
  const colWidths = [40, 28, 28, 28, 46]

  const rows = rental.items.map(item => {
    const condOut = item.condition_out ? item.condition_out.charAt(0).toUpperCase() + item.condition_out.slice(1) : '-'
    const condIn = item.condition_in ? item.condition_in.charAt(0).toUpperCase() + item.condition_in.slice(1) : 'Pending'
    return [
      item.equipment_name,
      item.serial_number || '-',
      condOut,
      condIn,
      item.condition_notes_in || '-',
    ]
  })

  y = drawTable(pdf, headers, rows, colWidths, y, margin)
  y += 5

  // General checklist
  y = checkPageBreak(pdf, y, margin, 40)
  y = drawSectionTitle(pdf, 'Return Checklist', y, margin)

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  const checklistItems = [
    'All equipment items returned',
    'Camera body in working condition',
    'Lens clean and undamaged',
    'Battery and charger returned',
    'Memory cards returned and cleared',
    'Camera strap / body cap included',
    'All cables and accessories accounted for',
    'Equipment bag / case returned',
    'No visible physical damage',
    'All serial numbers verified',
  ]

  checklistItems.forEach((item) => {
    y = checkPageBreak(pdf, y, margin, 6)
    // Checkbox
    pdf.setDrawColor(150, 150, 150)
    pdf.setLineWidth(0.3)
    pdf.rect(margin, y - 3, 4, 4)
    pdf.text(item, margin + 7, y)
    y += 6
  })

  y += 5

  // Financial summary
  y = checkPageBreak(pdf, y, margin, 40)
  y = drawSectionTitle(pdf, 'Financial Summary', y, margin)

  y = drawTotalRow(pdf, 'Rental Total:', pdfFormatCurrency(rental.total_amount), y)
  y = drawTotalRow(pdf, 'Security Deposit:', pdfFormatCurrency(rental.deposit_amount), y)

  if (lateDays > 0 && rental.late_fee) {
    y = drawTotalRow(pdf, `Late Fee (${lateDays} days):`, pdfFormatCurrency(rental.late_fee), y)
  }

  if (rental.damage_fee && rental.damage_fee > 0) {
    y = drawTotalRow(pdf, 'Damage Fee:', pdfFormatCurrency(rental.damage_fee), y)
  }

  y = drawDivider(pdf, y)

  const totalDeductions = (rental.late_fee || 0) + (rental.damage_fee || 0)
  y = drawTotalRow(pdf, 'Total Deductions:', pdfFormatCurrency(totalDeductions), y)

  const refundAmount = rental.deposit_refund_amount ?? Math.max(0, rental.deposit_amount - totalDeductions)
  y = drawTotalRow(pdf, 'Deposit Refund:', pdfFormatCurrency(refundAmount), y, true)

  // Damage notes
  if (rental.damage_notes) {
    y += 5
    y = checkPageBreak(pdf, y, margin, 15)
    y = drawSectionTitle(pdf, 'Damage Notes', y, margin)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(rental.damage_notes, pageWidth - margin * 2)
    pdf.text(lines, margin, y)
    y += lines.length * 4 + 5
  }

  y += 10

  // Signatures
  y = checkPageBreak(pdf, y, margin, 40)
  y = drawSectionTitle(pdf, 'Signatures', y, margin)

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text('I confirm that the equipment has been returned and inspected as recorded above.', margin, y)
  y += 15

  const sigWidth = (pageWidth - margin * 2 - 20) / 2

  pdf.setDrawColor(150, 150, 150)
  pdf.setLineWidth(0.3)

  // Staff signature
  pdf.line(margin, y, margin + sigWidth, y)
  y += 5
  pdf.setFont('helvetica', 'bold')
  pdf.text('Staff (Inspected by)', margin, y)
  y += 4
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Date: _______________`, margin, y)

  // Customer signature
  const custX = margin + sigWidth + 20
  pdf.line(custX, y - 9, custX + sigWidth, y - 9)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Customer', custX, y - 4)
  pdf.setFont('helvetica', 'normal')
  pdf.text(rental.customer_name, custX, y)
  pdf.text(`Date: _______________`, custX, y + 4)

  drawFooter(pdf, settings)
  pdf.save(`${rental.rental_number}_Return_Checklist.pdf`)
}
