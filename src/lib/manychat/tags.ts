const MANYCHAT_API_BASE = "https://api.manychat.com"

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

export interface ManychatTag {
  id: number
  name: string
}

/**
 * Lists all tags in the Manychat account.
 */
export async function getTags(apiKey: string): Promise<ManychatTag[]> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/page/getTags`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
    })
    clear()
    if (!res.ok) return []
    const data = await res.json()
    if (data.status !== "success" || !Array.isArray(data.data)) return []
    return data.data.map((t: Record<string, unknown>) => ({
      id: Number(t.id),
      name: String(t.name),
    }))
  } catch {
    clear()
    return []
  }
}

export interface CreateTagResult {
  ok: boolean
  tag?: ManychatTag
  error?: string
}

/**
 * Creates a new tag in the Manychat account.
 * Returns the created tag with its ID.
 */
export async function createTag(apiKey: string, name: string): Promise<CreateTagResult> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/page/createTag`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      signal,
    })
    clear()
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.message || `Erro ${res.status}` }
    }
    if (data.status !== "success" || !data.data?.id) {
      return { ok: false, error: "Resposta inesperada ao criar tag." }
    }
    return { ok: true, tag: { id: Number(data.data.id), name: String(data.data.name ?? name) } }
  } catch (err) {
    clear()
    if ((err as Error).name === "AbortError") return { ok: false, error: "Timeout ao criar tag." }
    return { ok: false, error: "Erro ao criar tag." }
  }
}

export interface AddTagResult {
  ok: boolean
  error?: string
}

/**
 * Adds a tag to a Manychat subscriber by tag ID.
 */
export async function addTag(
  apiKey: string,
  subscriberId: string,
  tagId: number
): Promise<AddTagResult> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/subscriber/addTag`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subscriber_id: subscriberId, tag_id: tagId }),
      signal,
    })
    clear()
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.message || `Erro ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    clear()
    if ((err as Error).name === "AbortError") return { ok: false, error: "Timeout ao adicionar tag." }
    return { ok: false, error: "Erro ao adicionar tag." }
  }
}
