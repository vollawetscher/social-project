# Email Ingress Note (Later Implementation)

## Goal

Capture project-relevant email communication into Notissima so it can be analyzed and linked into project memory/knowledge graph.

## Simplest v1 Workflow

- User adds a Notissima address as `BCC` (preferred) or `CC` in normal email clients.
- Inbound email provider webhook delivers the message to Notissima.
- Notissima routes the message to the correct user/project.
- Message is stored as an imported text session and analyzed.

## Addressing Strategy

Use unique aliases instead of plain mailbox names:

- `project+<projectToken>@notissima.com`
- or `u_<userToken>+p_<projectToken>@notissima.com`

Why:

- deterministic routing
- abuse resistance
- easier revocation/rotation per project

## Ingestion Pipeline (v1)

1. Receive inbound webhook (SES/Postmark/SendGrid/etc.).
2. Verify provider signature.
3. Parse MIME payload:
   - headers (`From`, `To`, `Cc`, `Subject`, `Date`, `Message-ID`, `In-Reply-To`, `References`)
   - plain text body (preferred for analysis)
   - html body (optional conversion/fallback)
4. Resolve alias -> user/project.
5. Dedupe by `Message-ID`.
6. Persist message + metadata.
7. Create/update Notissima session with:
   - `input_hint = external_inquiry_email`
   - source signals (content type, inferred author role)
8. Trigger existing analysis pipeline.

## Data Model Additions (Recommended)

- `email_messages`
  - `id`
  - `project_id`
  - `session_id` (nullable)
  - `message_id` (unique)
  - `in_reply_to`
  - `references` (array/json)
  - `from_address`
  - `to_addresses` (json)
  - `cc_addresses` (json)
  - `subject`
  - `sent_at`
  - `text_body`
  - `html_body` (optional)
  - `raw_storage_path` (optional)
  - `attachments_meta` (json)
  - `ingest_status`
  - `created_at`

- `project_inbound_aliases`
  - alias token, project/user mapping, active flag, created/rotated timestamps

## Security and Privacy

- Require provider signature verification on inbound webhook.
- Enforce size limits and attachment type allow-list.
- Strip active HTML/script content before processing.
- Encrypt raw MIME at rest if stored.
- Dedupe and idempotency protections.
- Prefer `BCC` guidance to avoid exposing internal capture address to external recipients.

## UX Notes

- Show source badge in sessions (example: `External inquiry email`).
- Display sender and subject in session header.
- Allow manual re-linking to a different project.
- Expose thread timeline view later (message chain by `References`).

## Phase Plan

### Phase 1 (minimal, high value)

- Alias generation + mapping
- Inbound webhook endpoint
- MIME parsing (text-first)
- Session creation with `external_inquiry_email`
- Dedupe by `Message-ID`

### Phase 2

- Thread reconstruction (`In-Reply-To` / `References`)
- Attachment metadata and selective ingestion
- Basic project timeline UI

### Phase 3

- Knowledge graph integration (entities, commitments, decisions, open requests)
- CRM/project-system sync hooks

## Open Decisions

- Provider choice for inbound email (SES vs Postmark vs SendGrid).
- Alias format and rotation policy.
- Whether to ingest full thread by default or latest message only.
- Attachment policy (store all vs whitelist).
