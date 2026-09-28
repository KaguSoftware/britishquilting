# Finishing setup

Everything in the code is built. What's left is accounts, keys and content that only you can provide. Work through the sections in order; each ends with a quick check.

Keys go in two places:
- **Local:** `.env.local` in the project root (never committed).
- **Live:** Vercel → Project → Settings → Environment Variables (add to Production and Preview, then redeploy).

`.env.example` lists every variable.

---

## 1. Become the shop owner

1. Run the site (`npm run dev`) and sign up at `/signup` with the owner's email.
2. Run:
   ```
   node scripts/make-owner.mjs owner@britishquilting.com
   ```
3. Sign in and open `/admin`.
4. To add staff later: Admin → Staff → enter their email (they must sign up first).

**Check:** `/admin` opens and shows the "Today" page.

---

## 2. Emails (Resend)

Needed for order confirmations, dispatch emails, password resets and sign-in links.

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add domain** → `britishquilting.com`. Add the DNS records it shows at your domain registrar and wait until it says *Verified*.
3. **API Keys → Create** (Sending access). Then set:
   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM="British Quilting <orders@britishquilting.com>"
   STAFF_NOTIFY_EMAIL=mustafa@britishquilting.com
   ```
4. Make Supabase send auth emails through Resend. In Supabase: **Project Settings → Authentication → SMTP Settings → Enable custom SMTP**:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
   - Sender email `orders@britishquilting.com`, sender name `British Quilting`

**Check:** Use "Forgot password" on `/forgot-password`, and the email should arrive within a minute.

---

## 3. Supabase sign-in settings

In Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://britishquilting.com`
- **Redirect URLs:** add
  - `http://localhost:3000/**`
  - `https://britishquilting.com/**`
  - `https://*.vercel.app/**` (preview deploys)

In **Authentication → Providers → Email**, keep **Confirm email** on.

### Google sign-in
1. [Google Cloud Console](https://console.cloud.google.com) → create a project → **APIs & Services → OAuth consent screen**: External, app name "British Quilting", add logo and support email, publish.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorised redirect URI: `https://ootquzcaobtbwlishfyj.supabase.co/auth/v1/callback`
3. Copy the Client ID and Secret into Supabase → **Authentication → Providers → Google** → enable → save.

### Apple sign-in (needs an Apple Developer account, £79/year)
1. [developer.apple.com](https://developer.apple.com) → Certificates, IDs & Profiles.
2. **Identifiers → +** → App IDs → enable *Sign in with Apple*.
3. **Identifiers → +** → Services IDs → e.g. `com.britishquilting.web` → enable *Sign in with Apple* → Configure:
   - Domain: `ootquzcaobtbwlishfyj.supabase.co`
   - Return URL: `https://ootquzcaobtbwlishfyj.supabase.co/auth/v1/callback`
4. **Keys → +** → enable *Sign in with Apple* → download the `.p8` file, and note the Key ID and your Team ID.
5. Supabase → **Providers → Apple** → enable. Enter the Services ID as the Client ID, and generate the secret from the Team ID, Key ID and `.p8` using the tool linked on that page.
6. The Apple secret expires every 6 months. Put a reminder in the calendar to regenerate it.

**Check:** Both buttons on `/login` take you to Google or Apple and back into `/account`.

---

## 4. Card payments, Apple Pay and Google Pay (Stripe)

1. Create an account at [dashboard.stripe.com](https://dashboard.stripe.com) and complete business verification (Intermode Limited).
2. **Developers → API keys** (start in *Test mode*):
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. **Webhook for local testing.** Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then run:
   ```
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe --events payment_intent.succeeded,payment_intent.payment_failed,charge.refunded
   ```
   Put the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`.
4. **Webhook for the live site.** In Developers → Webhooks → **Add endpoint**:
   - URL: `https://britishquilting.com/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - Copy its signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`
5. **Apple Pay and Google Pay:**
   - Settings → Payment methods: make sure Apple Pay, Google Pay and Link are on.
   - Settings → Payment methods → Apple Pay → **Add domain** → `britishquilting.com` (Stripe hosts the verification file for you).
6. **Going live:** switch to Live mode, then repeat steps 2 and 4 with the live keys in Vercel.

**Check:** Pay at `/checkout` with test card `4242 4242 4242 4242`, any future date and any CVC. The order should show as *Paid* in Admin → Orders and a confirmation email should arrive.

---

## 5. PayPal

1. [developer.paypal.com](https://developer.paypal.com) → log in with the business PayPal account → **Apps & Credentials → Sandbox → Create App**.
2. Set:
   ```
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
   ```
3. Test with a sandbox *personal* account (listed under Sandbox → Accounts).
4. **Going live:** switch the toggle to *Live*, create a live app, and set the live ID and secret with `PAYPAL_API_BASE=https://api-m.paypal.com`.

**Check:** The PayPal button at checkout completes a sandbox payment and the order shows as *Paid*.

---

## 6. Shop settings (in the admin)

Admin → **Settings**:
- Bank details (shown on trade invoice emails)
- Invoice terms (days)
- Click & collect address and opening hours
- Low-stock email address
- Optional announcement bar text

Admin → **Shipping**: check the rates and weight bands, and set the free-delivery threshold (currently £75).

---

## 7. Real products and photos

The shop currently has **20 sample products** with placeholder prices and colour placeholders instead of photos.

1. Admin → **Products**: edit each real product (price per metre, trade price, stock, photos from your phone or computer), or add new ones.
2. Switch off or delete the sample products you don't sell.
3. Categories: Admin → **Categories**.

---

## 8. Words only you can write

These pages contain clearly marked placeholder text in `[square brackets]`:
- `/legal/terms` and `/legal/privacy`: have these checked by your solicitor
- `/help/returns`, `/help/delivery`, `/faq`, `/about`

Search the project for `[` inside `src/app/(site)/legal` to find every placeholder.

---

## 9. Deploy to Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import `KaguSoftware/britishquilting`.
2. Add every variable from `.env.example`, with live values:
   ```
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_SITE_URL=https://britishquilting.com
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
   NEXT_PUBLIC_PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE
   RESEND_API_KEY, EMAIL_FROM, STAFF_NOTIFY_EMAIL
   ```
3. Deploy, then **Settings → Domains** → add `britishquilting.com` and `www.britishquilting.com`. Set the DNS records Vercel shows at your registrar.
4. After the domain works, redo the domain-specific steps above: the Supabase Site URL (section 3), the Stripe live webhook and Apple Pay domain (section 4), and the PayPal live app (section 5).

---

## Final launch checklist

- [ ] Owner account works and `/admin` opens
- [ ] Password reset email arrives
- [ ] Google and Apple sign-in work
- [ ] Test card payment → order *Paid* → confirmation email
- [ ] PayPal sandbox payment works
- [ ] Trade application → approve in admin → trade prices show → pay by invoice works
- [ ] Add tracking to an order → customer gets the dispatch email with a working tracking link
- [ ] Real products live, sample products removed
- [ ] Legal pages reviewed
- [ ] Stripe and PayPal switched to **live** keys in Vercel
- [ ] Place one real small order end to end, then refund it from the admin
