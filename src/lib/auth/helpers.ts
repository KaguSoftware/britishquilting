/** Only allow same-site relative paths, so ?next= can never bounce users off-site. */
export function safeNext(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || !next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  // Never send people back into the auth screens after signing in.
  if (/^\/(login|signup|forgot-password|auth\/)/.test(next)) return fallback;
  return next;
}

/** Turn Supabase auth errors into calm, human sentences. */
export function friendlyAuthError(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!err) return "Something went wrong. Please try again.";
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return "That email and password don't match our records. Please check and try again.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return "Please confirm your email first. We've sent you a link; check your inbox and spam folder.";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered"))
    return "An account with this email already exists. Try signing in, or reset your password.";
  if (code === "weak_password" || msg.includes("password should"))
    return "Please choose a stronger password: at least 8 characters, mixing letters and numbers.";
  if (code === "same_password" || msg.includes("different from the old"))
    return "Your new password must be different from your current one.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || err.status === 429 || msg.includes("rate limit"))
    return "Too many attempts in a short time. Please wait a minute and try again.";
  if (code === "otp_expired" || msg.includes("expired") || msg.includes("invalid") && msg.includes("token"))
    return "That link has expired or has already been used. Please request a new one.";
  if (code === "email_address_invalid" || msg.includes("invalid email")) return "Please enter a valid email address.";
  if (code === "signup_disabled") return "New sign-ups are paused just now. Please contact us and we'll help.";
  if (code === "provider_disabled" || msg.includes("provider is not enabled"))
    return "That sign-in option isn't available yet. Please use your email instead.";
  if (code === "session_not_found" || code === "refresh_token_not_found") return "Your session has ended. Please sign in again.";
  return "Something went wrong. Please try again, or contact us if it keeps happening.";
}
