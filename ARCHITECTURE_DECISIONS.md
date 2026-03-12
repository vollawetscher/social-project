# Notissima — Architecture Decisions

**Last updated:** 2026-03-04

## Tech Stack Decision: Capacitor Wrapper (not Native Rewrite)

### Decision
Build as a **web app (React + Supabase)** wrapped with **Capacitor** for iOS/Android distribution.
A full native rewrite (React Native / Flutter) is deferred until 1000+ active users and sufficient revenue.

### Rationale
- 90% of native benefits at 10% of the effort (1-2 days vs. 4-8 weeks)
- Entire codebase stays as one — no separate iOS/Android codebases
- Core features (Voice Recording, WebRTC/LiveKit, Supabase Auth) work well in Capacitor
- Team can iterate fast with web technologies

### Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client (Capacitor Wrapper)                             │
│  - React + TypeScript + Tailwind                        │
│  - Capacitor native plugins (Mic, Push, Background)     │
│  - LiveKit Client SDK (WebRTC)                          │
│  - Supabase Client (Auth, DB, Storage)                  │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌───────────────────────────────┐
│  Supabase (Backend)  │  │  LiveKit Server (Cloud)       │
│  - Auth (email, OAuth│  │  - WebRTC Rooms               │
│  - PostgreSQL DB     │  │  - Egress Service             │
│  - Storage (audio)   │  │    (server-side recording,    │
│  - Edge Functions    │  │     per-speaker audio tracks)  │
└──────────────────────┘  └───────────────┬───────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │  Transcription Service        │
                          │  - Whisper / Deepgram         │
                          │  - Speaker diarization        │
                          │  - Per-speaker text output    │
                          └───────────────────────────────┘
```

### Conference Call Recording & Transcription

**Approach:** Server-side via LiveKit Egress (NOT client-side microphone recording)

1. All participants connect to LiveKit Room via the app
2. LiveKit Egress records audio server-side — each speaker as a separate track
3. After the call: audio files are sent to Whisper/Deepgram for transcription
4. Result: clean text with speaker attribution

**Why server-side:**
- Perfect audio quality (digital streams, no room noise)
- Speaker separation built-in (each participant = own track)
- Works identically regardless of client device (phone, tablet, desktop)
- No dependency on client microphone quality or room acoustics

### Capacitor Wrapper — Benefits over pure PWA

| Feature              | PWA (current)              | Capacitor Wrapper          |
|----------------------|---------------------------|---------------------------|
| Voice Recording      | Web API, browser-dependent | Native plugin, reliable    |
| WebRTC/LiveKit       | Audio stops on standby     | Runs in background         |
| File Upload          | Standard fetch             | Background upload possible |
| Push Notifications   | Limited (especially iOS)   | Fully native               |
| Offline              | Service Worker only        | Native + Service Worker    |
| App Store presence   | No                         | Yes (iOS + Android)        |

### Known Limitations of Capacitor Wrapper

These are acceptable trade-offs for the current stage (0-1000 users):

1. **Performance**: UI renders in WebView (embedded browser). Complex animations or very long lists may feel slightly less smooth than native. For our use cases (forms, voice recording, call UI) this is negligible.

2. **UX / Look & Feel**: Scroll behavior, transitions, and gestures feel slightly different from native iOS/Android apps. Most users won't notice.

3. **Keyboard handling**: Input fields can sometimes be hidden behind the keyboard. Solvable but requires fine-tuning.

4. **App Store risk (Apple)**: Apple can reject pure WebView apps. Mitigated because we use native features (microphone, push notifications, camera).

5. **App size**: Slightly larger than a pure native app (WebView engine included). Typically 10-20MB overhead.

6. **Dual dependency**: Depends on both web framework updates AND Capacitor plugin updates. When iOS/Android ships a major update, Capacitor may need to catch up.

7. **WebRTC edge cases**: Background audio is much better than PWA but still not quite as robust as a fully native WebRTC integration. Rare issues possible on older Android devices.

### When to Consider Native Rewrite

Trigger points for reconsidering a full native app:

- **1000+ active users** with revenue to fund 4-8 weeks of development
- **Performance complaints** from users about UI responsiveness
- **Complex audio features** needed (real-time audio editing, waveform visualization, audio effects)
- **Advanced native UX** required (Instagram/TikTok-level gestures and animations)
- **Enterprise customers** demanding native app certification

### App Store Requirements

**Apple App Store (iOS):**
- Apple Developer Account: $99/year
- Review process: typically 1-3 days (first submission may take longer)
- Requires Xcode on macOS for building
- Strict guidelines — app must provide native value beyond a website

**Google Play Store (Android):**
- Google Play Developer Account: $25 one-time fee
- Review process: typically 1-3 days (can be hours for updates)
- Can build from macOS or Linux
- Less strict than Apple but increasingly enforcing quality standards

**Realistic timeline for first store submission:**
- Setup accounts + certificates: 1 day
- Capacitor build + testing: 1-2 days
- Prepare store listing (screenshots, description, privacy policy): 1 day
- Review wait time: 1-3 days
- **Total: ~1 week from "go" to live in stores**

**For updates after initial approval:**
- Push update, review takes hours to 1-2 days
- Hot updates (web content only) can bypass store review entirely via Capacitor Live Update

---

## Open Decisions (to be discussed)

- [ ] Supabase project: shared with Playacar or separate instance?
- [ ] LiveKit hosting: self-hosted or LiveKit Cloud?
- [ ] Transcription provider: OpenAI Whisper (API) vs Deepgram vs self-hosted Whisper?
- [ ] Auth strategy: email only, or also OAuth (Google, Apple)?
- [ ] i18n languages: EN + ES + DE?
