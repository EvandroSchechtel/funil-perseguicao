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
  const normalized = normalizePhone(phone)
  const { signal, clear } = withTimeout(10000)
  try {
    const url = `${MANYCHAT_API_BASE}/fb/subscriber/findBySystemField?system_field=whatsapp_phone&value=${encodeURIComponent(normalized)}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
    })
    clear()

    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== "success" || !data.data?.id) return null
    return { id: String(data.data.id) }
  } catch {
    clear()
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
        phone: lead.telefone,
        ...(lead.email && { email: lead.email }),
      }),
      signal,
    })
    clear()

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      // Manychat returns 4xx with a message when subscriber already exists
      const msg: string = data?.message || ""
      if (msg.toLowerCase().includes("already exist") || msg.toLowerCase().includes("já existe")) {
        return { alreadyExists: true }
      }
      return null
    }

    if (data.status !== "success" || !data.data?.id) return null
    return { id: String(data.data.id) }
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
 * 1. Try findBySystemField(whatsapp_phone) — fastest path for existing subscribers
 * 2. If not found, try createSubscriber
 * 3. If createSubscriber returns "already exists" → retry findBySystemField (race condition)
 * 4. If subscriber found at any step → sendFlow
 */
export async function processLeadInManychat(
  apiKey: string,
  lead: { nome: string; telefone: string; email?: string },
  flowNs: string
): Promise<ManychatActionResult> {
  // 1. Try to find existing subscriber by WhatsApp phone
  let subscriber = await findSubscriberByPhone(apiKey, lead.telefone)

  // 2. If not found, try to create
  if (!subscriber) {
    const created = await createManychatSubscriber(apiKey, lead)

    if (created && "id" in created) {
      // Successfully created
      subscriber = { id: created.id }
    } else if (created && "alreadyExists" in created) {
      // Subscriber exists in Manychat but wasn't found by phone yet (e.g. opt-in happened
      // after we checked). Retry findBySystemField as fallback.
      subscriber = await findSubscriberByPhone(apiKey, lead.telefone)
    }
    // else: null → both create and find failed
  }

  if (!subscriber) {
    return {
      ok: false,
      sem_optin: true,
      error: "Subscriber não encontrado no Manychat. O contato precisa ter feito opt-in pelo WhatsApp.",
    }
  }

  // 3. Send flow
  const result = await sendFlowToSubscriber(apiKey, subscriber.id, flowNs)
  return { ok: result.ok, subscriber_id: subscriber.id, error: result.error }
}

export const WHATSAPP_ID_FIELD = "[esc]whatsapp-id"

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
