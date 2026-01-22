# Supabase Authentication Setup

Clean, built-in Supabase authentication using email/password.

## Configuration Steps

### 1. Supabase Dashboard Settings

Go to: **Authentication** → **URL Configuration**

```
Site URL: https://social-project-production-2ca7.up.railway.app

Redirect URLs (add these):
  - https://social-project-production-2ca7.up.railway.app/auth/callback
  - https://social-project-production-2ca7.up.railway.app/dashboard
  - http://localhost:3000/auth/callback (for development)
  - http://localhost:3000/dashboard (for development)
```

### 2. Environment Variables

Required in `.env.local` and production:

```bash
# Supabase (from Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URL (for redirects)
NEXT_PUBLIC_SITE_URL=https://social-project-production-2ca7.up.railway.app
```

### 3. Email Templates (Optional)

Go to: **Authentication** → **Email Templates**

Customize:
- **Invite user** template (sent when admin invites)
- **Confirm signup** template
- **Magic Link** template

Use `{{ .ConfirmationURL }}` in templates - Supabase automatically adds proper redirect URLs.

## How It Works

### User Invitation Flow

1. **Admin invites user:**
   ```bash
   POST /api/admin/invite
   { "email": "user@example.com" }
   ```

2. **Supabase sends email** with invite link

3. **User clicks link** → Redirected to Supabase

4. **Supabase handles password setup** automatically

5. **User redirected back** to `/auth/callback` → `/dashboard`

### Login Flow

1. User enters email/password at `/login`
2. Supabase validates credentials
3. Session established via cookies
4. Redirect to `/dashboard`

### Password Reset Flow

1. User can request password reset (add this feature if needed)
2. Supabase sends reset email
3. User sets new password
4. Redirected back to app

## API Endpoints

### Invite User (Admin)
```bash
POST /api/admin/invite
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Login (Built-in)
Users go to `/login` page - handled by Supabase client SDK

### Logout
```typescript
const { error } = await supabase.auth.signOut()
```

## Testing

### Test Invite Flow

1. Call invite API with test email
2. Check email inbox
3. Click invite link
4. Should be prompted to set password by Supabase
5. After setting password, redirected to dashboard

### Test Login

1. Go to `/login`
2. Enter email/password
3. Should redirect to `/dashboard`

## Troubleshooting

### "Email link is invalid or has expired"
- Link can only be used once
- Links expire after 24 hours
- Resend invite

### "Invalid login credentials"
- Check email/password are correct
- Ensure user has set a password (not just invited)

### Redirect loops
- Check Site URL matches your domain exactly
- Ensure redirect URLs are whitelisted
- Clear browser cookies and try again

### Invite emails not sending
- Check Supabase email settings
- Verify email templates are configured
- Check spam folder

## Security Notes

- Service role key must be kept secret (server-side only)
- Anon key is public (client-side safe)
- RLS policies control data access
- Session tokens stored in httpOnly cookies
