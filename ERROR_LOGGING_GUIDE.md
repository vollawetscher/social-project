# Error Logging & Bug Reporting System

## Overview

This system provides comprehensive error tracking that combines server-side logs with client-side bug reports. All errors are stored in a centralized database with rich context for debugging and AI-powered analysis.

## Architecture

```
┌─────────────────┐
│  Client Side    │
│  - Bug Reporter │──┐
│  - Error Events │  │
└─────────────────┘  │
                      │
                      ├──→ /api/error-logs ──→ ┌──────────────┐
                      │                         │  error_logs  │
┌─────────────────┐  │                         │   table      │
│  Server Side    │  │                         └──────────────┘
│  - API Errors   │──┘                                │
│  - Background   │                                   │
│    Jobs         │                                   ↓
└─────────────────┘                          ┌────────────────┐
                                              │  AI Analysis   │
                                              │  - Patterns    │
                                              │  - Suggestions │
                                              └────────────────┘
```

## Key Features

### 1. Hierarchical Context
Every error is linked to your data hierarchy:
- **Case ID** - Highest level context (recommended for user-facing IDs)
- **Session ID** - Individual session context
- **File ID** - Specific file that caused the error
- **User ID** - Who encountered the error

### 2. Rich Metadata
- Full stack traces
- Request context (endpoint, method, IP, user agent)
- Application state (environment, version)
- Custom metadata (flexible JSON)

### 3. User Bug Reports
- Users can submit bug reports with descriptions
- Reproduction steps captured
- Automatically includes context (case, session, file)

### 4. AI-Ready Structure
- Designed for pattern detection
- Temporal analysis support
- Aggregation capabilities
- Correlation across hierarchy

## Usage

### Server-Side Error Logging

#### In API Routes

```typescript
import { createErrorLogger } from '@/lib/services/error-logger'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const errorLogger = createErrorLogger(supabase)
    
    // Your code...
  } catch (error) {
    const errorLogger = createErrorLogger()
    
    // Log with full context
    await errorLogger.logFromRequest(error, request, {
      sessionId: sessionId,
      caseId: caseId,
      errorCode: '500',
    })
    
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

#### In Background Jobs

```typescript
import { createErrorLogger } from '@/lib/services/error-logger'

async function backgroundJob(sessionId: string) {
  const supabase = createClient()
  const errorLogger = createErrorLogger(supabase)
  
  try {
    // Your processing code...
  } catch (error) {
    // Log with context
    await errorLogger.log({
      errorType: 'server_error',
      severity: 'critical',
      message: 'Background job failed',
      error,
      sessionId,
      caseId: session?.case_id,
      userId: session?.user_id,
      endpoint: '/api/jobs/transcribe',
      metadata: {
        step: 'processing',
        attempt: 1,
      },
    })
  }
}
```

### Client-Side Bug Reporter

#### In React Components

```tsx
import { BugReporter } from '@/components/error/BugReporter'

export function MyPage({ caseId, sessionId }) {
  return (
    <div>
      {/* Add bug reporter button */}
      <BugReporter 
        caseId={caseId}
        sessionId={sessionId}
        variant="outline"
        size="sm"
      />
      
      {/* Your page content */}
    </div>
  )
}
```

#### Manual Error Logging from Client

```typescript
async function reportError(error: Error, context: any) {
  await fetch('/api/error-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      errorType: 'client_error',
      severity: 'error',
      message: error.message,
      caseId: context.caseId,
      sessionId: context.sessionId,
      metadata: {
        component: 'AudioUploader',
        action: 'file_upload',
        fileSize: context.fileSize,
      },
    }),
  })
}
```

## For AI Support System

### Querying Error Patterns

```typescript
import { createErrorLogger } from '@/lib/services/error-logger'

const errorLogger = createErrorLogger()

// Get all errors for a case
const errors = await errorLogger.getErrorPatterns({
  caseId: 'case-uuid',
  startDate: new Date('2026-01-01'),
})

// Analyze patterns
const analysis = {
  totalErrors: errors.length,
  bySeverity: groupBy(errors, 'severity'),
  byType: groupBy(errors, 'error_type'),
  commonMessages: getMostCommon(errors, 'message'),
  timeline: groupByTime(errors, 'created_at'),
}
```

### AI Analysis Queries

The `error_logs` table is optimized for AI queries:

```sql
-- Find recurring errors in a case
SELECT 
  message,
  COUNT(*) as occurrences,
  array_agg(DISTINCT session_id) as affected_sessions,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM error_logs
WHERE case_id = $1
  AND resolved = false
GROUP BY message
HAVING COUNT(*) > 3
ORDER BY occurrences DESC;

-- Error timeline for a case
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  severity,
  COUNT(*) as error_count
FROM error_logs
WHERE case_id = $1
GROUP BY hour, severity
ORDER BY hour DESC;

-- Most problematic endpoints
SELECT 
  endpoint,
  error_type,
  COUNT(*) as failures
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
  AND resolved = false
GROUP BY endpoint, error_type
ORDER BY failures DESC
LIMIT 10;
```

## Best Practices

### 1. Use Case ID for User-Facing Reports
When users report bugs or need support, provide them with their **Case ID**:
- Less granular than session/file IDs (better privacy)
- Provides full context across multiple sessions
- Easier to reference ("Case #12345" vs long UUIDs)

```typescript
// Good: Show case ID
<BugReporter caseId={caseId} />

// Include case ID in error response
return NextResponse.json({ 
  error: 'Something went wrong',
  referenceId: caseId, // User can include this in support requests
})
```

### 2. Include Severity Levels
Use appropriate severity:
- `debug` - Development/debugging info
- `info` - Informational (non-error events)
- `warning` - Potential issues (recoverable)
- `error` - Errors requiring attention
- `critical` - System-critical failures

### 3. Add Contextual Metadata
Include relevant metadata for AI analysis:
```typescript
await errorLogger.log({
  // ... other fields
  metadata: {
    featureFlag: 'new_transcription_v2',
    fileSize: audioBuffer.length,
    apiVersion: 'v2',
    retryAttempt: 2,
  },
})
```

### 4. Resolve Errors After Fixing
Mark errors as resolved:
```typescript
await errorLogger.resolve(errorId, 'Fixed by upgrading API library')
```

## Admin Dashboard Queries

### View Recent Errors
```typescript
// GET /api/error-logs?limit=50
const response = await fetch('/api/error-logs')
const { errors, isAdmin } = await response.json()
```

### Filter by Context
```typescript
// GET /api/error-logs?caseId=xxx&severity=critical&resolved=false
const response = await fetch(
  `/api/error-logs?caseId=${caseId}&severity=critical&resolved=false`
)
```

## Database Schema

```sql
error_logs {
  id              uuid
  case_id         uuid              -- Link to case (recommended for support)
  session_id      uuid              -- Link to session
  file_id         uuid              -- Link to file
  user_id         uuid              -- Who encountered it
  error_type      text              -- server_error, client_error, bug_report, api_error
  severity        text              -- debug, info, warning, error, critical
  message         text              -- Error message
  stack_trace     text              -- Full stack trace
  error_code      text              -- HTTP status or custom code
  endpoint        text              -- API route or page path
  method          text              -- HTTP method
  user_agent      text              -- Browser/client info
  ip_address      text              -- Client IP
  app_version     text              -- Application version
  environment     text              -- development, staging, production
  metadata        jsonb             -- Flexible additional context
  user_description text             -- User's bug report description
  reproduction_steps text           -- How to reproduce
  created_at      timestamptz
  resolved        boolean
  resolved_at     timestamptz
  resolution_notes text
}
```

## Migration

Run the migration:
```bash
# If using Supabase CLI
supabase db push

# Or apply manually in Supabase Dashboard
# SQL Editor → New Query → Paste migration content → Run
```

## Next Steps for AI Support

1. **Pattern Detection**: Query error_logs to find recurring issues
2. **Contextual Analysis**: Use case_id to understand user journey
3. **Automated Suggestions**: Generate fixes based on error patterns
4. **Proactive Monitoring**: Alert when error thresholds exceeded
5. **Root Cause Analysis**: Correlate errors across sessions/files

## Example: AI Support Query

```typescript
async function analyzeCase(caseId: string) {
  const errorLogger = createErrorLogger()
  const errors = await errorLogger.getErrorPatterns({ caseId })
  
  // Send to AI for analysis
  const analysis = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{
      role: 'user',
      content: `Analyze these errors and suggest solutions:
      
      ${JSON.stringify(errors, null, 2)}
      
      Provide:
      1. Root cause analysis
      2. Severity assessment
      3. Recommended fixes
      4. Prevention strategies`
    }]
  })
  
  return analysis
}
```

## Support

For questions or issues with the error logging system, check:
- Database logs in Supabase Dashboard
- Console output (errors are logged to both DB and console)
- Error patterns in `/api/error-logs` endpoint
