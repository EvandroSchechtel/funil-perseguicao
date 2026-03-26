"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Webhook, Copy, CheckCircle2, Plus, Trash2, ToggleLeft, ToggleRight,
  Info, GripVertical, FlaskConical, ChevronDown, ChevronRight, Tag, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { type WebhookItem, type Flow } from "./types"

interface WebhooksSectionProps {
  webhooks: WebhookItem[]
  loadingWebhooks: boolean
  accessToken: string | null
  canWrite: boolean
  onToggleWebhook: (w: WebhookItem) => void
  onToggleFlow: (flow: Flow, webhookId: string) => void
  onDeleteFlow: (flow: Flow, webhookId: string) => void
  onOpenTeste: (w: WebhookItem) => void
  onShowAddFlow: (webhookId: string) => void
  actionLoading: string | null
  webhooksCount: number
}

export function WebhooksSection({
  webhooks,
  loadingWebhooks,
  canWrite,
  onToggleWebhook,
  onToggleFlow,
  onDeleteFlow,
  onOpenTeste,
  onShowAddFlow,
  actionLoading,
  webhooksCount,
}: WebhooksSectionProps) {
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleCopy(url: string, wid: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(wid)
      setTimeout(() => setCopiedId(null), 2000)
      toast.success("URL copiada!")
    } catch {
      toast.error("Erro ao copiar.")
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">
        Webhooks{webhooksCount > 0 && <span className="text-[#3F3F58] normal-case ml-1">({webhooksCount})</span>}
      </p>
      {loadingWebhooks ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex items-center justify-center py-10 gap-3">
          <Webhook className="w-5 h-5 text-[#5A5A72]" />
          <p className="text-[#5A5A72] text-sm">Nenhum webhook nesta campanha</p>
        </div>
      ) : (
        webhooks.map((w) => {
          const expanded = expandedWebhook === w.id
          const activeFlows = w.webhook_flows?.filter((f) => f.status === "ativo") || []
          return (
            <div key={w.id} className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#1C1C28] transition-colors" onClick={() => setExpandedWebhook(expanded ? null : w.id)}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${w.status === "ativo" ? "bg-[#25D366]" : "bg-[#3F3F58]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[#F1F1F3] font-medium text-sm">{w.nome}</p>
                  <p className="text-[#5A5A72] text-xs font-mono mt-0.5 truncate">{w.url_publica}</p>
                </div>
                <Badge variant={w.status === "ativo" ? "ativo" : "inativo"} className="shrink-0">{w.status === "ativo" ? "Ativo" : "Inativo"}</Badge>
                <div className="flex items-center gap-3 shrink-0 text-[#8B8B9E] text-xs">
                  <span>{activeFlows.length} flows</span>
                  <span>{w.leads_count} leads</span>
                </div>
                <Link href={`/admin/webhooks/${w.id}`} onClick={(e) => e.stopPropagation()} className="p-1.5 text-[#5A5A72] hover:text-[#A78BFA] transition-colors shrink-0" title="Ver detalhes e fila">
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button onClick={(e) => { e.stopPropagation(); handleCopy(w.url_publica, w.id) }} className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors shrink-0" title="Copiar URL">
                  {copiedId === w.id ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                </button>
                {expanded ? <ChevronDown className="w-4 h-4 text-[#5A5A72] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#5A5A72] shrink-0" />}
              </div>
              {expanded && (
                <div className="border-t border-[#1E1E2A] px-5 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">Flows</p>
                    <div className="flex gap-2">
                      {activeFlows.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => onOpenTeste(w)}>
                          <FlaskConical className="w-3.5 h-3.5 mr-1" />Testar
                        </Button>
                      )}
                      <Button size="sm" onClick={() => onShowAddFlow(w.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Adicionar Flow
                      </Button>
                      <button onClick={() => onToggleWebhook(w)} className="text-[#5A5A72] hover:text-[#25D366] transition-colors p-1.5" title={w.status === "ativo" ? "Desativar webhook" : "Ativar webhook"}>
                        {w.status === "ativo" ? <ToggleRight className="w-5 h-5 text-[#25D366]" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {!w.webhook_flows || w.webhook_flows.length === 0 ? (
                    <div className="flex items-center gap-2 py-3">
                      <Info className="w-4 h-4 text-[#5A5A72] shrink-0" />
                      <p className="text-[#5A5A72] text-sm">Nenhum flow. Adicione um flow para este webhook receber leads.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {w.webhook_flows.map((flow) => (
                        <div key={flow.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#111118] border border-[#1E1E2A]">
                          <GripVertical className="w-4 h-4 text-[#2A2A3A] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[#C4C4D4] text-sm font-medium">{flow.conta?.nome ?? "Webhook externo"}</p>
                            <p className="text-[#5A5A72] text-xs font-mono">
                              {flow.tipo === "webhook"
                                ? (flow.webhook_url ? (flow.webhook_url.length > 40 ? flow.webhook_url.slice(0, 40) + "\u2026" : flow.webhook_url) : "\u2014")
                                : (flow.flow_nome || (flow.flow_ns ? (flow.flow_ns.length > 40 ? flow.flow_ns.slice(0, 40) + "\u2026" : flow.flow_ns) : "\u2014"))}
                            </p>
                            {flow.tag_manychat_nome && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#A78BFA] mt-0.5">
                                <Tag className="w-2.5 h-2.5" />{flow.tag_manychat_nome}
                              </span>
                            )}
                          </div>
                          <Badge variant={flow.status === "ativo" ? "ativo" : "inativo"}>{flow.status === "ativo" ? "Ativo" : "Inativo"}</Badge>
                          <span className="text-[#8B8B9E] text-xs shrink-0">{flow.total_enviados} enviados</span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => onToggleFlow(flow, w.id)} disabled={actionLoading === flow.id + "-toggle"} className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors disabled:opacity-50">
                              {flow.status === "ativo" ? <ToggleRight className="w-4 h-4 text-[#25D366]" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button onClick={() => onDeleteFlow(flow, w.id)} className="p-1.5 text-[#5A5A72] hover:text-[#F87171] transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Lead status summary */}
                  {w.leads_count > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-[#1E1E2A]">
                      <span className="text-[10px] text-[#5A5A72] uppercase tracking-wider font-semibold shrink-0">Leads:</span>
                      {[
                        { key: "sucesso",    label: "Sucesso",    color: "text-[#25D366] bg-[#25D366]/10" },
                        { key: "falha",      label: "Falha",      color: "text-[#F87171] bg-[#F87171]/10" },
                        { key: "sem_optin",  label: "Sem optin",  color: "text-[#F59E0B] bg-[#F59E0B]/10" },
                        { key: "pendente",   label: "Pendente",   color: "text-[#8B8B9E] bg-[#8B8B9E]/10" },
                        { key: "processando",label: "Processando",color: "text-[#60A5FA] bg-[#60A5FA]/10" },
                      ].map(({ key, label, color }) =>
                        (w.leads_status?.[key] ?? 0) > 0 ? (
                          <span key={key} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
                            {label}: {w.leads_status[key]}
                          </span>
                        ) : null
                      )}
                      <Link href={`/admin/webhooks/${w.id}`} className="ml-auto text-[10px] text-[#5A5A72] hover:text-[#A78BFA] transition-colors flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />Ver fila completa
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
