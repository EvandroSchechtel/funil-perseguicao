import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { parseWebhookPayload } from "@/lib/webhook/payload-parser"

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/webhook/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeFormRequest(fields: Record<string, string>): NextRequest {
  const params = new URLSearchParams(fields)
  return new NextRequest("http://localhost/api/webhook/test", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
}

// ── ActiveCampaign (form-encoded, bracket notation) ───────────────────────────

describe("ActiveCampaign form-encoded", () => {
  it("TC-01: extracts nome from contact[first_name]+contact[last_name], telefone and email", async () => {
    const req = makeFormRequest({
      "contact[first_name]": "João",
      "contact[last_name]": "Silva",
      "contact[phone]": "5542998234664",
      "contact[email]": "joao@example.com",
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("João Silva")
    expect(result.telefone).toBe("5542998234664")
    expect(result.email).toBe("joao@example.com")
  })

  it("TC-02: direct 'nome' and 'telefone' fields take priority over contact[] fields", async () => {
    const req = makeFormRequest({
      "nome": "Maria Direta",
      "telefone": "5511999991111",
      "contact[first_name]": "Outro",
      "contact[phone]": "5511000000000",
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Maria Direta")
    expect(result.telefone).toBe("5511999991111")
  })

  it("TC-15: only first_name (no last_name) → uses just the first name", async () => {
    const req = makeFormRequest({
      "contact[first_name]": "Ana",
      "contact[phone]": "11988887777",
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Ana")
    expect(result.telefone).toBe("11988887777")
  })

  it("TC-16: no name fields → falls back to contact[email] as nome", async () => {
    const req = makeFormRequest({
      "contact[email]": "fulano@ac.com",
      "contact[phone]": "11922221111",
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("fulano@ac.com")
    expect(result.email).toBe("fulano@ac.com")
  })
})

// ── RD Station (JSON) ─────────────────────────────────────────────────────────

describe("RD Station JSON", () => {
  it("TC-03: extracts from name + mobile_phone", async () => {
    const req = makeJsonRequest({
      name: "Ana Rodrigues",
      email: "ana@rdstation.com",
      mobile_phone: "11987654321",
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Ana Rodrigues")
    expect(result.telefone).toBe("11987654321")
    expect(result.email).toBe("ana@rdstation.com")
  })

  it("TC-04: fallback personal_phone when mobile_phone absent", async () => {
    const req = makeJsonRequest({ name: "Ana", personal_phone: "1133334444" })
    const result = await parseWebhookPayload(req)
    expect(result.telefone).toBe("1133334444")
  })
})

// ── Hotmart (JSON, nested buyer) ──────────────────────────────────────────────

describe("Hotmart JSON", () => {
  it("TC-05: extracts from buyer.name, buyer.email, buyer.phone", async () => {
    const req = makeJsonRequest({
      buyer: { name: "Carlos Hotmart", email: "carlos@email.com", phone: "21999998888" },
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Carlos Hotmart")
    expect(result.telefone).toBe("21999998888")
    expect(result.email).toBe("carlos@email.com")
  })

  it("TC-06: handles data.buyer wrapper", async () => {
    const req = makeJsonRequest({
      data: { buyer: { name: "Carlos Wrapper", email: "c@x.com", phone: "21999990000" } },
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Carlos Wrapper")
    expect(result.telefone).toBe("21999990000")
    expect(result.email).toBe("c@x.com")
  })
})

// ── Kiwify (JSON, nested Customer) ───────────────────────────────────────────

describe("Kiwify JSON", () => {
  it("TC-07: extracts Customer.full_name, Customer.email, Customer.mobile (capital C)", async () => {
    const req = makeJsonRequest({
      Customer: { full_name: "Paula Kiwify", email: "paula@kiwify.com", mobile: "31988887777" },
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Paula Kiwify")
    expect(result.telefone).toBe("31988887777")
    expect(result.email).toBe("paula@kiwify.com")
  })

  it("TC-08: lowercase customer key also works", async () => {
    const req = makeJsonRequest({
      customer: { full_name: "Paulo Lower", email: "p@k.com", phone: "31911112222" },
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Paulo Lower")
    expect(result.telefone).toBe("31911112222")
    expect(result.email).toBe("p@k.com")
  })
})

// ── Eduzz (JSON, flat) ────────────────────────────────────────────────────────

describe("Eduzz JSON", () => {
  it("TC-09: extracts buyer_name, buyer_email, buyer_cel", async () => {
    const req = makeJsonRequest({
      buyer_name: "Roberto Eduzz",
      buyer_email: "roberto@eduzz.com",
      buyer_cel: "47988886666",
    })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Roberto Eduzz")
    expect(result.telefone).toBe("47988886666")
    expect(result.email).toBe("roberto@eduzz.com")
  })

  it("TC-10: falls back to buyer_phone when buyer_cel absent", async () => {
    const req = makeJsonRequest({ buyer_name: "Roberto", buyer_phone: "47911110000" })
    const result = await parseWebhookPayload(req)
    expect(result.telefone).toBe("47911110000")
  })
})

// ── Generic JSON ──────────────────────────────────────────────────────────────

describe("Generic direct JSON", () => {
  it("TC-11: nome + telefone + email (existing behaviour preserved)", async () => {
    const req = makeJsonRequest({ nome: "Teste", telefone: "42999991234", email: "t@t.com" })
    const result = await parseWebhookPayload(req)
    expect(result.nome).toBe("Teste")
    expect(result.telefone).toBe("42999991234")
    expect(result.email).toBe("t@t.com")
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("TC-12: missing telefone → returns undefined, does not throw", async () => {
    const req = makeJsonRequest({ nome: "Alguém" })
    const result = await parseWebhookPayload(req)
    expect(result.telefone).toBeUndefined()
    // nome was found
    expect(result.nome).toBe("Alguém")
  })

  it("TC-13: malformed JSON body → all fields undefined, no throw", async () => {
    const req = new NextRequest("http://localhost/api/webhook/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ invalid json !!!",
    })
    await expect(parseWebhookPayload(req)).resolves.toEqual({
      nome: undefined,
      telefone: undefined,
      email: undefined,
    })
  })

  it("TC-14: phone sent as number is coerced to string", async () => {
    const req = makeJsonRequest({ nome: "X", phone: 5542998234664 })
    const result = await parseWebhookPayload(req)
    expect(result.telefone).toBe("5542998234664")
  })
})
