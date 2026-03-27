# Cleanup Backlog

Technical debt and refactoring items to address when time allows.

---

## Code Duplication

### `normalizeWordCorrections` — 3 identical copies
The AI returns `word_corrections` as `{original, corrected, confidence}[]` but the UI expects `Record<string, string>`. The normalizer is duplicated in:
- `app/[locale]/(app)/sessions/[id]/page.tsx`
- `components/session-setup-panel.tsx`
- `components/transcript-viewer-v0.tsx` (inline IIFE)

**Fix:** Extract to `lib/utils/normalize-word-corrections.ts` and import everywhere.

---

## Dead Code

### `offsetTranscriptSegments` and `identifyPrimedSpeaker` — unused exports
Voice sample stripping was moved into `SpeechmaticsService.parseTranscript` (word-level filtering) and `detectPrimedSpeaker`. The old segment-level functions in `lib/services/voice-sample-prepend.ts` are no longer imported anywhere.

**Fix:** Remove `offsetTranscriptSegments` and `identifyPrimedSpeaker` from `voice-sample-prepend.ts`.

---

## Configuration

### `ffmpeg-static` npm dependency — possibly unnecessary
System ffmpeg is installed via Nixpacks (`nixPkgs = ["...", "ffmpeg"]`). If confirmed working on Railway, the `ffmpeg-static` npm package and the `experimental.serverComponentsExternalPackages` config can be removed.

**Fix:** After confirming system ffmpeg works, remove `ffmpeg-static` from `package.json` and clean up `next.config.js`.

---

## Error Messages

### Hardcoded German error messages in upload route
`app/api/sessions/[id]/upload/route.ts` has several German-only error messages (e.g. "Die Datei ist zu klein", "Audioformat wird nicht unterstützt"). These should use a locale-neutral format or error codes that the client localizes.

**Fix:** Return error codes/keys instead of hardcoded German strings.

---

## Schema

### `user_is_speaker` — backfill for existing sessions
Existing sessions have `user_is_speaker = NULL`. Call sessions and quick recordings created before this column was added won't benefit from voice sample prepend on re-transcription.

**Fix:** Run a one-time backfill:
```sql
UPDATE sessions SET user_is_speaker = true
WHERE id IN (SELECT session_id FROM calls WHERE session_id IS NOT NULL)
   OR input_hint IN ('quick_record', 'voice_note', 'phone_call', 'video_call');
```

---

## Auto-generation SSL Error

### `ERR_SSL_PACKET_LENGTH_TOO_LONG` on auto-generation fetch
After analysis completes, the auto-generation internal fetch fails with an SSL error. This is likely an internal fetch using `https://` to hit the local server which only listens on HTTP.

**Fix:** Investigate the `NEXT_PUBLIC_APP_URL` value on Railway and ensure internal fetches use the correct protocol/port.

---

*Last updated: March 27, 2026*
