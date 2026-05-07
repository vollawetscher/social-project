import type Anthropic from '@anthropic-ai/sdk'

/**
 * Assistant prefill that forces Claude's reply to be the body of a JSON object.
 *
 * Claude sometimes wraps JSON in markdown fences (` ```json ... ``` `) or adds
 * preambles, even when the prompt forbids it. By prefilling the assistant turn
 * with `{`, the model physically cannot emit a fence or preamble — its
 * continuation is constrained to be a JSON object body. The opening `{` must be
 * re-prepended to the response text before parsing.
 */
export const JSON_PREFILL: Anthropic.MessageParam = {
  role: 'assistant',
  content: '{',
}

/**
 * Re-attach the prefilled `{` to a Claude response text so the result starts
 * with `{` and is ready for `JSON.parse`.
 */
export function withJsonPrefill(responseText: string): string {
  const trimmed = String(responseText || '').trimStart()
  return trimmed.startsWith('{') ? trimmed : `{${trimmed}`
}
