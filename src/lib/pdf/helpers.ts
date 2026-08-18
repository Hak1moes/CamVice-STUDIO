import jsPDF from 'jspdf'
import type { BusinessSettings } from '@/types'

export function drawHeader(pdf: jsPDF, settings: BusinessSettings | null) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20
  let y = 20

  // Business name
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text(settings?.business_name || 'Camvice Studio', margin, y)
  y += 7

  // Business details
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)

  if (settings?.business_address) {
    const addressLines = pdf.splitTextToSize(settings.business_address, pageWidth - margin * 2)
    pdf.text(addressLines, margin, y)
    y += addressLines.length * 4
  }

  const contactParts: string[] = []
  if (settings?.business_phone) contactParts.push(settings.business_phone)
  if (settings?.business_email) contactParts.push(settings.business_email)
  if (contactParts.length > 0) {
    pdf.text(contactParts.join('  |  '), margin, y)
    y += 4
  }

  if (settings?.business_registration) {
    pdf.text(`SSM: ${settings.business_registration}`, margin, y)
    y += 4
  }

  pdf.setTextColor(0, 0, 0)

  // Divider line
  y += 3
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 8

  return y
}

export function drawDocumentTitle(pdf: jsPDF, title: string, y: number): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(23, 23, 23) // neutral-900
  pdf.text(title, pageWidth / 2, y, { align: 'center' })
  pdf.setTextColor(0, 0, 0)
  return y + 10
}

export function drawInfoRow(pdf: jsPDF, label: string, value: string, x: number, y: number): number {
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text(label, x, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(value || '-', x + 35, y)
  return y + 5
}

export function drawInfoRowWide(pdf: jsPDF, label: string, value: string, x: number, y: number, labelWidth: number = 45): number {
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text(label, x, y)
  pdf.setFont('helvetica', 'normal')
  const maxWidth = pdf.internal.pageSize.getWidth() - x - labelWidth - 20
  const lines = pdf.splitTextToSize(value || '-', maxWidth)
  pdf.text(lines, x + labelWidth, y)
  return y + lines.length * 4 + 1
}

export function drawSectionTitle(pdf: jsPDF, title: string, y: number, margin: number = 20): number {
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(30, 41, 59) // slate-800
  pdf.text(title, margin, y)
  pdf.setTextColor(0, 0, 0)
  return y + 6
}

export function drawTable(
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  columnWidths: number[],
  startY: number,
  margin: number = 20
): number {
  let y = startY
  const rowHeight = 7
  const tableWidth = columnWidths.reduce((a, b) => a + b, 0)

  // Header row
  pdf.setFillColor(241, 245, 249) // slate-100
  pdf.rect(margin, y - 4, tableWidth, rowHeight, 'F')
  pdf.setDrawColor(226, 232, 240) // slate-200
  pdf.rect(margin, y - 4, tableWidth, rowHeight, 'S')

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(71, 85, 105) // slate-500

  let xPos = margin + 3
  headers.forEach((header, i) => {
    pdf.text(header, xPos, y)
    xPos += columnWidths[i]
  })

  y += rowHeight - 1
  pdf.setTextColor(0, 0, 0)

  // Data rows
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)

  rows.forEach((row, rowIndex) => {
    // Calculate dynamic row height based on first column wrap
    const firstColLines = pdf.splitTextToSize(row[0] || '', columnWidths[0] - 6)
    const lineH = 4.5
    const dynamicRowH = Math.max(rowHeight, firstColLines.length * lineH + 3)

    y = checkPageBreak(pdf, y, 20, dynamicRowH)

    // Alternating row background
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(248, 250, 252) // slate-50
      pdf.rect(margin, y - 4, tableWidth, dynamicRowH, 'F')
    }

    // Row border
    pdf.setDrawColor(241, 245, 249)
    pdf.line(margin, y + dynamicRowH - 5, margin + tableWidth, y + dynamicRowH - 5)

    xPos = margin + 3
    row.forEach((cell, i) => {
      if (i === 0) {
        pdf.text(firstColLines, xPos, y)
      } else {
        const cellText = pdf.splitTextToSize(cell, columnWidths[i] - 6)
        pdf.text(cellText[0] || '', xPos, y)
      }
      xPos += columnWidths[i]
    })

    y += dynamicRowH
  })

  return y + 3
}

export function drawTotalRow(pdf: jsPDF, label: string, value: string, y: number, isBold: boolean = false, margin: number = 20): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const rightX = pageWidth - margin

  pdf.setFontSize(9)
  pdf.setFont('helvetica', isBold ? 'bold' : 'normal')
  pdf.text(label, rightX - 60, y)
  pdf.text(value, rightX, y, { align: 'right' })
  return y + 5
}

export function drawDivider(pdf: jsPDF, y: number, margin: number = 20): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.3)
  pdf.line(pageWidth - margin - 65, y, pageWidth - margin, y)
  return y + 3
}

export function drawFooter(pdf: jsPDF, settings: BusinessSettings | null) {
  const pageCount = pdf.getNumberOfPages()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(150, 150, 150)

    const footerText = `Generated by ${settings?.business_name || 'Camvice Studio'} | ${new Date().toLocaleDateString('en-MY')}`
    pdf.text(footerText, 20, pageHeight - 10)

    if (pageCount > 1) {
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' })
    }
  }
}

export function checkPageBreak(pdf: jsPDF, y: number, margin: number = 20, requiredSpace: number = 30): number {
  const pageHeight = pdf.internal.pageSize.getHeight()
  if (y + requiredSpace > pageHeight - margin) {
    pdf.addPage()
    return margin + 10
  }
  return y
}

export function pdfFormatCurrency(amount: number): string {
  return `RM ${amount.toFixed(2)}`
}

export function drawBankDetails(pdf: jsPDF, settings: BusinessSettings | null, y: number, margin: number = 20): number {
  if (!settings?.bank_name) return y

  y = checkPageBreak(pdf, y, margin, 35)
  y = drawSectionTitle(pdf, 'Bank Payment Details', y, margin)

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  if (settings.bank_name) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('Bank:', margin, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(settings.bank_name, margin + 30, y)
    y += 5
  }
  if (settings.bank_account) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('Account:', margin, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(settings.bank_account, margin + 30, y)
    y += 5
  }
  if (settings.bank_holder) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('Name:', margin, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(settings.bank_holder, margin + 30, y)
    y += 5
  }

  return y + 5
}
