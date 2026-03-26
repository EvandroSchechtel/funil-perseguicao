import { prisma } from "@/lib/db/prisma"
import { groupNameSimilarity, SIMILARITY_THRESHOLD } from "@/lib/utils/name-similarity"

export interface AutoVincularResult {
  criado: boolean
  grupoId: string | null
  score: number
  templateId: string | null
  templateNomeFiltro: string | null
}

export interface EscanearResult {
  total_grupos_zapi: number
  novos_vinculados: number
  ja_configurados: number
  sem_match: number
  detalhes: Array<{
    nome: string
    grupoWaId: string
    acao: "criado" | "existente" | "sem_match"
    score: number
    templateNomeFiltro: string | null
    grupoId: string | null
    leads_count: number
  }>
}

/**
 * Tries to auto-link a new WhatsApp group to an existing campaign
 * by finding the most semantically similar GrupoMonitoramento.nome_filtro.
 *
 * If similarity >= SIMILARITY_THRESHOLD and the group isn't already configured,
 * creates a new GrupoMonitoramento cloning the template's campaign + conta + tags.
 */
export async function tentarAutoVincularGrupo(
  instanciaId: string,
  grupoWaId: string,
  grupoNome: string
): Promise<AutoVincularResult> {
  // Load all active monitoring groups for this instance as templates
  const templates = await prisma.grupoMonitoramento.findMany({
    where: { instancia_id: instanciaId, status: "ativo", auto_expand: true },
    select: {
      id: true,
      nome_filtro: true,
      grupo_wa_id: true,
      campanha_id: true,
      conta_manychat_id: true,
      tag_manychat_id: true,
      tag_manychat_nome: true,
      contas_monitoramento: {
        select: { conta_manychat_id: true, tag_manychat_id: true, tag_manychat_nome: true },
      },
    },
  })

  if (templates.length === 0) {
    return { criado: false, grupoId: null, score: 0, templateId: null, templateNomeFiltro: null }
  }

  // Check if already configured (by WA ID or exact name)
  const existing = templates.find(
    (t) =>
      (grupoWaId && t.grupo_wa_id === grupoWaId) ||
      t.nome_filtro.toLowerCase() === grupoNome.toLowerCase()
  )
  if (existing) {
    // Back-fill grupo_wa_id if it wasn't set yet
    if (!existing.grupo_wa_id && grupoWaId) {
      await prisma.grupoMonitoramento.update({
        where: { id: existing.id },
        data: { grupo_wa_id: grupoWaId },
      })
    }
    return {
      criado: false,
      grupoId: existing.id,
      score: 1.0,
      templateId: existing.id,
      templateNomeFiltro: existing.nome_filtro,
    }
  }

  // Find best matching template by semantic similarity
  let bestScore = 0
  let bestTemplate: (typeof templates)[0] | null = null

  for (const t of templates) {
    const score = groupNameSimilarity(grupoNome, t.nome_filtro)
    if (score > bestScore) {
      bestScore = score
      bestTemplate = t
    }
  }

  if (!bestTemplate || bestScore < SIMILARITY_THRESHOLD) {
    console.log(
      `[AutoVincular] Sem match para "${grupoNome}" — melhor score: ${bestScore.toFixed(2)}`
    )
    return { criado: false, grupoId: null, score: bestScore, templateId: null, templateNomeFiltro: null }
  }

  // Check if a group with this same nome_filtro already exists for this campanha
  const duplicate = await prisma.grupoMonitoramento.findFirst({
    where: {
      instancia_id: instanciaId,
      campanha_id: bestTemplate.campanha_id,
      nome_filtro: { equals: grupoNome, mode: "insensitive" },
    },
    select: { id: true },
  })

  if (duplicate) {
    return {
      criado: false,
      grupoId: duplicate.id,
      score: bestScore,
      templateId: bestTemplate.id,
      templateNomeFiltro: bestTemplate.nome_filtro,
    }
  }

  // Auto-create new GrupoMonitoramento cloning the template
  const novo = await prisma.grupoMonitoramento.create({
    data: {
      instancia_id: instanciaId,
      campanha_id: bestTemplate.campanha_id,
      conta_manychat_id: bestTemplate.conta_manychat_id,
      nome_filtro: grupoNome,
      grupo_wa_id: grupoWaId || null,
      tag_manychat_id: bestTemplate.tag_manychat_id,
      tag_manychat_nome: bestTemplate.tag_manychat_nome,
    },
    select: { id: true },
  })

  // Copy contas_monitoramento junction records from template (multi-conta support)
  if (bestTemplate.contas_monitoramento.length > 0) {
    await prisma.grupoMonitoramentoConta.createMany({
      data: bestTemplate.contas_monitoramento.map((cm) => ({
        id: crypto.randomUUID(),
        grupo_id: novo.id,
        conta_manychat_id: cm.conta_manychat_id,
        tag_manychat_id: cm.tag_manychat_id,
        tag_manychat_nome: cm.tag_manychat_nome,
      })),
      skipDuplicates: true,
    }).catch((err) => console.error("[AutoVincular] Erro ao copiar contas_monitoramento:", err))
  }

  console.log(
    `[AutoVincular] Grupo auto-vinculado: "${grupoNome}" → ` +
    `campanha=${bestTemplate.campanha_id} score=${bestScore.toFixed(2)} ` +
    `template="${bestTemplate.nome_filtro}"`
  )

  return {
    criado: true,
    grupoId: novo.id,
    score: bestScore,
    templateId: bestTemplate.id,
    templateNomeFiltro: bestTemplate.nome_filtro,
  }
}

/**
 * Scans all groups from Z-API and auto-links similar ones.
 * Called by the manual "Escanear Grupos" admin action.
 */
export async function escanearEAutoVincular(
  instanciaId: string,
  gruposZApi: Array<{ phone: string; name: string }>
): Promise<EscanearResult> {
  const result: EscanearResult = {
    total_grupos_zapi: gruposZApi.length,
    novos_vinculados: 0,
    ja_configurados: 0,
    sem_match: 0,
    detalhes: [],
  }

  for (const g of gruposZApi) {
    const r = await tentarAutoVincularGrupo(instanciaId, g.phone, g.name)

    if (r.criado) {
      result.novos_vinculados++
      result.detalhes.push({
        nome: g.name, grupoWaId: g.phone, acao: "criado",
        score: r.score, templateNomeFiltro: r.templateNomeFiltro,
        grupoId: r.grupoId, leads_count: 0,
      })
    } else if (r.grupoId) {
      result.ja_configurados++
      result.detalhes.push({
        nome: g.name, grupoWaId: g.phone, acao: "existente",
        score: r.score, templateNomeFiltro: r.templateNomeFiltro,
        grupoId: r.grupoId, leads_count: 0,
      })
    } else {
      result.sem_match++
      result.detalhes.push({
        nome: g.name, grupoWaId: g.phone, acao: "sem_match",
        score: r.score, templateNomeFiltro: null,
        grupoId: null, leads_count: 0,
      })
    }
  }

  // Batch-fetch leads counts for all configured groups in a single query
  const configuredIds = result.detalhes
    .filter((d) => d.grupoId)
    .map((d) => d.grupoId!)

  if (configuredIds.length > 0) {
    const counts = await prisma.entradaGrupo.groupBy({
      by: ["grupo_id"],
      where: { grupo_id: { in: configuredIds } },
      _count: { grupo_id: true },
    })
    const countMap = new Map(counts.map((c) => [c.grupo_id, c._count.grupo_id]))
    for (const d of result.detalhes) {
      if (d.grupoId) d.leads_count = countMap.get(d.grupoId) ?? 0
    }
  }

  return result
}
