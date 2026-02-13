/**
 * Export output content to MD, PDF, or DOCX with proper markdown conversion
 */

import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { Root, Content, PhrasingContent } from 'mdast'
import { jsPDF } from 'jspdf'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  convertInchesToTwip,
} from 'docx'

type Block =
  | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start?: number; items: Inline[][] }
  | { type: 'blockquote'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'thematicBreak' }

type Inline = { type: 'text'; value: string; bold?: boolean; italic?: boolean }

function extractText(node: PhrasingContent | { type: string; children?: PhrasingContent[]; value?: string }): Inline[] {
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
        const paras = (li.children || []).filter((c) => (c as { type: string }).type === 'paragraph')
        return paras.flatMap((p) => ((p as { children: PhrasingContent[] }).children || []).flatMap((c) => extractText(c)))
      })
      blocks.push({
        type: 'list',
        ordered: node.ordered || false,
        start: node.start ?? undefined,
        items: items.filter((arr) => arr.length > 0),
      })
    } else if (node.type === 'blockquote') {
      const children = (node.children || [])
        .flatMap((p) => (p.type === 'paragraph' ? ((p as { children: PhrasingContent[] }).children || []).flatMap(extractText) : []))
      blocks.push({ type: 'blockquote', children })
    } else if (node.type === 'code') {
      blocks.push({ type: 'code', value: node.value })
    } else if (node.type === 'thematicBreak') {
      blocks.push({ type: 'thematicBreak' })
    }
  }
  return blocks
}

function inlineToText(inlines: Inline[]): string {
  return inlines.map((i) => i.value).join('')
}

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

  const root = fromMarkdown(content, {
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
      } else if (block.type === 'blockquote') {
        addLine('  ' + inlineToText(block.children), 10, false, 8)
        y += 2
      } else if (block.type === 'code') {
        pdf.setFont('courier', 'normal')
        pdf.setFontSize(9)
        const lines = block.value.split(/\r?\n/)
        for (const line of lines) {
          if (y + 5 > pageHeight - margin) {
            pdf.addPage()
            y = margin
          }
          pdf.text(line, margin + 5, y)
          y += 5
        }
        pdf.setFont('helvetica', 'normal')
        y += 2
      } else if (block.type === 'thematicBreak') {
        y += 4
        pdf.setDrawColor(200, 200, 200)
        pdf.line(margin, y, pageWidth - margin, y)
        y += 8
      }
    }

    pdf.save(`${baseName}.pdf`)
  }

  if (format === 'docx') {
    const docChildren: Paragraph[] = []

    for (const block of blocks) {
      if (block.type === 'heading') {
        const runs = block.children.map((i) => new TextRun({ text: i.value, bold: i.bold, italics: i.italic }))
        docChildren.push(
          new Paragraph({
            children: runs,
            heading: block.depth === 1 ? HeadingLevel.HEADING_1 : block.depth === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: { after: 120 },
          })
        )
      } else if (block.type === 'paragraph') {
        const runs = block.children.map((i) => new TextRun({ text: i.value, bold: i.bold, italics: i.italic }))
        if (runs.length > 0) {
          docChildren.push(new Paragraph({ children: runs, spacing: { after: 80 } }))
        } else {
          docChildren.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 80 } }))
        }
      } else if (block.type === 'list') {
        block.items.forEach((item, idx) => {
          const runs = item.map((i) => new TextRun({ text: i.value, bold: i.bold, italics: i.italic }))
          const prefix = block.ordered ? `${(block.start ?? 1) + idx}. ` : ''
          docChildren.push(
            new Paragraph({
              children: [new TextRun(prefix), ...runs],
              bullet: block.ordered ? undefined : { level: 0 },
              indent: block.ordered ? { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } : undefined,
              spacing: { after: 60 },
            })
          )
        })
      } else if (block.type === 'blockquote') {
        const runs = block.children.map((i) => new TextRun({ text: i.value, bold: i.bold, italics: i.italic }))
        docChildren.push(
          new Paragraph({
            children: [...[new TextRun('  ')], ...runs],
            indent: { left: convertInchesToTwip(0.5) },
            spacing: { after: 80 },
          })
        )
      } else if (block.type === 'code') {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: block.value, font: 'Courier New' })],
            spacing: { after: 80 },
          })
        )
      } else if (block.type === 'thematicBreak') {
        docChildren.push(new Paragraph({ children: [new TextRun('—'.repeat(40))], spacing: { after: 120 } }))
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren.length > 0 ? docChildren : [new Paragraph({ children: [new TextRun('')] })],
        },
      ],
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
