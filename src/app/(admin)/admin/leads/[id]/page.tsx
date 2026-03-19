"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  User, Phone, Mail, Webhook, Zap, AlertTriangle, Send,
  Hash, Building2, Megaphone, ExternalLink, UserCheck,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

interface LeadDetail {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: "pendente" | "processando" | "sucesso" | "falha" | "sem_optin"
  erro_msg: string | null
  tentativas: number
  subscriber_id: string | null
  flow_executado: string | null
  conta_nome: string | null
  manychat_log: unknown
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
}

const STATUS_CONFIG = {
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

interface TimelineEvent {
  at: string
  icon: React.ElementType
  iconColor: string
  title: string
  description?: string
  mono?: string
}

function buildTimeline(lead: LeadDetail): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // 1. Lead received
  events.push({
    at: lead.created_at,
    icon: Webhook,
    iconColor: "text-[#60A5FA]",
    title: "Lead recebido via Webhook",
    description: `Webhook: ${lead.webhook.nome}${lead.campanha ? ` · Campanha: ${lead.campanha.nome}` : ""}`,
  })

  // 2. Flow assigned
  if (lead.webhook_flow) {
    events.push({
      at: lead.created_at,
      icon: Zap,
      iconColor: "text-[#A78BFA]",
      title: "Flow selecionado pelo rodízio",
      description: `${lead.webhook_flow.flow_nome || lead.webhook_flow.flow_ns} · Conta: ${lead.webhook_flow.conta.nome}`,
      mono: lead.webhook_flow.flow_ns,
    })
  }

  // 3. Processing attempts (tentativas > 0 means it was picked up)
  if (lead.tentativas > 0) {
    events.push({
      at: lead.updated_at,
      icon: Loader2,
      iconColor: "text-[#60A5FA]",
      title: `${lead.tentativas} tentativa${lead.tentativas > 1 ? "s" : ""} de processamento`,
      description:
        lead.tentativas > 1
          ? `Foram realizadas ${lead.tentativas} tentativas com backoff exponencial (5s, 25s, 125s)`
          : "Processamento iniciado pelo worker",
    })
  }

  // 4. Sem optin
  if (lead.status === "sem_optin") {
    events.push({
      at: lead.updated_at,
      icon: AlertTriangle,
      iconColor: "text-[#F59E0B]",
      title: "Contato sem opt-in no Manychat",
      description:
        "O número de telefone não foi encontrado como subscriber no Manychat. O contato precisa iniciar uma conversa pelo WhatsApp para habilitar o envio de flows.",
    })
  }

  // 5. Error
  if (lead.status === "falha" && lead.erro_msg) {
    events.push({
      at: lead.updated_at,
      icon: XCircle,
      iconColor: "text-[#F87171]",
      title: "Erro no processamento",
      mono: lead.erro_msg,
    })
  }

  // 6. Success
  if (lead.status === "sucesso" && lead.processado_at) {
    events.push({
      at: lead.processado_at,
      icon: Send,
      iconColor: "text-[#25D366]",
      title: "Flow disparado com sucesso",
      description: `Conta: ${lead.conta_nome || lead.webhook_flow?.conta.nome || "—"} · Flow: ${lead.flow_executado || lead.webhook_flow?.flow_ns || "—"}`,
    })

    if (lead.subscriber_id) {
      events.push({
        at: lead.processado_at,
        icon: UserCheck,
        iconColor: "text-[#25D366]",
        title: "Subscriber identificado no Manychat",
        description: "ID do subscriber registrado no lead",
        mono: lead.subscriber_id,
      })
    }
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, user } = useAuth()
  const router = useRouter()
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState(false)

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
                <div className="mt-4 pt-4 border-t border-[#FFFFFF08] flex items-center justify-between gap-3">
                  <div className="text-xs text-[#8B8B9E]">
                    {!lead.webhook_flow ? (
                      <span className="text-[#F87171]">Reprocessamento indisponível — flow não encontrado para este lead.</span>
                    ) : !canReprocess ? (
                      <span>Você não tem permissão para reprocessar leads.</span>
                    ) : lead.status === "sem_optin" ? (
                      <span>O contato precisará ter feito opt-in no WhatsApp antes de reprocessar.</span>
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

            {/* ── Timeline / Histórico ── */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-1">Histórico de Ações</h2>
              <p className="text-[#5A5A72] text-xs mb-5">Linha do tempo completa do processamento deste lead</p>

              <div className="relative">
                {buildTimeline(lead).map((event, i, arr) => {
                  const Icon = event.icon
                  const isLast = i === arr.length - 1
                  return (
                    <div key={i} className="flex gap-4">
                      {/* Spine */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full bg-[#1E1E2A] border border-[#2A2A3A] flex items-center justify-center shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${event.iconColor}`} />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-[#1E1E2A] my-1" />}
                      </div>
                      {/* Content */}
                      <div className={`pb-5 flex-1 min-w-0 ${isLast ? "" : ""}`}>
                        <p className="text-[#F1F1F3] text-sm font-medium">{event.title}</p>
                        {event.description && (
                          <p className="text-[#8B8B9E] text-xs mt-0.5">{event.description}</p>
                        )}
                        {event.mono && (
                          <p className="text-xs font-mono text-[#A78BFA] bg-[#1A1A28] border border-[#2A2A3A] rounded px-2 py-1 mt-1.5 break-all">
                            {event.mono}
                          </p>
                        )}
                        <p className="text-[#3A3A52] text-xs mt-1.5">
                          {formatDate(event.at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

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
