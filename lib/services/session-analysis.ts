/**
 * Detect whether a session has completed AI analysis artifacts.
 *
 * Important: DB defaults are `suggested_domains = []` and
 * `ai_extracted_context = {}`. Those are truthy in JavaScript, so a naive
 * `recording_type && suggested_domains && ai_extracted_context` check falsely
 * treats brand-new (or voice-agent-preseeded) sessions as already analyzed.
 */
export function hasReadyAnalysisArtifacts(sessionRow: {
  recording_type?: string | null
  suggested_domains?: unknown
  ai_extracted_context?: unknown
} | null | undefined): boolean {
  if (!sessionRow) return false

  const hasRecordingType =
    typeof sessionRow.recording_type === 'string' && sessionRow.recording_type.trim().length > 0
  const hasDomains =
    Array.isArray(sessionRow.suggested_domains) && sessionRow.suggested_domains.length > 0
  const extracted = sessionRow.ai_extracted_context
  const hasExtractedContext =
    !!extracted &&
    typeof extracted === 'object' &&
    !Array.isArray(extracted) &&
    Object.keys(extracted as object).length > 0

  return hasRecordingType && hasDomains && hasExtractedContext
}
