# Local Recordings - Technical Details

## File Formats

### Browser-Specific Formats
Recordings use the best format supported by the browser:

| Browser | Format | MIME Type | Extension |
|---------|--------|-----------|-----------|
| **iOS Safari** | AAC (MP4) | `audio/mp4` | `.mp4` |
| **Desktop Chrome** | Opus (WebM) | `audio/webm` | `.webm` |
| **Desktop Chrome** | Vorbis (Ogg) | `audio/ogg` | `.ogg` |
| **Android Chrome** | WebM/Ogg | `audio/webm` | `.webm` |
| **Firefox** | Opus (Ogg) | `audio/ogg` | `.ogg` |

### Why Different Formats?

- **iOS Safari** uses MP4/AAC because WebM isn't supported
- **Desktop browsers** prefer WebM or Ogg for efficiency
- All formats are **compatible with Speechmatics** transcription
- Format is **auto-detected** at recording time

### Quality Metrics

- **Bitrate**: ~64-128 kbps (varies by browser)
- **Sample rate**: 16kHz - 48kHz (browser dependent)
- **Channels**: Mono (single channel)
- **File size**: ~1-2 MB per minute of audio

## Storage Limits

### IndexedDB Storage Quotas

| Platform | Typical Limit | Maximum | Notes |
|----------|--------------|---------|-------|
| **iOS Safari** | 50-100 MB | ~1 GB | Cleared if device low on storage |
| **Desktop Chrome** | 60% of disk | Several GB | Uses quota API |
| **Android Chrome** | ~100 MB | Several GB | Can request more |
| **Firefox** | ~50 MB | Several GB | Prompts if over 50MB |

### Practical Capacity

| Recording Length | Est. File Size | iOS Capacity | Desktop Capacity |
|-----------------|----------------|--------------|------------------|
| 5 minutes | 5-10 MB | ✅ 5-10 recordings | ✅ 100+ recordings |
| 15 minutes | 15-30 MB | ✅ 3-6 recordings | ✅ 50+ recordings |
| 30 minutes | 30-60 MB | ⚠️ 1-3 recordings | ✅ 30+ recordings |
| 60 minutes | 60-120 MB | ❌ Risk full | ✅ 15+ recordings |

### Storage Best Practices

1. **Upload regularly** - Don't accumulate many recordings
2. **Delete after upload** - Auto-cleanup implemented
3. **Monitor storage** - UI shows total size
4. **Warn users** - Show warning at 80% capacity (future)

## Browser Compatibility

### MediaRecorder API Support

| Browser | Supported | Format | Notes |
|---------|-----------|--------|-------|
| Chrome 47+ | ✅ | WebM/Ogg | Full support |
| Firefox 29+ | ✅ | Ogg/WebM | Full support |
| Safari 14+ | ✅ | MP4 | iOS 14+, macOS 11+ |
| Edge 79+ | ✅ | WebM | Chromium-based |
| Opera 36+ | ✅ | WebM | Full support |

### IndexedDB Support

| Browser | Supported | Notes |
|---------|-----------|-------|
| All modern browsers | ✅ | IE 10+ (not recommended) |
| Safari 10+ | ✅ | iOS 10+, macOS 10.12+ |
| Chrome 24+ | ✅ | Full support |
| Firefox 16+ | ✅ | Full support |

### Known Issues

1. **iOS Safari < 14** - No MediaRecorder support
2. **Private/Incognito mode** - Limited storage (10-50 MB)
3. **Storage pressure** - iOS may clear data if device full
4. **Audio quality** - iOS Safari may use lower bitrate

## Recording Quality

### Optimization Settings

Current implementation:
```typescript
// Auto-detect best format
const audioFormat = detectSupportedAudioFormat()

// Priority order:
1. audio/mp4 (iOS)
2. audio/mpeg (MP3)
3. audio/wav (uncompressed, large)
4. audio/ogg (Opus codec)
5. audio/aac
```

### Bitrate Control

Not currently configurable - browser decides:
- **iOS**: ~64 kbps (good for speech)
- **Chrome**: ~96-128 kbps (excellent quality)
- **Firefox**: ~96 kbps (good quality)

### Future Enhancements

1. **Quality selector** - Let users choose bitrate
2. **Compression** - Client-side compression before storage
3. **Chunking** - Split long recordings into chunks
4. **Background upload** - Upload while recording continues

## Technical Architecture

### Data Flow

```
1. Recording
   ↓
[MediaRecorder API]
   ↓
[Blob (in-memory)]
   ↓
[IndexedDB (persistent)]

2. Upload
   ↓
[Read from IndexedDB]
   ↓
[Convert to File object]
   ↓
[Upload via FormData]
   ↓
[Supabase Storage]
   ↓
[Delete from IndexedDB]
```

### Storage Schema

```typescript
Database: gespraechsbericht-recordings
Store: recordings

Recording {
  id: string           // Unique ID
  blob: Blob          // Raw audio data
  duration: number    // Seconds
  timestamp: number   // Unix timestamp
  mimeType: string    // e.g., "audio/mp4"
  size: number        // Bytes
}

Indexes:
- timestamp (for sorting)
```

### Security

- **Sandboxed** - IndexedDB isolated per origin
- **No cross-origin access** - Can't be read by other sites
- **User-controlled** - User can clear via browser settings
- **No server access** - Data never leaves device until upload

## Monitoring & Debugging

### Check IndexedDB Contents

**Chrome DevTools:**
1. Open DevTools (F12)
2. Application tab
3. IndexedDB → gespraechsbericht-recordings
4. recordings store
5. See all stored recordings

**Firefox DevTools:**
1. Open DevTools (F12)
2. Storage tab
3. Indexed DB → gespraechsbericht-recordings
4. recordings → View entries

### Console Logging

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('debug', 'recording:*')
```

Look for:
- `[AudioRecorder]` - Recording operations
- `[LocalStorage]` - IndexedDB operations
- `[AudioFormat]` - Format detection

### Check Storage Usage

```javascript
// In browser console (Chrome only)
navigator.storage.estimate().then(estimate => {
  console.log('Used:', estimate.usage / 1024 / 1024, 'MB')
  console.log('Available:', estimate.quota / 1024 / 1024, 'MB')
  console.log('Percentage:', (estimate.usage / estimate.quota * 100).toFixed(1) + '%')
})
```

## Performance

### Recording Performance

- **CPU usage**: Low (~2-5%)
- **Memory usage**: ~10-50 MB while recording
- **Battery impact**: Minimal (same as native voice recorder)

### Storage Performance

- **Write speed**: ~100+ MB/s (IndexedDB)
- **Read speed**: ~200+ MB/s
- **Search**: O(1) by ID, O(n log n) by timestamp
- **Delete**: ~1ms per recording

### Upload Performance

- **Compression**: Gzip enabled
- **Chunk size**: Entire file (no chunking yet)
- **Concurrent uploads**: Sequential (one at a time)
- **Progress tracking**: Supported

## Troubleshooting

### "Storage full" Error

**Solution:**
1. Upload pending recordings
2. Clear browser cache
3. Free up device storage
4. Use desktop instead of mobile

### Recording Not Saving

**Check:**
1. Browser supports MediaRecorder
2. IndexedDB enabled (not disabled in privacy settings)
3. Not in Private/Incognito mode (limited storage)
4. Sufficient storage available

### Upload Fails

**Check:**
1. Network connection
2. File size within limits (100 MB max)
3. Authentication valid
4. Case selected

### Audio Quality Poor

**Solutions:**
1. Use desktop browser (higher bitrate)
2. Record in quiet environment
3. Speak clearly close to microphone
4. Check microphone quality

---

**Last Updated:** January 31, 2026
**Format Support:** MP4, WebM, Ogg, AAC
**Storage:** IndexedDB API
