import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { requireAuth, requireSessionOwnership, handleAuthError } from '@/lib/auth/helpers'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    await requireSessionOwnership(params.id, user.id)
    const supabase = createClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('session_id', params.id)
      .maybeSingle()

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const pdf = new jsPDF()
    const gespraechsbericht = report.claude_json

    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 20
    const lineHeight = 7
    let yPosition = margin

    const checkPageBreak = (spaceNeeded: number = lineHeight) => {
      if (yPosition + spaceNeeded > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage()
        yPosition = margin
        return true
      }
      return false
    }

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      pdf.setFontSize(fontSize)
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal')
      const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin)
      for (const line of lines) {
        checkPageBreak()
        pdf.text(line, margin, yPosition)
        yPosition += lineHeight
      }
    }

    const addSection = (title: string, content: string[] | string) => {
      checkPageBreak(lineHeight * 3)
      yPosition += 5
      addText(title, 14, true)
      yPosition += 3

      if (Array.isArray(content)) {
        content.forEach((item, index) => {
          checkPageBreak()
          addText(`${index + 1}. ${item}`, 10)
        })
      } else {
        addText(content, 10)
      }
    }

    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Gesprächsbericht', margin, yPosition)
    yPosition += 15

    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text(session.internal_case_id || `Gespräch ${session.id.slice(0, 8)}`, margin, yPosition)
    yPosition += 10

    addSection('Zusammenfassung', gespraechsbericht.summary_short)

    addSection('Metadaten', [
      `Datum: ${gespraechsbericht.gespraechsbericht.metadaten.datum}`,
      `Dauer: ${gespraechsbericht.gespraechsbericht.metadaten.dauer}`,
      `Setting: ${gespraechsbericht.gespraechsbericht.metadaten.setting}`,
      `Beteiligte: ${gespraechsbericht.gespraechsbericht.metadaten.beteiligte_rollen.join(', ')}`,
    ])

    addSection('Gesprächsverlauf', gespraechsbericht.gespraechsbericht.gespraechsverlauf_kurz)

    yPosition += 5
    checkPageBreak(lineHeight * 3)
    addText('Kernaussagen & Zitate', 14, true)
    yPosition += 3
    gespraechsbericht.gespraechsbericht.kernaussagen_zitate.forEach((zitat: any) => {
      checkPageBreak(lineHeight * 2)
      addText(`[${zitat.timecode}] ${zitat.speaker}: "${zitat.quote}"`, 10)
      yPosition += 2
    })

    addSection('Beobachtungen', gespraechsbericht.gespraechsbericht.beobachtungen)
    addSection('Themen', gespraechsbericht.gespraechsbericht.themen)
    addSection('Ressourcen & Schutzfaktoren', gespraechsbericht.gespraechsbericht.ressourcen_und_schutzfaktoren)
    addSection('Belastungen & Risikoindikatoren', gespraechsbericht.gespraechsbericht.belastungen_und_risikoindikatoren)
    addSection('Offene Punkte', gespraechsbericht.gespraechsbericht.offene_punkte)
    addSection('Nächste Schritte (Vorschlag)', gespraechsbericht.gespraechsbericht.naechste_schritte_vorschlag)

    yPosition += 10
    checkPageBreak(lineHeight * 5)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    pdf.text('---', margin, yPosition)
    yPosition += 5
    pdf.text(`Erstellt: ${new Date(report.created_at).toLocaleString('de-DE')}`, margin, yPosition)
    yPosition += 5
    pdf.text(`Audioqualität: ${gespraechsbericht.quality_notes.audio_quality}`, margin, yPosition)
    yPosition += 5
    pdf.text(`Transkript-Konfidenz: ${gespraechsbericht.quality_notes.transcript_confidence}`, margin, yPosition)
    yPosition += 5
    pdf.text('PII-Redaktion angewendet', margin, yPosition)

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="gespraechsbericht-${session.internal_case_id || params.id}.pdf"`,
      },
    })
  } catch (error: any) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json(
      { error: error.message || 'PDF generation failed' },
      { status: 500 }
    )
  }
}
