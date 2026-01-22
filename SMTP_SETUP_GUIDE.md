# Custom SMTP Setup Guide

## Why Custom SMTP is Critical for Production

### Supabase Default Email Service Limitations:
- ⚠️ **Rate Limited:** ~4 emails per hour per project
- ⚠️ **Unreliable Delivery:** Emails can be delayed 10-15 minutes
- ⚠️ **No Delivery Guarantees:** May fail silently
- ⚠️ **Not Suitable for Production:** Only for development/testing

### With Custom SMTP:
- ✅ **Higher Limits:** Thousands of emails per hour
- ✅ **Fast Delivery:** Typically under 1 minute
- ✅ **Reliable:** 99%+ delivery rates
- ✅ **Analytics:** Track opens, clicks, bounces
- ✅ **Professional:** Use your own domain

---

## Recommended SMTP Providers

### 1. SendGrid (Recommended)
**Best for:** Most use cases, excellent free tier

- **Free Tier:** 100 emails/day forever
- **Paid:** From $19.95/month for 50k emails
- **Features:** Analytics, templates, APIs
- **Setup Time:** 10 minutes

### 2. AWS SES (Best Value)
**Best for:** High volume, cost-conscious

- **Pricing:** $0.10 per 1,000 emails
- **Free Tier:** 62,000 emails/month (if hosted on AWS)
- **Features:** Highly scalable, integrated with AWS
- **Setup Time:** 20 minutes (requires AWS account)

### 3. Postmark
**Best for:** Transactional emails, reliability

- **Free Tier:** 100 emails/month
- **Paid:** From $15/month for 10k emails
- **Features:** Best deliverability, excellent support
- **Setup Time:** 10 minutes

### 4. Mailgun
**Best for:** Developers, API-first

- **Free Tier:** 5,000 emails/month for 3 months
- **Paid:** From $35/month for 50k emails
- **Features:** Powerful API, good documentation
- **Setup Time:** 15 minutes

---

## Setup Instructions

### Option 1: SendGrid (Recommended)

#### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com/
2. Sign up for free account
3. Verify your email address

#### Step 2: Create API Key
1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it: "Supabase Auth"
4. Choose **Restricted Access**
5. Enable only: **Mail Send** → **Mail Send** (Full Access)
6. Click **Create & View**
7. **Copy the API key** (you won't see it again)

#### Step 3: Verify Sender Identity
1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in your details (use your actual email for replies)
4. Check your inbox and verify the email

#### Step 4: Configure in Supabase
1. Go to Supabase Dashboard → **Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Click **Enable Custom SMTP**
4. Fill in:
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: [Your SendGrid API Key]
   Sender Email: your-verified-email@yourdomain.com
   Sender Name: Your App Name
   ```
5. Click **Save**

#### Step 5: Test
1. Go to your app's signup page
2. Create a test account
3. Email should arrive within 1 minute

---

### Option 2: AWS SES

#### Step 1: Create AWS Account
1. Go to https://aws.amazon.com/
2. Create account (requires credit card)

#### Step 2: Request Production Access
1. Go to AWS Console → **SES**
2. Click **Request production access** (required to send to any email)
3. Fill in use case details
4. Wait for approval (usually 24-48 hours)

#### Step 3: Verify Email/Domain
1. In SES Console → **Verified identities**
2. Click **Create identity**
3. Choose **Email address** or **Domain**
4. Follow verification steps

#### Step 4: Create SMTP Credentials
1. In SES Console → **SMTP settings**
2. Click **Create SMTP credentials**
3. Download the credentials CSV
4. Note the **SMTP endpoint** for your region

#### Step 5: Configure in Supabase
1. Go to Supabase Dashboard → **Settings** → **Auth**
2. Enable **Custom SMTP**
3. Fill in:
   ```
   Host: email-smtp.[region].amazonaws.com
   Port: 587
   Username: [Your SMTP Username from CSV]
   Password: [Your SMTP Password from CSV]
   Sender Email: your-verified-email@yourdomain.com
   Sender Name: Your App Name
   ```
4. Click **Save**

---

### Option 3: Postmark

#### Step 1: Create Account
1. Go to https://postmarkapp.com/
2. Sign up for free trial

#### Step 2: Create Server
1. Click **Servers** → **Create a Server**
2. Name it: "Production Transactional"
3. Click **Create Server**

#### Step 3: Verify Sender Signature
1. Go to **Sender Signatures**
2. Click **Add Sender Signature**
3. Enter your email address
4. Verify via email

#### Step 4: Get SMTP Credentials
1. Go to your server → **Credentials**
2. Note the **SMTP API tokens**

#### Step 5: Configure in Supabase
1. Go to Supabase Dashboard → **Settings** → **Auth**
2. Enable **Custom SMTP**
3. Fill in:
   ```
   Host: smtp.postmarkapp.com
   Port: 587
   Username: [Your Server API Token]
   Password: [Your Server API Token]
   Sender Email: your-verified-email@yourdomain.com
   Sender Name: Your App Name
   ```
4. Click **Save**

---

## Testing Your SMTP Setup

### 1. Send Test Email from Supabase
1. Supabase Dashboard → **Authentication** → **Email Templates**
2. Select any template
3. Click **Preview** or **Send Test Email**
4. Check your inbox

### 2. Test Signup Flow
1. Go to your app's signup page
2. Use a real email you can access
3. Submit signup
4. Email should arrive within 1-2 minutes

### 3. Check SMTP Logs
- **SendGrid:** Dashboard → Activity Feed
- **AWS SES:** CloudWatch Logs
- **Postmark:** Activity → Messages

---

## Troubleshooting

### Issue: Emails Still Not Arriving

**Check 1: SMTP Settings in Supabase**
- Verify all fields are correct
- Check for typos in password/API key
- Ensure port is 587 (not 465 or 25)

**Check 2: Sender Verification**
- Email/domain must be verified with SMTP provider
- Check provider's dashboard for verification status

**Check 3: Spam Folder**
- Check spam/junk folder
- Mark as "Not Spam" to train filters

**Check 4: Provider Logs**
- Check your SMTP provider's logs
- Look for bounces or delivery failures

**Check 5: Rate Limits**
- Even with custom SMTP, some providers have initial limits
- SendGrid free tier: 100/day
- AWS SES sandbox: 200/day (before production access)

### Issue: Authentication Failed

**Common Causes:**
1. **Wrong credentials** - Double-check API key/password
2. **Using email password instead of SMTP password** - Most providers require special SMTP credentials
3. **API key permissions** - Ensure "Mail Send" permission is enabled
4. **IP allowlist** - Some providers require allowlisting Supabase IPs

**Solution:**
- Regenerate SMTP credentials
- Copy-paste carefully (no extra spaces)
- Use "apikey" as username for SendGrid (not your email)

### Issue: Sender Not Verified

**Symptoms:**
- Error: "Sender not verified"
- Email rejected by provider

**Solution:**
1. Go to provider dashboard
2. Find sender verification section
3. Verify email or domain
4. Wait for verification email
5. Click verification link

---

## Email Template Customization

### Customize Supabase Email Templates

1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Select template: **Confirm signup**, **Magic Link**, etc.
3. Edit HTML and text versions
4. Use these variables:
   - `{{ .ConfirmationURL }}` - Confirmation link
   - `{{ .Token }}` - Verification token
   - `{{ .SiteURL }}` - Your app URL
   - `{{ .Email }}` - User's email

### Best Practices:
- ✅ Keep emails simple and clear
- ✅ Include your logo/branding
- ✅ Use plain text alternative
- ✅ Test on mobile devices
- ✅ Include support contact
- ❌ Don't use all caps or spam trigger words
- ❌ Don't make confirmation link the only content

---

## Cost Comparison

| Provider | Free Tier | Entry Paid Plan | Per 1,000 Emails |
|----------|-----------|-----------------|------------------|
| SendGrid | 100/day | $19.95/month (50k) | ~$0.40 |
| AWS SES | 62k/month* | Pay-as-you-go | $0.10 |
| Postmark | 100/month | $15/month (10k) | ~$1.50 |
| Mailgun | 5k/month† | $35/month (50k) | ~$0.70 |
| Supabase | ~4/hour | N/A | Not suitable |

*If hosted on AWS  
†First 3 months only

---

## Security Best Practices

### 1. Protect SMTP Credentials
- ✅ Store in Supabase dashboard (encrypted)
- ✅ Never commit to git
- ✅ Rotate regularly (every 90 days)
- ❌ Don't share API keys
- ❌ Don't use same key for multiple apps

### 2. Use Restricted API Keys
- Only enable "Mail Send" permission
- Don't grant full account access
- Create separate keys per environment

### 3. Monitor Usage
- Set up alerts for unusual activity
- Review logs weekly
- Check for bounces and spam complaints

### 4. SPF and DKIM
- Configure SPF record in DNS
- Enable DKIM signing
- Add DMARC policy
- Improves deliverability and prevents spoofing

---

## Domain-Based Email (Advanced)

### Why Use Your Own Domain?
- ✅ More professional (notifications@yourdomain.com)
- ✅ Better deliverability
- ✅ Builds domain reputation
- ✅ Branded experience

### Setup Steps:
1. **Add DNS Records** (from SMTP provider)
   - SPF record (TXT)
   - DKIM record (TXT)
   - DMARC record (TXT)
2. **Verify Domain** in SMTP provider
3. **Update Sender Email** in Supabase to use your domain

### DNS Records Example (SendGrid):
```
Type: TXT
Host: @
Value: v=spf1 include:sendgrid.net ~all

Type: TXT
Host: s1._domainkey
Value: [DKIM key from SendGrid]

Type: TXT
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

---

## Next Steps After Setup

1. ✅ **Test thoroughly** - Send test emails to various providers (Gmail, Outlook, etc.)
2. ✅ **Monitor deliverability** - Check open rates and bounces
3. ✅ **Set up alerts** - Get notified of delivery issues
4. ✅ **Customize templates** - Brand your confirmation emails
5. ✅ **Plan for scale** - Upgrade plan before hitting limits

---

## Support

### Provider Support:
- **SendGrid:** support.sendgrid.com
- **AWS SES:** AWS Support Console
- **Postmark:** support.postmarkapp.com
- **Mailgun:** help.mailgun.com

### Supabase Support:
- Discord: discord.supabase.com
- GitHub: github.com/supabase/supabase/discussions
- Docs: supabase.com/docs/guides/auth/auth-smtp

---

## Quick Start Checklist

- [ ] Choose SMTP provider (SendGrid recommended)
- [ ] Create account and verify email
- [ ] Generate SMTP credentials/API key
- [ ] Configure in Supabase Dashboard
- [ ] Test signup flow
- [ ] Verify email arrives within 1-2 minutes
- [ ] Check spam folder
- [ ] Monitor provider dashboard
- [ ] Set up alerts for failures
- [ ] Plan capacity for growth

**Time to complete:** 15-30 minutes  
**Result:** Professional, reliable email delivery
