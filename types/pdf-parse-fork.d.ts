declare module 'pdf-parse-fork' {
  interface PDFInfo {
    PDFFormatVersion?: string
    IsAcroFormPresent?: boolean
    IsXFAPresent?: boolean
    [key: string]: any
  }

  interface PDFMetadata {
    _metadata?: any
    [key: string]: any
  }

  interface PDFData {
    numpages: number
    numrender: number
    info: PDFInfo
    metadata: PDFMetadata
    text: string
    version: string
  }

  interface PDFParseOptions {
    pagerender?: (pageData: any) => Promise<string>
    max?: number
    version?: string
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PDFParseOptions
  ): Promise<PDFData>

  export = pdfParse
}
