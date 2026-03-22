import { type NextRequest } from "next/server"

// ── Path resolution helpers ───────────────────────────────────────────────────

/**
 * Walks a dot-notation path on any nested object.
 * Coerces numbers to string (some CRMs send phone as a number type).
 * Returns undefined if path doesn't exist or value is empty.
 */
function resolvePath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  if (typeof current === "number") return String(current)
  if (typeof current === "string") return current.trim() || undefined
  return undefined
}

/** Tries each dot-notation path in order; returns first non-empty string value. */
function pickFirst(obj: unknown, paths: string[]): string | undefined {
  for (const path of paths) {
    const val = resolvePath(obj, path)
    if (val) return val
  }
  return undefined
}

/**
 * Combines two name-part paths (e.g. first_name + last_name) when present.
 * Returns undefined if neither path resolves to a value.
 */
function combineNameParts(obj: unknown, firstPath: string, lastPath: string): string | undefined {
  const first = resolvePath(obj, firstPath)
  const last = resolvePath(obj, lastPath)
  const combined = [first, last].filter(Boolean).join(" ").trim()
  return combined || undefined
}

/**
 * Converts FormData with bracket notation to a plain nested object.
 * Handles one level of nesting: contact[first_name] → { contact: { first_name: "..." } }
 * Flat keys are kept as-is: nome → { nome: "..." }
 */
function deNestBracketKeys(form: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue
    const match = key.match(/^(\w+)\[(\w+)\]$/)
    if (match) {
      const parent = match[1]
      const child = match[2]
      if (typeof obj[parent] !== "object" || obj[parent] == null) {
        obj[parent] = {}
      }
      ;(obj[parent] as Record<string, string>)[child] = value
    } else {
      obj[key] = value
    }
  }
  return obj
}

// ── Field resolution priority lists ──────────────────────────────────────────

const NOME_PATHS = [
  // Generic / direct
  "nome",
  "name",
  "full_name",
  "nome_completo",
  // Kiwify
  "Customer.full_name",
  "customer.full_name",
  // Hotmart
  "buyer.name",
  "data.buyer.name",
  // Eduzz
  "buyer_name",
  "client_name",
  // NOTE: email fallbacks ("contact.email", "email") are appended AFTER
  // combineNameParts in parseWebhookPayload so that first_name+last_name
  // combination always takes priority over using the email as a display name.
]

const TELEFONE_PATHS = [
  // Generic / direct
  "telefone",
  "phone",
  "celular",
  "mobile",
  "whatsapp",
  "fone",
  // ActiveCampaign (nested after deNest)
  "contact.phone",
  // Hotmart
  "buyer.phone",
  "data.buyer.phone",
  // Kiwify
  "Customer.mobile",
  "Customer.phone",
  "customer.mobile",
  "customer.phone",
  // RD Station
  "mobile_phone",
  "personal_phone",
  // Eduzz
  "buyer_cel",
  "buyer_phone",
]

const EMAIL_PATHS = [
  // Universal — every CRM uses "email" at some nesting level, so try flat first
  "email",
  // ActiveCampaign (nested after deNest)
  "contact.email",
  // Hotmart
  "buyer.email",
  "data.buyer.email",
  // Kiwify
  "Customer.email",
  "customer.email",
  // Eduzz
  "buyer_email",
]

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Parses ANY webhook request body and extracts nome, telefone, email.
 *
 * Supports:
 * - JSON (flat or nested): generic, RD Station, Hotmart, Kiwify, Eduzz
 * - application/x-www-form-urlencoded + multipart/form-data with bracket notation (ActiveCampaign)
 *
 * Never throws. Returns undefined fields when not found; caller (Zod) handles validation errors.
 */
export async function parseWebhookPayload(
  request: NextRequest
): Promise<{ nome: string | undefined; telefone: string | undefined; email: string | undefined }> {
  const contentType = request.headers.get("content-type") ?? ""

  let rawObj: unknown
  try {
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData()
      rawObj = deNestBracketKeys(form)
    } else {
      rawObj = await request.json()
    }
  } catch {
    return { nome: undefined, telefone: undefined, email: undefined }
  }

  const nome =
    pickFirst(rawObj, NOME_PATHS) ??
    combineNameParts(rawObj, "contact.first_name", "contact.last_name") ??
    combineNameParts(rawObj, "first_name", "last_name") ??
    resolvePath(rawObj, "contact.email") ??
    resolvePath(rawObj, "email")

  const telefone = pickFirst(rawObj, TELEFONE_PATHS)
  const email = pickFirst(rawObj, EMAIL_PATHS)

  return { nome, telefone, email }
}
