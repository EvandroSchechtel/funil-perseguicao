import { prisma } from "@/lib/db/prisma"
import { testZApiConnection } from "@/lib/zapi/client"
import { getWebhookQueue, getGrupoEventosQueue } from "@/lib/queue/queues"

// ── Helpers ───────────────────────────────────────────────────────────────────

type AlertaData = {
  tipo: string
  nivel: string
  titulo: string
  mensagem: string
  referencia_id?: string
  referencia_nome?: string
}

async function upsertAlerta(data: AlertaData): Promise<void> {
  const existente = await prisma.alertaSistema.findFirst({
    where: {
      tipo: data.tipo,
      referencia_id: data.referencia_id ?? null,
      resolvido_at: null,
    },
    select: { id: true },
  })
  if (existente) return // já registrado — não duplicar
  await prisma.alertaSistema.create({ data })
  console.log(`[Monitor] Alerta criado: ${data.tipo} — ${data.titulo}`)
}

async function resolverAlerta(tipo: string, referenciaId: string | null): Promise<void> {
  const count = await prisma.alertaSistema.updateMany({
    where: { tipo, referencia_id: referenciaId, resolvido_at: null },
    data: { resolvido_at: new Date() },
  })
  if (count.count > 0) {
    console.log(`[Monitor] Alerta resolvido: ${tipo} ref=${referenciaId ?? "-"}`)
  }
}

// ── Verificação 1: Campanhas sem webhook há >1h ───────────────────────────────

const CAMPANHA_SILENCIOSA_MS = 60 * 60 * 1000 // 1 hora

export async function verificarCampanhasSilenciosas(): Promise<void> {
  const campanhas = await prisma.campanha.findMany({
    where: { status: "ativo", pausado_at: null, deleted_at: null },
    select: { id: true, nome: true },
  })

  for (const campanha of campanhas) {
    const ultimoLead = await prisma.lead.findFirst({
      where: { campanha_id: campanha.id },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    })

    const silenciosa =
      !ultimoLead ||
      Date.now() - ultimoLead.created_at.getTime() > CAMPANHA_SILENCIOSA_MS

    if (silenciosa) {
      const tempoSemReceberMsg = ultimoLead
        ? `Último webhook há ${Math.round((Date.now() - ultimoLead.created_at.getTime()) / 60000)}min.`
        : "Nunca recebeu webhooks."
      await upsertAlerta({
        tipo: "campanha_sem_webhook",
        nivel: "critico",
        titulo: "Campanha sem receber leads",
        mensagem: `"${campanha.nome}" está sem receber webhooks há mais de 1h. ${tempoSemReceberMsg} Verifique a integração Manychat.`,
        referencia_id: campanha.id,
        referencia_nome: campanha.nome,
      })
    } else {
      await resolverAlerta("campanha_sem_webhook", campanha.id)
    }
  }
}

// ── Verificação 2: Instâncias Z-API desconectadas ─────────────────────────────

export async function verificarConexoesZApi(): Promise<void> {
  const instancias = await prisma.instanciaZApi.findMany({
    where: { status: "ativo", deleted_at: null },
    select: { id: true, nome: true, instance_id: true, token: true, client_token: true },
  })

  for (const inst of instancias) {
    try {
      const result = await testZApiConnection(inst.instance_id, inst.token, inst.client_token)

      if (!result.ok || result.connected === false) {
        await upsertAlerta({
          tipo: "zapi_desconectado",
          nivel: "critico",
          titulo: "Z-API desconectado",
          mensagem: `Instância "${inst.nome}" está desconectada. Entradas e saídas de grupo não estão sendo rastreadas. ${result.error ? `Erro: ${result.error}` : ""}`,
          referencia_id: inst.id,
          referencia_nome: inst.nome,
        })
      } else {
        await resolverAlerta("zapi_desconectado", inst.id)
      }
    } catch (err) {
      console.warn(`[Monitor] Erro ao verificar instância ${inst.nome}:`, err)
    }
  }
}

// ── Verificação 3: Filas BullMQ travadas ──────────────────────────────────────

const FILA_FALHAS_CRITICO = 5

export async function verificarSaudeFilas(): Promise<void> {
  const filas = [
    { nome: "webhooks",      getQueue: getWebhookQueue },
    { nome: "grupo-eventos", getQueue: getGrupoEventosQueue },
  ]

  for (const { nome, getQueue } of filas) {
    try {
      const q = getQueue()
      const [failed, active, waiting] = await Promise.all([
        q.getFailedCount(),
        q.getActiveCount(),
        q.getWaitingCount(),
      ])

      const travada = failed >= FILA_FALHAS_CRITICO && active === 0 && waiting === 0

      if (travada) {
        await upsertAlerta({
          tipo: "fila_travada",
          nivel: "critico",
          titulo: `Fila "${nome}" com falhas`,
          mensagem: `${failed} jobs com falha e nenhum em processamento. O worker pode estar parado. Verifique com \`pm2 status\`.`,
          referencia_id: nome,
          referencia_nome: nome,
        })
      } else {
        await resolverAlerta("fila_travada", nome)
      }
    } catch {
      // Redis offline — tratado pelo badge da tela de filas, não criar alerta duplicado
    }
  }
}

// ── Execução principal ────────────────────────────────────────────────────────

/**
 * Runs all health checks in parallel.
 * Called by the BullMQ monitor worker every 5 minutes.
 */
export async function executarMonitoramento(): Promise<void> {
  console.log("[Monitor] Iniciando verificação de saúde...")
  await Promise.allSettled([
    verificarCampanhasSilenciosas(),
    verificarConexoesZApi(),
    verificarSaudeFilas(),
  ])
  console.log("[Monitor] Verificação concluída")
}
