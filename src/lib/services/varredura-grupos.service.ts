import { prisma } from "@/lib/db/prisma"
import { addTag } from "@/lib/manychat/tags"
import { getGroupMetadata, normalizePhone, type ZApiGroupMetadata } from "@/lib/zapi/client"
import { ServiceError } from "./errors"

const LOCK_HOURS = 24

export interface VarreduraResult {
  grupos_varridos: number
  grupos_sem_id: number       // grupos sem grupo_wa_id (ainda nao vinculados ao WA)
  total_membros: number       // participantes unicos lidos do Z-API
  leads_encontrados: number   // membros que tem Lead nesta campanha
  ja_processados: number      // leads com tag_aplicada=true (skip)
  tags_aplicadas: number      // leads que receberam tag agora
  erros: number               // falhas de getGroupMetadata ou outras
  proxima_varredura_em: string // ISO8601
  aviso_24h: string | null    // aviso quando varredura recente, mas nao bloqueia
}

// ── Progress callback types ─────────────────────────────────────────────────

export interface VarreduraProgressEvent {
  fase: "inicio" | "metadata" | "processando" | "tags" | "salvando" | "grupo_completo" | "completo"
  grupoIndex?: number
  grupoTotal?: number
  grupoNome?: string
  status?: string
  membros?: number
  leadsEncontrados?: number
  tagsAplicadas?: number
  tagsTotal?: number
  jaProcessados?: number
  erros?: number
}

export type VarreduraProgressCallback = (event: VarreduraProgressEvent) => void

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Runs promises in batches of `size`, returning all settled results in order. */
async function batchAllSettled<T>(
  items: (() => Promise<T>)[],
  size: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    const settled = await Promise.allSettled(batch.map((fn) => fn()))
    results.push(...settled)
  }
  return results
}

/** For a phone like "5542998234664", returns search variants: itself, "+5542...", and "42..." */
function phoneVariants(phone: string): string[] {
  const variants = [phone, `+${phone}`]
  if (phone.startsWith("55")) variants.push(phone.slice(2))
  return variants
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Varredura retroativa de grupos: percorre todos os membros atuais dos grupos
 * WhatsApp vinculados a campanha e aplica tags Manychat para leads que ainda
 * nao foram processados.
 *
 * Regras:
 * - So pode rodar uma vez a cada 24h por campanha (trava via ultima_varredura_at)
 * - So processa leads ja existentes na campanha (nao cria leads novos)
 * - Aplica tags em todas as contas Manychat vinculadas ao grupo (multi-conta)
 * - Usa ContatoConta(contato_id, conta_id) — nunca Lead.subscriber_id
 */
export async function varredarGruposCampanha(
  campanhaId: string,
  onProgress?: VarreduraProgressCallback,
): Promise<VarreduraResult> {
  // 1. Busca campanha com credenciais da instancia Z-API
  const campanha = await prisma.campanha.findFirst({
    where: { id: campanhaId, deleted_at: null },
    select: {
      id: true,
      ultima_varredura_at: true,
      instancia_zapi: {
        select: { id: true, instance_id: true, token: true, client_token: true },
      },
    },
  })
  if (!campanha) throw new ServiceError("not_found", "Campanha não encontrada.")
  if (!campanha.instancia_zapi) {
    throw new ServiceError("bad_request", "Campanha não tem instância Z-API vinculada. Vincule uma instância antes de varrer.")
  }

  // 2. Aviso de 24h (nao bloqueia — apenas informa)
  let aviso_24h: string | null = null
  if (campanha.ultima_varredura_at) {
    const diff = Date.now() - new Date(campanha.ultima_varredura_at).getTime()
    const restante = LOCK_HOURS * 3_600_000 - diff
    if (restante > 0) {
      const horas = Math.ceil(restante / 3_600_000)
      const label = horas === 1 ? "1 hora" : `${horas} horas`
      aviso_24h = `Varredura recente (faltam ${label} para o próximo ciclo). Resultados podem estar duplicados.`
    }
  }

  // 3. Grava timestamp imediatamente (evita runs concorrentes)
  await prisma.campanha.update({
    where: { id: campanhaId },
    data: { ultima_varredura_at: new Date() },
  })

  // 4. Busca todos os GrupoMonitoramento ativos da campanha
  const grupos = await prisma.grupoMonitoramento.findMany({
    where: { campanha_id: campanhaId, status: "ativo" },
    include: {
      conta_manychat: { select: { id: true, api_key: true } },
      contas_monitoramento: {
        include: { conta_manychat: { select: { id: true, api_key: true } } },
      },
    },
  })

  const inst = campanha.instancia_zapi
  const result: VarreduraResult = {
    grupos_varridos: 0,
    grupos_sem_id: 0,
    total_membros: 0,
    leads_encontrados: 0,
    ja_processados: 0,
    tags_aplicadas: 0,
    erros: 0,
    proxima_varredura_em: new Date(Date.now() + LOCK_HOURS * 3_600_000).toISOString(),
    aviso_24h,
  }

  // ── Phase 1: Resolve grupo_wa_id from cache for groups missing it ──────

  const gruposSemId = grupos.filter((g) => !g.grupo_wa_id)
  if (gruposSemId.length > 0) {
    const cachedEntries = await prisma.grupoWaCache.findMany({
      where: {
        instancia_id: inst.id,
        OR: gruposSemId.map((g) => ({
          nome: { contains: g.nome_filtro, mode: "insensitive" as const },
        })),
      },
      select: { grupo_wa_id: true, nome: true },
    })

    // Match each grupo sem id against cache
    for (const grupo of gruposSemId) {
      const match = cachedEntries.find((c) =>
        c.nome.toLowerCase().includes(grupo.nome_filtro.toLowerCase())
      )
      if (match) {
        await prisma.grupoMonitoramento.update({
          where: { id: grupo.id },
          data: { grupo_wa_id: match.grupo_wa_id },
        })
        grupo.grupo_wa_id = match.grupo_wa_id
      } else {
        result.grupos_sem_id++
      }
    }
  }

  // Filter to groups that have grupo_wa_id resolved
  const gruposComId = grupos.filter((g) => g.grupo_wa_id)

  // Emit inicio event
  onProgress?.({ fase: "inicio", grupoTotal: gruposComId.length })

  // ── Phase 2: Fetch group metadata in parallel batches of 3 ─────────────

  console.log(`[Varredura] Buscando metadados de ${gruposComId.length} grupos (batches de 3)...`)

  type GrupoComMeta = {
    grupo: (typeof gruposComId)[number]
    metadata: ZApiGroupMetadata
  }

  const gruposComMeta: GrupoComMeta[] = []

  // Emit "buscando" for each group before fetching
  for (let i = 0; i < gruposComId.length; i++) {
    onProgress?.({
      fase: "metadata",
      grupoIndex: i + 1,
      grupoTotal: gruposComId.length,
      grupoNome: gruposComId[i].nome_filtro,
      status: "aguardando",
    })
  }

  const metadataFetchers = gruposComId.map((grupo, idx) => async () => {
    onProgress?.({
      fase: "metadata",
      grupoIndex: idx + 1,
      grupoTotal: gruposComId.length,
      grupoNome: grupo.nome_filtro,
      status: "buscando",
    })
    return getGroupMetadata(inst.instance_id, inst.token, inst.client_token, grupo.grupo_wa_id!)
  })

  const metadataResults = await batchAllSettled(metadataFetchers, 3)

  for (let i = 0; i < gruposComId.length; i++) {
    const grupo = gruposComId[i]
    const settled = metadataResults[i]

    if (settled.status === "rejected" || !settled.value) {
      console.warn(`[Varredura] getGroupMetadata falhou para grupo ${grupo.id} (${grupo.grupo_wa_id})`)
      result.erros++
      onProgress?.({
        fase: "metadata",
        grupoIndex: i + 1,
        grupoTotal: gruposComId.length,
        grupoNome: grupo.nome_filtro,
        status: "erro",
        erros: result.erros,
      })
      continue
    }

    result.grupos_varridos++
    const metadata = settled.value
    console.log(`[Varredura] Grupo "${metadata.name}" — ${metadata.participants.length} participantes`)
    gruposComMeta.push({ grupo, metadata })

    onProgress?.({
      fase: "metadata",
      grupoIndex: i + 1,
      grupoTotal: gruposComId.length,
      grupoNome: metadata.name,
      status: "ok",
      membros: metadata.participants.length,
    })
  }

  // ── Phase 3: Collect all unique phones from all groups ─────────────────

  // Map: normalizedPhone -> { participant, grupo, metadata, contasToTag }
  interface ParticipantInfo {
    telefoneNorm: string
    participantName: string | undefined
    grupo: (typeof gruposComId)[number]
    metadata: ZApiGroupMetadata
    contasToTag: Array<{
      conta_manychat: { id: string; api_key: string }
      tag_manychat_id: number
    }>
  }

  const allParticipants: ParticipantInfo[] = []
  const allPhones = new Set<string>()
  const allGrupoIds = new Set<string>()

  for (const { grupo, metadata } of gruposComMeta) {
    const contasToTag = grupo.contas_monitoramento.length > 0
      ? grupo.contas_monitoramento
      : [{ conta_manychat: grupo.conta_manychat, tag_manychat_id: grupo.tag_manychat_id }]

    allGrupoIds.add(grupo.id)

    for (const participant of metadata.participants) {
      const telefoneNorm = normalizePhone(participant.phone)
      if (!telefoneNorm) continue
      allPhones.add(telefoneNorm)
      allParticipants.push({
        telefoneNorm,
        participantName: participant.name,
        grupo,
        metadata,
        contasToTag,
      })
    }
  }

  result.total_membros = allParticipants.length

  if (allParticipants.length === 0) {
    console.log(`[Varredura] campanhaId=${campanhaId} result=`, result)
    return result
  }

  // ── Phase 4: Batch queries — contatos, leads, entradas, contatoContas ──

  console.log(`[Varredura] Batch queries: ${allPhones.size} telefones unicos, ${allGrupoIds.size} grupos`)

  // Build all phone variants for the WHERE IN query
  const allPhoneVariants: string[] = []
  for (const phone of allPhones) {
    allPhoneVariants.push(...phoneVariants(phone))
  }

  // 4a. All contatos matching any phone variant
  const contatosArr = await prisma.contato.findMany({
    where: { telefone: { in: allPhoneVariants } },
    select: { id: true, telefone: true },
  })

  // Build phone -> contato map (normalize keys for quick lookup)
  const contatoByPhone = new Map<string, { id: string; telefone: string }>()
  for (const c of contatosArr) {
    // Index by normalized digits
    const digits = c.telefone.replace(/\D/g, "")
    contatoByPhone.set(digits, c)
    contatoByPhone.set(c.telefone, c) // also index by raw value
  }

  // Lookup helper: find contato for a normalized phone
  function findContato(telefoneNorm: string) {
    // Try exact digits match first, then with +, then without country code
    return contatoByPhone.get(telefoneNorm)
      ?? contatoByPhone.get(`+${telefoneNorm}`)
      ?? (telefoneNorm.startsWith("55") ? contatoByPhone.get(telefoneNorm.slice(2)) : undefined)
      ?? undefined
  }

  // Collect all contato IDs that we found
  const foundContatoIds = new Set<string>()
  for (const phone of allPhones) {
    const c = findContato(phone)
    if (c) foundContatoIds.add(c.id)
  }

  // 4b. All leads for these contatos in this campanha
  const leadsArr = foundContatoIds.size > 0
    ? await prisma.lead.findMany({
        where: { contato_id: { in: [...foundContatoIds] }, campanha_id: campanhaId },
        select: { id: true, contato_id: true },
      })
    : []

  const leadByContatoId = new Map<string, { id: string; contato_id: string }>()
  for (const l of leadsArr) {
    leadByContatoId.set(l.contato_id, l)
  }

  // 4c. All existing entradas for these grupos
  const entradasArr = allGrupoIds.size > 0
    ? await prisma.entradaGrupo.findMany({
        where: { grupo_id: { in: [...allGrupoIds] } },
        select: { grupo_id: true, telefone: true, tag_aplicada: true },
      })
    : []

  // Key: "grupo_id|telefone"
  const entradaMap = new Map<string, { tag_aplicada: boolean }>()
  for (const e of entradasArr) {
    entradaMap.set(`${e.grupo_id}|${e.telefone}`, { tag_aplicada: e.tag_aplicada })
  }

  // 4d. All ContatoContas for found contatos (with subscriber_id)
  // Collect all conta IDs we might need
  const allContaIds = new Set<string>()
  for (const { grupo } of gruposComMeta) {
    const contas = grupo.contas_monitoramento.length > 0
      ? grupo.contas_monitoramento
      : [{ conta_manychat: grupo.conta_manychat, tag_manychat_id: grupo.tag_manychat_id }]
    for (const c of contas) {
      allContaIds.add(c.conta_manychat.id)
    }
  }

  const contatoContasArr = (foundContatoIds.size > 0 && allContaIds.size > 0)
    ? await prisma.contatoConta.findMany({
        where: {
          contato_id: { in: [...foundContatoIds] },
          conta_id: { in: [...allContaIds] },
          subscriber_id: { not: null },
        },
        select: { contato_id: true, conta_id: true, subscriber_id: true },
      })
    : []

  // Key: "contato_id|conta_id" -> subscriber_id
  const ccMap = new Map<string, string>()
  for (const cc of contatoContasArr) {
    if (cc.subscriber_id) {
      ccMap.set(`${cc.contato_id}|${cc.conta_id}`, cc.subscriber_id)
    }
  }

  console.log(`[Varredura] Batch results: ${contatosArr.length} contatos, ${leadsArr.length} leads, ${entradasArr.length} entradas, ${contatoContasArr.length} contatoContas`)

  onProgress?.({
    fase: "processando",
    grupoTotal: gruposComMeta.length,
    status: "identificando_leads",
  })

  // ── Phase 5: Process participants, apply tags, collect upserts ─────────

  interface UpsertEntry {
    grupo_id: string
    lead_id: string
    contato_id: string
    telefone: string
    nome_whatsapp: string | null
    grupo_wa_id: string
    grupo_wa_nome: string
    subscriber_id: string | null
    tag_aplicada: boolean
    tag_erro: string | null
  }

  const upserts: UpsertEntry[] = []
  const leadIdsToUpdateGrupoEntrou: string[] = []

  // Collect tag calls to run in batches of 5
  interface TagCall {
    apiKey: string
    subscriberId: string
    tagId: number
    participantIndex: number // to correlate results
  }

  // Process each participant — group by participant to collect tag calls
  interface PendingParticipant {
    info: ParticipantInfo
    contato: { id: string }
    lead: { id: string }
    tagCalls: TagCall[]
  }

  const pendingParticipants: PendingParticipant[] = []
  let participantIndex = 0

  for (let gi = 0; gi < gruposComMeta.length; gi++) {
    const { grupo, metadata } = gruposComMeta[gi]
    const participants = metadata.participants
    const grupoParticipants = allParticipants.filter((p) => p.grupo.id === grupo.id)

    console.log(`[Varredura] Progresso: grupo ${gi + 1}/${gruposComMeta.length} "${metadata.name}" — ${grupoParticipants.length} membros`)

    try {
      for (let mi = 0; mi < grupoParticipants.length; mi++) {
        const pInfo = grupoParticipants[mi]

        if (mi > 0 && mi % 50 === 0) {
          console.log(`[Varredura] Progresso: grupo ${gi + 1}/${gruposComMeta.length}, membro ${mi}/${grupoParticipants.length}`)
        }

        // Lookup contato
        const contato = findContato(pInfo.telefoneNorm)
        if (!contato) continue

        // Lookup lead
        const lead = leadByContatoId.get(contato.id)
        if (!lead) continue

        result.leads_encontrados++

        // Check existing entrada
        const entradaKey = `${grupo.id}|${pInfo.telefoneNorm}`
        const existingEntrada = entradaMap.get(entradaKey)
        if (existingEntrada?.tag_aplicada) {
          result.ja_processados++
          continue
        }

        // Build tag calls for this participant
        const tagCalls: TagCall[] = []
        for (const entry of pInfo.contasToTag) {
          const subscriberId = ccMap.get(`${contato.id}|${entry.conta_manychat.id}`)
          if (!subscriberId) continue
          tagCalls.push({
            apiKey: entry.conta_manychat.api_key,
            subscriberId,
            tagId: entry.tag_manychat_id,
            participantIndex,
          })
        }

        pendingParticipants.push({
          info: pInfo,
          contato,
          lead,
          tagCalls,
        })
        participantIndex++
      }
    } catch (err) {
      console.error(`[Varredura] Erro processando grupo "${metadata.name}":`, err)
      result.erros++
    }
  }

  // ── Phase 6: Batch tag API calls (5 concurrent) ───────────────────────

  console.log(`[Varredura] Aplicando tags para ${pendingParticipants.length} participantes pendentes...`)

  // Flatten all tag calls
  const allTagCalls = pendingParticipants.flatMap((p) => p.tagCalls)

  onProgress?.({
    fase: "tags",
    tagsTotal: allTagCalls.length,
    tagsAplicadas: 0,
    leadsEncontrados: result.leads_encontrados,
    jaProcessados: result.ja_processados,
  })

  const tagCallFunctions = allTagCalls.map((tc) => () =>
    addTag(tc.apiKey, tc.subscriberId, tc.tagId)
  )

  const tagResults = await batchAllSettled(tagCallFunctions, 5)

  // Map participantIndex -> tag results
  const tagResultsByParticipant = new Map<number, { ok: boolean; subscriberId: string; error: string | null }[]>()

  for (let i = 0; i < allTagCalls.length; i++) {
    const tc = allTagCalls[i]
    const settled = tagResults[i]

    const value = settled.status === "fulfilled"
      ? { ok: settled.value.ok, subscriberId: tc.subscriberId, error: settled.value.error ?? null }
      : { ok: false, subscriberId: tc.subscriberId, error: "Promise rejected" }

    const existing = tagResultsByParticipant.get(tc.participantIndex) ?? []
    existing.push(value)
    tagResultsByParticipant.set(tc.participantIndex, existing)
  }

  // ── Phase 7: Build upsert list from results ───────────────────────────

  for (let pi = 0; pi < pendingParticipants.length; pi++) {
    const pp = pendingParticipants[pi]
    const pTagResults = tagResultsByParticipant.get(pi) ?? []

    // If no tag calls were made (no subscriber_id found), still upsert with tag_aplicada=false
    const tagAplicada = pTagResults.some((r) => r.ok)
    const tagErro = pTagResults
      .filter((r) => !r.ok)
      .map((r) => r.error)
      .filter(Boolean)
      .join("; ") || null

    const subscriberId = pTagResults.find((r) => r.subscriberId)?.subscriberId ?? null

    if (tagAplicada) {
      result.tags_aplicadas++
    }

    upserts.push({
      grupo_id: pp.info.grupo.id,
      lead_id: pp.lead.id,
      contato_id: pp.contato.id,
      telefone: pp.info.telefoneNorm,
      nome_whatsapp: pp.info.participantName ?? null,
      grupo_wa_id: pp.info.grupo.grupo_wa_id!,
      grupo_wa_nome: pp.info.metadata.name,
      subscriber_id: subscriberId,
      tag_aplicada: tagAplicada,
      tag_erro: tagErro,
    })

    leadIdsToUpdateGrupoEntrou.push(pp.lead.id)
  }

  onProgress?.({
    fase: "tags",
    tagsTotal: allTagCalls.length,
    tagsAplicadas: result.tags_aplicadas,
    leadsEncontrados: result.leads_encontrados,
    jaProcessados: result.ja_processados,
    erros: result.erros,
  })

  // ── Phase 8: Batch upserts via $transaction ───────────────────────────

  if (upserts.length > 0) {
    console.log(`[Varredura] Executando ${upserts.length} upserts em transacao...`)
    onProgress?.({ fase: "salvando" })

    // Prisma doesn't support bulk upserts natively, so batch in transaction
    // Process in chunks of 50 to keep transactions manageable
    const UPSERT_CHUNK = 50
    for (let i = 0; i < upserts.length; i += UPSERT_CHUNK) {
      const chunk = upserts.slice(i, i + UPSERT_CHUNK)
      await prisma.$transaction(
        chunk.map((u) =>
          prisma.entradaGrupo.upsert({
            where: { grupo_id_telefone: { grupo_id: u.grupo_id, telefone: u.telefone } },
            create: {
              grupo_id: u.grupo_id,
              lead_id: u.lead_id,
              contato_id: u.contato_id,
              telefone: u.telefone,
              nome_whatsapp: u.nome_whatsapp,
              grupo_wa_id: u.grupo_wa_id,
              grupo_wa_nome: u.grupo_wa_nome,
              subscriber_id: u.subscriber_id,
              tag_aplicada: u.tag_aplicada,
              tag_erro: u.tag_erro,
            },
            update: {
              lead_id: u.lead_id,
              contato_id: u.contato_id,
              subscriber_id: u.subscriber_id,
              tag_aplicada: u.tag_aplicada,
              tag_erro: u.tag_erro,
              entrou_at: new Date(),
            },
          })
        )
      )
    }

    // Batch update grupo_entrou_at for leads
    if (leadIdsToUpdateGrupoEntrou.length > 0) {
      await prisma.lead.updateMany({
        where: {
          id: { in: leadIdsToUpdateGrupoEntrou },
          grupo_entrou_at: null,
        },
        data: { grupo_entrou_at: new Date() },
      })
    }
  }

  onProgress?.({
    fase: "completo",
    grupoTotal: gruposComMeta.length,
    tagsAplicadas: result.tags_aplicadas,
    leadsEncontrados: result.leads_encontrados,
    jaProcessados: result.ja_processados,
    erros: result.erros,
    membros: result.total_membros,
  })

  console.log(`[Varredura] campanhaId=${campanhaId} result=`, result)
  return result
}
