import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { getGroupsAndCommunities } from "@/lib/zapi/client"
import { escanearEAutoVincular } from "@/lib/services/grupo-auto-vincular.service"
import { sincronizarGruposCache } from "@/lib/services/zapi.service"

export const maxDuration = 30

type Ctx = { params: Promise<{ id: string }> }

// POST /api/admin/zapi/instancias/[id]/escanear-grupos
// Fetches Z-API groups (or uses cache as fallback), auto-links similar ones.
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

    const t0 = Date.now()
    console.log("[escanear-grupos] Iniciando para instância", id)

    // Try Z-API first, fallback to local cache
    let grupos: Array<{ phone: string; name: string; isGroup: boolean }>
    let usouCache = false

    try {
      grupos = await getGroupsAndCommunities(inst.instance_id, inst.token, inst.client_token)
      console.log(`[escanear-grupos] Z-API retornou ${grupos.length} grupos em ${Date.now() - t0}ms`)
    } catch (zapiErr) {
      console.warn(`[escanear-grupos] Z-API falhou em ${Date.now() - t0}ms:`, zapiErr)
      grupos = []
    }

    // Fallback: use GrupoWaCache if Z-API returned nothing
    if (grupos.length === 0) {
      const cached = await prisma.grupoWaCache.findMany({
        where: { instancia_id: id },
        select: { grupo_wa_id: true, nome: true },
        orderBy: { synced_at: "desc" },
        take: 100,
      })
      console.log(`[escanear-grupos] Cache local: ${cached.length} grupos em ${Date.now() - t0}ms`)
      if (cached.length > 0) {
        grupos = cached.map((c) => ({ phone: c.grupo_wa_id, name: c.nome, isGroup: true }))
        usouCache = true
      }
    }

    if (grupos.length === 0) {
      return ok({
        total_grupos_zapi: 0, novos_vinculados: 0, ja_configurados: 0, sem_match: 0, detalhes: [],
        aviso: "Nenhum grupo encontrado. Verifique se a instância Z-API está conectada.",
      })
    }

    // Sync cache (only if we got fresh data from Z-API)
    if (!usouCache) {
      try { await sincronizarGruposCache(id, grupos) } catch { /* best-effort */ }
    }
    console.log(`[escanear-grupos] Cache sync em ${Date.now() - t0}ms`)

    // Auto-link by similarity
    const result = await escanearEAutoVincular(id, grupos)
    console.log(`[escanear-grupos] Auto-link concluído em ${Date.now() - t0}ms:`, JSON.stringify(result))

    return ok({
      ...result,
      ...(usouCache ? { aviso: "Z-API indisponível — usou cache local. Dados podem estar desatualizados." } : {}),
    })
  } catch (error) {
    console.error("[escanear-grupos] Erro:", error)
    const msg = error instanceof Error ? error.message : "Erro interno no servidor"
    return handleServiceError(error) ?? serverError(msg)
  }
}
