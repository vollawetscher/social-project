/**
 * Document Parser Service
 * Extracts text content from various document formats
 */

interface ParsedDocument {
  text: string
  metadata: {
    pageCount?: number
    wordCount: number
    characterCount: number
    format: 'pdf' | 'docx' | 'txt' | 'unknown'
  }
}

/**
 * Parse text from a file buffer
 * Supports: TXT, PDF, DOCX
 */
export async function parseDocument(
  file: File | Buffer,
  filename: string
): Promise<ParsedDocument> {
  const extension = filename.split('.').pop()?.toLowerCase()

  let text = ''
  let format: 'pdf' | 'docx' | 'txt' | 'unknown' = 'unknown'

  try {
    if (extension === 'txt') {
      format = 'txt'
      if (file instanceof File) {
        text = await file.text()
      } else {
        text = file.toString('utf-8')
      }
    } else if (extension === 'pdf') {
      format = 'pdf'
      // For now, we'll handle PDF parsing server-side
      // This would require pdf-parse library
      throw new Error('PDF parsing requires server-side processing')
    } else if (extension === 'docx' || extension === 'doc') {
      format = 'docx'
      // For now, we'll handle DOCX parsing server-side
      // This would require mammoth library
      throw new Error('DOCX parsing requires server-side processing')
    } else {
      throw new Error(`Unsupported file format: ${extension}`)
    }

    // Calculate metadata
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length
    const characterCount = text.length

    return {
      text,
      metadata: {
        wordCount,
        characterCount,
        format,
      },
    }
  } catch (error) {
    console.error('Error parsing document:', error)
    throw error
  }
}

/**
 * Extract structured information from parsed text
 * Identifies headings, sections, and document structure
 */
export function analyzeDocumentStructure(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line)

  // Detect potential headings (lines that are:
  // - Short (< 80 chars)
  // - Don't end with punctuation
  // - Are followed by longer content
  const potentialHeadings: string[] = []
  
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]
    
    // Heading heuristics
    const isShort = line.length < 80
    const noEndPunctuation = !/[.!?,;:]$/.test(line)
    const isAllCaps = line === line.toUpperCase() && line.length > 2
    const isNumbered = /^\d+\.?\s/.test(line)
    const nextLineIsLonger = nextLine && nextLine.length > line.length
    
    if (isShort && (noEndPunctuation || isAllCaps || isNumbered) && nextLineIsLonger) {
      potentialHeadings.push(line)
    }
  }

  // Detect common section patterns
  const commonSections = [
    'executive summary',
    'summary',
    'introduction',
    'background',
    'overview',
    'key findings',
    'findings',
    'analysis',
    'detailed analysis',
    'recommendations',
    'conclusion',
    'conclusions',
    'next steps',
    'action items',
    'appendix',
    'references',
  ]

  const detectedSections = potentialHeadings.filter(heading => {
    const lowerHeading = heading.toLowerCase()
    return commonSections.some(section => lowerHeading.includes(section))
  })

  return {
    headings: potentialHeadings,
    sections: detectedSections,
    totalLines: lines.length,
    averageLineLength: lines.reduce((sum, line) => sum + line.length, 0) / lines.length,
  }
}
