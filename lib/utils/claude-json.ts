/**
 * Helpers for Claude JSON responses.
 *
 * Sonnet 4.6 does not support assistant message prefill, so callers must end
 * the messages array with a user turn and enforce JSON-only output in the prompt.
 */

/**
 * Normalize Claude JSON text before parsing.
 * Prepends `{` when the model omitted the opening brace (common without prefill).
 */
export function withJsonPrefill(responseText: string): string {
  const trimmed = String(responseText || '').trimStart()
  return trimmed.startsWith('{') ? trimmed : `{${trimmed}`
}

/** Append to prompts that must return a raw JSON object (no markdown fences). */
export const JSON_ONLY_SUFFIX =
  '\n\nRespond with ONLY valid JSON — a single object starting with `{`. No markdown fences, no preamble, no explanation.'
