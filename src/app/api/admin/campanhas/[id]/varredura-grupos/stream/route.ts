import { NextRequest } from "next/server"
import { verifyAccessToken } from "@/lib/auth/jwt"
import { prisma } from "@/lib/db/prisma"
import { varredarGruposCampanha, type VarreduraProgressEvent } from "@/lib/services/varredura-grupos.service"

// Allows up to 5 minutes for large groups
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/campanhas/[id]/varredura-grupos/stream?token=...
// Server-Sent Events endpoint for real-time varredura progress
export async function GET(request: NextRequest, { params }: Ctx) {
  // Auth via query param (EventSource doesn't support headers)
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return new Response("Token de acesso nao fornecido", { status: 401 })
  }

  const payload = await verifyAccessToken(token)
  if (!payload) {
    return new Response("Token invalido ou expirado", { status: 401 })
  }

  // Verify user still exists and has proper role
  const user = await prisma.usuario.findFirst({
    where: { id: payload.id, deleted_at: null },
    select: { id: true, status: true, role: true },
  })

  if (!user || user.status === "inativo") {
    return new Response("Conta desativada", { status: 403 })
  }

  if (!["super_admin", "admin"].includes(user.role)) {
    return new Response("Acesso negado", { status: 403 })
  }

  const { id } = await params

  // Create SSE stream
  const encoder = new TextEncoder()
  let controllerRef: ReadableStreamDefaultController | null = null

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller

      function sendEvent(event: string, data: unknown) {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch {
          // Stream might be closed
        }
      }

      function onProgress(evt: VarreduraProgressEvent) {
        sendEvent("progress", evt)
      }

      // Run varredura with progress callback
      varredarGruposCampanha(id, onProgress)
        .then((resultado) => {
          sendEvent("complete", { resultado })
          try { controller.close() } catch { /* already closed */ }
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Erro desconhecido na varredura"
          sendEvent("error", { message })
          try { controller.close() } catch { /* already closed */ }
        })
    },
    cancel() {
      // Client disconnected — nothing to clean up since varredura runs to completion
      controllerRef = null
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  })
}
