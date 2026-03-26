// ── Z-API Instance — Shared Types ────────────────────────────────────────────

export interface ZApiInstance {
  id: string
  nome: string
  instance_id: string
  status: "ativo" | "inativo"
  webhook_token: string
  created_at: string
  cliente: { id: string; nome: string } | null
  grupos: ZApiGrupo[]
  _count?: { campanhas: number }
}

export interface ZApiGrupo {
  id: string
  nome_filtro: string
  grupo_wa_id: string | null
  tag_manychat_id: number
  tag_manychat_nome: string
  status: string
  auto_expand: boolean
  created_at: string
  campanha: { id: string; nome: string } | null
  conta_manychat: { id: string; nome: string } | null
  contas_monitoramento: Array<{
    id: string
    conta_manychat_id: string
    conta_manychat: { id: string; nome: string }
    tag_manychat_id: number
    tag_manychat_nome: string
  }>
  _count: { entradas: number } | null
}

export interface EntradaItem {
  id: string
  telefone: string
  nome_whatsapp: string | null
  entrou_at: string
  tag_aplicada: boolean
  lead: { id: string; nome: string; status: string } | null
  grupo: { nome_filtro: string; tag_manychat_nome: string }
}

export interface SaidaItem {
  id: string
  telefone: string
  nome_whatsapp: string | null
  saiu_at: string
  lead: { id: string; nome: string; status: string } | null
  grupo: { nome_filtro: string }
}

export interface EscanearDetalhe {
  nome: string
  grupoWaId: string
  acao: "criado" | "existente" | "sem_match"
  score: number
  templateNomeFiltro: string | null
  grupoId: string | null
  leads_count: number
}

export interface EscanearResult {
  total_grupos_zapi: number
  novos_vinculados: number
  ja_configurados: number
  sem_match: number
  detalhes: EscanearDetalhe[]
  entradas_processadas?: number
  erros_entradas?: number
  aviso?: string | null
}

export interface ZApiWaGroup {
  phone: string
  name: string
  isGroup: boolean
}

export interface ManychatTag {
  id: number
  name: string
}

export interface Campanha {
  id: string
  nome: string
}

export interface ContaManychat {
  id: string
  nome: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatDate(str: string | null) {
  if (!str) return "—"
  return new Date(str).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export function fmtDt(str: string | null) {
  if (!str) return null
  return new Date(str).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  })
}
