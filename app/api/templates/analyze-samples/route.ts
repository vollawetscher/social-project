import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface AnalysisResult {
  sections: Array<{
    name: string
    detected: boolean
    description?: string
  }>
  tone: string
  perspective: string
  language: string
  styleCharacteristics: {
    averageParagraphLength: string
    usesBulletPoints: boolean
    usesNumberedLists: boolean
    formality: string
  }
  requiredInputs: string[]
  suggestedInstructions: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Extract text from all files
    const documentTexts: string[] = []
    
    for (const file of files) {
      const text = await file.text()
      documentTexts.push(text)
    }

    // Combine all texts for analysis
    const combinedText = documentTexts.join('\n\n---DOCUMENT SEPARATOR---\n\n')

    // Analyze with Claude
    const analysisPrompt = `You are an expert document analyst. Analyze these sample documents and extract a template structure that can be used to generate similar documents in the future.

Sample Documents:
${combinedText.substring(0, 50000)} ${combinedText.length > 50000 ? '...(truncated)' : ''}

Please analyze and provide:

1. **Sections**: Identify all distinct sections/headings that appear across the samples. For each section:
   - Name of the section
   - Brief description of what it contains
   - Whether it appears in all samples (detected: true) or just some (detected: false)

2. **Tone & Style**:
   - Overall tone (e.g., "Professional / Formal", "Casual / Conversational", "Technical / Academic")
   - Writing perspective (e.g., "First Person", "Third Person", "Mixed")
   - Language (e.g., "English", "German", "French")

3. **Style Characteristics**:
   - Average paragraph length (Short/Medium/Long)
   - Uses bullet points? (yes/no)
   - Uses numbered lists? (yes/no)
   - Formality level (Very Formal/Formal/Neutral/Informal)

4. **Required Inputs**: What information/data points are consistently needed to generate this type of document? (e.g., participants, date, venue, key topics, decisions made, etc.)

5. **Generation Instructions**: Write clear, concise instructions (2-3 sentences) for an AI to generate this type of document.

Respond ONLY with valid JSON in this exact format:
{
  "sections": [
    { "name": "Section Name", "detected": true, "description": "Brief description" }
  ],
  "tone": "Tone description",
  "perspective": "Perspective description",
  "language": "Language name",
  "styleCharacteristics": {
    "averageParagraphLength": "Short|Medium|Long",
    "usesBulletPoints": true,
    "usesNumberedLists": false,
    "formality": "Formal|Neutral|Informal"
  },
  "requiredInputs": ["input1", "input2"],
  "suggestedInstructions": "Instructions for generating this type of document"
}`

    console.log('[Template Analysis] Sending to Claude...')
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent analysis
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Template Analysis] Claude response:', responseText.substring(0, 500))

    // Parse JSON response
    let analysis: AnalysisResult
    try {
      // Try to extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/```\s*([\s\S]*?)\s*```/)
      
      const jsonText = jsonMatch ? jsonMatch[1] : responseText
      analysis = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('[Template Analysis] Failed to parse JSON:', parseError)
      console.error('[Template Analysis] Response text:', responseText)
      
      // Return a fallback analysis
      analysis = {
        sections: [
          { name: 'Summary', detected: true, description: 'Overview of the document' },
          { name: 'Details', detected: true, description: 'Main content' },
          { name: 'Conclusion', detected: true, description: 'Final remarks' },
        ],
        tone: 'Professional / Formal',
        perspective: 'Third Person',
        language: 'English',
        styleCharacteristics: {
          averageParagraphLength: 'Medium',
          usesBulletPoints: true,
          usesNumberedLists: false,
          formality: 'Formal',
        },
        requiredInputs: ['participants', 'purpose', 'date'],
        suggestedInstructions: 'Generate a professional document summarizing the key points and outcomes.',
      }
    }

    console.log('[Template Analysis] Parsed analysis:', JSON.stringify(analysis, null, 2))

    return NextResponse.json({
      success: true,
      filesAnalyzed: files.length,
      analysis,
    })

  } catch (error) {
    console.error('[Template Analysis] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze documents', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
