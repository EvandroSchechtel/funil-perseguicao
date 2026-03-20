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
 * Normalizes a phone number to E.164 format with + prefix.
 * Strips formatting chars and ensures leading +.
 */
function normalizePhone(phone: string): string {
  // Remove everything except digits and leading +
  const digits = phone.replace(/[^\d]/g, "")
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
): Promise<{ id: string } | null> {
  const normalized = normalizePhone(phone) // +55...
  const digits = phone.replace(/\D/g, "")  // 55... (no +)

  // Swagger: params are "phone" or "email" directly (not system_field=X&value=Y)
  // Try both +55... and 55... formats
  for (const value of [normalized, digits]) {
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
      if (data.status !== "success" || !(data.data as Record<string, unknown>)?.id) continue
      console.log(`[Manychat] findBySystemField found phone="${value}"`)
      return { id: String((data.data as Record<string, unknown>).id) }
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
): Promise<{ id: string } | null> {
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
    if (list[0]?.id) return { id: String(list[0].id) }
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
      body: JSON.stringify({ subscriber_id: subscriberId, flow_ns: flowNs }),
      signal,
    })
    clear()

    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: "API key inválida." }
      if (res.status === 404) return { ok: false, error: "Subscriber ou Flow não encontrado." }
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data.message || `Erro Manychat: ${res.status}` }
    }

    return { ok: true }
  } catch (err) {
    clear()
    if ((err as Error).name === "AbortError") return { ok: false, error: "Tempo limite atingido (10s)." }
    return { ok: false, error: "Erro ao chamar API Manychat." }
  }
}

/**
 * Full orchestration: find or create subscriber, then send flow.
 * Used by the BullMQ worker to process leads.
 *
 * Strategy:
 * 1. Try findByCustomField([esc]whatsapp-id, phone) — primary lookup for all accounts
 * 2. Try findBySystemField(whatsapp_phone) — fallback for subscribers created via Manychat
 * 3. If not found, createSubscriber (with whatsapp_phone + optin + custom field set)
 * 4. If alreadyExists → retry both lookups
 * 5. If subscriber found at any step → setCustomField (to ensure it's stored) → sendFlow
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

  // 0. If subscriber_id is already known, skip all lookups
  if (knownSubscriberId) {
    console.log(`[Manychat] Using known subscriber_id=${knownSubscriberId}, skipping lookup`)
    if (whatsappFieldId) {
      setWhatsappIdField(apiKey, knownSubscriberId, phone, whatsappFieldId).catch(() => {})
    }
    const result = await sendFlowToSubscriber(apiKey, knownSubscriberId, flowNs)
    console.log(`[Manychat] sendFlow result →`, JSON.stringify(result))
    return { ok: result.ok, subscriber_id: knownSubscriberId, error: result.error }
  }

  let subscriber: { id: string } | null = null

  // 1. Custom field lookup — value stored as "+55..." (E.164 with +)
  if (whatsappFieldId) {
    subscriber = await findSubscriberByCustomField(apiKey, whatsappFieldId, phone)
    console.log(`[Manychat] findByCustomField(${whatsappFieldId}, "${phone}") →`, subscriber ? `found id=${subscriber.id}` : "not found")
  }

  // 2. System field lookup — try both "+55..." and "55..." formats
  if (!subscriber) {
    subscriber = await findSubscriberByPhone(apiKey, lead.telefone)
    console.log(`[Manychat] findBySystemField(whatsapp_phone) →`, subscriber ? `found id=${subscriber.id}` : "not found")
  }

  // 3. Create subscriber if not found
  if (!subscriber) {
    const created = await createManychatSubscriber(apiKey, lead)
    console.log(`[Manychat] createSubscriber →`, JSON.stringify(created))

    if (created && "id" in created) {
      subscriber = { id: created.id }
    } else if (created && "alreadyExists" in created) {
      // Subscriber exists but not found — retry all lookups
      if (whatsappFieldId) {
        subscriber = await findSubscriberByCustomField(apiKey, whatsappFieldId, phone)
        console.log(`[Manychat] retry findByCustomField →`, subscriber ? `found id=${subscriber.id}` : "not found")
      }
      if (!subscriber) {
        subscriber = await findSubscriberByPhone(apiKey, lead.telefone)
        console.log(`[Manychat] retry findBySystemField →`, subscriber ? `found id=${subscriber.id}` : "not found")
      }
    }
  }

  if (!subscriber) {
    console.warn(`[Manychat] subscriber not found for phone ${phone}`)
    return {
      ok: false,
      sem_optin: true,
      error: `Subscriber não encontrado no Manychat para o número ${phone}. Verifique se o contato existe e se o custom field [esc]whatsapp-id (id: ${whatsappFieldId ?? "não configurado"}) está corretamente configurado na conta.`,
    }
  }

  // 4. Ensure custom field is set with "+phone" format (best-effort, so future lookups work)
  if (whatsappFieldId && subscriber) {
    setWhatsappIdField(apiKey, subscriber.id, phone, whatsappFieldId).catch(() => {})
  }

  // 5. Send flow
  console.log(`[Manychat] sendFlow — subscriber_id=${subscriber.id}, flow_ns=${flowNs}`)
  const result = await sendFlowToSubscriber(apiKey, subscriber.id, flowNs)
  console.log(`[Manychat] sendFlow result →`, JSON.stringify(result))
  return { ok: result.ok, subscriber_id: subscriber.id, error: result.error }
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
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/subscriber/getCustomFields`, {
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
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/subscriber/getCustomFields`, {
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
    const createRes = await fetch(`${MANYCHAT_API_BASE}/fb/subscriber/createCustomField`, {
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
      ? { subscriber_id: subscriberId, field_id: fieldId, field_value: normalized }
      : { subscriber_id: subscriberId, field_name: WHATSAPP_ID_FIELD, field_value: normalized }

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
