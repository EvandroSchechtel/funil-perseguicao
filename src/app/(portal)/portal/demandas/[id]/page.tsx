"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { ArrowLeft, Send, Loader2, AlertCircle, Radio, CheckCircle2, Clock, User, MessageSquare, AlertTriangle, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comentario {
  id: string
  texto: string
  interno: boolean
  autor_id: string
  created_at: string
}

interface Evento {
  id: string
  tipo: string
  descricao: string
  meta: Record<string, unknown> | null
  usuario_id: string | null
  usuario: { id: string; nome: string } | null
  created_at: string
}

interface Demanda {
  id: string
  titulo: string
  descricao: string
  tipo: string
  status: string
  prioridade: string
  responsavel: { id: string; nome: string } | null
  criador: { id: string; nome: string; role: string }
  created_at: string
  updated_at: string
  comentarios: Comentario[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const tipoLabels: Record<string, string> = {
  nova_campanha: "Nova Campanha",
  ajuste_funil: "Ajuste de Funil",
  relatorio_customizado: "Relatório",
  suporte_tecnico: "Suporte",
  outro: "Outro",
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  aberta: { label: "Aberta", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  em_analise: { label: "Em Análise", color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  em_execucao: { label: "Em Execução", color: "#25D366", bg: "rgba(37,211,102,0.12)" },
  aguardando_cliente: { label: "Aguardando Resposta", color: "#F97316", bg: "rgba(249,115,22,0.12)" },
  concluida: { label: "Concluída", color: "#5A5A72", bg: "rgba(90,90,114,0.12)" },
  cancelada: { label: "Cancelada", color: "#F87171", bg: "rgba(248,113,113,0.12)" },
}

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente",
}

const statusTimeline = [
  { key: "aberta", label: "Aberta" },
  { key: "em_analise", label: "Em Análise" },
  { key: "em_execucao", label: "Em Execução" },
  { key: "concluida", label: "Concluída" },
]

const eventoIcons: Record<string, React.ReactNode> = {
  criada: <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />,
  status_alterado: <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />,
  prioridade_alterada: <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24]" />,
  atribuido: <User className="w-3.5 h-3.5 text-[#A78BFA]" />,
  comentario: <MessageSquare className="w-3.5 h-3.5 text-[#8B8B9E]" />,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(str: string): string {
  return new Date(str).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatRelative(str: string): string {
  const diff = Math.floor((Date.now() - new Date(str).getTime()) / 1000)
  if (diff < 60) return "agora"
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function getInitials(nome: string): string {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "#8B8B9E", bg: "rgba(139,139,158,0.12)" }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

function StatusTimeline({ status }: { status: string }) {
  const activeIdx = statusTimeline.findIndex((s) => s.key === status)
  const cancelled = status === "cancelada"

  return (
    <div className="flex items-center gap-0">
      {statusTimeline.map((step, idx) => {
        const isActive = idx === activeIdx && !cancelled
        const isDone = idx < activeIdx && !cancelled
        const isLast = idx === statusTimeline.length - 1
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                isActive ? "border-[#25D366] bg-[#25D366]/20 text-[#25D366]"
                  : isDone ? "border-[#25D366] bg-[#25D366] text-black"
                  : "border-[#1E1E2A] bg-[#111118] text-[#5A5A72]"
              }`}>{isDone ? "✓" : idx + 1}</div>
              <span className={`text-xs mt-1 whitespace-nowrap ${
                isActive ? "text-[#25D366] font-medium" : isDone ? "text-[#C4C4D4]" : "text-[#5A5A72]"
              }`}>{step.label}</span>
            </div>
            {!isLast && (
              <div className={`h-0.5 flex-1 min-w-[20px] mx-1 mb-5 transition-all ${isDone ? "bg-[#25D366]" : "bg-[#1E1E2A]"}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function CommentBubble({ comentario, currentUserId }: { comentario: Comentario; currentUserId: string }) {
  const isOwn = comentario.autor_id === currentUserId

  return (
    <div className={`flex gap-3 ${!isOwn ? "flex-row" : "flex-row-reverse"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        !isOwn ? "bg-[#25D366]/15 text-[#25D366]" : "bg-[#60A5FA]/15 text-[#60A5FA]"
      }`}>
        {isOwn ? "Eu" : "Eq"}
      </div>
      <div className={`max-w-[80%] flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
        <span className="text-xs text-[#5A5A72]">{formatDateTime(comentario.created_at)}</span>
        <div className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          !isOwn
            ? "bg-[#1E1E2A] text-[#C4C4D4] rounded-tl-none"
            : "bg-[#25D366]/10 text-[#F1F1F3] border border-[#25D366]/20 rounded-tr-none"
        }`}>
          {comentario.texto}
        </div>
      </div>
    </div>
  )
}

function EventoItem({ evento }: { evento: Evento }) {
  const icon = eventoIcons[evento.tipo] ?? <Tag className="w-3.5 h-3.5 text-[#5A5A72]" />
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-[#111118] border border-[#1E1E2A] flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#C4C4D4] text-sm">{evento.descricao}</p>
        {evento.usuario && (
          <p className="text-[#5A5A72] text-xs">por {evento.usuario.nome}</p>
        )}
      </div>
      <span className="text-[#5A5A72] text-xs shrink-0">{formatRelative(evento.created_at)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 15000 // 15s

export default function PortalDemandaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, user } = useAuth()

  const [demanda, setDemanda] = useState<Demanda | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [comentario, setComentario] = useState("")
  const [isLive, setIsLive] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!accessToken || !id) return
    if (!silent) setLoading(true)
    try {
      const [demandaRes, eventosRes] = await Promise.all([
        fetch(`/api/portal/demandas/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/portal/demandas/${id}/atividade`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      if (!demandaRes.ok) throw new Error()
      const demandaData = await demandaRes.json()
      const eventosData = eventosRes.ok ? await eventosRes.json() : { eventos: [] }

      setDemanda((prev) => {
        // Detect new comments silently
        if (silent && prev && demandaData.demanda.comentarios.length > prev.comentarios.length) {
          toast.info("Nova resposta da equipe!", { duration: 3000 })
        }
        return demandaData.demanda
      })
      setEventos(eventosData.eventos ?? [])
    } catch {
      if (!silent) toast.error("Erro ao carregar demanda.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [accessToken, id])

  // Initial load
  useEffect(() => { fetchData() }, [fetchData])

  // Auto-poll
  useEffect(() => {
    const interval = setInterval(() => {
      setIsLive(true)
      fetchData(true).finally(() => setTimeout(() => setIsLive(false), 500))
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  // Scroll to bottom when comments change
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [demanda?.comentarios.length])

  async function handleSendComment() {
    if (!comentario.trim() || !accessToken || !id) return
    setSending(true)
    try {
      const res = await fetch(`/api/portal/demandas/${id}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ texto: comentario.trim() }),
      })
      if (!res.ok) throw new Error()
      setComentario("")
      await fetchData(true)
    } catch {
      toast.error("Erro ao enviar comentário.")
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSendComment()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-7 h-7 animate-spin text-[#25D366]" />
      </div>
    )
  }

  if (!demanda) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AlertCircle className="w-10 h-10 text-[#F87171]" />
        <p className="text-[#8B8B9E]">Demanda não encontrada.</p>
        <Link href="/portal/demandas" className="text-sm text-[#25D366] hover:underline">
          Voltar para demandas
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="h-16 bg-[#0B0B0F] border-b border-[#1E1E2A] flex items-center justify-between px-6 sticky top-0 z-20">
        <Link
          href="/portal/demandas"
          className="flex items-center gap-1.5 text-[#8B8B9E] hover:text-[#F1F1F3] transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Minhas Demandas
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-[#5A5A72]">
          <Radio className={`w-3 h-3 transition-colors ${isLive ? "text-[#25D366]" : "text-[#5A5A72]"}`} />
          Ao vivo
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="flex gap-6">
          {/* Left column */}
          <div className="flex-1 min-w-0 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#111118] text-[#8B8B9E] border border-[#1E1E2A]">
                  {tipoLabels[demanda.tipo] ?? demanda.tipo}
                </span>
                {demanda.status === "aguardando_cliente" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] animate-pulse" />
                    Aguarda sua resposta
                  </span>
                )}
              </div>
              <h1 className="text-[#F1F1F3] text-2xl font-bold">{demanda.titulo}</h1>
            </div>

            {/* Status timeline */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider mb-4">Progresso</h2>
              {demanda.status === "cancelada" ? (
                <div className="flex items-center gap-2 text-[#F87171]">
                  <span className="w-2 h-2 rounded-full bg-[#F87171] inline-block" />
                  <span className="text-sm font-medium">Cancelada</span>
                </div>
              ) : (
                <StatusTimeline status={demanda.status} />
              )}
            </div>

            {/* Description */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider mb-3">Descrição</h2>
              <p className="text-[#C4C4D4] text-sm leading-relaxed whitespace-pre-wrap">{demanda.descricao}</p>
            </div>

            {/* Comments */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-[#1E1E2A] flex items-center justify-between">
                <h2 className="text-[#F1F1F3] font-semibold">
                  Comentários
                  {demanda.comentarios.length > 0 && (
                    <span className="ml-2 text-sm text-[#5A5A72] font-normal">({demanda.comentarios.length})</span>
                  )}
                </h2>
              </div>

              <div className="p-5 space-y-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                {demanda.comentarios.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-[#5A5A72] text-sm">Nenhum comentário ainda. Envie uma mensagem!</p>
                  </div>
                ) : (
                  demanda.comentarios.map((c) => (
                    <CommentBubble key={c.id} comentario={c} currentUserId={user?.id ?? ""} />
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              <div className="border-t border-[#1E1E2A] p-4">
                <div className="flex gap-3">
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escreva um comentário... (Ctrl+Enter para enviar)"
                    rows={3}
                    className="flex-1 rounded-lg border border-[#1E1E2A] bg-[#111118] px-3 py-2.5 text-sm text-[#F1F1F3] placeholder:text-[#5A5A72] resize-none focus:outline-none focus:border-[#25D366] focus:shadow-[0_0_0_2px_rgba(37,211,102,0.15)] transition-colors"
                  />
                  <Button onClick={handleSendComment} loading={sending} disabled={!comentario.trim()} className="self-end">
                    <Send className="w-4 h-4" />
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="w-72 shrink-0 space-y-4">
            {/* Info card */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 space-y-4">
              <h2 className="text-[#F1F1F3] font-semibold text-sm">Informações</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Status</p>
                  <StatusBadge status={demanda.status} />
                </div>
                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Prioridade</p>
                  <p className="text-[#C4C4D4] text-sm font-medium">{prioridadeLabels[demanda.prioridade] ?? demanda.prioridade}</p>
                </div>
                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Criado em</p>
                  <p className="text-[#C4C4D4] text-sm">{formatDateTime(demanda.created_at)}</p>
                </div>
                {demanda.responsavel && (
                  <div>
                    <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Responsável</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#25D366]/15 flex items-center justify-center text-xs font-bold text-[#25D366]">
                        {getInitials(demanda.responsavel.nome)}
                      </div>
                      <p className="text-[#C4C4D4] text-sm">{demanda.responsavel.nome}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Waiting note */}
            {demanda.status === "aguardando_cliente" && (
              <div className="bg-[#F97316]/10 border border-[#F97316]/30 rounded-xl p-4">
                <p className="text-[#F97316] font-semibold text-sm mb-1">Aguardando sua resposta</p>
                <p className="text-[#F97316]/70 text-xs leading-relaxed">
                  Nossa equipe está aguardando um retorno seu para prosseguir com a demanda.
                </p>
              </div>
            )}

            {/* Activity timeline */}
            {eventos.length > 0 && (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
                <h2 className="text-[#F1F1F3] font-semibold text-sm mb-4">Histórico</h2>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {eventos.map((e) => <EventoItem key={e.id} evento={e} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
