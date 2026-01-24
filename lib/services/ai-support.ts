import Anthropic from '@anthropic-ai/sdk'
import { createErrorLogger } from './error-logger'
import { SupabaseClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ErrorAnalysis {
  summary: string
  rootCause: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
  preventionStrategies: string[]
  affectedSessions: string[]
  errorCount: number
  firstSeen: Date
  lastSeen: Date
}

export class AISupportService {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Analyze errors for a specific case and provide AI-powered insights
   */
  async analyzeCaseErrors(caseId: string): Promise<ErrorAnalysis> {
    const errorLogger = createErrorLogger(this.supabase)

    // Get all unresolved errors for the case
    const errors = await errorLogger.getErrorPatterns({
      caseId,
      // Look back 30 days
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    })

    if (errors.length === 0) {
      return {
        summary: 'No errors found for this case',
        rootCause: 'N/A',
        severity: 'low',
        recommendations: [],
        preventionStrategies: [],
        affectedSessions: [],
        errorCount: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
      }
    }

    // Prepare error summary for AI
    const errorSummary = this.prepareErrorSummary(errors)

    // Get AI analysis
    const aiResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are a technical support analyst. Analyze these error logs from a medical transcription application and provide structured insights.

Case ID: ${caseId}
Total Errors: ${errors.length}

Error Summary:
${errorSummary}

Provide analysis in this JSON format:
{
  "summary": "Brief overview of the issues (2-3 sentences)",
  "rootCause": "Most likely root cause of the errors",
  "severity": "low|medium|high|critical",
  "recommendations": ["Specific action 1", "Specific action 2", "..."],
  "preventionStrategies": ["Prevention strategy 1", "Prevention strategy 2", "..."]
}

Focus on:
1. Patterns and recurring issues
2. Correlation between errors
3. User impact assessment
4. Actionable recommendations
5. Long-term prevention strategies`,
        },
      ],
    })

    // Parse AI response
    const aiAnalysis = this.parseAIResponse(aiResponse)

    // Get affected sessions
    const affectedSessions = [
      ...new Set(errors.map((e) => e.session_id).filter(Boolean)),
    ] as string[]

    // Get time range
    const timestamps = errors.map((e) => new Date(e.created_at).getTime())
    const firstSeen = new Date(Math.min(...timestamps))
    const lastSeen = new Date(Math.max(...timestamps))

    return {
      ...aiAnalysis,
      affectedSessions,
      errorCount: errors.length,
      firstSeen,
      lastSeen,
    }
  }

  /**
   * Analyze errors for a specific session
   */
  async analyzeSessionErrors(sessionId: string): Promise<ErrorAnalysis> {
    const errorLogger = createErrorLogger(this.supabase)

    const errors = await errorLogger.getErrorPatterns({
      sessionId,
    })

    if (errors.length === 0) {
      return {
        summary: 'No errors found for this session',
        rootCause: 'N/A',
        severity: 'low',
        recommendations: [],
        preventionStrategies: [],
        affectedSessions: [sessionId],
        errorCount: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
      }
    }

    const errorSummary = this.prepareErrorSummary(errors)

    const aiResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Analyze these errors from a single transcription session:

Session ID: ${sessionId}
Total Errors: ${errors.length}

${errorSummary}

Provide concise analysis in JSON format:
{
  "summary": "What went wrong",
  "rootCause": "Most likely cause",
  "severity": "low|medium|high|critical",
  "recommendations": ["Fix 1", "Fix 2"],
  "preventionStrategies": ["Prevention 1", "Prevention 2"]
}`,
        },
      ],
    })

    const aiAnalysis = this.parseAIResponse(aiResponse)

    const timestamps = errors.map((e) => new Date(e.created_at).getTime())

    return {
      ...aiAnalysis,
      affectedSessions: [sessionId],
      errorCount: errors.length,
      firstSeen: new Date(Math.min(...timestamps)),
      lastSeen: new Date(Math.max(...timestamps)),
    }
  }

  /**
   * Get system-wide error patterns (admin only)
   */
  async analyzeSystemErrors(days: number = 7): Promise<{
    totalErrors: number
    byType: Record<string, number>
    bySeverity: Record<string, number>
    topEndpoints: Array<{ endpoint: string; count: number }>
    trends: string
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const { data: errors, error } = await this.supabase
      .from('error_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .eq('resolved', false)

    if (error || !errors) {
      throw error
    }

    // Aggregate statistics
    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    const endpointCounts: Record<string, number> = {}

    errors.forEach((err) => {
      byType[err.error_type] = (byType[err.error_type] || 0) + 1
      bySeverity[err.severity] = (bySeverity[err.severity] || 0) + 1
      if (err.endpoint) {
        endpointCounts[err.endpoint] = (endpointCounts[err.endpoint] || 0) + 1
      }
    })

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Get AI trend analysis
    const summaryForAI = `
System Error Analysis (Last ${days} days)
Total Errors: ${errors.length}

By Type:
${Object.entries(byType)
  .map(([type, count]) => `  ${type}: ${count}`)
  .join('\n')}

By Severity:
${Object.entries(bySeverity)
  .map(([sev, count]) => `  ${sev}: ${count}`)
  .join('\n')}

Top Problematic Endpoints:
${topEndpoints.map((e) => `  ${e.endpoint}: ${e.count} errors`).join('\n')}
`

    const aiResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Analyze this system error summary and provide insights about trends and systemic issues:

${summaryForAI}

Provide 2-3 paragraphs analyzing:
1. Most concerning trends
2. Potential systemic issues
3. Priority areas for improvement`,
        },
      ],
    })

    const trends =
      aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''

    return {
      totalErrors: errors.length,
      byType,
      bySeverity,
      topEndpoints,
      trends,
    }
  }

  /**
   * Prepare error summary for AI analysis
   */
  private prepareErrorSummary(errors: any[]): string {
    // Group by message
    const grouped = errors.reduce((acc, err) => {
      const key = err.message
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(err)
      return acc
    }, {} as Record<string, any[]>)

    // Format summary
    let summary = ''
    Object.entries(grouped).forEach(([message, instances]) => {
      summary += `\nError: "${message}"\n`
      summary += `  Occurrences: ${instances.length}\n`
      summary += `  Severity: ${instances[0].severity}\n`
      summary += `  Type: ${instances[0].error_type}\n`
      summary += `  Endpoints: ${[...new Set(instances.map((i) => i.endpoint).filter(Boolean))].join(', ')}\n`

      if (instances[0].stack_trace) {
        const stackLines = instances[0].stack_trace.split('\n').slice(0, 3)
        summary += `  Stack: ${stackLines.join(' ')}\n`
      }

      if (instances[0].metadata) {
        summary += `  Context: ${JSON.stringify(instances[0].metadata)}\n`
      }
    })

    return summary
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: Anthropic.Message): {
    summary: string
    rootCause: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    recommendations: string[]
    preventionStrategies: string[]
  } {
    const content =
      response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          summary: parsed.summary || 'No summary provided',
          rootCause: parsed.rootCause || 'Unknown',
          severity: parsed.severity || 'medium',
          recommendations: parsed.recommendations || [],
          preventionStrategies: parsed.preventionStrategies || [],
        }
      }
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e)
    }

    // Fallback: use raw response
    return {
      summary: content.substring(0, 500),
      rootCause: 'See summary',
      severity: 'medium',
      recommendations: [],
      preventionStrategies: [],
    }
  }

  /**
   * Generate user-friendly support message
   */
  async generateSupportMessage(
    caseId: string,
    userDescription: string
  ): Promise<string> {
    const analysis = await this.analyzeCaseErrors(caseId)

    const prompt = `You are a helpful technical support agent. A user has reported an issue.

User's Description: "${userDescription}"

Technical Analysis:
- Error Count: ${analysis.errorCount}
- Severity: ${analysis.severity}
- Root Cause: ${analysis.rootCause}
- Summary: ${analysis.summary}

Generate a friendly, professional response to the user that:
1. Acknowledges their issue
2. Explains what went wrong in simple terms
3. Provides clear next steps or workarounds
4. Sets realistic expectations for resolution

Keep it concise (3-4 paragraphs) and avoid technical jargon.`

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  }
}

/**
 * Helper function to create AISupportService instance
 */
export function createAISupportService(supabase: SupabaseClient): AISupportService {
  return new AISupportService(supabase)
}
