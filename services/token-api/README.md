# Token Payment & Referral API

A standalone API service for managing token-based payments and referral systems. Designed to be completely decoupled from host applications, communicating only via REST API.

## Features

- **Token Ledger**: Append-only ledger for all token transactions
- **Balance Management**: Credit, debit, reserve, and release tokens
- **Referral System**: Code generation, attribution tracking, reward distribution
- **Stripe Integration**: Webhook handling for payment processing
- **Idempotency**: Built-in idempotency for all mutating operations
- **Security**: API key authentication, rate limiting, helmet security headers

## Quick Start

### 1. Install Dependencies

```bash
cd services/token-api
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Set Up Database

Run the migrations in your Supabase project (SQL Editor):

1. `supabase/migrations/001_token_wallets.sql`
2. `supabase/migrations/002_ledger_entries.sql`
3. `supabase/migrations/003_referrals.sql`
4. `supabase/migrations/004_idempotency.sql`

### 4. Run Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3001`

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

### Balance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/balance/:accountId` | Get token balance |
| GET | `/v1/balance/:accountId/history` | Get transaction history |

### Tokens

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/tokens/consume` | Debit tokens from account |
| POST | `/v1/tokens/reserve` | Reserve tokens for pending operation |
| POST | `/v1/tokens/release` | Release reserved tokens |
| POST | `/v1/tokens/credit` | Credit tokens to account |

### Referrals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/referrals/generate` | Create new referral code |
| GET | `/v1/referrals/:code` | Validate referral code |
| POST | `/v1/referrals/attribute` | Record referral attribution |
| POST | `/v1/referrals/convert` | Trigger referral reward |
| GET | `/v1/referrals/stats/:accountId` | Get referral statistics |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/stripe` | Stripe payment webhooks |

## Authentication

All API endpoints (except `/health` and `/webhooks/stripe`) require an API key:

```
X-API-Key: your-api-key
```

## Idempotency

For POST/PUT/DELETE requests, include an idempotency key:

```
Idempotency-Key: unique-request-id
```

## Example Usage

### Get Balance

```bash
curl -X GET http://localhost:3001/v1/balance/user-123 \
  -H "X-API-Key: your-api-key"
```

### Consume Tokens

```bash
curl -X POST http://localhost:3001/v1/tokens/consume \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: consume-$(uuidgen)" \
  -d '{
    "account_id": "user-123",
    "amount": 10,
    "idempotency_key": "job-456",
    "description": "Report generation"
  }'
```

### Generate Referral Code

```bash
curl -X POST http://localhost:3001/v1/referrals/generate \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "owner_account_id": "user-123",
    "campaign": "launch-2026",
    "reward_tokens": 50
  }'
```

## Deployment (Railway)

1. Connect your GitHub repo to Railway
2. Set the root directory to `services/token-api`
3. Add environment variables in Railway dashboard
4. Deploy!

Railway will automatically detect the Node.js app and run `npm start`.

## License

ISC
