/**
 * Apply transcript corrections to raw text.
 * Replaces original (misheard) terms with corrected values.
 * Processes longer phrases first to avoid partial replacements
 * (e.g. "Maître Spet" before "Maître").
 */
export function applyTranscriptCorrections(
  rawText: string,
  wordCorrections: Record<string, string>
): string {
  if (!rawText || !wordCorrections || Object.keys(wordCorrections).length === 0) {
    return rawText
  }

  // Sort keys by length descending so longer phrases are replaced first
  const sortedOriginals = Object.keys(wordCorrections).sort(
    (a, b) => b.length - a.length
  )

  let result = rawText
  for (const original of sortedOriginals) {
    const replacement = wordCorrections[original]
    if (replacement !== undefined && original !== '') {
      // Use split/join to avoid regex special char issues
      result = result.split(original).join(replacement)
    }
  }
  return result
}
