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
 * Finds a Manychat subscriber by phone number (used as user_ref).
 * Returns { id } or null if not found.
 */
export async function findSubscriberByPhone(
  apiKey: string,
  phone: string
): Promise<{ id: string } | null> {
  const { signal, clear } = withTimeout(10000)
  try {
    const url = `${MANYCHAT_API_BASE}/fb/subscriber/findByUserRef?user_ref=${encodeURIComponent(phone)}`
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
 * Returns { id } or null on failure.
 */
export async function createManychatSubscriber(
  apiKey: string,
  lead: { nome: string; telefone: string; email?: string }
): Promise<{ id: string } | null> {
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
 */
export async function processLeadInManychat(
  apiKey: string,
  lead: { nome: string; telefone: string; email?: string },
  flowNs: string
): Promise<ManychatActionResult> {
  // 1. Try to find existing subscriber by phone
  let subscriber = await findSubscriberByPhone(apiKey, lead.telefone)

  // 2. If not found, create new subscriber
  if (!subscriber) {
    subscriber = await createManychatSubscriber(apiKey, lead)
  }

  if (!subscriber) {
    return { ok: false, error: "Não foi possível encontrar ou criar o subscriber no Manychat." }
  }

  // 3. Send flow
  const result = await sendFlowToSubscriber(apiKey, subscriber.id, flowNs)
  return { ok: result.ok, subscriber_id: subscriber.id, error: result.error }
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
