# Recording Safety Features

## Audio Feedback Implementation

The AudioRecorder component now includes multiple layers of protection against data loss:

### 1. **Health Monitoring** (Every 5 seconds)
- ✅ Automatically checks if audio chunks are being captured
- ✅ If no data received for 5+ seconds → **Triple beep alert** + visual warning
- ⏸️ Paused automatically when recording is paused
- 🛑 Stopped when recording ends

### 2. **MediaRecorder Error Detection**
- ✅ Listens for MediaRecorder errors
- ✅ Immediate **triple beep alert** + critical error message
- ⚠️ Alerts: "KRITISCHER FEHLER bei der Aufnahme!"

### 3. **Microphone Track Monitoring**
- ✅ Detects if microphone access is lost during recording
- ✅ **Triple beep alert** when track ends unexpectedly
- ⚠️ Alerts: "Mikrofon-Zugriff wurde beendet!"

### 4. **Post-Recording Validation**
- ✅ Validates that recorded data size matches duration
- ✅ **Triple beep alert** if recording appears incomplete
- 📊 Shows expected vs actual data size

## Audio Alert Pattern

**Triple Beep** (800Hz sine wave):
- Beep 1 at T+0ms
- Beep 2 at T+200ms  
- Beep 3 at T+400ms

Works even when:
- ✅ Phone screen is locked
- ✅ App is in background
- ✅ Phone is in pocket
- ✅ Silent mode (on most devices)

## User Experience

### Normal Recording
1. User starts recording → "Aufnahme gestartet"
2. Health monitoring runs silently in background
3. User stops recording → "Aufnahme beendet"
4. Data validated, saved if OK

### Failure Scenario
1. Recording running normally
2. **Issue detected** (no data / mic lost / error)
3. → 🔊 **BEEP-BEEP-BEEP** (audio alert)
4. → 🚨 Visual toast notification (10-15s duration)
5. → User can immediately stop & restart to prevent data loss

## Technical Details

- Health check interval: 5 seconds
- Alert sound: 800Hz, 150ms per beep, 200ms spacing
- Visual alerts: 10,000ms - 15,000ms duration
- Minimum expected data: 8KB per second of recording
