import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { getGroupsAndCommunities } from "@/lib/zapi/client"
import { escanearEAutoVincular } from "@/lib/services/grupo-auto-vincular.service"
import { sincronizarGruposCache } from "@/lib/services/zapi.service"

// Buscar grupos + auto-vincular é rápido (poucos requests à Z-API)
// Processamento de participantes fica na varredura da campanha (endpoint separado)
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

// POST /api/admin/zapi/instancias/[id]/escanear-grupos
// Fetches all Z-API groups, syncs cache, auto-links similar ones.
// Does NOT process participants — use the campaign varredura for that.
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id } = await params
    const inst = await prisma.instanciaZApi.findFirst({
      where: { id, deleted_at: null },
      select: { instance_id: true, token: true, client_token: true },
    })
    if (!inst) return (await import("@/lib/api/response")).notFound("Instância não encontrada.")

    // 1. Buscar grupos do WhatsApp (paginado, ~5-15s)
    let grupos: Awaited<ReturnType<typeof getGroupsAndCommunities>>
    try {
      grupos = await getGroupsAndCommunities(inst.instance_id, inst.token, inst.client_token)
    } catch (zapiErr) {
      console.error("[escanear-grupos] Erro Z-API:", zapiErr)
      const msg = zapiErr instanceof Error ? zapiErr.message : "Erro desconhecido"
      return NextResponse.json(
        { error: "zapi_error", message: `Erro ao buscar grupos da Z-API: ${msg}. Verifique se a instância está conectada.` },
        { status: 502 }
      )
    }

    if (grupos.length === 0) {
      return ok({
        novos_vinculados: 0, ja_existentes: 0, total_grupos_wa: 0,
        aviso: "Nenhum grupo encontrado no WhatsApp. Verifique se a instância está conectada e se o número tem grupos.",
      })
    }

    // 2. Sincronizar cache (rápido, Prisma upserts)
    try { await sincronizarGruposCache(id, grupos) } catch { /* best-effort */ }

    // 3. Auto-vincular por similaridade (rápido, comparações em memória)
    const result = await escanearEAutoVincular(id, grupos)

    return ok(result)
  } catch (error) {
    console.error("[escanear-grupos] Erro:", error)
    const msg = error instanceof Error ? error.message : "Erro interno no servidor"
    return handleServiceError(error) ?? serverError(msg)
  }
}
