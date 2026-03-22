const MANYCHAT_API_BASE = "https://api.manychat.com"

export interface ManychatPageInfo {
  id: string
  name: string
  category?: string
  timezone?: string
}

export interface ManychatConnectionResult {
  ok: boolean
  page_id?: string
  page_name?: string
  error?: string
}

export interface ManychatActionResult {
  ok: boolean
  subscriber_id?: string
  error?: string
  sem_optin?: boolean // subscriber not found — no opt-in yet, do not retry
  autoDetectedFieldId?: number // if wrong field_id was configured, this is the correct one
}

// Helper to create an AbortController with timeout
function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

/**
 * Tests a Manychat API key by fetching the page info.
 * Returns page_id and page_name on success.
 */
export async function testManychatConnection(apiKey: string): Promise<ManychatConnectionResult> {
  const { signal, clear } = withTimeout(8000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/page/getInfo`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
    })
    clear()

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[Manychat testConnection] HTTP ${res.status}:`, body)
      if (res.status === 401) return { ok: false, error: "API key inválida ou sem permissão. Verifique em Manychat → Settings → Integration → API e certifique-se de que seu plano suporta API." }
      if (res.status === 403) return { ok: false, error: "Sem permissão. Seu plano Manychat pode não incluir acesso à API (requer Pro ou superior)." }
      return { ok: false, error: `Erro da API Manychat: ${res.status}` }
    }

    const data = await res.json()
    if (data.status !== "success" || !data.data) {
      return { ok: false, error: "Resposta inesperada da API Manychat." }
    }

    const page: ManychatPageInfo = data.data
    return { ok: true, page_id: String(page.id), page_name: page.name }
  } catch (err) {
    clear()
    if ((err as Error).name === "AbortError") return { ok: false, error: "Tempo limite de conexão atingido (8s)." }
    return { ok: false, error: "Não foi possível conectar à API Manychat." }
  }
}

/**
 * Brazilian DDDs (area codes) — used to detect BR numbers without country code.
 * Source: ANATEL official DDD list.
 */
const VALID_BR_DDDS = new Set([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
])

/**
 * Normalizes a phone number to E.164 format (+countrycode+digits).
 *
 * Rules (WhatsApp-only system, spec-aligned):
 * 1. Strip all non-digit chars.
 * 2. 12-13 digits starting with "55" → Brazilian number with DDI → E.164 directly.
 * 3. 10-11 digits with a valid Brazilian DDD → Brazilian number without DDI → prepend 55.
 * 4. Anything else → use as-is with + prefix (do not assume Brazil).
 *
 * Examples:
 *   "+55 (42) 9 9823-4664" → "+5542998234664"
 *   "42998234664"          → "+5542998234664"  (11 digits, DDD 42)
 *   "5542998234664"        → "+5542998234664"  (13 digits, starts with 55)
 *   "351912345678"         → "+351912345678"   (Portugal, not forced to BR)
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")

  // 12-13 digits starting with 55 → Brazil with DDI → E.164
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return `+${digits}`
  }

  // 10-11 digits with valid Brazilian DDD → Brazil without DDI → prepend 55
  if ((digits.length === 10 || digits.length === 11) && VALID_BR_DDDS.has(digits.slice(0, 2))) {
    return `+55${digits}`
  }

  // General case: use as-is (E.164 requires + prefix)
  return `+${digits}`
}

/**
 * Finds a Manychat subscriber by WhatsApp phone number using the
 * findBySystemField endpoint with system_field=whatsapp_phone.
 * Returns { id } or null if not found.
 */
export async function findSubscriberByPhone(
  apiKey: string,
  phone: string
): Promise<{ id: string; unsubscribed: boolean } | null> {
  const normalized = normalizePhone(phone)    // e.g. "+5542998234664"
  const withoutPlus = normalized.slice(1)     // e.g. "5542998234664"
  const rawDigits = phone.replace(/\D/g, "")  // e.g. "42998234664" (original digits)

  // Try 3 candidates (deduplicated): E.164, digits-only-normalized, raw-digits
  // This covers: Manychat storing "+55...", "55...", or the number as received
  const candidates = [...new Set([normalized, withoutPlus, rawDigits])]

  for (const value of candidates) {
    const { signal, clear } = withTimeout(10000)
    try {
      const url = `${MANYCHAT_API_BASE}/fb/subscriber/findBySystemField?phone=${encodeURIComponent(value)}`
      console.log(`[Manychat] findBySystemField phone="${value}"`)
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal,
      })
      clear()

      const body = await res.text()
      console.log(`[Manychat] findBySystemField HTTP ${res.status} → ${body.slice(0, 200)}`)

      if (!res.ok) continue
      let data: Record<string, unknown>
      try { data = JSON.parse(body) } catch { continue }
      const d = data.data as Record<string, unknown>
      if (data.status !== "success" || !d?.id) continue
      console.log(`[Manychat] findBySystemField found phone="${value}" status="${d.status}"`)
      return { id: String(d.id), unsubscribed: d.status === "unsubscribed" }
    } catch {
      clear()
    }
  }
  return null
}

/**
 * Finds a Manychat subscriber by the value stored in a custom field.
 * Used to look up subscribers via the [esc]whatsapp-id custom field.
 * Returns { id } or null if not found.
 */
export async function findSubscriberByCustomField(
  apiKey: string,
  fieldId: number,
  value: string
): Promise<{ id: string; unsubscribed: boolean } | null> {
  const { signal, clear } = withTimeout(10000)
  try {
    // field_value is required — must be URL-encoded with %2B for + prefix
    const url = `${MANYCHAT_API_BASE}/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(value)}`
    console.log(`[Manychat] findByCustomField field_id=${fieldId} field_value="${value}"`)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
    })
    clear()

    const body = await res.text()
    console.log(`[Manychat] findByCustomField HTTP ${res.status} → ${body.slice(0, 500)}`)

    if (!res.ok) return null
    let data: Record<string, unknown>
    try { data = JSON.parse(body) } catch { return null }
    if (data.status !== "success") return null

    // API returns array of subscribers
    const list = Array.isArray(data.data) ? data.data as Array<Record<string, unknown>> : []
    console.log(`[Manychat] findByCustomField returned ${list.length} result(s)`)
    if (list.length === 0) return null
    if (list[0]?.id) {
      const sub = { id: String(list[0].id), unsubscribed: list[0].status === "unsubscribed" }
      console.log(`[Manychat] findByCustomField found id=${sub.id} status="${list[0].status}"`)
      return sub
    }
    return null
  } catch (err) {
    clear()
    console.error(`[Manychat] findByCustomField error:`, err)
    return null
  }
}

/**
 * Creates a new Manychat subscriber.
 * Returns { id } on success, { alreadyExists: true } if subscriber already exists,
 * or null on other failures.
 */
export async function createManychatSubscriber(
  apiKey: string,
  lead: { nome: string; telefone: string; email?: string }
): Promise<{ id: string } | { alreadyExists: true } | null> {
  const { signal, clear } = withTimeout(10000)
  try {
    const [firstName, ...rest] = lead.nome.trim().split(" ")
    const lastName = rest.join(" ") || ""

    const res = await fetch(`${MANYCHAT_API_BASE}/fb/subscriber/createSubscriber`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        whatsapp_phone: normalizePhone(lead.telefone),
        has_opt_in_whatsapp: true, // required to allow programmatic WhatsApp flow sends via sendFlow
        ...(lead.email && { email: lead.email, has_opt_in_email: false }),
      }),
      signal,
    })
    clear()

    const rawBody = await res.text()
    console.log(`[Manychat] createSubscriber HTTP ${res.status} → ${rawBody.slice(0, 500)}`)

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(rawBody) } catch { /* ignore */ }

    if (!res.ok) {
      // Manychat returns 4xx with a message when subscriber already exists
      const msg: string = String(data?.message || "")
      if (
        msg.toLowerCase().includes("already exist") ||
        msg.toLowerCase().includes("já existe") ||
        msg.toLowerCase().includes("already") ||
        res.status === 409
      ) {
        return { alreadyExists: true }
      }
      return null
    }

    if (data.status !== "success" || !(data.data as Record<string, unknown>)?.id) return null
    return { id: String((data.data as Record<string, unknown>).id) }
  } catch {
    clear()
    return null
  }
}

/**
 * Sends a Manychat Flow to a subscriber.
 */
export async function sendFlowToSubscriber(
  apiKey: string,
  subscriberId: string,
  flowNs: string
): Promise<{ ok: boolean; error?: string }> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/sending/sendFlow`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subscriber_id: Number(subscriberId), flow_ns: flowNs }),
      signal,
    })
    clear()

    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: "API key inválida." }
      if (res.status === 404) return { ok: false, error: "Subscriber ou Flow não encontrado." }
      const data = await res.json().catch(() => ({}))
      const extra = Array.isArray(data.messages)
        ? (data.messages as Array<Record<string, unknown>>).map((m) => m.message).filter(Boolean).join("; ")
        : ""
      const error = [data.message, extra].filter(Boolean).join(" — ") || `Erro Manychat: ${res.status}`
      return { ok: false, error }
    }

    return { ok: true }
  } catch (err) {
    clear()
    if ((err as Error).name === "AbortError") return { ok: false, error: "Tempo limite atingido (10s)." }
    return { ok: false, error: "Erro ao chamar API Manychat." }
  }
}

/**
 * Updates an existing Manychat subscriber to ensure has_opt_in_whatsapp: true.
 * MUST be awaited before sendFlow — calling it fire-and-forget creates a race condition
 * where sendFlow executes before Manychat processes the opt-in update.
 * Uses updateSubscriber (not createSubscriber) because createSubscriber returns
 * "alreadyExists" for existing subscribers and does NOT update the opt-in flag.
 */
async function updateManychatSubscriberOptIn(
  apiKey: string,
  subscriberId: string,
  phone: string
): Promise<void> {
  const { signal, clear } = withTimeout(8000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/subscriber/updateSubscriber`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriber_id: Number(subscriberId),
        whatsapp_phone: normalizePhone(phone),
        has_opt_in_whatsapp: true,
      }),
      signal,
    })
    const body = await res.text()
    clear()
    if (!res.ok) {
      console.warn(`[Manychat] updateSubscriber opt-in FALHOU HTTP ${res.status}: ${body.slice(0, 300)}`)
    } else {
      console.log(`[Manychat] updateSubscriber opt-in OK → HTTP ${res.status}`)
    }
  } catch (err) {
    clear()
    console.warn(`[Manychat] updateSubscriber opt-in failed:`, err)
  }
}

/** Returns true when a sendFlow error indicates a missing WhatsApp opt-in (Validation error). */
function isOptInError(error?: string): boolean {
  const e = error?.toLowerCase() ?? ""
  return e.includes("validation error") || e.includes("opt-in") || e.includes("opt_in")
}

/**
 * Full orchestration: find or create subscriber, then send flow.
 * Used by the BullMQ worker to process leads.
 *
 * Strategy (Option C — FIND CUSTOM FIELD → CREATE → FIND SYSTEM FIELD):
 * 0. knownSubscriberId → updateOptIn (await) → sendFlow → return
 * 1. findByCustomField([esc]whatsapp-id, phone) — primary; fastest for repeat leads
 *    → found: updateOptIn (await) → setCustomField → sendFlow → return
 * 2. createSubscriber(has_opt_in_whatsapp: true) — new subscriber in one call
 *    → { id }: setCustomField → sendFlow → return  (skip updateSubscriber — already has opt-in)
 *    → alreadyExists or error → step 3
 * 3. findBySystemField(whatsapp_phone, 3 formats) — last resort fallback
 *    → found: updateOptIn (await) → setCustomField → sendFlow → return
 *    → not found: sem_optin
 */
export async function processLeadInManychat(
  apiKey: string,
  lead: { nome: string; telefone: string; email?: string },
  flowNs: string,
  whatsappFieldId?: number | null,
  knownSubscriberId?: string
): Promise<ManychatActionResult> {
  const phone = normalizePhone(lead.telefone)   // "+5542998234664"
  console.log(`[Manychat] processLead — phone: ${phone}, flow: ${flowNs}, fieldId: ${whatsappFieldId}, knownSubscriberId: ${knownSubscriberId ?? "none"}`)

  // STEP 0: known subscriber_id — skip all lookups
  if (knownSubscriberId) {
    console.log(`[Manychat] Using known subscriber_id=${knownSubscriberId}, skipping lookup`)
    if (whatsappFieldId) {
      setWhatsappIdField(apiKey, knownSubscriberId, phone, whatsappFieldId).catch(() => {})
    }
    // MUST be awaited: sendFlow would race if this is fire-and-forget
    await updateManychatSubscriberOptIn(apiKey, knownSubscriberId, lead.telefone)
    const result = await sendFlowToSubscriber(apiKey, knownSubscriberId, flowNs)
    console.log(`[Manychat] sendFlow result →`, JSON.stringify(result))
    if (!result.ok && isOptInError(result.error)) {
      return { ok: false, sem_optin: true, subscriber_id: knownSubscriberId, error: result.error }
    }
    return { ok: result.ok, subscriber_id: knownSubscriberId, error: result.error }
  }

  // STEP 1: custom field lookup — primary (efficient for repeat leads & retries)
  if (whatsappFieldId) {
    const found = await findSubscriberByCustomField(apiKey, whatsappFieldId, phone)
    console.log(`[Manychat] findByCustomField(${whatsappFieldId}, "${phone}") →`, found ? `found id=${found.id}` : "not found")

    if (found) {
      if (found.unsubscribed) {
        console.warn(`[Manychat] subscriber ${found.id} is unsubscribed — attempting updateSubscriber opt-in re-enable before sendFlow`)
      }
      await updateManychatSubscriberOptIn(apiKey, found.id, lead.telefone)
      setWhatsappIdField(apiKey, found.id, phone, whatsappFieldId).catch(() => {})
      console.log(`[Manychat] sendFlow — subscriber_id=${found.id}, flow_ns=${flowNs}`)
      const result = await sendFlowToSubscriber(apiKey, found.id, flowNs)
      console.log(`[Manychat] sendFlow result →`, JSON.stringify(result))
      if (!result.ok && isOptInError(result.error)) {
        return { ok: false, sem_optin: true, subscriber_id: found.id, error: result.error }
      }
      return { ok: result.ok, subscriber_id: found.id, error: result.error }
    }
  }

  // STEP 2: create subscriber — new subscriber with opt-in in a single API call
  const created = await createManychatSubscriber(apiKey, lead)
  console.log(`[Manychat] createSubscriber →`, JSON.stringify(created))

  if (created && "id" in created) {
    // New subscriber — has_opt_in_whatsapp already set in createSubscriber; no updateSubscriber needed
    if (whatsappFieldId) {
      setWhatsappIdField(apiKey, created.id, phone, whatsappFieldId).catch(() => {})
    }
    console.log(`[Manychat] sendFlow — subscriber_id=${created.id}, flow_ns=${flowNs}`)
    const result = await sendFlowToSubscriber(apiKey, created.id, flowNs)
    console.log(`[Manychat] sendFlow result →`, JSON.stringify(result))
    if (!result.ok && isOptInError(result.error)) {
      return { ok: false, sem_optin: true, subscriber_id: created.id, error: result.error }
    }
    return { ok: result.ok, subscriber_id: created.id, error: result.error }
  }

  // STEP 3: alreadyExists or create error — fall back to system field lookup
  const found = await findSubscriberByPhone(apiKey, lead.telefone)
  console.log(`[Manychat] findBySystemField(whatsapp_phone) →`, found ? `found id=${found.id}` : "not found")

  if (!found) {
    console.warn(`[Manychat] subscriber not found for phone ${phone}`)
    return {
      ok: false,
      sem_optin: true,
      error: `Subscriber não encontrado no Manychat para o número ${phone}. Verifique se o contato existe e se o custom field [esc]whatsapp-id (id: ${whatsappFieldId ?? "não configurado"}) está corretamente configurado na conta.`,
    }
  }

  if (found.unsubscribed) {
    console.warn(`[Manychat] subscriber ${found.id} is unsubscribed — attempting updateSubscriber opt-in re-enable before sendFlow`)
  }

  await updateManychatSubscriberOptIn(apiKey, found.id, lead.telefone)
  if (whatsappFieldId) {
    setWhatsappIdField(apiKey, found.id, phone, whatsappFieldId).catch(() => {})
  }
  console.log(`[Manychat] sendFlow — subscriber_id=${found.id}, flow_ns=${flowNs}`)
  const result = await sendFlowToSubscriber(apiKey, found.id, flowNs)
  console.log(`[Manychat] sendFlow result →`, JSON.stringify(result))
  if (!result.ok && isOptInError(result.error)) {
    return { ok: false, sem_optin: true, subscriber_id: found.id, error: result.error }
  }
  return { ok: result.ok, subscriber_id: found.id, error: result.error }
}

export const WHATSAPP_ID_FIELD = "[esc]whatsapp-id"

/**
 * Fetches the field_id of [esc]whatsapp-id from Manychat custom fields.
 * Returns the correct field_id, or null if not found.
 * Does NOT create the field — use ensureWhatsappIdField for that.
 */
export async function getWhatsappIdFieldId(apiKey: string): Promise<number | null> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/page/getCustomFields`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
    })
    clear()
    if (!res.ok) return null
    const data = await res.json()
    const fields: Array<{ id: number; name: string }> = data?.data ?? []
    const found = fields.find((f) => f.name === WHATSAPP_ID_FIELD)
    return found ? found.id : null
  } catch {
    clear()
    return null
  }
}

export interface VerifyFieldResult {
  ok: boolean
  field?: { id: number; name: string; type: string }
  message?: string
}

/**
 * Verifies whether a specific custom field ID exists in the Manychat account.
 * Fetches the full custom fields list and searches by numeric id.
 * Returns the field info if found, or ok=false with a message if not.
 */
export async function verifyCustomFieldId(
  apiKey: string,
  fieldId: number
): Promise<VerifyFieldResult> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/page/getCustomFields`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
    })
    clear()
    if (!res.ok) return { ok: false, message: `Erro ao consultar Manychat: ${res.status}` }
    const data = await res.json()
    const fields: Array<{ id: number; name: string; type: string }> = data?.data ?? []
    const found = fields.find((f) => f.id === fieldId)
    if (!found) return { ok: false, message: "Campo não encontrado nesta conta Manychat." }
    return { ok: true, field: found }
  } catch (err) {
    clear()
    if ((err as Error).name === "AbortError") return { ok: false, message: "Tempo limite atingido." }
    return { ok: false, message: "Erro ao conectar ao Manychat." }
  }
}

export interface EnsureFieldResult {
  ok: boolean
  fieldId?: number
  alreadyExisted?: boolean
  error?: string
}

/**
 * Ensures the custom field "[esc]whatsapp-id" exists in the Manychat account.
 * If it already exists, returns its ID from the fields list.
 * If it doesn't exist, creates it and returns the new ID.
 * Called when connecting a new Manychat account.
 */
export async function ensureWhatsappIdField(apiKey: string): Promise<EnsureFieldResult> {
  const { signal: s1, clear: c1 } = withTimeout(10000)
  try {
    // 1. Fetch existing custom fields
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/page/getCustomFields`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: s1,
    })
    c1()

    if (!res.ok) return { ok: false, error: `Erro ao buscar campos: ${res.status}` }

    const data = await res.json()
    const fields: Array<{ id: number; name: string; type: string }> = data?.data ?? []

    // 2. Check if field already exists — return its ID
    const existing = fields.find((f) => f.name === WHATSAPP_ID_FIELD)
    if (existing) {
      return { ok: true, fieldId: existing.id, alreadyExisted: true }
    }

    // 3. Create the field and capture the returned ID
    const { signal: s2, clear: c2 } = withTimeout(10000)
    const createRes = await fetch(`${MANYCHAT_API_BASE}/fb/page/createCustomField`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: WHATSAPP_ID_FIELD, type: "text" }),
      signal: s2,
    })
    c2()

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}))
      return { ok: false, error: err?.message || `Erro ao criar campo: ${createRes.status}` }
    }

    const createData = await createRes.json().catch(() => ({}))
    const fieldId: number | undefined = createData?.data?.id ?? createData?.data?.field_id ?? undefined

    return { ok: true, fieldId, alreadyExisted: false }
  } catch (err) {
    c1()
    if ((err as Error).name === "AbortError") return { ok: false, error: "Tempo limite atingido." }
    return { ok: false, error: "Erro ao garantir campo [esc]whatsapp-id." }
  }
}

/**
 * Sets the [esc]whatsapp-id custom field on a subscriber.
 * Uses field_id when available (faster), falls back to field_name.
 * Best-effort — errors are swallowed so they don't fail the main flow.
 */
export async function setWhatsappIdField(
  apiKey: string,
  subscriberId: string,
  phone: string,
  fieldId?: number | null
): Promise<void> {
  const normalized = normalizePhone(phone)
  const { signal, clear } = withTimeout(8000)
  try {
    const body = fieldId
      ? { subscriber_id: Number(subscriberId), field_id: fieldId, field_value: normalized }
      : { subscriber_id: Number(subscriberId), field_name: WHATSAPP_ID_FIELD, field_value: normalized }

    const endpoint = fieldId
      ? `${MANYCHAT_API_BASE}/fb/subscriber/setCustomField`
      : `${MANYCHAT_API_BASE}/fb/subscriber/setCustomFieldByName`

    await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
    clear()
  } catch {
    clear()
    // swallow — best-effort
  }
}

/**
 * Masks an API key for safe display: shows last 4 chars.
 * Example: "mc_abc123...xyz789" → "••••••••xyz789"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return "••••••••"
  const visible = apiKey.slice(-4)
  return `••••••••${visible}`
}
