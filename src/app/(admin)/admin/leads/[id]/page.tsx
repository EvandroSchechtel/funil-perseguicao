"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, User, Phone, Mail, Webhook, Zap } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

interface LeadDetail {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: "pendente" | "processando" | "sucesso" | "falha"
  erro_msg: string | null
  tentativas: number
  processado_at: string | null
  created_at: string
  updated_at: string
  webhook: {
    id: string
    nome: string
    flow_ns: string
    conta: { id: string; nome: string }
  }
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
    bg: "bg-[#1E1E2A]",
    border: "border-[#60A5FA]/30",
    description: "Sendo processado pelo worker agora",
  },
  sucesso: {
    label: "Sucesso",
    icon: CheckCircle2,
    color: "text-[#25D366]",
    bg: "bg-[#162516]",
    border: "border-[#25D366]/30",
    description: "Flow enviado com sucesso no Manychat",
  },
  falha: {
    label: "Falha",
    icon: XCircle,
    color: "text-[#F87171]",
    bg: "bg-[#2A1616]",
    border: "border-[#F87171]/30",
    description: "Erro no processamento",
  },
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#1E1E2A] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[#1E1E2A] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[#5A5A72]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#5A5A72] font-medium uppercase tracking-wider">{label}</p>
        <div className="text-[#F1F1F3] text-sm mt-0.5">{value}</div>
      </div>
    </div>
  )
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

  useEffect(() => {
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
        // Refresh lead data
        const refreshRes = await fetch(`/api/admin/leads/${lead.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          setLead(refreshData.lead)
        }
      } else {
        toast.error(data.message || "Erro ao reprocessar lead.")
      }
    } catch {
      toast.error("Erro ao reprocessar lead.")
    } finally {
      setReprocessing(false)
    }
  }

  function formatDate(str: string | null) {
    if (!str) return "—"
    return new Date(str).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
  }

  const statusCfg = lead ? STATUS_CONFIG[lead.status] : null

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Leads", href: "/admin/leads" },
          { label: loading ? "..." : lead?.nome || "Detalhe" },
        ]}
      />

      <div className="p-6 max-w-2xl">
        {/* Back button */}
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
            {/* Status Card */}
            <div className={`${statusCfg.bg} border ${statusCfg.border} rounded-xl p-5 flex items-center gap-4`}>
              <div className={`w-12 h-12 rounded-xl ${statusCfg.bg} border ${statusCfg.border} flex items-center justify-center shrink-0`}>
                <statusCfg.icon className={`w-6 h-6 ${statusCfg.color} ${lead.status === "processando" ? "animate-spin" : ""}`} />
              </div>
              <div className="flex-1">
                <p className={`text-lg font-bold ${statusCfg.color}`}>{statusCfg.label}</p>
                <p className="text-[#8B8B9E] text-sm">{statusCfg.description}</p>
              </div>
              {lead.status === "falha" && canReprocess && (
                <Button
                  onClick={handleReprocess}
                  loading={reprocessing}
                  className="shrink-0"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reprocessar
                </Button>
              )}
            </div>

            {/* Error message */}
            {lead.status === "falha" && lead.erro_msg && (
              <div className="bg-[#2A1616] border border-[#F87171]/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-[#F87171] uppercase tracking-wider mb-2">Mensagem de Erro</p>
                <p className="text-sm text-[#F1A1A1] font-mono break-all">{lead.erro_msg}</p>
              </div>
            )}

            {/* Lead info */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-4">Dados do Lead</h2>
              <InfoRow icon={User} label="Nome" value={lead.nome} />
              <InfoRow icon={Phone} label="Telefone" value={lead.telefone} />
              <InfoRow icon={Mail} label="Email" value={lead.email || <span className="text-[#5A5A72]">Não informado</span>} />
            </div>

            {/* Webhook / Flow info */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-4">Origem & Flow</h2>
              <InfoRow
                icon={Webhook}
                label="Webhook"
                value={
                  <Link href={`/admin/webhooks/${lead.webhook.id}/editar`} className="text-[#25D366] hover:underline">
                    {lead.webhook.nome}
                  </Link>
                }
              />
              <InfoRow icon={Zap} label="Conta Manychat" value={lead.webhook.conta.nome} />
              <InfoRow
                icon={Zap}
                label="Flow NS"
                value={<span className="font-mono text-xs text-[#8B8B9E]">{lead.webhook.flow_ns}</span>}
              />
            </div>

            {/* Timeline */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#F1F1F3] font-semibold mb-4">Histórico</h2>
              <InfoRow icon={Clock} label="Recebido em" value={formatDate(lead.created_at)} />
              <InfoRow icon={Clock} label="Última atualização" value={formatDate(lead.updated_at)} />
              <InfoRow icon={Clock} label="Processado em" value={formatDate(lead.processado_at)} />
              <InfoRow
                icon={RefreshCw}
                label="Tentativas"
                value={
                  <span className={lead.tentativas >= 3 ? "text-[#F87171]" : "text-[#F1F1F3]"}>
                    {lead.tentativas} {lead.tentativas === 1 ? "tentativa" : "tentativas"}
                  </span>
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
