/**
 * Export output content to MD, PDF, or DOCX
 */

import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun } from 'docx'

export async function exportOutput(
  content: string,
  filename: string,
  format: 'md' | 'pdf' | 'docx'
): Promise<void> {
  const baseName = filename.replace(/\s+/g, '-').toLowerCase().replace(/\.[^.]+$/, '')

  if (format === 'md') {
    const blob = new Blob([content], { type: 'text/markdown' })
    downloadBlob(blob, `${baseName}.md`)
    return
  }

  if (format === 'pdf') {
    const pdf = new jsPDF()
    const margin = 20
    const pageWidth = pdf.internal.pageSize.getWidth()
    const lineHeight = 6
    let y = margin

    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      const isHeading = /^#+\s/.test(line)
      if (isHeading) {
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
      } else {
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'normal')
      }
      const text = line.replace(/^#+\s*/, '')
      const wrapped = pdf.splitTextToSize(text || ' ', pageWidth - 2 * margin)
      for (const w of wrapped) {
        if (y + lineHeight > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage()
          y = margin
        }
        pdf.text(w, margin, y)
        y += lineHeight
      }
    }
    pdf.save(`${baseName}.pdf`)
    return
  }

  if (format === 'docx') {
    const paragraphs: Paragraph[] = []
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
      const isHeading = /^#+\s/.test(line)
      const text = line.replace(/^#+\s*/, '')
      if (!text.trim()) {
        paragraphs.push(new Paragraph({ children: [new TextRun('')] }))
        continue
      }
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text, bold: isHeading })],
        })
      )
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun('')] })],
      }],
    })

    const blob = await Packer.toBlob(doc)
    downloadBlob(blob, `${baseName}.docx`)
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
