import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { isGroupJoinEvent, type ZApiWebhookPayload } from "@/lib/zapi/client"
import { processarEntradaGrupo } from "@/lib/services/entradas.service"

// Always return 200 to Z-API — never 4xx/5xx to avoid retry storms
function ok() {
  return NextResponse.json({ ok: true }, { status: 200 })
}

// POST /api/webhook/zapi/[token]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // 1. Validate token → find instância
  const instancia = await prisma.instanciaZApi.findFirst({
    where: { webhook_token: token, status: "ativo", deleted_at: null },
    select: { id: true, client_token: true },
  })

  if (!instancia) {
    // Return 200 anyway — don't reveal if token is invalid
    console.warn(`[ZApi Webhook] Unknown token: ${token}`)
    return ok()
  }

  // 2. Parse body safely
  let payload: ZApiWebhookPayload
  try {
    payload = await request.json()
  } catch {
    console.warn("[ZApi Webhook] Invalid JSON body")
    return ok()
  }

  console.log(`[ZApi Webhook] instancia=${instancia.id} type=${payload.type} notification=${payload.notification ?? "-"} isGroup=${payload.isGroup}`)

  // 3. Only process GROUP_PARTICIPANT_ADD events
  if (!isGroupJoinEvent(payload)) {
    return ok()
  }

  // 4. Process asynchronously — don't block the response
  processarEntradaGrupo(instancia.id, payload).catch((err) => {
    console.error("[ZApi Webhook] processarEntradaGrupo error:", err)
  })

  return ok()
}

// Z-API may send GET to validate the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 })
}
