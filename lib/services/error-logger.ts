import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'
export type ErrorType = 'server_error' | 'client_error' | 'bug_report' | 'api_error'

export interface ErrorContext {
  // Identifiers (hierarchical for AI analysis)
  caseId?: string | null
  sessionId?: string | null
  fileId?: string | null
  userId?: string | null

  // Error details
  errorType: ErrorType
  severity?: ErrorSeverity
  message: string
  error?: Error | unknown
  errorCode?: string

  // Request context
  endpoint?: string
  method?: string
  userAgent?: string
  ipAddress?: string

  // Application state
  appVersion?: string
  environment?: string

  // Additional context
  metadata?: Record<string, any>

  // User-provided info (for bug reports)
  userDescription?: string
  reproductionSteps?: string
}

export class ErrorLogger {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Log an error with full context
   */
  async log(context: ErrorContext): Promise<{ id: string | null; error: Error | null }> {
    try {
      const stackTrace = this.extractStackTrace(context.error)
      const errorMessage = this.extractErrorMessage(context.error, context.message)

      const { data, error } = await this.supabase
        .from('error_logs')
        .insert({
          case_id: context.caseId || null,
          session_id: context.sessionId || null,
          file_id: context.fileId || null,
          user_id: context.userId || null,
          error_type: context.errorType,
          severity: context.severity || 'error',
          message: errorMessage,
          stack_trace: stackTrace,
          error_code: context.errorCode,
          endpoint: context.endpoint,
          method: context.method,
          user_agent: context.userAgent,
          ip_address: context.ipAddress,
          app_version: context.appVersion || process.env.NEXT_PUBLIC_APP_VERSION,
          environment: context.environment || process.env.NODE_ENV,
          metadata: context.metadata || {},
          user_description: context.userDescription,
          reproduction_steps: context.reproductionSteps,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[ErrorLogger] Failed to log error to database:', error)
        return { id: null, error }
      }

      // Also log to console for immediate visibility
      console.error('[ErrorLogger] Logged error:', {
        id: data.id,
        type: context.errorType,
        severity: context.severity,
        message: errorMessage,
        case_id: context.caseId,
        session_id: context.sessionId,
      })

      return { id: data.id, error: null }
    } catch (err) {
      console.error('[ErrorLogger] Critical error in logger:', err)
      return { id: null, error: err as Error }
    }
  }

  /**
   * Log error from API route request
   */
  async logFromRequest(
    error: Error | unknown,
    request: Request,
    additionalContext?: Partial<ErrorContext>
  ): Promise<{ id: string | null; error: Error | null }> {
    const url = new URL(request.url)
    
    return this.log({
      errorType: 'server_error',
      severity: 'error',
      message: this.extractErrorMessage(error),
      error,
      endpoint: url.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: this.extractIpAddress(request),
      ...additionalContext,
    })
  }

  /**
   * Extract stack trace from error
   */
  private extractStackTrace(error: unknown): string | undefined {
    if (error instanceof Error && error.stack) {
      return error.stack
    }
    return undefined
  }

  /**
   * Extract error message from error object or fallback
   */
  private extractErrorMessage(error?: unknown, fallback?: string): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message)
    }
    return fallback || 'Unknown error'
  }

  /**
   * Extract IP address from request
   */
  private extractIpAddress(request: Request): string | undefined {
    // Try various headers that might contain the client IP
    const headers = [
      'x-forwarded-for',
      'x-real-ip',
      'cf-connecting-ip', // Cloudflare
      'x-client-ip',
    ]

    for (const header of headers) {
      const value = request.headers.get(header)
      if (value) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return value.split(',')[0].trim()
      }
    }

    return undefined
  }

  /**
   * Mark error as resolved
   */
  async resolve(errorId: string, resolutionNotes?: string): Promise<void> {
    await this.supabase
      .from('error_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
      })
      .eq('id', errorId)
  }

  /**
   * Get error patterns for AI analysis
   * Returns aggregated error data grouped by type, message, and identifiers
   */
  async getErrorPatterns(options?: {
    caseId?: string
    sessionId?: string
    startDate?: Date
    endDate?: Date
    minOccurrences?: number
  }) {
    let query = this.supabase
      .from('error_logs')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })

    if (options?.caseId) {
      query = query.eq('case_id', options.caseId)
    }

    if (options?.sessionId) {
      query = query.eq('session_id', options.sessionId)
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString())
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return data
  }
}

/**
 * Helper function to create ErrorLogger instance
 */
export function createErrorLogger(supabase?: SupabaseClient): ErrorLogger {
  return new ErrorLogger(supabase || createClient())
}

/**
 * Helper function to log errors in catch blocks
 * Example usage:
 * 
 * try {
 *   // ... code
 * } catch (error) {
 *   await logError({
 *     errorType: 'api_error',
 *     message: 'Failed to process request',
 *     error,
 *     sessionId: sessionId,
 *     caseId: caseId
 *   })
 * }
 */
export async function logError(context: ErrorContext) {
  const logger = createErrorLogger()
  return logger.log(context)
}
