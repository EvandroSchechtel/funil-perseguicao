"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Plus, Trash2, Search, Tag, Users, CheckCircle2,
  XCircle, RefreshCw, Copy, ChevronDown, X,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

// ── Types ──────────────────────────────────────────────────────────────────────

interface GrupoMonitoramento {
  id: string
  nome_filtro: string
  tag_manychat_id: number
  tag_manychat_nome: string
  status: "ativo" | "inativo"
  created_at: string
  campanha: { id: string; nome: string }
  conta_manychat: { id: string; nome: string }
  _count: { entradas: number }
}

interface Instancia {
  id: string
  nome: string
  instance_id: string
  token: string
  status: "ativo" | "inativo"
  webhook_token: string
  created_at: string
  cliente: { id: string; nome: string } | null
  grupos: GrupoMonitoramento[]
}

interface ZApiGroup {
  phone: string   // group WA ID
  name: string
  isGroup: boolean
}

interface ManychatTag {
  id: number
  name: string
}

interface Campanha {
  id: string
  nome: string
}

interface ContaManychat {
  id: string
  nome: string
}

interface EntradaGrupo {
  id: string
  telefone: string
  nome_participante: string | null
  entrou_at: string
  tag_aplicada: boolean
  lead: { id: string; nome: string; status: string } | null
  grupo: { nome_filtro: string; tag_manychat_nome: string }
}

// ── Searchable dropdown component ─────────────────────────────────────────────

interface SearchableSelectProps<T> {
  options: T[]
  value: string
  onChange: (value: string, label: string) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  placeholder: string
  searchPlaceholder?: string
  loading?: boolean
  disabled?: boolean
  label?: string
}

function SearchableSelect<T>({
  options, value, onChange, getKey, getLabel,
  placeholder, searchPlaceholder = "Buscar...", loading, disabled, label,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => getKey(o) === value)
  const filtered = options.filter((o) =>
    getLabel(o).toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-1.5 block">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => { setOpen((v) => !v); setSearch("") }}
        className="flex h-10 w-full items-center justify-between rounded-lg border bg-[#111118] px-3 py-2 text-sm text-[#F1F1F3] border-[#1E1E2A] focus:border-[#25D366] focus:outline-none focus:shadow-[0_0_0_2px_rgba(37,211,102,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedOption ? "text-[#F1F1F3]" : "text-[#5A5A72]"}>
          {loading ? "Carregando..." : selectedOption ? getLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-[#5A5A72] shrink-0" />
      </button>

      {open && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#1E1E2A] bg-[#16161E] shadow-xl">
          <div className="p-2 border-b border-[#1E1E2A]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5A5A72]" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#111118] rounded-md border border-[#2A2A3A] text-sm text-[#F1F1F3] placeholder-[#5A5A72] pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#25D366]"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[#5A5A72] text-xs text-center py-4">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={getKey(o)}
                  type="button"
                  onClick={() => {
                    onChange(getKey(o), getLabel(o))
                    setOpen(false)
                    setSearch("")
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#1C1C28] transition-colors text-left"
                >
                  <span className="text-[#F1F1F3] truncate">{getLabel(o)}</span>
                  {getKey(o) === value && <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0 ml-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function InstanciaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken, user } = useAuth()

  const [inst, setInst] = useState<Instancia | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"grupos" | "entradas">("grupos")

  // Grupo form state
  const [showGrupoForm, setShowGrupoForm] = useState(false)
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [contas, setContas] = useState<ContaManychat[]>([])
  const [zapiGroups, setZapiGroups] = useState<ZApiGroup[]>([])
  const [zapiGroupsLoading, setZapiGroupsLoading] = useState(false)
  const [manychatTags, setManychatTags] = useState<ManychatTag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [grupoForm, setGrupoForm] = useState({
    campanha_id: "", campanha_nome: "",
    conta_manychat_id: "", conta_manychat_nome: "",
    nome_filtro: "",
    tag_manychat_id: "", tag_manychat_nome: "",
  })
  const [savingGrupo, setSavingGrupo] = useState(false)
  const [deleteGrupoDialog, setDeleteGrupoDialog] = useState<GrupoMonitoramento | null>(null)
  const [deletingGrupo, setDeletingGrupo] = useState(false)

  // Entradas state
  const [entradas, setEntradas] = useState<EntradaGrupo[]>([])
  const [entradasLoading, setEntradasLoading] = useState(false)
  const [grupoFiltro, setGrupoFiltro] = useState("")

  const canWrite = user ? hasPermission(user.role, "contas:write") : false

  // ── Fetch instância ──
  const fetchInst = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Instância não encontrada")
      const data = await res.json()
      setInst(data.instancia)
      setWebhookUrl(data.webhook_url || "")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => { fetchInst() }, [fetchInst])

  // ── Fetch campanhas + contas (for grupo form) ──
  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/campanhas?per_page=200", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => setCampanhas(d.campanhas || []))
      .catch(() => {})
    fetch("/api/admin/contas?per_page=200", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => setContas(d.contas || []))
      .catch(() => {})
  }, [accessToken])

  // ── Fetch Z-API groups when form opens ──
  async function fetchZapiGroups() {
    setZapiGroupsLoading(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}/detectar-grupos`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setZapiGroups(data.grupos || [])
    } catch {
      toast.error("Erro ao buscar grupos do Z-API.")
    } finally {
      setZapiGroupsLoading(false)
    }
  }

  // ── Fetch tags when conta_manychat changes ──
  async function fetchTags(contaId: string) {
    setTagsLoading(true)
    setManychatTags([])
    try {
      const res = await fetch(
        `/api/admin/zapi/instancias/${id}/tags-manychat?conta_id=${contaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await res.json()
      setManychatTags(data.tags || [])
    } catch {
      toast.error("Erro ao buscar tags do Manychat.")
    } finally {
      setTagsLoading(false)
    }
  }

  function openGrupoForm() {
    setGrupoForm({
      campanha_id: "", campanha_nome: "",
      conta_manychat_id: "", conta_manychat_nome: "",
      nome_filtro: "",
      tag_manychat_id: "", tag_manychat_nome: "",
    })
    setManychatTags([])
    setShowGrupoForm(true)
    fetchZapiGroups()
  }

  // ── Save grupo ──
  async function handleSaveGrupo() {
    const { campanha_id, conta_manychat_id, nome_filtro, tag_manychat_id, tag_manychat_nome } = grupoForm
    if (!campanha_id || !conta_manychat_id || !nome_filtro || !tag_manychat_id || !tag_manychat_nome) {
      toast.error("Preencha todos os campos do grupo.")
      return
    }
    setSavingGrupo(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}/grupos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ campanha_id, conta_manychat_id, nome_filtro, tag_manychat_id, tag_manychat_nome }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Grupo configurado.")
        setShowGrupoForm(false)
        fetchInst()
      } else {
        toast.error(data.message || "Erro ao configurar grupo.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSavingGrupo(false)
    }
  }

  // ── Delete grupo ──
  async function handleDeleteGrupo() {
    if (!deleteGrupoDialog) return
    setDeletingGrupo(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}/grupos/${deleteGrupoDialog.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDeleteGrupoDialog(null)
        fetchInst()
      } else {
        toast.error(data.message || "Erro ao remover grupo.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setDeletingGrupo(false)
    }
  }

  // ── Fetch entradas ──
  const fetchEntradas = useCallback(async () => {
    if (!accessToken || !id) return
    setEntradasLoading(true)
    try {
      const params = grupoFiltro ? `?grupo_id=${grupoFiltro}` : ""
      const res = await fetch(`/api/admin/zapi/instancias/${id}/entradas${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setEntradas(data.entradas || [])
    } catch {
      toast.error("Erro ao carregar entradas.")
    } finally {
      setEntradasLoading(false)
    }
  }, [accessToken, id, grupoFiltro])

  useEffect(() => {
    if (activeTab === "entradas") fetchEntradas()
  }, [activeTab, fetchEntradas])

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copiado!")
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Z-API", href: "/admin/zapi" }, { label: "..." }]} />
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (!inst) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Z-API", href: "/admin/zapi" }]} />
        <div className="p-6">
          <p className="text-[#F87171]">Instância não encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/admin/zapi")}>Voltar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Z-API / Grupos WA", href: "/admin/zapi" },
          { label: inst.nome },
        ]}
      />

      <div className="p-6 max-w-4xl">
        <Link
          href="/admin/zapi"
          className="inline-flex items-center gap-2 text-[#8B8B9E] hover:text-[#F1F1F3] text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Z-API
        </Link>

        {/* Header card */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[#F1F1F3] text-xl font-bold">{inst.nome}</h1>
                <Badge variant={inst.status === "ativo" ? "ativo" : "inativo"}>
                  {inst.status === "ativo" ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-[#8B8B9E] text-sm font-mono">{inst.instance_id}</p>
              {inst.cliente && (
                <p className="text-[#5A5A72] text-xs mt-1">Cliente: {inst.cliente.nome}</p>
              )}
            </div>
          </div>

          {/* Webhook URL */}
          {webhookUrl && (
            <div className="mt-4 pt-4 border-t border-[#1E1E2A]">
              <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-1.5">
                Webhook URL (configure no Z-API)
              </p>
              <div className="flex items-center gap-2 bg-[#111118] border border-[#2A2A3A] rounded-lg px-3 py-2">
                <code className="text-xs text-[#25D366] flex-1 truncate">{webhookUrl}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="text-[#5A5A72] hover:text-[#F1F1F3] transition-colors shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#111118] rounded-lg p-1 w-fit">
          {(["grupos", "entradas"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-[#1E1E2A] text-[#F1F1F3]"
                  : "text-[#5A5A72] hover:text-[#8B8B9E]"
              }`}
            >
              {tab === "grupos" ? "Grupos Monitorados" : "Entradas"}
              {tab === "grupos" && inst.grupos.length > 0 && (
                <span className="ml-1.5 text-xs text-[#5A5A72]">({inst.grupos.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Grupos ── */}
        {activeTab === "grupos" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#8B8B9E] text-sm">
                Cada grupo monitora entradas de participantes e aplica a tag no Manychat automaticamente.
              </p>
              {canWrite && (
                <Button size="sm" onClick={openGrupoForm}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar Grupo
                </Button>
              )}
            </div>

            {/* Grupo form */}
            {showGrupoForm && (
              <div className="bg-[#16161E] border border-[#25D366]/30 rounded-xl p-5 mb-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[#F1F1F3] font-semibold">Novo Grupo Monitorado</h3>
                  <button
                    type="button"
                    onClick={() => setShowGrupoForm(false)}
                    className="text-[#5A5A72] hover:text-[#F1F1F3]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Campanha */}
                <SearchableSelect<Campanha>
                  label="Campanha *"
                  options={campanhas}
                  value={grupoForm.campanha_id}
                  getKey={(c) => c.id}
                  getLabel={(c) => c.nome}
                  placeholder="Selecione uma campanha..."
                  searchPlaceholder="Buscar campanha..."
                  onChange={(val, label) =>
                    setGrupoForm((p) => ({ ...p, campanha_id: val, campanha_nome: label }))
                  }
                />

                {/* Conta Manychat */}
                <SearchableSelect<ContaManychat>
                  label="Conta Manychat *"
                  options={contas}
                  value={grupoForm.conta_manychat_id}
                  getKey={(c) => c.id}
                  getLabel={(c) => c.nome}
                  placeholder="Selecione uma conta Manychat..."
                  searchPlaceholder="Buscar conta..."
                  onChange={(val, label) => {
                    setGrupoForm((p) => ({ ...p, conta_manychat_id: val, conta_manychat_nome: label, tag_manychat_id: "", tag_manychat_nome: "" }))
                    fetchTags(val)
                  }}
                />

                {/* Grupo WA (from Z-API) */}
                <div>
                  <label className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-1.5 block">
                    Grupo WhatsApp *
                    <button
                      type="button"
                      onClick={fetchZapiGroups}
                      className="ml-2 text-[#25D366] hover:text-[#1DB954] text-xs normal-case font-normal"
                    >
                      <RefreshCw className={`w-3 h-3 inline mr-0.5 ${zapiGroupsLoading ? "animate-spin" : ""}`} />
                      Recarregar
                    </button>
                  </label>
                  <SearchableSelect<ZApiGroup>
                    options={zapiGroups}
                    value={grupoForm.nome_filtro}
                    getKey={(g) => g.name}
                    getLabel={(g) => g.name}
                    placeholder={zapiGroupsLoading ? "Buscando grupos..." : "Selecione um grupo WA..."}
                    searchPlaceholder="Filtrar por nome do grupo..."
                    loading={zapiGroupsLoading}
                    onChange={(val) =>
                      setGrupoForm((p) => ({ ...p, nome_filtro: val }))
                    }
                  />
                  <p className="text-xs text-[#5A5A72] mt-1">
                    O sistema usará o nome como filtro para identificar o grupo nos webhooks.
                  </p>
                </div>

                {/* Tag Manychat */}
                <div>
                  <SearchableSelect<ManychatTag>
                    label="Tag Manychat (será aplicada ao entrar no grupo) *"
                    options={manychatTags}
                    value={grupoForm.tag_manychat_id}
                    getKey={(t) => String(t.id)}
                    getLabel={(t) => t.name}
                    placeholder={
                      !grupoForm.conta_manychat_id
                        ? "Selecione uma conta Manychat primeiro..."
                        : tagsLoading
                        ? "Buscando tags..."
                        : "Selecione a tag..."
                    }
                    searchPlaceholder="Buscar tag..."
                    loading={tagsLoading}
                    disabled={!grupoForm.conta_manychat_id}
                    onChange={(val, label) =>
                      setGrupoForm((p) => ({ ...p, tag_manychat_id: val, tag_manychat_nome: label }))
                    }
                  />
                  {grupoForm.conta_manychat_id && !tagsLoading && manychatTags.length === 0 && (
                    <p className="text-xs text-[#F59E0B] mt-1">
                      Nenhuma tag encontrada. Crie tags no Manychat e reabra este formulário.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSaveGrupo} loading={savingGrupo} size="sm">
                    Salvar Grupo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowGrupoForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Grupos list */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              {inst.grupos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Users className="w-10 h-10 text-[#2A2A3A]" />
                  <p className="text-[#5A5A72] text-sm">Nenhum grupo configurado</p>
                  {canWrite && (
                    <Button size="sm" onClick={openGrupoForm}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Adicionar Grupo
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E1E2A]">
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Grupo WA</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Campanha</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Tag Manychat</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Entradas</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {inst.grupos.map((g) => (
                      <tr key={g.id} className="border-b border-[#1E1E2A] last:border-0">
                        <td className="px-5 py-4">
                          <p className="text-[#F1F1F3] text-sm font-medium">{g.nome_filtro}</p>
                          <p className="text-[#5A5A72] text-xs mt-0.5">{g.conta_manychat.nome}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[#C4C4D4] text-sm">{g.campanha.nome}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                            <span className="text-[#C4C4D4] text-sm">{g.tag_manychat_nome}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => { setGrupoFiltro(g.id); setActiveTab("entradas") }}
                            className="text-[#25D366] text-sm hover:underline"
                          >
                            {g._count.entradas}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={g.status === "ativo" ? "ativo" : "inativo"}>
                            {g.status === "ativo" ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => setDeleteGrupoDialog(g)}
                              className="text-[#5A5A72] hover:text-[#F87171] transition-colors"
                              title="Remover grupo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Entradas ── */}
        {activeTab === "entradas" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              {inst.grupos.length > 0 && (
                <select
                  value={grupoFiltro}
                  onChange={(e) => setGrupoFiltro(e.target.value)}
                  className="bg-[#111118] border border-[#1E1E2A] rounded-lg px-3 py-2 text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366]"
                >
                  <option value="">Todos os grupos</option>
                  {inst.grupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nome_filtro}</option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="outline" onClick={fetchEntradas} disabled={entradasLoading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${entradasLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              {entradasLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full" />
                </div>
              ) : entradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Users className="w-10 h-10 text-[#2A2A3A]" />
                  <p className="text-[#5A5A72] text-sm">Nenhuma entrada registrada</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E1E2A]">
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Participante</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Grupo</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Lead</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Tag aplicada</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Entrou em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entradas.map((e) => (
                      <tr key={e.id} className="border-b border-[#1E1E2A] last:border-0">
                        <td className="px-5 py-4">
                          <p className="text-[#F1F1F3] text-sm">{e.nome_participante || "—"}</p>
                          <p className="text-[#5A5A72] text-xs font-mono mt-0.5">{e.telefone}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[#C4C4D4] text-sm">{e.grupo.nome_filtro}</p>
                          <p className="text-[#5A5A72] text-xs mt-0.5">{e.grupo.tag_manychat_nome}</p>
                        </td>
                        <td className="px-5 py-4">
                          {e.lead ? (
                            <Link
                              href={`/admin/leads/${e.lead.id}`}
                              className="text-[#25D366] text-sm hover:underline"
                            >
                              {e.lead.nome}
                            </Link>
                          ) : (
                            <span className="text-[#5A5A72] text-sm">Não identificado</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {e.tag_aplicada ? (
                            <span className="inline-flex items-center gap-1 text-[#25D366] text-sm">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#5A5A72] text-sm">
                              <XCircle className="w-3.5 h-3.5" />
                              Não
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[#8B8B9E] text-sm">{formatDate(e.entrou_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete grupo dialog */}
      <Dialog open={!!deleteGrupoDialog} onOpenChange={() => setDeleteGrupoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Grupo</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Tem certeza que deseja remover o grupo{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteGrupoDialog?.nome_filtro}</span>?
            O histórico de entradas também será excluído.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGrupoDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteGrupo} loading={deletingGrupo}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
