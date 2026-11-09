# Supabase: sign-in emails (M4)

For Dani, in the Supabase dashboard → project **Changel**. Do this once Resend shows changel.app as **Verified**.

## 1. Send email through Resend
**Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP**:

| Field | Value |
| --- | --- |
| Sender email | `hello@changel.app` |
| Sender name | `Changel` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the value after `RESEND_API_KEY=` in your `.env.local` (starts with `re_`) |

Save.

## 2. Email templates
**Authentication → Emails → Templates**. For each template below, set the subject, switch the body to source/HTML, and paste the whole file:

| Template | Subject | Body file |
| --- | --- | --- |
| Confirm sign up | `Your Changel code: {{ .Token }}` | `supabase/templates/confirm-signup.html` |
| Magic link | `Your Changel code: {{ .Token }}` | `supabase/templates/magic-link.html` |
| Change email address | `Save your Changel streak: {{ .Token }}` | `supabase/templates/change-email.html` |

## 3. Where links may go
**Authentication → URL Configuration**:
- **Site URL:** `https://changel.app`
- **Redirect URLs** → add each:
  - `https://changel.app/**`
  - `https://*-releasedani.vercel.app/**`
  - `http://localhost:3000/**`

## 4. Email sign-in settings
**Authentication → Sign In / Providers → Email**:
- **Enable Email provider:** on
- **Confirm email:** on
- **Secure email change:** **off** (anonymous players have no old address to confirm; the new address still gets a code)
- **Email OTP length:** `6`
- **Email OTP expiration:** `3600` seconds

Save.

## 5. Email rate limit
**Authentication → Rate Limits** → **Rate limit for sending emails**: change `30` to `100` per hour, then save. The game also limits each IP to 5 emails per 10 minutes.
