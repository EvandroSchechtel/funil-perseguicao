"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { ArrowLeft, Send, Loader2, AlertCircle, Lock, Radio, CheckCircle2, Clock, User, MessageSquare, AlertTriangle, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/Header"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Usuario {
  id: string
  nome: string
  role: string
}

interface Comentario {
  id: string
  texto: string
  interno: boolean
  autor: { nome: string; role: string }
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
  atribuido_a: { id: string; nome: string } | null
  cliente: { id: string; nome: string }
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
  aguardando_cliente: { label: "Aguardando Cliente", color: "#F97316", bg: "rgba(249,115,22,0.12)" },
  concluida: { label: "Concluída", color: "#5A5A72", bg: "rgba(90,90,114,0.12)" },
  cancelada: { label: "Cancelada", color: "#F87171", bg: "rgba(248,113,113,0.12)" },
}

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "#5A5A72" },
  normal: { label: "Normal", color: "#8B8B9E" },
  alta: { label: "Alta", color: "#FBBF24" },
  urgente: { label: "Urgente", color: "#F87171" },
}

const statusTimeline = [
  { key: "aberta", label: "Aberta" },
  { key: "em_analise", label: "Em Análise" },
  { key: "em_execucao", label: "Em Execução" },
  { key: "concluida", label: "Concluída" },
]

const statusSelectOptions = [
  { value: "aberta", label: "Aberta" },
  { value: "em_analise", label: "Em Análise" },
  { value: "em_execucao", label: "Em Execução" },
  { value: "aguardando_cliente", label: "Aguardando Cliente" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
]

const prioridadeSelectOptions = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(str: string): string {
  return new Date(str).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function getTimelineIndex(status: string): number {
  return statusTimeline.findIndex((s) => s.key === status)
}

function formatRelative(str: string): string {
  const diff = Math.floor((Date.now() - new Date(str).getTime()) / 1000)
  if (diff < 60) return "agora"
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

const eventoIcons: Record<string, React.ReactNode> = {
  criada: <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />,
  status_alterado: <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />,
  prioridade_alterada: <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24]" />,
  atribuido: <User className="w-3.5 h-3.5 text-[#A78BFA]" />,
  comentario: <MessageSquare className="w-3.5 h-3.5 text-[#8B8B9E]" />,
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
        {evento.usuario && <p className="text-[#5A5A72] text-xs">por {evento.usuario.nome}</p>}
      </div>
      <span className="text-[#5A5A72] text-xs shrink-0">{formatRelative(evento.created_at)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badges
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

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#111118] text-[#8B8B9E] border border-[#1E1E2A]">
      {tipoLabels[tipo] ?? tipo}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function StatusTimeline({ status }: { status: string }) {
  const activeIdx = getTimelineIndex(status)
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
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isActive
                    ? "border-[#25D366] bg-[#25D366]/20 text-[#25D366]"
                    : isDone
                    ? "border-[#25D366] bg-[#25D366] text-black"
                    : "border-[#1E1E2A] bg-[#111118] text-[#5A5A72]"
                }`}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  isActive ? "text-[#25D366] font-medium" : isDone ? "text-[#C4C4D4]" : "text-[#5A5A72]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`h-0.5 flex-1 min-w-[16px] mx-1 mb-5 transition-all ${
                  isDone ? "bg-[#25D366]" : "bg-[#1E1E2A]"
                }`}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comment bubble
// ---------------------------------------------------------------------------

function CommentBubble({ comentario }: { comentario: Comentario }) {
  const isAdmin = ["admin", "super_admin", "operador"].includes(comentario.autor.role)
  const isInternal = comentario.interno

  return (
    <div className={`flex gap-3 ${isAdmin ? "flex-row" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          isAdmin ? "bg-[#25D366]/15 text-[#25D366]" : "bg-[#60A5FA]/15 text-[#60A5FA]"
        }`}
      >
        {getInitials(comentario.autor.nome)}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] flex flex-col gap-1 ${isAdmin ? "items-start" : "items-end"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[#C4C4D4]">{comentario.autor.nome}</span>
          {isInternal && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#FBBF24] bg-[#FBBF24]/10 border border-[#FBBF24]/20 px-1.5 py-0.5 rounded">
              <Lock className="w-2.5 h-2.5" />
              Interno
            </span>
          )}
          <span className="text-xs text-[#5A5A72]">{formatDateTime(comentario.created_at)}</span>
        </div>
        <div
          className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
            isInternal
              ? "bg-[#FBBF24]/8 border border-[#FBBF24]/20 text-[#C4C4D4] rounded-tl-none"
              : isAdmin
              ? "bg-[#1E1E2A] text-[#C4C4D4] rounded-tl-none"
              : "bg-[#25D366]/10 text-[#F1F1F3] border border-[#25D366]/20 rounded-tr-none"
          }`}
        >
          {comentario.texto}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline select for admin controls
// ---------------------------------------------------------------------------

function AdminSelect({
  label,
  value,
  onChange,
  options,
  saving,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  saving?: boolean
}) {
  return (
    <div>
      <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1.5">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          className="w-full bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#25D366]/50 disabled:opacity-50 appearance-none cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#111118]">
              {o.label}
            </option>
          ))}
        </select>
        {saving && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#25D366]" />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDemandaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()

  const [demanda, setDemanda] = useState<Demanda | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [comentario, setComentario] = useState("")
  const [interno, setInterno] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!accessToken || !id) return
    if (!silent) setLoading(true)
    try {
      const [demandaRes, eventosRes] = await Promise.all([
        fetch(`/api/admin/demandas/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/admin/demandas/${id}/atividade`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      if (!demandaRes.ok) throw new Error()
      const demandaData = await demandaRes.json()
      const eventosData = eventosRes.ok ? await eventosRes.json() : { eventos: [] }
      setDemanda(demandaData.demanda ?? demandaData)
      setEventos(eventosData.eventos ?? [])
    } catch {
      if (!silent) toast.error("Erro ao carregar demanda.")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [accessToken, id])

  const fetchUsuarios = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch("/api/admin/usuarios?per_page=100", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setUsuarios(data.data ?? [])
    } catch {
      // silent
    }
  }, [accessToken])

  useEffect(() => {
    fetchData()
    fetchUsuarios()
  }, [fetchData, fetchUsuarios])

  // Auto-poll every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      setIsLive(true)
      fetchData(true).finally(() => setTimeout(() => setIsLive(false), 500))
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [demanda?.comentarios])

  async function handleUpdateField(field: string, value: string) {
    if (!accessToken || !id || !demanda) return
    setSaving(field)
    try {
      const body: Record<string, string> = {}
      body[field] = value
      const res = await fetch(`/api/admin/demandas/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await fetchData(true)
      toast.success("Demanda atualizada.")
    } catch {
      toast.error("Erro ao atualizar demanda.")
    } finally {
      setSaving(null)
    }
  }

  async function handleSendComment() {
    if (!comentario.trim() || !accessToken || !id) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/demandas/${id}/comentarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ texto: comentario.trim(), interno }),
      })
      if (!res.ok) throw new Error()
      setComentario("")
      setInterno(false)
      await fetchData(true)
      toast.success(interno ? "Comentário interno enviado." : "Comentário enviado.")
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
      <>
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Demandas", href: "/admin/demandas" }, { label: "..." }]} />
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-7 h-7 animate-spin text-[#25D366]" />
        </div>
      </>
    )
  }

  if (!demanda) {
    return (
      <>
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Demandas", href: "/admin/demandas" }, { label: "Não encontrada" }]} />
        <div className="flex flex-col items-center justify-center py-40 gap-3">
          <AlertCircle className="w-10 h-10 text-[#F87171]" />
          <p className="text-[#8B8B9E]">Demanda não encontrada.</p>
          <Link href="/admin/demandas" className="text-sm text-[#25D366] hover:underline">
            Voltar para demandas
          </Link>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Demandas", href: "/admin/demandas" },
          { label: demanda.titulo },
        ]}
        actions={
          <div className="flex items-center gap-1.5 text-xs text-[#5A5A72]">
            <Radio className={`w-3 h-3 transition-colors ${isLive ? "text-[#25D366]" : "text-[#5A5A72]"}`} />
            Ao vivo
          </div>
        }
      />

      <div className="p-6">
        {/* Back */}
        <Link
          href="/admin/demandas"
          className="inline-flex items-center gap-1.5 text-[#8B8B9E] hover:text-[#F1F1F3] transition-colors text-sm mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para demandas
        </Link>

        <div className="flex gap-6">
          {/* Left column — 2/3 */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Title + badge */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TipoBadge tipo={demanda.tipo} />
                <span className="text-xs text-[#5A5A72]">
                  Cliente: <span className="text-[#C4C4D4]">{demanda.cliente?.nome ?? "—"}</span>
                </span>
              </div>
              <h1 className="text-[#F1F1F3] text-2xl font-bold">{demanda.titulo}</h1>
            </div>

            {/* Status timeline */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
              <h2 className="text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider mb-4">
                Progresso
              </h2>
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
              <h2 className="text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider mb-3">
                Descrição
              </h2>
              <p className="text-[#C4C4D4] text-sm leading-relaxed whitespace-pre-wrap">
                {demanda.descricao}
              </p>
            </div>

            {/* Comments */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-[#1E1E2A]">
                <h2 className="text-[#F1F1F3] font-semibold">
                  Comentários
                  {demanda.comentarios.length > 0 && (
                    <span className="ml-2 text-sm text-[#5A5A72] font-normal">
                      ({demanda.comentarios.length})
                    </span>
                  )}
                </h2>
              </div>

              {/* Comment list */}
              <div className="p-5 space-y-4 min-h-[200px] max-h-[500px] overflow-y-auto">
                {demanda.comentarios.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-[#5A5A72] text-sm">Nenhum comentário ainda.</p>
                  </div>
                ) : (
                  demanda.comentarios.map((c) => <CommentBubble key={c.id} comentario={c} />)
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Comment input */}
              <div className="border-t border-[#1E1E2A] p-4 space-y-3">
                {/* Internal toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                  <div
                    onClick={() => setInterno((v) => !v)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      interno ? "bg-[#FBBF24]" : "bg-[#1E1E2A]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        interno ? "left-4" : "left-0.5"
                      }`}
                    />
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-1 ${interno ? "text-[#FBBF24]" : "text-[#5A5A72]"}`}>
                    <Lock className="w-3 h-3" />
                    Comentário interno (oculto para o cliente)
                  </span>
                </label>

                <div className="flex gap-3">
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      interno
                        ? "Nota interna... (visível apenas para a equipe)"
                        : "Escreva um comentário... (Ctrl+Enter para enviar)"
                    }
                    rows={3}
                    className={`flex-1 rounded-lg border bg-[#111118] px-3 py-2.5 text-sm text-[#F1F1F3] placeholder:text-[#5A5A72] transition-colors resize-none focus:outline-none ${
                      interno
                        ? "border-[#FBBF24]/30 focus:border-[#FBBF24]/60 focus:shadow-[0_0_0_2px_rgba(251,191,36,0.1)]"
                        : "border-[#1E1E2A] focus:border-[#25D366] focus:shadow-[0_0_0_2px_rgba(37,211,102,0.15)]"
                    }`}
                  />
                  <Button
                    onClick={handleSendComment}
                    loading={sending}
                    disabled={!comentario.trim()}
                    variant={interno ? "outline" : "default"}
                    className="self-end"
                  >
                    <Send className="w-4 h-4" />
                    {interno ? "Nota" : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — 1/3 */}
          <div className="w-72 shrink-0 space-y-4">
            {/* Admin controls */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 space-y-4">
              <h2 className="text-[#F1F1F3] font-semibold text-sm">Gerenciar</h2>

              <AdminSelect
                label="Status"
                value={demanda.status}
                onChange={(v) => handleUpdateField("status", v)}
                options={statusSelectOptions}
                saving={saving === "status"}
              />

              <AdminSelect
                label="Prioridade"
                value={demanda.prioridade}
                onChange={(v) => handleUpdateField("prioridade", v)}
                options={prioridadeSelectOptions}
                saving={saving === "prioridade"}
              />

              <div>
                <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1.5">Responsável</p>
                <div className="relative">
                  <select
                    value={demanda.atribuido_a?.id ?? ""}
                    onChange={(e) => handleUpdateField("atribuido_a", e.target.value)}
                    disabled={saving === "atribuido_a"}
                    className="w-full bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#25D366]/50 disabled:opacity-50 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#111118]">
                      Não atribuído
                    </option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#111118]">
                        {u.nome}
                      </option>
                    ))}
                  </select>
                  {saving === "atribuido_a" && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#25D366]" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Info card */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 space-y-4">
              <h2 className="text-[#F1F1F3] font-semibold text-sm">Informações</h2>

              <div className="space-y-3">
                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Cliente</p>
                  <p className="text-[#C4C4D4] text-sm font-medium">{demanda.cliente?.nome ?? "—"}</p>
                </div>

                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Status atual</p>
                  <StatusBadge status={demanda.status} />
                </div>

                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Prioridade</p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: prioridadeConfig[demanda.prioridade]?.color ?? "#8B8B9E" }}
                  >
                    {prioridadeConfig[demanda.prioridade]?.label ?? demanda.prioridade}
                  </p>
                </div>

                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Criado em</p>
                  <p className="text-[#C4C4D4] text-sm">{formatDateTime(demanda.created_at)}</p>
                </div>

                <div>
                  <p className="text-[#5A5A72] text-xs uppercase tracking-wider mb-1">Última atualização</p>
                  <p className="text-[#C4C4D4] text-sm">{formatDateTime(demanda.updated_at)}</p>
                </div>
              </div>
            </div>

            {/* Activity timeline */}
            {eventos.length > 0 && (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
                <h2 className="text-[#F1F1F3] font-semibold text-sm mb-4">Histórico de Atividade</h2>
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
