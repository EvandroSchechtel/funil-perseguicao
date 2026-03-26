const ZAPI_BASE = "https://api.z-api.io"

function zapiUrl(instanceId: string, token: string, path: string): string {
  return `${ZAPI_BASE}/instances/${instanceId}/token/${token}${path}`
}

function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

export interface ZApiGroup {
  phone: string   // group ID (e.g. "120363019502650977-group")
  name: string    // group display name
  isGroup: boolean
}

/**
 * Returns all WhatsApp groups from the Z-API instance.
 * Paginates /chats until all groups are fetched (Z-API returns chunks of pageSize).
 */
export async function getGroups(
  instanceId: string,
  token: string,
  clientToken: string
): Promise<ZApiGroup[]> {
  const allGroups: ZApiGroup[] = []
  const pageSize = 100
  let page = 1

  while (true) {
    const { signal, clear } = withTimeout(15000)
    let data: ZApiGroup[]
    try {
      // Usar /groups (retorna só grupos) em vez de /chats (retorna tudo)
      const res = await fetch(
        zapiUrl(instanceId, token, `/groups?page=${page}&pageSize=${pageSize}`),
        { headers: { "Client-Token": clientToken }, signal }
      )
      clear()
      if (!res.ok) break
      data = await res.json().catch(() => [])
    } catch {
      clear()
      break
    }

    if (!Array.isArray(data) || data.length === 0) break
    allGroups.push(...data.filter((c) => c.isGroup))
    if (data.length < pageSize) break  // last page
    page++
  }

  return allGroups
}

/**
 * Returns all WhatsApp communities from the Z-API instance.
 * Communities use the /community-chats endpoint (paginated, same shape as /chats).
 */
export async function getCommunities(
  instanceId: string,
  token: string,
  clientToken: string
): Promise<ZApiGroup[]> {
  const allCommunities: ZApiGroup[] = []
  const pageSize = 100
  let page = 1

  while (true) {
    const { signal, clear } = withTimeout(15000)
    let data: ZApiGroup[]
    try {
      const res = await fetch(
        zapiUrl(instanceId, token, `/community-chats?page=${page}&pageSize=${pageSize}`),
        { headers: { "Client-Token": clientToken }, signal }
      )
      clear()
      if (!res.ok) break
      data = await res.json().catch(() => [])
    } catch {
      clear()
      break
    }

    if (!Array.isArray(data) || data.length === 0) break
    allCommunities.push(...data)
    if (data.length < pageSize) break
    page++
  }

  return allCommunities
}

/**
 * Returns all WhatsApp groups AND communities merged.
 * Both are treated as monitoring targets in this app.
 * Deduped by phone to prevent duplicates if Z-API overlaps.
 */
export async function getGroupsAndCommunities(
  instanceId: string,
  token: string,
  clientToken: string
): Promise<ZApiGroup[]> {
  const [groups, communities] = await Promise.all([
    getGroups(instanceId, token, clientToken),
    getCommunities(instanceId, token, clientToken),
  ])

  const seen = new Set(groups.map((g) => g.phone))
  const merged = [...groups]
  for (const c of communities) {
    if (!seen.has(c.phone)) {
      seen.add(c.phone)
      merged.push(c)
    }
  }
  return merged
}

export interface ZApiGroupMetadata {
  phone: string
  name: string
  participants: Array<{ phone: string; name?: string; isAdmin: boolean }>
}

/**
 * Returns metadata (name + participants) of a specific group.
 */
export async function getGroupMetadata(
  instanceId: string,
  token: string,
  clientToken: string,
  groupId: string
): Promise<ZApiGroupMetadata | null> {
  const { signal, clear } = withTimeout(12000)
  try {
    const res = await fetch(zapiUrl(instanceId, token, `/group-metadata/${groupId}`), {
      headers: { "Client-Token": clientToken },
      signal,
    })
    clear()
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return data ?? null
  } catch {
    clear()
    return null
  }
}

export interface ZApiConnectionResult {
  ok: boolean
  connected?: boolean
  error?: string
}

/**
 * Tests the Z-API connection by fetching instance status.
 */
export async function testZApiConnection(
  instanceId: string,
  token: string,
  clientToken: string
): Promise<ZApiConnectionResult> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(zapiUrl(instanceId, token, "/status"), {
      headers: { "Client-Token": clientToken },
      signal,
    })
    clear()
    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: "Token inválido ou sem permissão." }
      return { ok: false, error: `Erro Z-API: ${res.status}` }
    }
    const data = await res.json().catch(() => ({}))
    const connected = data?.connected === true || data?.status === "connected"
    return { ok: true, connected }
  } catch (err) {
    clear()
    if ((err as Error).name === "AbortError") return { ok: false, error: "Timeout ao conectar ao Z-API." }
    return { ok: false, error: "Não foi possível conectar ao Z-API." }
  }
}

/**
 * Configures the webhook URL on the Z-API instance.
 * Called when admin saves the instance configuration.
 */
export async function configureWebhook(
  instanceId: string,
  token: string,
  clientToken: string,
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const { signal, clear } = withTimeout(10000)
  try {
    const res = await fetch(zapiUrl(instanceId, token, "/update-webhook-received"), {
      method: "PUT",
      headers: { "Client-Token": clientToken, "Content-Type": "application/json" },
      body: JSON.stringify({ value: webhookUrl }),
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
    if ((err as Error).name === "AbortError") return { ok: false, error: "Timeout." }
    return { ok: false, error: "Erro ao configurar webhook." }
  }
}

export interface ZApiSendTextResult {
  zaapId?: string
  messageId?: string
  id?: string
  [key: string]: unknown
}

/**
 * Sends a text message to a WhatsApp phone/group via Z-API.
 * Returns the raw Z-API response (contains messageId / zaapId).
 */
export async function sendTextMessage(
  instanceId: string,
  token: string,
  clientToken: string,
  phone: string,
  message: string,
  replyToMsgId?: string
): Promise<ZApiSendTextResult | null> {
  const { signal, clear } = withTimeout(15000)
  try {
    const body: Record<string, unknown> = { phone, message }
    if (replyToMsgId) body.messageId = replyToMsgId
    const res = await fetch(zapiUrl(instanceId, token, "/send-text"), {
      method: "POST",
      headers: { "Client-Token": clientToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
    clear()
    if (!res.ok) {
      console.warn(`[ZApi] sendTextMessage failed: ${res.status}`)
      return null
    }
    return await res.json().catch(() => null)
  } catch (err) {
    clear()
    console.warn("[ZApi] sendTextMessage error:", err)
    return null
  }
}

// ── Webhook payload types ──────────────────────────────────────────────────────

export interface ZApiWebhookPayload {
  type: string
  isGroup?: boolean
  notification?: string           // "GROUP_PARTICIPANT_ADD" | "GROUP_PARTICIPANT_INVITE" |
                                  // "GROUP_PARTICIPANT_REMOVE" | "GROUP_PARTICIPANT_LEAVE" |
                                  // "MEMBERSHIP_APPROVAL_REQUEST" | ...
  notificationParameters?: string[] // phones involved in the event (Z-API official docs)
  phone?: string                  // group ID (e.g. "120363019502650977-group") or sender phone
  chatId?: string                 // group/chat ID (e.g. "120363019502650977@g.us")
  chatName?: string               // group display name
  participantPhone?: string       // phone of participant who joined/left
  senderName?: string             // display name of participant / message sender
  senderPhone?: string            // phone of message sender (in group messages)
  text?: {                        // present on text message events
    message?: string
  }
  momment?: number                // unix timestamp ms
  instanceId?: string
  requestMethod?: string          // "invite_link" | "non_admin_add"
  messageId?: string              // WA message ID (for threading)
  zaapId?: string                 // Z-API internal message ID
}

/**
 * Extracts the participant phone from a Z-API group event payload.
 * GROUP_PARTICIPANT_INVITE sends the phone in notificationParameters[0]
 * instead of participantPhone — this helper normalizes both cases.
 */
export function getParticipantPhone(payload: ZApiWebhookPayload): string {
  return payload.participantPhone || payload.notificationParameters?.[0] || ""
}

/**
 * Returns true if the payload represents a participant joining a group.
 * Covers GROUP_PARTICIPANT_ADD (added by admin) and GROUP_PARTICIPANT_INVITE (joined via link).
 * Note: isGroup may not always be set by Z-API, so we don't require it.
 */
export function isGroupJoinEvent(payload: ZApiWebhookPayload): boolean {
  return (
    (payload.notification === "GROUP_PARTICIPANT_ADD" ||
      payload.notification === "GROUP_PARTICIPANT_INVITE") &&
    getParticipantPhone(payload).length > 0
  )
}

/**
 * Returns true if the payload represents a participant leaving a group.
 * Covers both REMOVE (admin-kicked) and LEAVE (self-leave) notification types.
 * Note: isGroup may not always be set by Z-API, so we don't require it.
 */
export function isGroupExitEvent(payload: ZApiWebhookPayload): boolean {
  return (
    (payload.notification === "GROUP_PARTICIPANT_REMOVE" ||
      payload.notification === "GROUP_PARTICIPANT_LEAVE") &&
    getParticipantPhone(payload).length > 0
  )
}

/**
 * Normalizes a phone number to digits only (no +, no spaces, no dashes).
 * E.g. "+55 42 9982-34664" → "5542998234664"
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

/**
 * Returns true if senderName is a Z-API system value, not a real person's name.
 * For GROUP_PARTICIPANT_INVITE via link, Z-API sends senderName="invite" to
 * indicate the join method. When this happens together with an empty
 * participantPhone, notificationParameters[0] is a WhatsApp internal ID
 * (not a real phone number) and the event should be skipped.
 */
export function isSystemJoinName(name?: string): boolean {
  if (!name) return false
  const lower = name.trim().toLowerCase()
  return lower === "invite" || lower === "add" || lower === "join"
}
