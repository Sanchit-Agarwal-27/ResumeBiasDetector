/* eslint-disable no-control-regex */
/**
 * BiasLens Security & Input Sanitization Suite
 *
 * Provides defense-in-depth security utilities:
 * 1. SQL Injection & dangerous character evasion mitigation
 * 2. Strict Cross-Site Scripting (XSS) HTML/SVG sanitization
 * 3. Filename path traversal prevention
 * 4. Safe email & credential normalization
 * 5. Text length bounding & memory exhaustion defense
 */

const DANGEROUS_HTML_PATTERN =
  /<\s*\/?\s*(script|iframe|embed|object|meta|link|style|form|base|applet)[\s\S]*?>/gi;
const DANGEROUS_ATTRIBUTES_PATTERN =
  /\s*(on\w+|javascript:|data:text\/html|vbscript:)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SQL_META_CHARS = /(--|;|\|\||\b(UNION\s+ALL|DROP\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM)\b)/gi;

/**
 * Escapes unsafe HTML characters to render plain text safely inside contentEditable / DOM
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitizes user-provided plain text / markdown / resume content before processing or persisting.
 * Strips script tags, unsafe protocols, and enforces maximum safe string length (500,000 chars)
 * to prevent ReDoS (Regular Expression Denial of Service) and RAM overflow.
 */
export function sanitizeInputText(raw: unknown, maxLength: number = 500000): string {
  if (typeof raw !== "string") return "";
  // Bound max length
  let clean = raw.slice(0, maxLength);
  // Strip null bytes and control characters (except common whitespace \r, \n, \t)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Disarm dangerous executable HTML and script payloads
  clean = clean.replace(DANGEROUS_HTML_PATTERN, "");
  clean = clean.replace(DANGEROUS_ATTRIBUTES_PATTERN, "");
  return clean;
}

/**
 * Sanitizes filenames to eliminate directory traversal attacks (../, ..\, null bytes, absolute paths)
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") return "document.pdf";
  // Remove path separators and traversal tokens
  let safe = filename
    .replace(/^[a-zA-Z]:[/\\]/, "") // remove drive letter e.g. C:
    .replace(/^.*[/\\]/, "") // remove directory path
    .replace(/\.\.+/g, "") // remove consecutive dots
    .replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, "_") // strip illegal filename chars
    .trim();

  if (!safe || safe.startsWith(".")) {
    safe = `resume_${Date.now()}`;
  }

  // Enforce max filename length
  if (safe.length > 120) {
    const ext = safe.match(/\.[^.]+$/)?.[0] || "";
    safe = safe.slice(0, 120 - ext.length) + ext;
  }

  return safe;
}

/**
 * Validates and normalizes email addresses to prevent header injection or malformed payload attacks
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim().toLowerCase();
  // Strip control chars & newlines
  const sanitized = trimmed.replace(/[\r\n\t\x00-\x1F]/g, "");
  return sanitized;
}

/**
 * Validates whether an input contains potentially destructive SQL meta-syntax.
 * (Even though Supabase client uses parameterized PostgREST RPC queries by default,
 * this acts as defense-in-depth against client-side exploitation).
 */
export function detectSuspiciousSql(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return SQL_META_CHARS.test(input);
}
