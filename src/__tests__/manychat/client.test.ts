/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CRITICAL SERVICE TESTS — Manychat Client
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * These tests protect the core lead-processing logic.
 * If any of these tests fail, a lead WILL NOT reach Manychat.
 *
 * NEVER modify processLeadInManychat, createManychatSubscriber, or
 * sendFlowToSubscriber without ensuring all tests still pass.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import {
  processLeadInManychat,
  createManychatSubscriber,
  sendFlowToSubscriber,
} from "@/lib/manychat/client"

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE = "https://api.manychat.com"
const API_KEY = "test_api_key_abc123"
const FLOW_NS = "content20260319193116_225492"
const FIELD_ID = 12345
const LEAD = { nome: "João Silva", telefone: "5542998234664" }
const PHONE_E164 = "+5542998234664"
const SUB_ID = "789"
const SUB_ID_NUM = 789     // integer sent in API request bodies (Manychat requires integer)
const SUB_ID_NEW = "456"
const SUB_ID_NEW_NUM = 456 // integer sent in API request bodies

// ── Fetch call recorder ───────────────────────────────────────────────────────

interface FetchCall {
  url: string
  method: string
  body: Record<string, unknown> | null
}

function setupFetch(
  overrides: Record<string, { status?: number; body: object }> = {}
): { calls: FetchCall[] } {
  const calls: FetchCall[] = []

  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      let body: Record<string, unknown> | null = null
      try {
        body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null
      } catch { /* ignore */ }

      calls.push({ url, method: init?.method ?? "GET", body })

      // Check user-provided overrides first
      for (const [key, val] of Object.entries(overrides)) {
        if (url.includes(key)) {
          return new Response(JSON.stringify(val.body), { status: val.status ?? 200 })
        }
      }

      // Default responses per endpoint
      if (url.includes("/fb/subscriber/findByCustomField")) {
        // Default: not found (empty list)
        return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 })
      }
      if (url.includes("/fb/subscriber/findBySystemField")) {
        // Default: not found
        return new Response(JSON.stringify({ status: "error", data: null }), { status: 404 })
      }
      if (url.includes("/fb/subscriber/createSubscriber")) {
        // Default: created successfully
        return new Response(
          JSON.stringify({ status: "success", data: { id: SUB_ID_NEW } }),
          { status: 200 }
        )
      }
      if (url.includes("/fb/sending/sendFlow")) {
        // Default: sent successfully
        return new Response(JSON.stringify({ status: "success" }), { status: 200 })
      }
      // Catch-all for setCustomField, setCustomFieldByName, etc.
      return new Response(JSON.stringify({ status: "success" }), { status: 200 })
    }
  )

  return { calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Helper: find calls by endpoint ───────────────────────────────────────────

function callsTo(calls: FetchCall[], endpoint: string): FetchCall[] {
  return calls.filter((c) => c.url.includes(endpoint))
}

function indexOfFirst(calls: FetchCall[], endpoint: string): number {
  return calls.findIndex((c) => c.url.includes(endpoint))
}

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 1 — has_opt_in_whatsapp: true MUST be ensured for every subscriber.
//
// Strategy:
//   NEW subscriber  → createSubscriber with has_opt_in_whatsapp: true
//   EXISTING subscriber → updateSubscriber with has_opt_in_whatsapp: true
//
// Rationale: createSubscriber returns "alreadyExists" for existing subscribers
// WITHOUT updating opt-in. updateSubscriber actually sets the flag.
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: has_opt_in_whatsapp=true ensured for all subscribers", () => {
  it("createManychatSubscriber includes has_opt_in_whatsapp: true in request body", async () => {
    const { calls } = setupFetch()
    await createManychatSubscriber(API_KEY, LEAD)

    const createCall = callsTo(calls, "/fb/subscriber/createSubscriber")[0]
    expect(createCall, "createSubscriber fetch must be called").toBeDefined()
    expect(createCall.body?.has_opt_in_whatsapp).toBe(true)
  })

  it("processLeadInManychat — new subscriber path: createSubscriber has has_opt_in_whatsapp=true", async () => {
    const { calls } = setupFetch()
    // All lookups return not-found → will create new subscriber
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    const createCalls = callsTo(calls, "/fb/subscriber/createSubscriber")
    expect(createCalls.length, "createSubscriber must be called at least once").toBeGreaterThan(0)
    for (const c of createCalls) {
      expect(c.body?.has_opt_in_whatsapp, `createSubscriber call missing has_opt_in_whatsapp: ${JSON.stringify(c.body)}`).toBe(true)
    }
  })

  it("processLeadInManychat — found via custom field: updateSubscriber called with has_opt_in_whatsapp=true", async () => {
    const { calls } = setupFetch({
      "/fb/subscriber/findByCustomField": {
        body: { status: "success", data: [{ id: SUB_ID }] },
      },
    })
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    const updateCalls = callsTo(calls, "/fb/subscriber/updateSubscriber")
    expect(updateCalls.length, "updateSubscriber must be called to set opt-in on existing subscriber").toBeGreaterThan(0)
    for (const c of updateCalls) {
      expect(c.body?.has_opt_in_whatsapp).toBe(true)
      expect(c.body?.subscriber_id).toBe(SUB_ID_NUM) // integer per Manychat API spec
    }
  })

  it("processLeadInManychat — found via system field: updateSubscriber called with has_opt_in_whatsapp=true", async () => {
    // In Option C, system field is only reached after createSubscriber returns alreadyExists
    const { calls } = setupFetch({
      "/fb/subscriber/createSubscriber": {
        status: 409,
        body: { status: "error", message: "already exists" },
      },
      "/fb/subscriber/findBySystemField": {
        body: { status: "success", data: { id: SUB_ID } },
      },
    })
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null)

    const updateCalls = callsTo(calls, "/fb/subscriber/updateSubscriber")
    expect(updateCalls.length, "updateSubscriber must be called for existing subscriber found via system field").toBeGreaterThan(0)
    for (const c of updateCalls) {
      expect(c.body?.has_opt_in_whatsapp).toBe(true)
      expect(c.body?.subscriber_id).toBe(SUB_ID_NUM) // integer per Manychat API spec
    }
  })

  it("processLeadInManychat — knownSubscriberId path: updateSubscriber called with has_opt_in_whatsapp=true", async () => {
    const { calls } = setupFetch()
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null, SUB_ID)

    const updateCalls = callsTo(calls, "/fb/subscriber/updateSubscriber")
    expect(updateCalls.length, "updateSubscriber must run even for known subscriber_id").toBeGreaterThan(0)
    for (const c of updateCalls) {
      expect(c.body?.has_opt_in_whatsapp).toBe(true)
      expect(c.body?.subscriber_id).toBe(SUB_ID_NUM) // integer per Manychat API spec
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 2 — sendFlow is ALWAYS called with the correct subscriber_id
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: sendFlowToSubscriber called with correct subscriber_id", () => {
  it("returns ok=true and subscriber_id when sendFlow succeeds", async () => {
    setupFetch({
      "/fb/subscriber/findByCustomField": {
        body: { status: "success", data: [{ id: SUB_ID }] },
      },
    })
    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    expect(result.ok).toBe(true)
    expect(result.subscriber_id).toBe(SUB_ID)
  })

  it("new subscriber: sendFlow uses subscriber_id from createSubscriber response", async () => {
    const { calls } = setupFetch()
    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null)

    expect(result.ok).toBe(true)
    expect(result.subscriber_id).toBe(SUB_ID_NEW)

    const sendCall = callsTo(calls, "/fb/sending/sendFlow")[0]
    expect(sendCall?.body?.subscriber_id).toBe(SUB_ID_NEW_NUM) // integer per Manychat API spec
    expect(sendCall?.body?.flow_ns).toBe(FLOW_NS)
  })

  it("knownSubscriberId path: sendFlow uses the provided subscriber_id", async () => {
    const { calls } = setupFetch()
    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null, SUB_ID)

    expect(result.ok).toBe(true)
    expect(result.subscriber_id).toBe(SUB_ID)

    const sendCall = callsTo(calls, "/fb/sending/sendFlow")[0]
    expect(sendCall?.body?.subscriber_id).toBe(SUB_ID_NUM) // integer per Manychat API spec
    expect(sendCall?.body?.flow_ns).toBe(FLOW_NS)
  })

  it("sendFlowToSubscriber: returns ok=true on HTTP 200", async () => {
    setupFetch()
    const result = await sendFlowToSubscriber(API_KEY, SUB_ID, FLOW_NS)
    expect(result.ok).toBe(true)
  })

  it("sendFlowToSubscriber: returns ok=false with error on HTTP 404", async () => {
    setupFetch({
      "/fb/sending/sendFlow": { status: 404, body: { message: "Subscriber ou Flow não encontrado." } },
    })
    const result = await sendFlowToSubscriber(API_KEY, SUB_ID, FLOW_NS)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it("sendFlowToSubscriber: returns ok=false with error on Manychat Validation error", async () => {
    setupFetch({
      "/fb/sending/sendFlow": { status: 400, body: { message: "Validation error" } },
    })
    const result = await sendFlowToSubscriber(API_KEY, SUB_ID, FLOW_NS)
    expect(result.ok).toBe(false)
    expect(result.error).toContain("Validation error")
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 3 — opt-in upsert happens BEFORE sendFlow (order matters)
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: opt-in upsert (updateSubscriber) runs before sendFlow", () => {
  it("found by custom field: updateSubscriber index < sendFlow index", async () => {
    const { calls } = setupFetch({
      "/fb/subscriber/findByCustomField": {
        body: { status: "success", data: [{ id: SUB_ID }] },
      },
    })
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    const updateIdx = indexOfFirst(calls, "/fb/subscriber/updateSubscriber")
    const sendIdx = indexOfFirst(calls, "/fb/sending/sendFlow")

    expect(updateIdx, "updateSubscriber must be called").toBeGreaterThanOrEqual(0)
    expect(sendIdx, "sendFlow must be called").toBeGreaterThanOrEqual(0)
    expect(updateIdx).toBeLessThan(sendIdx)
  })

  it("found by system field: updateSubscriber index < sendFlow index", async () => {
    // In Option C, system field is only reached after createSubscriber returns alreadyExists
    const { calls } = setupFetch({
      "/fb/subscriber/createSubscriber": {
        status: 409,
        body: { status: "error", message: "already exists" },
      },
      "/fb/subscriber/findBySystemField": {
        body: { status: "success", data: { id: SUB_ID } },
      },
    })
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null)

    const updateIdx = indexOfFirst(calls, "/fb/subscriber/updateSubscriber")
    const sendIdx = indexOfFirst(calls, "/fb/sending/sendFlow")

    expect(updateIdx).toBeGreaterThanOrEqual(0)
    expect(sendIdx).toBeGreaterThanOrEqual(0)
    expect(updateIdx).toBeLessThan(sendIdx)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 4 — sem_optin=true returned (not thrown) when subscriber not found
// Subscriber not found is NOT a retryable error — worker must not retry it.
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: sem_optin returned when subscriber cannot be found", () => {
  it("returns sem_optin=true and ok=false when all lookups and create fail", async () => {
    setupFetch({
      "/fb/subscriber/createSubscriber": {
        status: 500,
        body: { status: "error", message: "Internal error" },
      },
    })
    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null)

    expect(result.ok).toBe(false)
    expect(result.sem_optin).toBe(true)
    expect(result.error).toBeTruthy()
  })

  it("sendFlow is NOT called when subscriber cannot be found", async () => {
    const { calls } = setupFetch({
      "/fb/subscriber/createSubscriber": {
        status: 500,
        body: { status: "error" },
      },
    })
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null)

    const sendCalls = callsTo(calls, "/fb/sending/sendFlow")
    expect(sendCalls.length, "sendFlow must NOT be called when subscriber not found").toBe(0)
  })

  it("does NOT throw — must return a result object, never throw", async () => {
    setupFetch({
      "/fb/subscriber/createSubscriber": {
        status: 500,
        body: { status: "error" },
      },
    })
    await expect(
      processLeadInManychat(API_KEY, LEAD, FLOW_NS, null)
    ).resolves.toBeDefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 5 — alreadyExists fallback: lookups retried, sendFlow still called
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: alreadyExists → findBySystemField → sendFlow", () => {
  it("falls back to system field after alreadyExists and still sends flow", async () => {
    // Option C: findByCustomField miss → createSubscriber alreadyExists → findBySystemField found
    const { calls } = setupFetch()

    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input)
        let body: Record<string, unknown> | null = null
        try { body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null } catch { /* ignore */ }
        calls.push({ url, method: init?.method ?? "GET", body })

        if (url.includes("/fb/subscriber/findByCustomField")) {
          return new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 })
        }
        if (url.includes("/fb/subscriber/createSubscriber")) {
          return new Response(
            JSON.stringify({ status: "error", message: "already exists" }),
            { status: 409 }
          )
        }
        if (url.includes("/fb/subscriber/findBySystemField")) {
          return new Response(JSON.stringify({ status: "success", data: { id: SUB_ID } }), { status: 200 })
        }
        if (url.includes("/fb/sending/sendFlow")) {
          return new Response(JSON.stringify({ status: "success" }), { status: 200 })
        }
        return new Response(JSON.stringify({ status: "success" }), { status: 200 })
      }
    )

    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    expect(result.ok).toBe(true)
    expect(result.subscriber_id).toBe(SUB_ID)
    const sendCall = callsTo(calls, "/fb/sending/sendFlow")[0]
    expect(sendCall?.body?.subscriber_id).toBe(SUB_ID_NUM) // integer per Manychat API spec
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 6 — sendFlow error (non-optin) must propagate as ok=false
// so the worker throws and BullMQ retries the job.
// "Validation error" is treated as sem_optin=true (no retry) — tested below.
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: sendFlow failure propagates correctly for retry", () => {
  it("non-optin error: returns ok=false, sem_optin falsy → worker retries", async () => {
    setupFetch({
      "/fb/subscriber/findByCustomField": {
        body: { status: "success", data: [{ id: SUB_ID }] },
      },
      "/fb/sending/sendFlow": {
        status: 500,
        body: { message: "Internal server error" },
      },
    })
    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    expect(result.ok).toBe(false)
    expect(result.sem_optin).toBeFalsy()  // NOT sem_optin — worker should retry
    expect(result.error).toBeTruthy()
    expect(result.subscriber_id).toBe(SUB_ID)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 8 — "Validation error" from sendFlow → sem_optin=true (no retry)
// Manychat "Validation error" = subscriber lacks WhatsApp opt-in.
// Retrying will never fix this — worker must mark as sem_optin, not falha.
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: Validation error from sendFlow → sem_optin=true", () => {
  it("found by custom field: Validation error → sem_optin=true with subscriber_id", async () => {
    setupFetch({
      "/fb/subscriber/findByCustomField": {
        body: { status: "success", data: [{ id: SUB_ID }] },
      },
      "/fb/sending/sendFlow": {
        status: 400,
        body: { message: "Validation error", messages: [{ message: "Subscriber does not have WhatsApp opt-in" }] },
      },
    })
    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    expect(result.ok).toBe(false)
    expect(result.sem_optin).toBe(true)
    expect(result.subscriber_id).toBe(SUB_ID)
    expect(result.error).toContain("Validation error")
  })

  it("knownSubscriberId path: Validation error → sem_optin=true with subscriber_id", async () => {
    setupFetch({
      "/fb/sending/sendFlow": {
        status: 400,
        body: { message: "Validation error" },
      },
    })
    const result = await processLeadInManychat(API_KEY, LEAD, FLOW_NS, null, SUB_ID)

    expect(result.ok).toBe(false)
    expect(result.sem_optin).toBe(true)
    expect(result.subscriber_id).toBe(SUB_ID)
    expect(result.error).toContain("Validation error")
  })

  it("sendFlowToSubscriber: captures data.messages[] in error detail", async () => {
    setupFetch({
      "/fb/sending/sendFlow": {
        status: 400,
        body: {
          message: "Validation error",
          messages: [{ message: "Subscriber does not have WhatsApp opt-in" }],
        },
      },
    })
    const result = await sendFlowToSubscriber(API_KEY, SUB_ID, FLOW_NS)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("Validation error")
    expect(result.error).toContain("Subscriber does not have WhatsApp opt-in")
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// INVARIANT 7 — phone normalization: smart E.164 with Brazilian DDD detection
//
// Rules (spec-aligned):
//   12-13 digits starting with 55  → Brazil with DDI → +55...
//   10-11 digits with valid DDD BR → Brazil without DDI → prepend 55 → +55...
//   Anything else                  → use as-is with + prefix (no Brazil assumed)
// ═════════════════════════════════════════════════════════════════════════════

describe("INVARIANT: phone normalization — smart E.164 with BR DDD detection", () => {
  it("createSubscriber uses E.164 phone format with + prefix", async () => {
    const { calls } = setupFetch()
    await createManychatSubscriber(API_KEY, LEAD)

    const createCall = callsTo(calls, "/fb/subscriber/createSubscriber")[0]
    expect(createCall.body?.whatsapp_phone).toBe(PHONE_E164)
  })

  it("sendFlow lookup uses E.164 phone for custom field search", async () => {
    const { calls } = setupFetch()
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    const lookupCall = calls.find((c) => c.url.includes("/fb/subscriber/findByCustomField"))
    expect(lookupCall?.url).toContain(encodeURIComponent(PHONE_E164))
  })

  it("updateSubscriber opt-in upsert uses E.164 format", async () => {
    const { calls } = setupFetch({
      "/fb/subscriber/findByCustomField": {
        body: { status: "success", data: [{ id: SUB_ID }] },
      },
    })
    await processLeadInManychat(API_KEY, LEAD, FLOW_NS, FIELD_ID)

    const updateCalls = callsTo(calls, "/fb/subscriber/updateSubscriber")
    expect(updateCalls.length).toBeGreaterThan(0)
    for (const c of updateCalls) {
      expect(c.body?.whatsapp_phone).toBe(PHONE_E164)
    }
  })

  // ── Smart normalization unit cases ────────────────────────────────────────

  it("BR number with DDI (13 digits, starts with 55) → +55...", async () => {
    // LEAD telefone = "5542998234664" → already has DDI 55
    const { calls } = setupFetch()
    await createManychatSubscriber(API_KEY, { nome: "Test", telefone: "5542998234664" })
    const c = callsTo(calls, "/fb/subscriber/createSubscriber")[0]
    expect(c.body?.whatsapp_phone).toBe("+5542998234664")
  })

  it("BR number without DDI (11 digits, valid DDD 42) → prepends 55 → +5542...", async () => {
    const { calls } = setupFetch()
    await createManychatSubscriber(API_KEY, { nome: "Test", telefone: "42998234664" })
    const c = callsTo(calls, "/fb/subscriber/createSubscriber")[0]
    expect(c.body?.whatsapp_phone).toBe("+5542998234664")
  })

  it("BR number without DDI (10 digits, valid DDD 42) → prepends 55 → +5542...", async () => {
    const { calls } = setupFetch()
    await createManychatSubscriber(API_KEY, { nome: "Test", telefone: "4298234664" })
    const c = callsTo(calls, "/fb/subscriber/createSubscriber")[0]
    expect(c.body?.whatsapp_phone).toBe("+554298234664")
  })

  it("Portuguese number (12 digits, 351...) → NOT forced to BR → +351...", async () => {
    const { calls } = setupFetch()
    await createManychatSubscriber(API_KEY, { nome: "Test", telefone: "351912345678" })
    const c = callsTo(calls, "/fb/subscriber/createSubscriber")[0]
    expect(c.body?.whatsapp_phone).toBe("+351912345678")
  })

  it("Formatted BR number with +55 and spaces → stripped to +5542...", async () => {
    const { calls } = setupFetch()
    await createManychatSubscriber(API_KEY, { nome: "Test", telefone: "+55 (42) 9 9823-4664" })
    const c = callsTo(calls, "/fb/subscriber/createSubscriber")[0]
    expect(c.body?.whatsapp_phone).toBe("+5542998234664")
  })
})
