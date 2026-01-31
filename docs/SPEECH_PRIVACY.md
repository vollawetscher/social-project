# Speech Recognition Privacy & GDPR Compliance

## Overview

This application uses **Speechmatics Real-Time API** for all speech-to-text transcription, ensuring full GDPR (DSGVO) and EU AI Act compliance.

## ✅ What We Do (GDPR-Compliant)

- **All voice processing happens on EU servers** (Speechmatics EU2 region: `eu2.rt.speechmatics.com`)
- Voice data is transmitted directly from user's device to Speechmatics servers via secure WebSocket
- No third-party processing (no Apple, Google, or Microsoft APIs)
- No voice data stored on our servers
- JWT tokens expire after 1 hour for security
- Real-time transcription with low latency

## ❌ What We Removed (Non-Compliant)

Previously, the app used `webkitSpeechRecognition` (Web Speech API) which:
- Sends voice data to Apple's servers on iOS/Safari
- Triggers iOS permission prompt: "Safari would like to access speech recognition. Speech data will be sent to Apple..."
- **Violates GDPR Article 44** (data transfers outside EU without adequate safeguards)
- **Violates EU AI Act** (using third-party AI systems without transparency)

## Technical Implementation

### Architecture

```
User's Device (iOS/Android/Desktop)
    ↓ [WebSocket over TLS]
Speechmatics EU2 Server (Frankfurt)
    ↓ [HTTPS API]
Our Backend (Generates secure JWT tokens)
```

### Files

1. **`lib/services/speechmatics-realtime.ts`**
   - WebSocket client for real-time transcription
   - Handles audio streaming (PCM 16-bit @ 16kHz)
   - Manages connection lifecycle

2. **`app/api/speechmatics/token/route.ts`**
   - Generates temporary JWT tokens (1-hour expiry)
   - Keeps API key secure on server-side
   - Requires authentication

3. **`components/session/CompactTranscribableField.tsx`**
   - Updated to use Speechmatics instead of Web Speech API
   - Real-time dictation with live preview
   - German language support

### Security Features

- **JWT tokens** with 1-hour expiry
- **Server-side API key** storage (never exposed to client)
- **TLS encryption** for all communications
- **EU-only processing** (no data leaves EU jurisdiction)

## User Experience

### Before (Non-Compliant)
1. User taps dictation button
2. iOS shows: "Safari would like to access speech recognition. Speech data will be sent to Apple..."
3. ⚠️ **GDPR violation**

### After (Compliant)
1. User taps dictation button
2. Standard microphone permission (required by browser)
3. Real-time transcription via Speechmatics
4. ✅ **GDPR compliant**

## Privacy Notice

Users see this notice in the UI:

> **DSGVO-konforme Spracherkennung:** Ihre Sprachdaten werden ausschließlich über unsere EU-Server (Speechmatics) verarbeitet. Keine Daten werden an Apple oder andere Drittanbieter gesendet. EU AI Act konform.

## Compliance Checklist

- ✅ **GDPR Article 5** - Data processed lawfully and transparently
- ✅ **GDPR Article 6** - Legitimate interest (service functionality)
- ✅ **GDPR Article 25** - Privacy by design
- ✅ **GDPR Article 32** - Security of processing (encryption, access controls)
- ✅ **GDPR Article 44** - International transfers (EU-only processing)
- ✅ **EU AI Act Article 13** - Transparency obligations (users informed about AI usage)

## Data Processing Agreement (DPA)

Speechmatics provides a GDPR-compliant DPA:
- ISO 27001 certified
- EU-based infrastructure
- GDPR Article 28 compliant processor
- No data retention for real-time API

## Testing

To verify EU-only processing:
1. Open browser DevTools → Network tab
2. Start dictation
3. Verify WebSocket connection to `wss://eu2.rt.speechmatics.com/v2`
4. No connections to `apple.com`, `google.com`, etc.

## Support

For questions about privacy and data processing:
- Review Speechmatics privacy policy: https://www.speechmatics.com/privacy-policy
- Review our privacy policy: [Link to your privacy policy]
- Contact: [Your data protection contact]

---

**Last Updated:** January 31, 2026
**Next Review:** July 31, 2026
