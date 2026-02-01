import PDFDocument from 'pdfkit'

/**
 * PDF Service - Generate contract renewal receipts
 */

export interface RenewalReceiptData {
  // Manager info
  managerName: string
  teamName: string
  leagueName: string

  // Session info
  consolidationDate: Date
  sessionName?: string
  transactionId: string

  // Renewals
  renewals: Array<{
    playerName: string
    position: string
    realTeam: string
    oldSalary: number
    newSalary: number
    oldDuration: number
    newDuration: number
    rescissionClause: number
  }>

  // Summary
  totalSalary: number
  remainingBudget: number
  releasedPlayers?: Array<{
    playerName: string
    position: string
    releaseCost: number
  }>
}

/**
 * Generate a PDF receipt for contract renewals
 */
export function generateRenewalReceipt(data: RenewalReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Ricevuta Rinnovi - ${data.teamName}`,
          Author: 'Fantacontratti',
          Subject: 'Contract Renewal Receipt',
          Keywords: 'fantacalcio, contratti, rinnovi',
        },
      })

      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Background color (simulate dark theme)
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff')

      // Header
      drawHeader(doc, data)

      // Manager Info Section
      drawManagerInfo(doc, data)

      // Renewals Table
      if (data.renewals.length > 0) {
        drawRenewalsTable(doc, data.renewals)
      }

      // Released Players (if any)
      if (data.releasedPlayers && data.releasedPlayers.length > 0) {
        drawReleasedPlayers(doc, data.releasedPlayers)
      }

      // Summary Section
      drawSummary(doc, data)

      // Footer
      drawFooter(doc, data)

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

function drawHeader(doc: PDFKit.PDFDocument, _data: RenewalReceiptData): void {
  // Logo placeholder (circle with soccer ball emoji simulation)
  doc
    .circle(doc.page.width / 2, 60, 25)
    .fill('#3b82f6')

  doc
    .fontSize(20)
    .fillColor('#1d4ed8')
    .text('', doc.page.width / 2 - 8, 50)

  // Title
  doc
    .fontSize(24)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text('FANTACONTRATTI', 0, 100, { align: 'center' })

  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Dynasty Fantasy Football', 0, 128, { align: 'center' })

  // Subtitle
  doc
    .fontSize(16)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text('RICEVUTA RINNOVI CONTRATTUALI', 0, 155, { align: 'center' })

  // Divider line
  doc
    .moveTo(50, 180)
    .lineTo(doc.page.width - 50, 180)
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .stroke()

  doc.y = 195
}

function drawManagerInfo(doc: PDFKit.PDFDocument, data: RenewalReceiptData): void {
  const startY = doc.y
  const leftCol = 50
  const rightCol = doc.page.width / 2 + 20

  // Left column
  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Manager:', leftCol, startY)
  doc
    .fontSize(12)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text(data.managerName, leftCol, startY + 14)

  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Squadra:', leftCol, startY + 35)
  doc
    .fontSize(12)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text(data.teamName, leftCol, startY + 49)

  // Right column
  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Lega:', rightCol, startY)
  doc
    .fontSize(12)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text(data.leagueName, rightCol, startY + 14)

  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Data Consolidamento:', rightCol, startY + 35)
  doc
    .fontSize(12)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text(formatDate(data.consolidationDate), rightCol, startY + 49)

  doc.y = startY + 80

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .stroke()

  doc.y += 15
}

function drawRenewalsTable(doc: PDFKit.PDFDocument, renewals: RenewalReceiptData['renewals']): void {
  // Section title
  doc
    .fontSize(14)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text('Rinnovi Effettuati', 50, doc.y)

  doc.y += 20

  // Table header
  const tableTop = doc.y
  const colWidths: readonly [number, number, number, number, number, number] = [130, 30, 80, 80, 80, 95] as const
  const headers = ['Giocatore', 'Pos', 'Ingaggio Prec.', 'Ingaggio Nuovo', 'Durata', 'Clausola']

  // Header background
  doc
    .rect(50, tableTop - 5, doc.page.width - 100, 20)
    .fill('#f3f4f6')

  let x = 50
  headers.forEach((header, i) => {
    const width = colWidths[i]!
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .font('Helvetica-Bold')
      .text(header, x + 5, tableTop, { width: width - 10 })
    x += width
  })

  doc.y = tableTop + 20

  // Table rows
  renewals.forEach((renewal, index) => {
    const rowY = doc.y

    // Alternate row background
    if (index % 2 === 0) {
      doc
        .rect(50, rowY - 3, doc.page.width - 100, 18)
        .fill('#fafafa')
    }

    x = 50

    // Player name with team
    doc
      .fontSize(9)
      .fillColor('#1a1c20')
      .font('Helvetica-Bold')
      .text(renewal.playerName, x + 5, rowY, { width: colWidths[0] - 10 })
    doc
      .fontSize(7)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(renewal.realTeam, x + 5, rowY + 10, { width: colWidths[0] - 10 })
    x += colWidths[0]

    // Position
    doc
      .fontSize(9)
      .fillColor('#1a1c20')
      .font('Helvetica')
      .text(renewal.position, x + 5, rowY, { width: colWidths[1] - 10 })
    x += colWidths[1]

    // Old salary
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(`${renewal.oldSalary}M`, x + 5, rowY, { width: colWidths[2] - 10 })
    x += colWidths[2]

    // New salary (with color if changed)
    const salaryColor = renewal.newSalary > renewal.oldSalary ? '#22c55e' : '#1a1c20'
    doc
      .fontSize(9)
      .fillColor(salaryColor)
      .font('Helvetica-Bold')
      .text(`${renewal.newSalary}M`, x + 5, rowY, { width: colWidths[3] - 10 })
    x += colWidths[3]

    // Duration
    const durationText = renewal.newDuration !== renewal.oldDuration
      ? `${renewal.oldDuration}s -> ${renewal.newDuration}s`
      : `${renewal.newDuration}s`
    doc
      .fontSize(9)
      .fillColor('#1a1c20')
      .font('Helvetica')
      .text(durationText, x + 5, rowY, { width: colWidths[4] - 10 })
    x += colWidths[4]

    // Rescission clause
    doc
      .fontSize(9)
      .fillColor('#f59e0b')
      .font('Helvetica-Bold')
      .text(`${renewal.rescissionClause}M`, x + 5, rowY, { width: colWidths[5] - 10 })

    doc.y = rowY + 22
  })

  doc.y += 15
}

function drawReleasedPlayers(doc: PDFKit.PDFDocument, released: NonNullable<RenewalReceiptData['releasedPlayers']>): void {
  // Check if we need a new page
  if (doc.y > doc.page.height - 150) {
    doc.addPage()
    doc.y = 50
  }

  // Section title
  doc
    .fontSize(14)
    .fillColor('#dc2626')
    .font('Helvetica-Bold')
    .text('Giocatori Svincolati', 50, doc.y)

  doc.y += 20

  released.forEach((player) => {
    doc
      .fontSize(10)
      .fillColor('#1a1c20')
      .font('Helvetica')
      .text(`${player.position} - ${player.playerName}`, 50, doc.y)
    doc
      .fontSize(10)
      .fillColor('#dc2626')
      .font('Helvetica-Bold')
      .text(`Costo taglio: ${player.releaseCost}M`, 300, doc.y)
    doc.y += 15
  })

  doc.y += 10
}

function drawSummary(doc: PDFKit.PDFDocument, data: RenewalReceiptData): void {
  // Check if we need a new page
  if (doc.y > doc.page.height - 150) {
    doc.addPage()
    doc.y = 50
  }

  // Divider
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .stroke()

  doc.y += 20

  // Summary box
  const boxY = doc.y
  const boxHeight = 80

  doc
    .rect(doc.page.width - 250, boxY, 200, boxHeight)
    .fill('#f0fdf4')
    .stroke('#22c55e')

  const summaryX = doc.page.width - 240

  doc
    .fontSize(12)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text('RIEPILOGO', summaryX, boxY + 10)

  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Totale Monte Ingaggi:', summaryX, boxY + 30)
  doc
    .fontSize(12)
    .fillColor('#1a1c20')
    .font('Helvetica-Bold')
    .text(`${data.totalSalary}M`, summaryX + 120, boxY + 30)

  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text('Budget Residuo:', summaryX, boxY + 50)
  doc
    .fontSize(12)
    .fillColor('#22c55e')
    .font('Helvetica-Bold')
    .text(`${data.remainingBudget}M`, summaryX + 120, boxY + 50)

  doc.y = boxY + boxHeight + 20
}

function drawFooter(doc: PDFKit.PDFDocument, data: RenewalReceiptData): void {
  const footerY = doc.page.height - 80

  // Divider
  doc
    .moveTo(50, footerY)
    .lineTo(doc.page.width - 50, footerY)
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .stroke()

  // Transaction ID
  doc
    .fontSize(8)
    .fillColor('#9ca3af')
    .font('Helvetica')
    .text(`ID Transazione: ${data.transactionId}`, 50, footerY + 15)

  // Timestamp
  doc
    .fontSize(8)
    .fillColor('#9ca3af')
    .font('Helvetica')
    .text(`Generato il: ${formatDateTime(new Date())}`, 50, footerY + 28)

  // Footer text
  doc
    .fontSize(8)
    .fillColor('#9ca3af')
    .font('Helvetica')
    .text(
      'Documento generato automaticamente da Fantacontratti. Non richiede firma.',
      0,
      footerY + 45,
      { align: 'center' }
    )

  doc
    .fontSize(8)
    .fillColor('#6b7280')
    .font('Helvetica')
    .text(
      `© ${new Date().getFullYear()} Fantacontratti. Tutti i diritti riservati.`,
      0,
      footerY + 58,
      { align: 'center' }
    )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
