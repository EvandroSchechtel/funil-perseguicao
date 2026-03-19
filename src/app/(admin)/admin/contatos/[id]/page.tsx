"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Phone, Mail, Hash, Zap, Megaphone, Webhook } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"

interface ContatoConta {
  id: string
  subscriber_id: string | null
  campanha_id: string | null
  created_at: string
  conta: { id: string; nome: string; page_name: string | null }
}

interface LeadSummary {
  id: string
  status: string
  tentativas: number
  processado_at: string | null
  created_at: string
  flow_executado: string | null
  conta_nome: string | null
  erro_msg: string | null
  webhook: { id: string; nome: string }
  campanha: { id: string; nome: string } | null
}

interface ContatoDetail {
  id: string
  telefone: string
  nome: string
  email: string | null
  created_at: string
  updated_at: string
  contas_vinculadas: ContatoConta[]
  leads: LeadSummary[]
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  sucesso:     { icon: CheckCircle2,  color: "text-[#25D366]", label: "Sucesso" },
  falha:       { icon: XCircle,       color: "text-[#F87171]", label: "Falha" },
  sem_optin:   { icon: AlertTriangle, color: "text-[#F59E0B]", label: "Sem Opt-in" },
  processando: { icon: Loader2,       color: "text-[#60A5FA]", label: "Processando" },
  pendente:    { icon: Clock,         color: "text-[#8B8B9E]", label: "Pendente" },
}

function fmt(str: string | null | undefined) {
  if (!str) return "—"
  return new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function ContatoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const [contato, setContato] = useState<ContatoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContato = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    fetch(`/api/admin/contatos/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => { if (!r.ok) throw new Error("Contato não encontrado"); return r.json() })
      .then((d) => setContato(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accessToken, id])

  useEffect(() => { fetchContato() }, [fetchContato])

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Contatos", href: "/admin/contatos" },
        { label: loading ? "..." : contato?.nome || "Detalhe" },
      ]} />

      <div className="p-6 max-w-3xl space-y-5">
        <Link href="/admin/contatos" className="inline-flex items-center gap-2 text-[#8B8B9E] hover:text-[#F1F1F3] text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar para Contatos
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-10 text-center">
            <p className="text-[#F87171]">{error}</p>
          </div>
        ) : contato ? (
          <>
            {/* Identity */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-4">Identidade do Contato</h2>
              <div className="flex items-center gap-3 py-2 border-b border-[#1E1E2A]">
                <Phone className="w-4 h-4 text-[#5A5A72]" />
                <span className="text-xs text-[#5A5A72] uppercase tracking-wider w-24">Telefone</span>
                <span className="font-mono text-[#25D366] text-sm">{contato.telefone}</span>
              </div>
              <div className="flex items-center gap-3 py-2 border-b border-[#1E1E2A]">
                <Hash className="w-4 h-4 text-[#5A5A72]" />
                <span className="text-xs text-[#5A5A72] uppercase tracking-wider w-24">Nome</span>
                <span className="text-[#F1F1F3] text-sm">{contato.nome}</span>
              </div>
              {contato.email && (
                <div className="flex items-center gap-3 py-2 border-b border-[#1E1E2A]">
                  <Mail className="w-4 h-4 text-[#5A5A72]" />
                  <span className="text-xs text-[#5A5A72] uppercase tracking-wider w-24">Email</span>
                  <span className="text-[#F1F1F3] text-sm">{contato.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 py-2">
                <Clock className="w-4 h-4 text-[#5A5A72]" />
                <span className="text-xs text-[#5A5A72] uppercase tracking-wider w-24">1ª entrada</span>
                <span className="text-[#8B8B9E] text-sm">{fmt(contato.created_at)}</span>
              </div>
            </div>

            {/* Contas Manychat vinculadas */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-1">Contas Manychat</h2>
              <p className="text-[#5A5A72] text-xs mb-4">Contas onde este contato foi identificado como subscriber</p>
              {contato.contas_vinculadas.length === 0 ? (
                <p className="text-[#5A5A72] text-sm">Nenhuma conta vinculada ainda — ocorre após o primeiro flow enviado com sucesso.</p>
              ) : (
                <div className="space-y-3">
                  {contato.contas_vinculadas.map((cv) => (
                    <div key={cv.id} className="flex items-center gap-3 bg-[#1C1C28] border border-[#1E1E2A] rounded-lg px-4 py-3">
                      <Zap className="w-4 h-4 text-[#25D366] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#F1F1F3] text-sm font-medium">{cv.conta.nome}</p>
                        {cv.conta.page_name && <p className="text-[#8B8B9E] text-xs">{cv.conta.page_name}</p>}
                      </div>
                      {cv.subscriber_id ? (
                        <div className="text-right">
                          <p className="text-xs text-[#5A5A72]">subscriber_id</p>
                          <p className="font-mono text-xs text-[#25D366]">{cv.subscriber_id}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-[#5A5A72]">sem subscriber_id</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Histórico de campanhas */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-1">Histórico de Campanhas</h2>
              <p className="text-[#5A5A72] text-xs mb-4">Todas as interações deste contato no sistema</p>
              {contato.leads.length === 0 ? (
                <p className="text-[#5A5A72] text-sm">Nenhuma interação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {contato.leads.map((lead) => {
                    const cfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.pendente
                    const Icon = cfg.icon
                    return (
                      <Link key={lead.id} href={`/admin/leads/${lead.id}`} className="flex items-center gap-4 bg-[#1C1C28] border border-[#1E1E2A] hover:border-[#2A2A3A] rounded-lg px-4 py-3 transition-colors group">
                        <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {lead.campanha && (
                              <span className="text-xs text-[#A78BFA] flex items-center gap-1">
                                <Megaphone className="w-3 h-3" />{lead.campanha.nome}
                              </span>
                            )}
                            <span className="text-xs text-[#5A5A72] flex items-center gap-1">
                              <Webhook className="w-3 h-3" />{lead.webhook.nome}
                            </span>
                            {lead.conta_nome && (
                              <span className="text-xs text-[#5A5A72] flex items-center gap-1">
                                <Zap className="w-3 h-3" />{lead.conta_nome}
                              </span>
                            )}
                          </div>
                          {lead.erro_msg && (
                            <p className="text-xs text-[#F87171] mt-0.5 truncate">{lead.erro_msg}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                          <p className="text-xs text-[#5A5A72]">{fmt(lead.processado_at || lead.created_at)}</p>
                          <p className="text-xs text-[#3A3A52]">{lead.tentativas} tent.</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
