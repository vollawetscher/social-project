/**
 * Export output content to MD, PDF, DOCX, or Google Docs-compatible DOCX.
 */

import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { Root, Content, PhrasingContent } from 'mdast'
import { jsPDF } from 'jspdf'
import { sanitizeOutputForPdf } from '@/lib/utils/output-text-sanitizer'
import {
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from 'docx'

export function isPdfExportSupportedLanguage(language?: string | null): boolean {
  return true
}

// Produce a filesystem-safe, ASCII-only slug for a template / output name.
//
// - Transliterates German umlauts explicitly (ö → oe, ü → ue, ä → ae, ß → ss)
//   so downstream NFKD stripping does not turn them into the wrong letter
//   (ö → o). Other Latin diacritics are removed via NFKD.
// - Replaces runs of non-alphanumeric characters with a single `-`. This
//   collapses sequences like " - " (space-dash-space) in template names
//   ("Lörrach Voice Agent - 2") to a single dash instead of the previous
//   `---`.
// - Caps length so we don't hit OS filename limits with very long templates.
function slugifyTemplateName(input: string): string {
  const translit = String(input || '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

  return translit
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// Canonical base name for output downloads across the app.
//
// All download entry points (outputs detail page, session detail page,
// public share page) route through this so the resulting filename is
// identical regardless of where the user clicks. Format:
//
//   <slug>-YYYY-MM-DD
//
// We use a human-readable date instead of a millisecond timestamp so the
// file is easier to recognize in the user's Downloads folder. Duplicate
// suffixes like ` (1)`, ` (2)` are added by the browser itself when the
// same file is downloaded multiple times in a day.
export function buildOutputDownloadBasename(
  templateName: string | null | undefined,
  createdAt: string | number | Date | null | undefined
): string {
  const slug = slugifyTemplateName(String(templateName || '')) || 'output'
  const date = (() => {
    if (createdAt) {
      const d = new Date(createdAt as any)
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    }
    return new Date().toISOString().slice(0, 10)
  })()
  return `${slug}-${date}`
}

type Block =
  | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start?: number; items: Inline[][] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'blockquote'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'thematicBreak' }

type Inline = { type: 'text'; value: string; bold?: boolean; italic?: boolean }

function extractText(node: PhrasingContent | { type: string; children?: PhrasingContent[]; value?: string }): Inline[] {
  if (node.type === 'break') return [{ type: 'text', value: '\n' }]
  if (node.type === 'text' || node.type === 'inlineCode') return [{ type: 'text', value: (node as { value: string }).value }]
  if (node.type === 'strong') {
    return ((node as { children: PhrasingContent[] }).children || []).flatMap(extractText).map((t) => ({ ...t, bold: true }))
  }
  if (node.type === 'emphasis') {
    return ((node as { children: PhrasingContent[] }).children || []).flatMap(extractText).map((t) => ({ ...t, italic: true }))
  }
  if (node.type === 'delete') {
    return ((node as { children: PhrasingContent[] }).children || []).flatMap(extractText)
  }
  if (node.type === 'link' && 'children' in node && Array.isArray(node.children)) {
    return node.children.flatMap(extractText)
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.flatMap((c) => extractText(c as PhrasingContent))
  }
  return []
}

function extractTextFromUnknownBlock(node: unknown): Inline[] {
  if (!node || typeof node !== 'object') return []
  const n = node as { type?: string; value?: unknown; children?: unknown[] }
  if (n.type === 'break') return [{ type: 'text', value: '\n' }]
  if (typeof n.value === 'string') return [{ type: 'text', value: n.value }]
  if (Array.isArray(n.children)) {
    return n.children.flatMap((child) => extractTextFromUnknownBlock(child))
  }
  return []
}

function extractListItemInlines(listItem: { children?: unknown[] }): Inline[] {
  const out: Inline[] = []
  const children = Array.isArray(listItem.children) ? listItem.children : []

  children.forEach((child, idx) => {
    const c = child as { type?: string; children?: PhrasingContent[]; value?: string }

    if (c.type === 'paragraph') {
      const inlines = (c.children || []).flatMap(extractText)
      if (inlines.length > 0) out.push(...inlines)
    } else if (c.type === 'list') {
      const nestedItems = ((c as { children?: unknown[] }).children || []) as { children?: unknown[] }[]
      nestedItems.forEach((nestedLi) => {
        const nestedText = inlineToText(extractListItemInlines(nestedLi)).trim()
        if (nestedText) {
          if (out.length > 0) out.push({ type: 'text', value: '\n' })
          out.push({ type: 'text', value: `- ${nestedText}` })
        }
      })
    } else {
      const fallback = extractTextFromUnknownBlock(c)
      if (fallback.length > 0) out.push(...fallback)
    }

    if (idx < children.length - 1 && out.length > 0) {
      out.push({ type: 'text', value: ' ' })
    }
  })

  return out
}

function mdastToBlocks(root: Root): Block[] {
  const blocks: Block[] = []
  for (const node of root.children) {
    if (node.type === 'heading') {
      blocks.push({
        type: 'heading',
        depth: node.depth as 1 | 2 | 3 | 4 | 5 | 6,
        children: (node.children || []).flatMap(extractText),
      })
    } else if (node.type === 'paragraph') {
      blocks.push({ type: 'paragraph', children: (node.children || []).flatMap(extractText) })
    } else if (node.type === 'list') {
      const items = (node.children || []).map((li) => {
        if (li.type !== 'listItem') return []
        return extractListItemInlines(li as { children?: unknown[] })
      })
      blocks.push({
        type: 'list',
        ordered: node.ordered || false,
        start: node.start ?? undefined,
        items: items.filter((arr) => arr.length > 0),
      })
    } else if (node.type === 'table') {
      const tableRows = ((node as { children?: unknown[] }).children || []) as {
        children?: { children?: PhrasingContent[] }[]
      }[]
      const normalizedRows = tableRows.map((row) =>
        (row.children || []).map((cell) => inlineToText((cell.children || []).flatMap(extractText)).trim())
      )

      if (normalizedRows.length > 0) {
        blocks.push({
          type: 'table',
          header: normalizedRows[0] || [],
          rows: normalizedRows.slice(1),
        })
      }
    } else if (node.type === 'blockquote') {
      const children = (node.children || [])
        .flatMap((p) => (p.type === 'paragraph' ? ((p as { children: PhrasingContent[] }).children || []).flatMap(extractText) : []))
      blocks.push({ type: 'blockquote', children })
    } else if (node.type === 'code') {
      blocks.push({ type: 'code', value: node.value })
    } else if (node.type === 'thematicBreak') {
      blocks.push({ type: 'thematicBreak' })
    } else {
      const fallback = extractTextFromUnknownBlock(node as Content)
      if (fallback.length > 0) {
        blocks.push({ type: 'paragraph', children: fallback })
      }
    }
  }
  return blocks
}

function inlineToText(inlines: Inline[]): string {
  return inlines.map((i) => i.value).join('')
}

function inlinesToDocxRuns(inlines: Inline[], size = 22): TextRun[] {
  const runs: TextRun[] = []

  for (const inline of inlines) {
    const parts = (inline.value || '').split('\n')
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part.length > 0) {
        runs.push(
          new TextRun({
            text: part,
            bold: inline.bold,
            italics: inline.italic,
            size,
            color: '000000',
            font: 'Arial',
          })
        )
      }
      if (i < parts.length - 1) {
        runs.push(
          new TextRun({
            text: '',
            break: 1,
            size,
            color: '000000',
            font: 'Arial',
          })
        )
      }
    }
  }

  return runs
}

export async function exportOutput(
  content: string,
  filename: string,
  format: 'md' | 'pdf' | 'docx' | 'gdoc'
): Promise<void> {
  const baseName = filename.replace(/\s+/g, '-').toLowerCase().replace(/\.[^.]+$/, '')

  if (format === 'md') {
    const blob = new Blob([content], { type: 'text/markdown' })
    downloadBlob(blob, `${baseName}.md`)
    return
  }

  const pdfSafeContent = format === 'pdf' ? sanitizeOutputForPdf(content) : content

  const root = fromMarkdown(pdfSafeContent, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const blocks = mdastToBlocks(root)

  if (format === 'pdf') {
    const pdf = new jsPDF()
    const margin = 20
    const pageWidth = pdf.internal.pageSize.getWidth()
    const maxWidth = pageWidth - 2 * margin
    const pageHeight = pdf.internal.pageSize.getHeight()
    let y = margin

    const headingSizes: Record<number, number> = { 1: 18, 2: 16, 3: 14, 4: 13, 5: 12, 6: 11 }

    const addLine = (text: string, fontSize: number, bold: boolean, indent = 0): void => {
      pdf.setFontSize(fontSize)
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      const x = margin + indent
      const wrapWidth = maxWidth - indent
      const lines = pdf.splitTextToSize(text || ' ', wrapWidth)
      for (const line of lines) {
        if (y + 6 > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }
        pdf.text(line, x, y)
        y += 6
      }
    }

    const renderInlines = (inlines: Inline[], baseFontSize: number): void => {
      let line = ''
      let bold = false
      let italic = false
      for (const i of inlines) {
        if (i.bold !== bold || i.italic !== italic) {
          if (line) {
            pdf.setFontSize(baseFontSize)
            pdf.setFont('helvetica', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal')
            const wrapped = pdf.splitTextToSize(line, maxWidth)
            for (const w of wrapped) {
              if (y + 6 > pageHeight - margin) {
                pdf.addPage()
                y = margin
              }
              pdf.text(w, margin, y)
              y += 6
            }
            line = ''
          }
          bold = i.bold ?? false
          italic = i.italic ?? false
        }
        line += i.value
      }
      if (line) {
        pdf.setFontSize(baseFontSize)
        pdf.setFont('helvetica', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal')
        const wrapped = pdf.splitTextToSize(line, maxWidth)
        for (const w of wrapped) {
          if (y + 6 > pageHeight - margin) {
            pdf.addPage()
            y = margin
          }
          pdf.text(w, margin, y)
          y += 6
        }
      }
    }

    for (const block of blocks) {
      if (block.type === 'heading') {
        y += 4
        const size = headingSizes[block.depth]
        const text = inlineToText(block.children)
        addLine(text, size, true)
        y += 2
      } else if (block.type === 'paragraph') {
        if (block.children.length > 0) {
          const baseSize = 11
          renderInlines(block.children, baseSize)
        } else {
          y += 4
        }
      } else if (block.type === 'list') {
        const indent = 10
        block.items.forEach((item, idx) => {
          const prefix = block.ordered ? `${(block.start ?? 1) + idx}. ` : '• '
          const text = prefix + inlineToText(item)
          addLine(text, 11, false, indent)
        })
        y += 2
      } else if (block.type === 'table') {
        const headerLine = block.header.join(' | ')
        if (headerLine) {
          addLine(headerLine, 11, true)
          addLine('-'.repeat(Math.max(8, Math.min(80, headerLine.length))), 10, false)
        }
        block.rows.forEach((row) => addLine(row.join(' | '), 10, false))
        y += 2
      } else if (block.type === 'blockquote') {
        addLine('  ' + inlineToText(block.children), 10, false, 8)
        y += 2
      } else if (block.type === 'code') {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        const inset = 6
        const wrapW = maxWidth - inset * 2
        const codeLines = block.value.split(/\r?\n/)
        const wrapped = codeLines.flatMap(l => l ? pdf.splitTextToSize(l, wrapW) as string[] : [''])
        const lineH = 5
        const codePad = 5
        const codeBlockHeight = wrapped.length * lineH + codePad * 2

        if (y + codeBlockHeight > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }

        pdf.setFillColor(245, 245, 245)
        pdf.roundedRect(margin, y - codePad, maxWidth, codeBlockHeight, 2, 2, 'F')
        y += codePad

        pdf.setTextColor(40, 40, 40)
        for (const line of wrapped) {
          pdf.text(line, margin + inset, y)
          y += lineH
        }
        pdf.setTextColor(0, 0, 0)
        y += codePad
      } else if (block.type === 'thematicBreak') {
        y += 4
        pdf.setDrawColor(200, 200, 200)
        pdf.line(margin, y, pageWidth - margin, y)
        y += 8
      }
    }

    pdf.save(`${baseName}.pdf`)
  }

  if (format === 'docx' || format === 'gdoc') {
    const docChildren: Paragraph[] = []
    const headingSizes: Record<number, number> = { 1: 32, 2: 28, 3: 26, 4: 24, 5: 23, 6: 22 } // half-points
    const line120 = { line: 288, lineRule: LineRuleType.AUTO } // 1.2 line spacing
    const emptyLine = () =>
      new Paragraph({
        children: [new TextRun({ text: '', size: 22, color: '000000', font: 'Arial' })],
        spacing: line120,
      })

    for (const block of blocks) {
      if (block.type === 'heading') {
        const runs = inlinesToDocxRuns(
          block.children.map((i) => ({ ...i, bold: true })),
          headingSizes[block.depth]
        )
        docChildren.push(emptyLine())
        docChildren.push(
          new Paragraph({
            children: runs.length > 0 ? runs : [new TextRun({ text: '', size: headingSizes[block.depth], color: '000000', font: 'Arial' })],
            spacing: {
              ...line120,
              before: 80,
              after: 80,
            },
          })
        )
        docChildren.push(emptyLine())
      } else if (block.type === 'paragraph') {
        const runs = inlinesToDocxRuns(block.children, 22)
        if (runs.length > 0) {
          docChildren.push(new Paragraph({ children: runs, spacing: { ...line120, after: 80 } }))
        } else {
          docChildren.push(new Paragraph({ children: [new TextRun({ text: '', size: 22, color: '000000', font: 'Arial' })], spacing: { ...line120, after: 80 } }))
        }
      } else if (block.type === 'list') {
        block.items.forEach((item, idx) => {
          const runs = inlinesToDocxRuns(item, 22)
          const prefix = block.ordered ? `${(block.start ?? 1) + idx}. ` : ''
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: prefix, size: 22, color: '000000', font: 'Arial' }), ...runs],
              bullet: block.ordered ? undefined : { level: 0 },
              indent: block.ordered ? { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } : undefined,
              spacing: { ...line120, after: 60 },
            })
          )
        })
      } else if (block.type === 'table') {
        const headerText = block.header.join(' | ')
        if (headerText) {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: headerText, bold: true, size: 22, color: '000000', font: 'Arial' })],
              spacing: { ...line120, after: 60 },
            })
          )
          docChildren.push(new Paragraph({ children: [new TextRun({ text: '—'.repeat(40), size: 20, color: '000000', font: 'Arial' })], spacing: { ...line120, after: 40 } }))
        }
        block.rows.forEach((row) => {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: row.join(' | '), size: 20, color: '000000', font: 'Arial' })],
              spacing: { ...line120, after: 40 },
            })
          )
        })
      } else if (block.type === 'blockquote') {
        const runs = inlinesToDocxRuns(block.children, 21)
        docChildren.push(
          new Paragraph({
            children: [...[new TextRun({ text: '  ', size: 21, color: '000000', font: 'Arial' })], ...runs],
            indent: { left: convertInchesToTwip(0.5) },
            spacing: { ...line120, after: 80 },
          })
        )
      } else if (block.type === 'code') {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: block.value, font: 'Courier New', size: 20, color: '000000' })],
            spacing: { ...line120, after: 80 },
          })
        )
      } else if (block.type === 'thematicBreak') {
        docChildren.push(new Paragraph({ children: [new TextRun({ text: '—'.repeat(40), size: 20, color: '000000', font: 'Arial' })], spacing: { ...line120, after: 120 } }))
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Arial',
              size: 22,
              color: '000000',
            },
            paragraph: {},
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          children: docChildren.length > 0 ? docChildren : [new Paragraph({ children: [new TextRun({ text: '', size: 22, color: '000000', font: 'Arial' })] })],
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    // Google Docs imports DOCX reliably; expose a dedicated option in UI.
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
