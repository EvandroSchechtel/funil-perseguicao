"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  User, Phone, Mail, Webhook, Zap, AlertTriangle, Send,
  Hash, Building2, Megaphone, ExternalLink, UserCheck, Users, LogIn, LogOut,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/layout/Header"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface LeadTentativa {
  id: string
  numero: number
  status: string
  erro_msg: string | null
  subscriber_id: string | null
  flow_ns: string | null
  conta_nome: string | null
  executado_at: string
}

interface LeadDetail {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: "pendente" | "processando" | "sucesso" | "falha" | "sem_optin" | "aguardando"
  erro_msg: string | null
  tentativas: number
  subscriber_id: string | null
  flow_executado: string | null
  conta_nome: string | null
  grupo_entrou_at: string | null
  grupo_saiu_at: string | null
  processado_at: string | null
  created_at: string
  updated_at: string
  webhook: { id: string; nome: string }
  campanha: { id: string; nome: string } | null
  webhook_flow: {
    id: string
    flow_ns: string
    flow_nome: string | null
    conta: { id: string; nome: string }
  } | null
  tentativas_hist: LeadTentativa[]
  entradas_grupo: Array<{
    id: string
    entrou_at: string
    tag_aplicada: boolean
    grupo: { nome_filtro: string }
  }>
  saidas_grupo: Array<{
    id: string
    saiu_at: string
    grupo: { nome_filtro: string }
  }>
}

const STATUS_CONFIG = {
  aguardando: {
    label: "Aguardando",
    icon: Clock,
    color: "text-[#F59E0B]",
    bg: "bg-[#1A1500]",
    border: "border-[#F59E0B]/40",
    description: "Campanha pausada — lead na fila de espera",
  },
  pendente: {
    label: "Pendente",
    icon: Clock,
    color: "text-[#F59E0B]",
    bg: "bg-[#2A2A1E]",
    border: "border-[#F59E0B]/30",
    description: "Aguardando processamento na fila",
  },
  processando: {
    label: "Processando",
    icon: Loader2,
    color: "text-[#60A5FA]",
    bg: "bg-[#1A1A2E]",
    border: "border-[#60A5FA]/30",
    description: "Sendo processado pelo worker agora",
  },
  sucesso: {
    label: "Flow Enviado",
    icon: CheckCircle2,
    color: "text-[#25D366]",
    bg: "bg-[#162516]",
    border: "border-[#25D366]/30",
    description: "Flow disparado com sucesso no Manychat",
  },
  falha: {
    label: "Falha",
    icon: XCircle,
    color: "text-[#F87171]",
    bg: "bg-[#2A1616]",
    border: "border-[#F87171]/30",
    description: "Erro no processamento — aguardando reprocessamento",
  },
  sem_optin: {
    label: "Sem Opt-in",
    icon: AlertTriangle,
    color: "text-[#F59E0B]",
    bg: "bg-[#2A2010]",
    border: "border-[#F59E0B]/30",
    description: "Contato não encontrado no Manychat — precisa fazer opt-in pelo WhatsApp",
  },
}

function formatDate(str: string | null | undefined) {
  if (!str) return null
  return new Date(str).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#1E1E2A] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[#1E1E2A] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[#5A5A72]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#5A5A72] font-medium uppercase tracking-wider">{label}</p>
        <div className="text-[#F1F1F3] text-sm mt-0.5 break-all">{value}</div>
      </div>
    </div>
  )
}

const TENTATIVA_STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  sucesso:   { icon: CheckCircle2,   color: "text-[#25D366]", label: "Flow enviado" },
  falha:     { icon: XCircle,        color: "text-[#F87171]", label: "Falhou" },
  sem_optin: { icon: AlertTriangle,  color: "text-[#F59E0B]", label: "Sem Opt-in" },
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, user } = useAuth()
  const router = useRouter()
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [showSubscriberForm, setShowSubscriberForm] = useState(false)
  const [subscriberInput, setSubscriberInput] = useState("")
  const [savingSubscriber, setSavingSubscriber] = useState(false)

  const canReprocess = user ? hasPermission(user.role, "leads:reprocess") : false

  const fetchLead = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    fetch(`/api/admin/leads/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Lead não encontrado")
        return res.json()
      })
      .then((data) => setLead(data.lead))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accessToken, id])

  useEffect(() => { fetchLead() }, [fetchLead])

  async function handleReprocess() {
    if (!lead) return
    setReprocessing(true)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/reprocessar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Lead reenfileirado com sucesso.")
        await fetchLead()
      } else {
        toast.error(data.message || "Erro ao reprocessar lead.")
      }
    } catch {
      toast.error("Erro ao reprocessar lead.")
    } finally {
      setReprocessing(false)
    }
  }

  async function handleSetSubscriberId() {
    if (!lead || !subscriberInput.trim()) return
    setSavingSubscriber(true)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ subscriber_id: subscriberInput.trim(), reprocess: true }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Subscriber ID salvo. Lead reenfileirado.")
        setShowSubscriberForm(false)
        setSubscriberInput("")
        await fetchLead()
      } else {
        toast.error(data.message || "Erro ao salvar subscriber ID.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSavingSubscriber(false)
    }
  }

  const statusCfg = lead ? STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.falha : null

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Leads", href: "/admin/leads" },
          { label: loading ? "..." : lead?.nome || "Detalhe" },
        ]}
      />

      <div className="p-6 max-w-3xl">
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-2 text-[#8B8B9E] hover:text-[#F1F1F3] text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Leads
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-10 text-center">
            <XCircle className="w-10 h-10 text-[#F87171] mx-auto mb-3" />
            <p className="text-[#F87171] font-medium">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Voltar
            </Button>
          </div>
        ) : lead && statusCfg ? (
          <div className="space-y-5">

            {/* ── Status Card ── */}
            <div className={`${statusCfg.bg} border ${statusCfg.border} rounded-xl p-5`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${statusCfg.bg} border ${statusCfg.border} flex items-center justify-center shrink-0`}>
                  <statusCfg.icon className={`w-6 h-6 ${statusCfg.color} ${lead.status === "processando" ? "animate-spin" : ""}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-lg font-bold ${statusCfg.color}`}>{statusCfg.label}</p>
                    {lead.tentativas > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E1E2A] text-[#5A5A72] border border-[#2A2A3A]">
                        {lead.tentativas} tentativa{lead.tentativas > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[#8B8B9E] text-sm mt-0.5">{statusCfg.description}</p>
                </div>
                {/* Refresh button for pending/processing */}
                {(lead.status === "pendente" || lead.status === "processando") && (
                  <Button variant="outline" size="sm" onClick={fetchLead} className="shrink-0">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Atualizar
                  </Button>
                )}
              </div>

              {/* Reprocess section */}
              {(lead.status === "falha" || lead.status === "sem_optin") && (
                <div className="mt-4 pt-4 border-t border-[#FFFFFF08] space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-[#8B8B9E]">
                      {!lead.webhook_flow ? (
                        <span className="text-[#F87171]">Reprocessamento indisponível — flow não encontrado para este lead.</span>
                      ) : !canReprocess ? (
                        <span>Você não tem permissão para reprocessar leads.</span>
                      ) : lead.status === "sem_optin" ? (
                        <span>Informe o Subscriber ID do Manychat abaixo, ou reprocesse após o contato fazer opt-in.</span>
                      ) : (
                        <span>Reenfileira o lead para uma nova tentativa de envio.</span>
                      )}
                    </div>
                    <Button
                      onClick={handleReprocess}
                      loading={reprocessing}
                      disabled={!canReprocess || !lead.webhook_flow}
                      className="shrink-0"
                      size="sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Reprocessar Lead
                    </Button>
                  </div>

                  {/* Manual subscriber_id override for sem_optin */}
                  {lead.status === "sem_optin" && canReprocess && (
                    <div className="bg-[#0B0B0F] border border-[#2A2A3A] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-[#C4C4D4]">
                          Informar Subscriber ID manualmente
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowSubscriberForm((v) => !v)}
                          className="text-xs text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                        >
                          {showSubscriberForm ? "Cancelar" : "Expandir"}
                        </button>
                      </div>
                      {!showSubscriberForm ? (
                        <p className="text-xs text-[#5A5A72]">
                          Se o subscriber já existe no Manychat mas não foi encontrado automaticamente, cole o subscriber_id aqui para vincular e disparar o flow.
                        </p>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs text-[#5A5A72]">
                            Encontre em Manychat → Contacts → selecione o contato → copie o ID da URL ou do perfil.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Ex: 7042882217"
                              value={subscriberInput}
                              onChange={(e) => setSubscriberInput(e.target.value)}
                              leftIcon={<UserCheck className="w-4 h-4" />}
                            />
                            <Button
                              onClick={handleSetSubscriberId}
                              loading={savingSubscriber}
                              disabled={!subscriberInput.trim()}
                              size="sm"
                              className="shrink-0"
                            >
                              <Send className="w-3.5 h-3.5 mr-1.5" />
                              Salvar e Executar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Lead Info ── */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-1">Dados do Lead</h2>
              <p className="text-[#5A5A72] text-xs mb-4">Informações recebidas pelo webhook</p>
              <InfoRow icon={User} label="Nome" value={lead.nome} />
              <InfoRow icon={Phone} label="Telefone" value={lead.telefone} />
              <InfoRow icon={Mail} label="Email" value={lead.email || <span className="text-[#5A5A72]">Não informado</span>} />
              <InfoRow
                icon={Hash}
                label="ID do Lead"
                value={<span className="font-mono text-xs text-[#8B8B9E]">{lead.id}</span>}
              />
              {lead.subscriber_id && (
                <InfoRow
                  icon={UserCheck}
                  label="Subscriber ID (Manychat)"
                  value={<span className="font-mono text-xs text-[#25D366]">{lead.subscriber_id}</span>}
                />
              )}
              <InfoRow
                icon={Users}
                label="Entrou no Grupo WA"
                value={
                  lead.grupo_entrou_at ? (
                    <span className="inline-flex items-center gap-1.5 text-[#25D366] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sim — {formatDate(lead.grupo_entrou_at)}
                    </span>
                  ) : (
                    <span className="text-[#5A5A72]">Ainda não entrou</span>
                  )
                }
              />
              <InfoRow
                icon={Users}
                label="Saiu do Grupo WA"
                value={
                  lead.grupo_saiu_at ? (
                    <span className="inline-flex items-center gap-1.5 text-[#EF4444] font-medium">
                      <XCircle className="w-3.5 h-3.5" />
                      Sim — {formatDate(lead.grupo_saiu_at)}
                    </span>
                  ) : (
                    <span className="text-[#5A5A72]">—</span>
                  )
                }
              />
            </div>

            {/* ── Origem & Flow ── */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-1">Origem & Flow</h2>
              <p className="text-[#5A5A72] text-xs mb-4">Por onde o lead entrou e qual flow foi acionado</p>
              <InfoRow
                icon={Webhook}
                label="Webhook"
                value={
                  <Link href={`/admin/webhooks/${lead.webhook.id}/editar`} className="text-[#25D366] hover:underline inline-flex items-center gap-1">
                    {lead.webhook.nome}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                }
              />
              {lead.campanha && (
                <InfoRow
                  icon={Megaphone}
                  label="Campanha"
                  value={
                    <Link href={`/admin/campanhas/${lead.campanha.id}/editar`} className="text-[#A78BFA] hover:underline inline-flex items-center gap-1">
                      {lead.campanha.nome}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  }
                />
              )}
              {lead.webhook_flow ? (
                <>
                  <InfoRow
                    icon={Building2}
                    label="Conta Manychat"
                    value={lead.conta_nome || lead.webhook_flow.conta.nome}
                  />
                  <InfoRow
                    icon={Zap}
                    label="Flow"
                    value={
                      <div>
                        {lead.webhook_flow.flow_nome && (
                          <p className="text-[#F1F1F3]">{lead.webhook_flow.flow_nome}</p>
                        )}
                        <p className="font-mono text-xs text-[#8B8B9E] mt-0.5">{lead.flow_executado || lead.webhook_flow.flow_ns}</p>
                      </div>
                    }
                  />
                </>
              ) : (
                <InfoRow
                  icon={Zap}
                  label="Conta Manychat"
                  value={lead.conta_nome || <span className="text-[#5A5A72]">—</span>}
                />
              )}
            </div>

            {/* ── Histórico de Tentativas ── */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[#F1F1F3] font-semibold">Histórico de Tentativas</h2>
                {lead.tentativas > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E1E2A] text-[#5A5A72] border border-[#2A2A3A]">
                    {lead.tentativas} tentativa{lead.tentativas !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-[#5A5A72] text-xs mb-5">Cada execução do worker registrada em ordem cronológica</p>

              {/* Lead received event */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-[#1E1E2A] border border-[#2A2A3A] flex items-center justify-center shrink-0">
                    <Webhook className="w-3.5 h-3.5 text-[#60A5FA]" />
                  </div>
                  {(lead.tentativas_hist.length > 0) && <div className="w-px flex-1 bg-[#1E1E2A] my-1" />}
                </div>
                <div className="pb-5 flex-1 min-w-0">
                  <p className="text-[#F1F1F3] text-sm font-medium">Lead recebido</p>
                  <p className="text-[#8B8B9E] text-xs mt-0.5">
                    {lead.webhook.nome}{lead.campanha ? ` · ${lead.campanha.nome}` : ""}
                    {lead.webhook_flow && ` · Flow: ${lead.webhook_flow.flow_nome || lead.webhook_flow.flow_ns}`}
                  </p>
                  <p className="text-[#3A3A52] text-xs mt-1">{formatDate(lead.created_at)}</p>
                </div>
              </div>

              {lead.tentativas_hist.length === 0 ? (
                <p className="text-[#5A5A72] text-xs text-center py-4">Nenhuma tentativa registrada ainda</p>
              ) : (
                lead.tentativas_hist.map((t, i) => {
                  const cfg = TENTATIVA_STATUS_CONFIG[t.status] ?? TENTATIVA_STATUS_CONFIG.falha
                  const Icon = cfg.icon
                  const isLast = i === lead.tentativas_hist.length - 1
                  return (
                    <div key={t.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-[#1E1E2A] border border-[#2A2A3A] flex items-center justify-center shrink-0">
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-[#1E1E2A] my-1" />}
                      </div>
                      <div className="pb-5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${cfg.color}`}>Tentativa {t.numero} — {cfg.label}</p>
                        </div>
                        {t.conta_nome && (
                          <p className="text-[#8B8B9E] text-xs mt-0.5">Conta: {t.conta_nome}</p>
                        )}
                        {t.flow_ns && (
                          <p className="font-mono text-xs text-[#5A5A72] mt-0.5">{t.flow_ns}</p>
                        )}
                        {t.subscriber_id && (
                          <p className="text-xs text-[#25D366] mt-0.5">subscriber_id: <span className="font-mono">{t.subscriber_id}</span></p>
                        )}
                        {t.erro_msg && (
                          <p className="text-xs font-mono text-[#F87171] bg-[#1A1010] border border-[#F87171]/20 rounded px-2 py-1 mt-1.5 break-all">
                            {t.erro_msg}
                          </p>
                        )}
                        <p className="text-[#3A3A52] text-xs mt-1.5">{formatDate(t.executado_at)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ── Histórico de Grupos ── */}
            {(lead.entradas_grupo.length > 0 || lead.saidas_grupo.length > 0) && (() => {
              const historico = [
                ...lead.entradas_grupo.map((e) => ({
                  id: e.id, tipo: "entrada" as const,
                  data: e.entrou_at, grupo: e.grupo.nome_filtro, tag_aplicada: e.tag_aplicada,
                })),
                ...lead.saidas_grupo.map((s) => ({
                  id: s.id, tipo: "saida" as const,
                  data: s.saiu_at, grupo: s.grupo.nome_filtro, tag_aplicada: null,
                })),
              ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

              return (
                <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                  <div className="px-5 pt-5 pb-3">
                    <h2 className="text-[#F1F1F3] font-semibold">Histórico de Grupos</h2>
                    <p className="text-[#5A5A72] text-xs mt-1">Entradas e saídas registradas nos grupos monitorados</p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-t border-[#1E1E2A]">
                        {["Evento", "Grupo", "Data"].map((h) => (
                          <th key={h} className="text-left text-[10px] font-semibold text-[#3F3F58] uppercase tracking-wider px-5 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((ev) => (
                        <tr key={`${ev.tipo}-${ev.id}`} className="border-t border-[#1E1E2A] hover:bg-[#121220] transition-colors">
                          <td className="px-5 py-3">
                            {ev.tipo === "entrada" ? (
                              <span className="inline-flex items-center gap-1.5 text-[#22C55E] text-sm font-medium">
                                <LogIn className="w-3.5 h-3.5" /> Entrada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[#EF4444] text-sm font-medium">
                                <LogOut className="w-3.5 h-3.5" /> Saída
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-[#9898B0] text-sm">{ev.grupo}</td>
                          <td className="px-5 py-3 text-[#7F7F9E] text-sm whitespace-nowrap">{formatDate(ev.data)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {/* ── Datas ── */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-4">Datas</h2>
              <InfoRow icon={Clock} label="Recebido em" value={formatDate(lead.created_at) || "—"} />
              <InfoRow icon={Clock} label="Processado em" value={formatDate(lead.processado_at) || "—"} />
              <InfoRow icon={Clock} label="Última atualização" value={formatDate(lead.updated_at) || "—"} />
            </div>

          </div>
        ) : null}
      </div>
    </div>
  )
}
