export interface CampanhaData {
  id: string
  nome: string
  descricao: string | null
  status: "ativo" | "inativo"
  pausado_at: string | null
  data_inicio: string | null
  data_fim: string | null
  created_at: string
  updated_at: string
  webhooks_count: number
  leads_count: number
  aguardando_count: number
  grupos_entrados_count: number
  usuario: { nome: string }
  cliente: { id: string; nome: string } | null
  instancia_zapi: { id: string; nome: string; status: string } | null
  ultima_varredura_at: string | null
}

export interface InstanciaOption {
  id: string
  nome: string
  status: string
}

export interface Flow {
  id: string
  tipo: string
  flow_ns: string | null
  flow_nome: string | null
  webhook_url: string | null
  ordem: number
  total_enviados: number
  status: "ativo" | "inativo"
  tag_manychat_id: number | null
  tag_manychat_nome: string | null
  conta: { id: string; nome: string; page_name: string | null } | null
}

export interface WebhookItem {
  id: string
  nome: string
  token: string
  status: "ativo" | "inativo"
  url_publica: string
  leads_count: number
  leads_status: Record<string, number>
  webhook_flows: Flow[]
}

export interface LeadItem {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: string
  erro_msg: string | null
  tentativas: number
  subscriber_id: string | null
  flow_executado: string | null
  conta_nome: string | null
  grupo_entrou_at: string | null
  grupo_saiu_at: string | null
  processado_at: string | null
  created_at: string
  webhook: { nome: string } | null
}

export type TesteResultado = { ok: true; lead_id: string } | { ok: false; message: string } | null

export interface GrupoMonitoramento {
  id: string
  nome_filtro: string
  grupo_wa_id: string | null
  tag_manychat_nome: string
  status: string
  auto_expand: boolean
  created_at: string
  instancia: { id: string; nome: string }
  conta_manychat: { id: string; nome: string }
  contas_monitoramento: Array<{
    conta_manychat_id: string
    conta_manychat: { id: string; nome: string }
    tag_manychat_id: number
    tag_manychat_nome: string
  }>
  _count: { entradas: number }
}

export interface VarreduraResult {
  grupos_varridos: number
  grupos_sem_id: number
  total_membros: number
  leads_encontrados: number
  ja_processados: number
  tags_aplicadas: number
  erros: number
  proxima_varredura_em: string
  aviso_24h?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatDate(str: string | null) {
  if (!str) return "—"
  return new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function fmtDt(str: string | null) {
  if (!str) return null
  return new Date(str).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  })
}

export function leadStatusStyle(status: string): { border: string; badge: string; bg: string } {
  switch (status) {
    case "sucesso": return { border: "border-l-[#25D366]", badge: "bg-[#25D366]/15 text-[#25D366]", bg: "" }
    case "falha":   return { border: "border-l-[#F87171]", badge: "bg-[#F87171]/15 text-[#F87171]", bg: "" }
    case "sem_optin": return { border: "border-l-[#F59E0B]", badge: "bg-[#F59E0B]/15 text-[#F59E0B]", bg: "" }
    case "processando": return { border: "border-l-[#60A5FA]", badge: "bg-[#60A5FA]/15 text-[#60A5FA]", bg: "" }
    case "aguardando": return { border: "border-l-[#F59E0B]", badge: "bg-[#F59E0B]/15 text-[#F59E0B]", bg: "" }
    default: return { border: "border-l-[#8B8B9E]", badge: "bg-[#8B8B9E]/15 text-[#8B8B9E]", bg: "" }
  }
}
