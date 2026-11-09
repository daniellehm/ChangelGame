> **Superseded 2026-11-09:** nameservers now point to Vercel and Claude manages these records via the Vercel API (see DECISIONS.md). Kept for reference only.

# changel.app DNS at GoDaddy

Set up for Vercel (the website) and Resend (sign-in emails from hello@changel.app).
GoDaddy → **My Products → changel.app → DNS** (Manage DNS). In the **Name** column, `@` means changel.app itself.

## 1. Remove GoDaddy's parking records

| Type | Name | Value (current) | Action |
| --- | --- | --- | --- |
| A | @ | 76.223.105.230 | **Delete** |
| A | @ | 13.248.243.5 | **Delete** |
| CNAME | www | @ (or changel.app) | **Delete** (replaced below) |

If **Forwarding** is set up for the domain (DNS page → Forwarding), remove it too.

## 2. Add these records

| # | Type | Name | Value | Priority | TTL |
| --- | --- | --- | --- | --- | --- |
| 1 | A | `@` | `216.198.79.1` | | 1 hour (default) |
| 2 | A | `@` | `64.29.17.1` | | 1 hour |
| 3 | CNAME | `www` | `ee887858f791d1b1.vercel-dns-017.com` | | 1 hour |
| 4 | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCtJqRzH10LDHz3f0kQAcrKtxCpbC4VGvx1bvr24OcrLw9z3+K8PDBBJ6LWa5TvaN0W+f0vZYeVVtMdsjIBSsku6F8fBbMt6mXEYH/IwoHw7gjQJ99lEXY+QP+7LdbRTH3F0gY/QjJRr8aN3qCzd9Vm/aXTUxgNHi6HDy65euHDEQIDAQAB` | | 1 hour |
| 5 | MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 | 1 hour |
| 6 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | | 1 hour |
| 7 | CNAME | `rsend` | `send.forge.rmta.net` | | 1 hour |
| 8 | TXT | `_dmarc` | `v=DMARC1; p=none;` | | 1 hour |

Notes:
- Rows 1–3 point the website at Vercel. `www.changel.app` redirects to `changel.app`.
- Rows 4–7 let Resend send email as changel.app (they're from Resend's domain setup). Copy row 4's value in full: it's one long line.
- Row 8 (DMARC) isn't required by Resend, but Gmail and Yahoo expect it, so sign-in emails don't land in spam.
- Don't change any existing **@ MX** or **@ TXT** records if you have them (e.g. for another email service). These records only add the `send`, `rsend`, `resend._domainkey` and `_dmarc` names.

Changes usually work within 30 minutes but can take up to 48 hours. Claude then verifies the domain in Resend and checks Vercel.
