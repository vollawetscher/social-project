# Email Signup Troubleshooting Guide

## Problem: No confirmation email received after signup

### Quick Diagnosis Steps

Run through these checks in your Supabase Dashboard:

## 1. Check Email Confirmation Settings

**Location:** Supabase Dashboard → **Authentication** → **Providers** → **Email**

### Option A: Email Confirmation is ENABLED ✅
- Users must click a confirmation link sent to their email
- Email template must be configured
- SMTP provider should be set up for production

**What to check:**
1. Go to **Authentication** → **Email Templates** → **Confirm signup**
2. Verify the template is enabled and uses `{{ .ConfirmationURL }}`
3. Test with a real email address you control

### Option B: Email Confirmation is DISABLED ❌
- Users are auto-confirmed immediately after signup
- **No email is sent** - this is expected behavior
- Users can log in immediately

**Result:** If disabled, signup works but no email is sent. Enable it if you want email verification.

---

## 2. Check SMTP Configuration

**Location:** Supabase Dashboard → **Settings** → **Auth** → **SMTP Settings**

### Default Behavior:
- Supabase provides a free email service
- **Rate limited** to ~4 emails per hour per project
- **Not recommended for production**

### For Production:
Configure custom SMTP provider:
- **SendGrid** (recommended)
- **AWS SES**
- **Postmark**
- **Mailgun**
- Any SMTP server

**If using default Supabase email service:**
- You may have hit the rate limit
- Check **Authentication** → **Logs** for email delivery errors

---

## 3. Check if User Already Exists

Supabase **will not send another confirmation email** if:
1. The email is already registered
2. The previous confirmation email hasn't been clicked

**To verify:**
1. Go to **Authentication** → **Users**
2. Search for the email address
3. Check if user exists and look at the `email_confirmed_at` column

**Solutions:**
- Delete the existing user and try again
- Or have the user check their original confirmation email
- Or use password reset flow to set a new password

---

## 4. Check Email Template Configuration

**Location:** Supabase Dashboard → **Authentication** → **Email Templates** → **Confirm signup**

### Required Elements:
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

### Common Issues:
- ❌ Template is disabled
- ❌ Missing `{{ .ConfirmationURL }}` variable
- ❌ Link has wrong domain (check Site URL)

---

## 5. Check Site URL and Redirect URLs

**Location:** Supabase Dashboard → **Authentication** → **URL Configuration**

### Required Settings:

**Site URL:**
```
https://social-project-production-2ca7.up.railway.app
```
(or `http://localhost:3000` for development)

**Redirect URLs (Allowed List):**
```
https://social-project-production-2ca7.up.railway.app/auth/callback
https://social-project-production-2ca7.up.railway.app/dashboard
http://localhost:3000/auth/callback
http://localhost:3000/dashboard
```

---

## 6. Check Supabase Logs

**Location:** Supabase Dashboard → **Authentication** → **Logs**

Look for:
- ✅ `user.signup` events
- ❌ Email delivery errors
- ❌ Rate limit errors
- ❌ SMTP errors

---

## Testing Checklist

### Test Email Confirmation Flow:

1. ✅ Go to `/signup`
2. ✅ Enter a **new** email (not previously registered)
3. ✅ Fill in password (minimum 6 characters)
4. ✅ Click "Create account"
5. ✅ Check Supabase Dashboard → **Authentication** → **Users** - user should appear
6. ✅ Check email inbox (including spam folder)
7. ✅ Click confirmation link in email
8. ✅ Should redirect to `/dashboard`

---

## Solutions by Scenario

### Scenario 1: "I want email verification"
**Enable email confirmation:**
1. Dashboard → **Authentication** → **Providers** → **Email**
2. Enable "Confirm email"
3. Configure SMTP for production
4. Test with a fresh email address

### Scenario 2: "I don't need email verification"
**Disable email confirmation:**
1. Dashboard → **Authentication** → **Providers** → **Email**
2. Disable "Confirm email"
3. Users can sign up and log in immediately
4. Updated signup page will redirect to dashboard automatically

### Scenario 3: "Emails are being sent but not received"
**Check email deliverability:**
1. Verify SMTP settings are correct
2. Check spam folder
3. Try a different email provider (Gmail, Outlook, etc.)
4. Check Supabase email rate limits
5. Consider using custom SMTP provider

### Scenario 4: "User already exists error"
**Handle existing users:**
1. Check **Authentication** → **Users** in dashboard
2. Delete test user if needed
3. Or direct user to login page instead

---

## Recommended Production Setup

### 1. Enable Email Confirmation ✅
For security and to verify real email addresses

### 2. Configure Custom SMTP Provider ✅
To avoid rate limits and improve deliverability

### 3. Customize Email Templates ✅
Brand your confirmation emails

### 4. Set Proper Redirect URLs ✅
Match your production domain

### 5. Monitor Email Logs ✅
Check for delivery issues

---

## Updated Signup Behavior

The signup page now handles these scenarios automatically:

1. **Email confirmation required** → Shows: "Check your email for confirmation link"
2. **Email confirmation disabled** → Shows: "Account created! Redirecting..." (auto-redirects to dashboard)
3. **User already exists** → Shows: "Email already registered. Check inbox or try logging in"
4. **Password too short** → Shows: "Password must be at least 6 characters"

---

## Support

If you've checked all the above and still have issues:
1. Check browser console for JavaScript errors
2. Check network tab for API response errors
3. Verify environment variables are set correctly (`NEXT_PUBLIC_SITE_URL`, etc.)
4. Check Supabase project status (dashboard may show service issues)
