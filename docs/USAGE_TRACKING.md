# Usage Tracking (Beta)

Usage events are recorded for cost calculation and subscription modeling.

## Events Tracked

| Event Type | Unit | Source |
|------------|------|--------|
| `transcription_minutes` | minutes | Session transcription completion |
| `ai_tokens_input` | tokens | Output generation, session analyze, auto-generate |
| `ai_tokens_output` | tokens | Same |
| `ai_generations` | count | Same (1 per AI call) |

## API

**GET `/api/usage?period=month`** (authenticated)

Returns aggregated usage for the current user:
- `period`: `week` | `month` | `all`
- Response: `transcription_minutes`, `ai_tokens_input`, `ai_tokens_output`, `ai_generations`

## Aggregating for Cost Calculation

Run in Supabase SQL Editor for total usage across all users:

```sql
SELECT 
  event_type, 
  SUM(amount)::numeric(14,2) as total,
  COUNT(*) as event_count
FROM usage_events
WHERE created_at >= date_trunc('month', now())
GROUP BY event_type;
```

Per-user breakdown:

```sql
SELECT 
  user_id,
  event_type,
  SUM(amount)::numeric(14,2) as total
FROM usage_events
WHERE created_at >= date_trunc('month', now())
GROUP BY user_id, event_type
ORDER BY user_id, event_type;
```

## Cost Estimation

- **Transcription**: Speechmatics pricing per audio minute
- **AI**: Anthropic Claude pricing per 1K tokens (input vs output differ)
- Multiply `transcription_minutes` × cost/min, `ai_tokens_*` × cost/1K
