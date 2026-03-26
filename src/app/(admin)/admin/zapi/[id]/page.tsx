"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Plus, Trash2, Search, Tag, Users, CheckCircle2,
  XCircle, RefreshCw, Copy, ChevronDown, X, Wifi, Building2,
  Megaphone, MessageSquare, Lock, ScanSearch, Pencil,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
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
  campanha: { id: string; nome: string } | null
  conta_manychat: { id: string; nome: string } | null
  _count: { entradas: number } | null
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

interface ZApiGroup { phone: string; name: string; isGroup: boolean }
interface ManychatTag { id: number; name: string }
interface Campanha { id: string; nome: string }
interface ContaManychat { id: string; nome: string }

interface EscanearDetalhe {
  nome: string
  grupoWaId: string
  acao: "criado" | "existente" | "sem_match"
  score: number
  templateNomeFiltro: string | null
  grupoId: string | null
  leads_count: number
}

interface EscanearResult {
  total_grupos_zapi: number
  novos_vinculados: number
  ja_configurados: number
  sem_match: number
  detalhes: EscanearDetalhe[]
  entradas_processadas?: number
  erros_entradas?: number
}

interface EntradaGrupo {
  id: string
  telefone: string
  nome_whatsapp: string | null
  entrou_at: string
  tag_aplicada: boolean
  lead: { id: string; nome: string; status: string } | null
  grupo: { nome_filtro: string; tag_manychat_nome: string }
}

interface SaidaGrupo {
  id: string
  telefone: string
  nome_whatsapp: string | null
  saiu_at: string
  lead: { id: string; nome: string; status: string } | null
  grupo: { nome_filtro: string }
}

// ── Searchable Select ──────────────────────────────────────────────────────────

function SearchableSelect<T>({
  options, value, onChange, getKey, getLabel,
  placeholder, searchPlaceholder = "Buscar...", loading: isLoading, disabled, label,
}: {
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
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => getKey(o) === value)
  const filtered = options.filter((o) => (getLabel(o) ?? "").toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest mb-1.5 block">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => { setOpen((v) => !v); setSearch("") }}
        className="flex h-10 w-full items-center justify-between rounded-lg border bg-[#13131F] px-3 py-2 text-sm border-[#1C1C2C] focus:border-[#25D366]/50 focus:outline-none transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#252535]"
      >
        <span className={selected ? "text-[#EEEEF5]" : "text-[#3F3F58]"}>
          {isLoading ? "Carregando…" : selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#3F3F58] shrink-0" />
      </button>

      {open && !isLoading && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#1C1C2C] bg-[#0F0F1A] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="p-2 border-b border-[#1C1C2C]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3F3F58]" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#13131F] rounded-lg border border-[#1C1C2C] text-sm text-[#EEEEF5] placeholder-[#3F3F58] pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#25D366]/40"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[#3F3F58] text-xs text-center py-4">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={getKey(o)}
                  type="button"
                  onClick={() => { onChange(getKey(o), getLabel(o)); setOpen(false); setSearch("") }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#13131F] transition-colors text-left gap-2"
                >
                  <span className="text-[#EEEEF5] truncate">{getLabel(o)}</span>
                  {getKey(o) === value && <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InstanciaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken, user } = useAuth()

  const [inst, setInst] = useState<Instancia | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"grupos" | "entradas" | "saidas">("grupos")
  const [copied, setCopied] = useState(false)

  // Grupo form
  const [showGrupoForm, setShowGrupoForm] = useState(false)
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [contas, setContas] = useState<ContaManychat[]>([])
  const [zapiGroups, setZapiGroups] = useState<ZApiGroup[]>([])
  const [zapiGroupsLoading, setZapiGroupsLoading] = useState(false)
  const [manychatTags, setManychatTags] = useState<ManychatTag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [grupoForm, setGrupoForm] = useState({ campanha_id: "", campanha_nome: "" })
  const [gruposWaSelecionados, setGruposWaSelecionados] = useState<Array<{nome: string; phone: string}>>([])
  const [grupoPickerFilter, setGrupoPickerFilter] = useState("")
  const [autoExpand, setAutoExpand] = useState(true)
  // Multi-conta staging area
  const [contaStageId, setContaStageId] = useState("")
  const [contaStageNome, setContaStageNome] = useState("")
  const [tagStageId, setTagStageId] = useState("")
  const [tagStageNome, setTagStageNome] = useState("")
  const [contasAdicionadas, setContasAdicionadas] = useState<Array<{
    contaId: string; contaNome: string; tagId: number; tagNome: string
  }>>([])
  const [savingGrupo, setSavingGrupo] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [creatingTag, setCreatingTag] = useState(false)
  const [deleteGrupoDialog, setDeleteGrupoDialog] = useState<GrupoMonitoramento | null>(null)
  const [deletingGrupo, setDeletingGrupo] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [confirmScan, setConfirmScan] = useState(false)
  const [scanResult, setScanResult] = useState<EscanearResult | null>(null)
  const [scanFilter, setScanFilter] = useState("")
  const [showEditInstancia, setShowEditInstancia] = useState(false)
  const [editForm, setEditForm] = useState({ nome: "", instance_id: "", token: "", client_token: "", status: "ativo" as "ativo" | "inativo" })
  const [savingEdit, setSavingEdit] = useState(false)

  // Entradas
  const [entradas, setEntradas] = useState<EntradaGrupo[]>([])
  const [entradasLoading, setEntradasLoading] = useState(false)
  const [entradasLoaded, setEntradasLoaded] = useState(false)
  const [grupoFiltro, setGrupoFiltro] = useState("")

  // Saídas
  const [saidas, setSaidas] = useState<SaidaGrupo[]>([])
  const [saidasLoading, setSaidasLoading] = useState(false)
  const [saidasLoaded, setSaidasLoaded] = useState(false)
  const [grupoFiltroSaidas, setGrupoFiltroSaidas] = useState("")

  const canWrite = user ? hasPermission(user.role, "contas:write") : false

  // ── Data fetching ──

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

      // Fetch campanhas and contas filtered by this instance's client
      const clienteId = data.instancia?.cliente?.id
      const clienteParam = clienteId ? `&cliente_id=${clienteId}` : ""
      const [cr, conr] = await Promise.all([
        fetch(`/api/admin/campanhas?per_page=200${clienteParam}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/admin/contas?per_page=200${clienteParam}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      const cd = await cr.json()
      const cond = await conr.json()
      setCampanhas(cd.data || [])
      setContas(cond.contas || [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => { fetchInst() }, [fetchInst])

  async function fetchZapiGroups(forceRefresh = false) {
    setZapiGroupsLoading(true)
    try {
      const url = `/api/admin/zapi/instancias/${id}/detectar-grupos${forceRefresh ? "?refresh=true" : ""}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) {
        toast.error("Erro ao buscar grupos do Z-API.")
        setZapiGroups([])
        return
      }
      const data = await res.json()
      setZapiGroups((data.grupos || []).filter((g: ZApiGroup) => g.name?.trim()))
    } catch {
      toast.error("Erro ao buscar grupos do Z-API.")
    } finally {
      setZapiGroupsLoading(false)
    }
  }

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

  // Auto-fetch tags when staged conta changes
  useEffect(() => {
    if (contaStageId) fetchTags(contaStageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaStageId])

  async function handleCreateTag() {
    if (!contaStageId || !newTagName.trim()) return
    setCreatingTag(true)
    try {
      const res = await fetch(`/api/admin/contas/${contaStageId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ nome: newTagName.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.tag) {
        setManychatTags((prev) => [...prev, data.tag])
        setTagStageId(String(data.tag.id))
        setTagStageNome(data.tag.name)
        setNewTagName("")
        toast.success(`Tag "${data.tag.name}" criada com sucesso.`)
      } else {
        toast.error(data.message || "Erro ao criar tag.")
        setNewTagName("")
      }
    } catch { toast.error("Erro de conexão.") }
    finally { setCreatingTag(false) }
  }

  function handleAdicionarConta() {
    if (!contaStageId || !tagStageId || Number(tagStageId) <= 0) {
      toast.error("Selecione uma conta e uma tag antes de adicionar.")
      return
    }
    if (contasAdicionadas.some((c) => c.contaId === contaStageId)) {
      toast.error("Esta conta já foi adicionada.")
      return
    }
    setContasAdicionadas((prev) => [
      ...prev,
      { contaId: contaStageId, contaNome: contaStageNome, tagId: Number(tagStageId), tagNome: tagStageNome },
    ])
    setContaStageId(""); setContaStageNome("")
    setTagStageId(""); setTagStageNome("")
    setManychatTags([]); setNewTagName("")
  }

  function openGrupoForm() {
    setGrupoForm({ campanha_id: "", campanha_nome: "" })
    setGruposWaSelecionados([])
    setGrupoPickerFilter("")
    setAutoExpand(true)
    setContasAdicionadas([])
    setContaStageId(""); setContaStageNome("")
    setTagStageId(""); setTagStageNome("")
    setManychatTags([]); setNewTagName("")
    setShowGrupoForm(true)
    fetchZapiGroups()
  }

  async function handleSaveGrupo() {
    const { campanha_id } = grupoForm
    if (!campanha_id || gruposWaSelecionados.length === 0 || contasAdicionadas.length === 0) {
      toast.error("Selecione campanha, ao menos um grupo e ao menos uma conta Manychat.")
      return
    }
    const [primary, ...rest] = contasAdicionadas
    setSavingGrupo(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}/grupos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          campanha_id,
          conta_manychat_id: primary.contaId,
          tag_manychat_id: primary.tagId,
          tag_manychat_nome: primary.tagNome,
          auto_expand: autoExpand,
          grupos: gruposWaSelecionados,
          ...(rest.length > 0 && {
            contas_adicionais: rest.map((c) => ({
              conta_id: c.contaId,
              tag_id: c.tagId,
              tag_nome: c.tagNome,
            })),
          }),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Grupos configurados.")
        if (data.results?.some((r: { status: string }) => r.status === "duplicado")) {
          toast.warning("Alguns grupos já existiam e foram ignorados.")
        }
        if (data.autoVinculados?.length > 0) {
          toast.success(
            `Auto-vinculados: ${(data.autoVinculados as string[]).length} grupo(s) similares encontrados.`,
            { duration: 6000 }
          )
        }
        setShowGrupoForm(false)
        fetchInst()
      } else {
        toast.error(data.message || "Erro ao configurar grupos.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSavingGrupo(false)
    }
  }

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

  async function handleScanGrupos() {
    setScanning(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}/escanear-grupos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { message?: string }).message || "Erro ao escanear grupos.")
        return
      }
      const data = await res.json()
      setScanResult(data)
      if (data.novos_vinculados > 0) fetchInst()
    } catch {
      toast.error("Erro ao escanear grupos.")
    } finally {
      setScanning(false)
    }
  }

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
      setEntradasLoaded(true)
    } catch {
      toast.error("Erro ao carregar entradas.")
    } finally {
      setEntradasLoading(false)
    }
  }, [accessToken, id, grupoFiltro])

  // Reset cache when the grupo filter changes so data is re-fetched
  useEffect(() => { setEntradasLoaded(false) }, [grupoFiltro])

  useEffect(() => {
    if (activeTab === "entradas" && !entradasLoaded) fetchEntradas()
  }, [activeTab, entradasLoaded, fetchEntradas])

  const fetchSaidas = useCallback(async () => {
    if (!accessToken || !id) return
    setSaidasLoading(true)
    try {
      const params = grupoFiltroSaidas ? `?grupo_id=${grupoFiltroSaidas}` : ""
      const res = await fetch(`/api/admin/zapi/instancias/${id}/saidas${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setSaidas(data.saidas || [])
      setSaidasLoaded(true)
    } catch {
      toast.error("Erro ao carregar saídas.")
    } finally {
      setSaidasLoading(false)
    }
  }, [accessToken, id, grupoFiltroSaidas])

  // Reset cache when the grupo filter changes so data is re-fetched
  useEffect(() => { setSaidasLoaded(false) }, [grupoFiltroSaidas])

  useEffect(() => {
    if (activeTab === "saidas" && !saidasLoaded) fetchSaidas()
  }, [activeTab, saidasLoaded, fetchSaidas])

  function openEditInstancia() {
    if (!inst) return
    setEditForm({ nome: inst.nome, instance_id: inst.instance_id, token: "", client_token: "", status: inst.status })
    setShowEditInstancia(true)
  }

  async function handleSaveEdit() {
    if (!editForm.nome.trim() || !editForm.instance_id.trim()) {
      toast.error("Nome e Instance ID são obrigatórios.")
      return
    }
    setSavingEdit(true)
    try {
      const body: Record<string, string> = {
        nome: editForm.nome.trim(),
        instance_id: editForm.instance_id.trim(),
        status: editForm.status,
      }
      if (editForm.token.trim()) body.token = editForm.token.trim()
      if (editForm.client_token.trim()) body.client_token = editForm.client_token.trim()

      const res = await fetch(`/api/admin/zapi/instancias/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Instância atualizada.")
        setShowEditInstancia(false)
        fetchInst()
      } else {
        toast.error(data.message || "Erro ao atualizar.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSavingEdit(false)
    }
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success("URL copiada!")
      })
      .catch(() => toast.error("Não foi possível copiar. Copie manualmente."))
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  // ── Loading / error states ──

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Z-API", href: "/admin/zapi" }, { label: "…" }]} />
        <div className="flex items-center justify-center flex-1">
          <div className="space-y-3 text-center">
            <div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[#7F7F9E] text-sm">Carregando…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!inst) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Z-API", href: "/admin/zapi" }]} />
        <div className="p-6">
          <p className="text-[#F87171] text-sm">Instância não encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/admin/zapi")}>
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  // ── Main render ──

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Z-API / WhatsApp", href: "/admin/zapi" },
          { label: inst.nome },
        ]}
      />

      <div className="p-6 max-w-4xl space-y-5">
        <Link
          href="/admin/zapi"
          className="inline-flex items-center gap-2 text-[#7F7F9E] hover:text-[#EEEEF5] text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Z-API
        </Link>

        {/* ── Hero card ── */}
        <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] overflow-hidden">
          {/* Top bar */}
          <div className="px-6 pt-6 pb-5 flex items-start gap-4">
            {/* Status icon */}
            <div className="relative shrink-0 mt-0.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${inst.status === "ativo" ? "bg-[#22C55E]/10" : "bg-[#13131F]"}`}>
                <Wifi className={`w-5 h-5 ${inst.status === "ativo" ? "text-[#22C55E]" : "text-[#3F3F58]"}`} />
              </div>
              {inst.status === "ativo" && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.7)] ring-2 ring-[#0F0F1A]" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[#EEEEF5] text-lg font-bold">{inst.nome}</h1>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    inst.status === "ativo"
                      ? "text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20"
                      : "text-[#3F3F58] bg-[#13131F] border-[#1C1C2C]"
                  }`}
                >
                  {inst.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-[#3F3F58] text-xs font-mono mt-1">{inst.instance_id}</p>

              {/* Client + stats row */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {inst.cliente ? (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#7F7F9E]" />
                    <Link
                      href={`/admin/clientes/${inst.cliente.id}`}
                      className="text-xs text-[#9898B0] hover:text-[#25D366] transition-colors font-medium"
                    >
                      {inst.cliente.nome}
                    </Link>
                    <span title="Cliente imutável após criação">
                      <Lock className="w-2.5 h-2.5 text-[#3F3F58]" />
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#3F3F58]" />
                    <span className="text-xs text-[#3F3F58] italic">Sem cliente vinculado</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#7F7F9E]" />
                  <span className="text-xs text-[#9898B0]">
                    {inst.grupos.length} {inst.grupos.length === 1 ? "grupo" : "grupos"} monitorados
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5 text-[#7F7F9E]" />
                  <span className="text-xs text-[#9898B0]">
                    {new Set(inst.grupos.map((g) => g.campanha?.id).filter(Boolean)).size} campanhas
                  </span>
                </div>
              </div>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={openEditInstancia}
                className="shrink-0 p-2 rounded-lg border border-[#1C1C2C] text-[#7F7F9E] hover:text-[#EEEEF5] hover:border-[#252535] transition-all"
                title="Editar instância"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Webhook URL */}
          {webhookUrl && (
            <div className="mx-6 mb-5 rounded-xl bg-[#0A0A12] border border-[#1C1C2C] p-3.5">
              <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest mb-2">
                Webhook URL — configure no painel Z-API
              </p>
              <div className="flex items-center gap-2">
                <code className="text-[#25D366] text-xs flex-1 truncate font-mono">{webhookUrl}</code>
                <button
                  type="button"
                  onClick={copyWebhook}
                  className={`shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                    copied
                      ? "text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/10"
                      : "text-[#7F7F9E] border-[#1C1C2C] hover:border-[#252535] hover:text-[#EEEEF5]"
                  }`}
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0.5 bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-1 w-fit">
          {(["grupos", "entradas", "saidas"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-[#0F0F1A] text-[#EEEEF5] shadow-sm"
                  : "text-[#3F3F58] hover:text-[#7F7F9E]"
              }`}
            >
              {tab === "grupos" ? "Grupos Monitorados" : tab === "entradas" ? "Entradas" : "Saídas"}
              {tab === "grupos" && inst.grupos.length > 0 && (
                <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeTab === "grupos" ? "bg-[#25D366]/15 text-[#25D366]" : "bg-[#13131F] text-[#3F3F58]"}`}>
                  {inst.grupos.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Grupos ── */}
        {activeTab === "grupos" && (
          <div className="space-y-4">
            {/* Add group header */}
            <div className="flex items-center justify-between">
              <p className="text-[#7F7F9E] text-sm">
                Cada grupo monitora entradas e aplica uma tag no Manychat automaticamente.
              </p>
              <div className="flex items-center gap-2">
                {canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmScan(true)}
                    loading={scanning}
                    title="Busca todos os grupos do Z-API e auto-vincula os similares"
                  >
                    <ScanSearch className="w-4 h-4" />
                    Descobrir Grupos
                  </Button>
                )}
                {canWrite && !showGrupoForm && (
                  <Button size="sm" onClick={openGrupoForm} className="shadow-md shadow-[#25D366]/10">
                    <Plus className="w-4 h-4" />
                    Adicionar Grupo
                  </Button>
                )}
              </div>
            </div>

            {/* Add group form */}
            {showGrupoForm && (
              <div className="bg-[#0F0F1A] border border-[#25D366]/20 rounded-2xl overflow-hidden shadow-[0_4px_32px_rgba(37,211,102,0.06)]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#1C1C2C]">
                  <div>
                    <p className="text-[#EEEEF5] font-semibold text-sm">Novo Grupo Monitorado</p>
                    <p className="text-[#3F3F58] text-xs mt-0.5">
                      Vincule um grupo WA a uma campanha e conta Manychat
                    </p>
                    {inst.cliente ? (
                      <p className="text-xs text-[#7F7F9E] mt-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3 shrink-0" />
                        Cliente: <span className="text-[#EEEEF5] font-medium ml-0.5">{inst.cliente.nome}</span>
                        <span className="text-[#3F3F58] ml-1">— campanhas e contas filtradas para este cliente</span>
                      </p>
                    ) : (
                      <p className="text-xs text-[#F59E0B] mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3 shrink-0" />
                        Instância sem cliente vinculado — exibindo todas as campanhas e contas
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGrupoForm(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3F3F58] hover:text-[#EEEEF5] hover:bg-[#13131F] transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Row 1: Campanha */}
                  <SearchableSelect<Campanha>
                    label="Campanha *"
                    options={campanhas}
                    value={grupoForm.campanha_id}
                    getKey={(c) => c.id}
                    getLabel={(c) => c.nome}
                    placeholder="Selecionar campanha…"
                    searchPlaceholder="Buscar campanha…"
                    onChange={(val, label) => setGrupoForm((p) => ({ ...p, campanha_id: val, campanha_nome: label }))}
                  />

                  {/* Row 2: Grupos WA — multi-select */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">
                        Grupos WhatsApp *
                      </label>
                      <button
                        type="button"
                        onClick={() => fetchZapiGroups(true)}
                        className="text-[#25D366] hover:text-[#1DB954] text-[10px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${zapiGroupsLoading ? "animate-spin" : ""}`} />
                        Recarregar
                      </button>
                    </div>

                    {/* Filter + select-all row */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3F3F58]" />
                      <input
                        value={grupoPickerFilter}
                        onChange={(e) => setGrupoPickerFilter(e.target.value)}
                        placeholder="Filtrar por nome…"
                        className="w-full h-8 pl-7 pr-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-xs text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50 transition-colors"
                      />
                    </div>

                    {(() => {
                      const filtered = zapiGroups.filter((g) =>
                        g.name.toLowerCase().includes(grupoPickerFilter.toLowerCase())
                      )
                      const allSelected = filtered.length > 0 && filtered.every((g) => gruposWaSelecionados.some((s) => s.nome === g.name))
                      return filtered.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setGruposWaSelecionados((prev) => prev.filter((s) => !filtered.some((g) => g.name === s.nome)))
                            } else {
                              const newEntries = filtered
                                .filter((g) => !gruposWaSelecionados.some((s) => s.nome === g.name))
                                .map((g) => ({ nome: g.name, phone: g.phone }))
                              setGruposWaSelecionados((prev) => [...prev, ...newEntries])
                            }
                          }}
                          className="text-[10px] font-medium text-[#25D366] hover:text-[#1DB954] transition-colors"
                        >
                          {allSelected ? `Desmarcar filtrados (${filtered.length})` : `Selecionar todos filtrados (${filtered.length})`}
                        </button>
                      ) : null
                    })()}

                    {/* Checkbox list */}
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-[#1C1C2C] bg-[#0A0A12] divide-y divide-[#1C1C2C]">
                      {zapiGroupsLoading ? (
                        <p className="text-center text-[#3F3F58] text-xs py-4">Carregando grupos…</p>
                      ) : zapiGroups.filter((g) => g.name.toLowerCase().includes(grupoPickerFilter.toLowerCase())).length === 0 ? (
                        <p className="text-center text-[#3F3F58] text-xs py-4">
                          {zapiGroups.length === 0 ? "Nenhum grupo encontrado" : "Nenhum resultado"}
                        </p>
                      ) : (
                        zapiGroups
                          .filter((g) => g.name.toLowerCase().includes(grupoPickerFilter.toLowerCase()))
                          .map((g) => {
                            const checked = gruposWaSelecionados.some((s) => s.nome === g.name)
                            return (
                              <label
                                key={g.phone}
                                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#13131F] transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setGruposWaSelecionados((prev) =>
                                      checked ? prev.filter((s) => s.nome !== g.name) : [...prev, { nome: g.name, phone: g.phone }]
                                    )
                                  }
                                  className="w-3.5 h-3.5 accent-[#25D366] shrink-0"
                                />
                                <span className="text-xs text-[#EEEEF5] truncate">{g.name}</span>
                              </label>
                            )
                          })
                      )}
                    </div>

                    {/* Counter + auto-expand */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#25D366]">
                        {gruposWaSelecionados.length > 0 ? `${gruposWaSelecionados.length} selecionado(s)` : ""}
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoExpand}
                          onChange={(e) => setAutoExpand(e.target.checked)}
                          className="w-3 h-3 accent-[#25D366]"
                        />
                        <span className="text-[10px] text-[#7F7F9E]">Auto-expandir grupos similares</span>
                      </label>
                    </div>
                  </div>

                  {/* Multi-conta section */}
                  <div className="space-y-3 pt-2 border-t border-[#1C1C2C]">
                    <p className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">
                      Contas Manychat *
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Staged conta */}
                      <SearchableSelect<ContaManychat>
                        label="Conta Manychat"
                        options={contas}
                        value={contaStageId}
                        getKey={(c) => c.id}
                        getLabel={(c) => c.nome}
                        placeholder="Selecionar conta…"
                        searchPlaceholder="Buscar conta…"
                        onChange={(val, label) => {
                          setContaStageId(val); setContaStageNome(label)
                          setTagStageId(""); setTagStageNome("")
                          setManychatTags([])
                        }}
                      />
                      {/* Staged tag */}
                      <div className="space-y-1.5">
                        <SearchableSelect<ManychatTag>
                          label="Tag Manychat"
                          options={manychatTags}
                          value={tagStageId}
                          getKey={(t) => String(t.id)}
                          getLabel={(t) => t.name}
                          placeholder={
                            !contaStageId ? "Selecione a conta primeiro…"
                            : tagsLoading ? "Buscando tags…"
                            : manychatTags.length === 0 ? "Nenhuma tag — crie abaixo"
                            : "Selecionar tag…"
                          }
                          searchPlaceholder="Buscar tag…"
                          loading={tagsLoading}
                          disabled={!contaStageId}
                          onChange={(val, label) => { setTagStageId(val); setTagStageNome(label) }}
                        />
                        {/* Criar tag inline */}
                        {contaStageId && !tagsLoading && (
                          <div className="flex gap-2">
                            <input
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag() } }}
                              placeholder="Nome da nova tag…"
                              className="flex-1 h-8 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-xs text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50 transition-colors"
                            />
                            <Button type="button" size="sm" variant="outline" className="h-8 px-3 text-xs shrink-0"
                              disabled={!newTagName.trim() || creatingTag} onClick={handleCreateTag}>
                              {creatingTag ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                              Criar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Adicionar conta button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={!contaStageId || !tagStageId || Number(tagStageId) <= 0}
                      onClick={handleAdicionarConta}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar conta Manychat
                    </Button>

                    {/* Lista de contas confirmadas */}
                    {contasAdicionadas.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest flex items-center gap-1.5">
                          <Tag className="w-3 h-3" /> Contas configuradas ({contasAdicionadas.length})
                        </p>
                        {contasAdicionadas.map((c) => (
                          <div key={c.contaId} className="flex items-center gap-2 px-3 py-2 bg-[#0A0A12] border border-[#1C1C2C] rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-[#EEEEF5] truncate block">{c.contaNome}</span>
                              <span className="text-[10px] text-[#3F3F58] truncate block">{c.tagNome}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setContasAdicionadas((prev) => prev.filter((x) => x.contaId !== c.contaId))}
                              className="w-6 h-6 flex items-center justify-center rounded text-[#3F3F58] hover:text-[#F87171] transition-colors shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                  <Button onClick={handleSaveGrupo} loading={savingGrupo} size="sm" className="shadow-md shadow-[#25D366]/10">
                    Salvar Grupo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowGrupoForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Groups list */}
            {inst.grupos.length === 0 ? (
              <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl flex flex-col items-center justify-center py-16 gap-3 shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
                <div className="w-12 h-12 rounded-xl bg-[#13131F] flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#3F3F58]" />
                </div>
                <p className="text-[#7F7F9E] text-sm">Nenhum grupo configurado</p>
                {canWrite && !showGrupoForm && (
                  <Button size="sm" variant="outline" onClick={openGrupoForm}>
                    <Plus className="w-4 h-4" />
                    Adicionar Grupo
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {inst.grupos.map((g) => (
                  <div
                    key={g.id}
                    className="group bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl px-5 py-4 hover:border-[#252535] transition-all duration-200 shadow-[0_1px_12px_rgba(0,0,0,0.3)]"
                  >
                    <div className="flex items-start gap-3">
                      {/* Left icon */}
                      <div className="w-9 h-9 rounded-xl bg-[#13131F] flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare className="w-4 h-4 text-[#25D366]" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[#EEEEF5] font-semibold text-sm">{g.nome_filtro}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {/* Campanha */}
                              <div className="flex items-center gap-1">
                                <Megaphone className="w-3 h-3 text-[#3F3F58]" />
                                <span className="text-[#7F7F9E] text-xs">{g.campanha?.nome ?? "—"}</span>
                              </div>
                              {/* Conta */}
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-[#3F3F58]" />
                                <span className="text-[#7F7F9E] text-xs">{g.conta_manychat?.nome ?? "—"}</span>
                              </div>
                              {/* Tag */}
                              <div className="flex items-center gap-1">
                                <Tag className="w-3 h-3 text-[#A78BFA]" />
                                <span className="text-[#9898B0] text-xs font-medium">{g.tag_manychat_nome}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right side */}
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => { setGrupoFiltro(g.id); setActiveTab("entradas") }}
                              className="text-right hover:text-[#25D366] transition-colors"
                            >
                              <p className="text-[#EEEEF5] text-sm font-bold">{g._count?.entradas ?? 0}</p>
                              <p className="text-[#3F3F58] text-[10px] uppercase tracking-wider">entradas</p>
                            </button>

                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => setDeleteGrupoDialog(g)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3F3F58] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Entradas ── */}
        {activeTab === "entradas" && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3">
              {inst.grupos.length > 0 && (
                <select
                  value={grupoFiltro}
                  onChange={(e) => setGrupoFiltro(e.target.value)}
                  className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-lg px-3 py-2 text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/40 transition-all hover:border-[#252535]"
                >
                  <option value="">Todos os grupos</option>
                  {inst.grupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nome_filtro}</option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="outline" onClick={fetchEntradas} disabled={entradasLoading}>
                <RefreshCw className={`w-3.5 h-3.5 ${entradasLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Table */}
            <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
              {entradasLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : entradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#13131F] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#3F3F58]" />
                  </div>
                  <p className="text-[#7F7F9E] text-sm">Nenhuma entrada registrada</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1C1C2C]">
                      {["Participante", "Grupo / Tag", "Lead", "Tag aplicada", "Entrou em"].map((h) => (
                        <th key={h} className="text-left text-[10px] font-semibold text-[#3F3F58] uppercase tracking-wider px-5 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entradas.map((e) => (
                      <tr key={e.id} className="border-b border-[#1C1C2C] last:border-0 hover:bg-[#121220] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-[#EEEEF5] text-sm font-medium">{e.nome_whatsapp || "—"}</p>
                          <p className="text-[#3F3F58] text-xs font-mono mt-0.5">{e.telefone}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[#9898B0] text-sm">{e.grupo.nome_filtro}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Tag className="w-2.5 h-2.5 text-[#A78BFA]" />
                            <p className="text-[#3F3F58] text-xs">{e.grupo.tag_manychat_nome}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {e.lead ? (
                            <Link href={`/admin/leads/${e.lead.id}`} className="text-[#25D366] text-sm hover:underline font-medium">
                              {e.lead.nome}
                            </Link>
                          ) : (
                            <span className="text-[#3F3F58] text-sm">Não identificado</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {e.tag_aplicada ? (
                            <span className="inline-flex items-center gap-1 text-[#22C55E] text-sm font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#3F3F58] text-sm">
                              <XCircle className="w-3.5 h-3.5" />
                              Não
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[#7F7F9E] text-sm whitespace-nowrap">
                          {formatDate(e.entrou_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Saídas ── */}
        {activeTab === "saidas" && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3">
              {inst.grupos.length > 0 && (
                <select
                  value={grupoFiltroSaidas}
                  onChange={(e) => setGrupoFiltroSaidas(e.target.value)}
                  className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-lg px-3 py-2 text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/40 transition-all hover:border-[#252535]"
                >
                  <option value="">Todos os grupos</option>
                  {inst.grupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nome_filtro}</option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="outline" onClick={fetchSaidas} disabled={saidasLoading}>
                <RefreshCw className={`w-3.5 h-3.5 ${saidasLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Table */}
            <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
              {saidasLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : saidas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#13131F] flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-[#3F3F58]" />
                  </div>
                  <p className="text-[#7F7F9E] text-sm">Nenhuma saída registrada</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1C1C2C]">
                      {["Participante", "Grupo", "Lead", "Saiu em"].map((h) => (
                        <th key={h} className="text-left text-[10px] font-semibold text-[#3F3F58] uppercase tracking-wider px-5 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {saidas.map((s) => (
                      <tr key={s.id} className="border-b border-[#1C1C2C] last:border-0 hover:bg-[#121220] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-[#EEEEF5] text-sm font-medium">{s.nome_whatsapp || "—"}</p>
                          <p className="text-[#3F3F58] text-xs font-mono mt-0.5">{s.telefone}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[#9898B0] text-sm">{s.grupo.nome_filtro}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {s.lead ? (
                            <Link href={`/admin/leads/${s.lead.id}`} className="text-[#25D366] text-sm hover:underline font-medium">
                              {s.lead.nome}
                            </Link>
                          ) : (
                            <span className="text-[#3F3F58] text-sm">Não identificado</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[#7F7F9E] text-sm whitespace-nowrap">
                          {formatDate(s.saiu_at)}
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

      {/* Scan confirmation dialog */}
      <Dialog open={confirmScan} onOpenChange={setConfirmScan}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escanear grupos?</DialogTitle>
            <DialogDescription>
              Busca todos os grupos e comunidades do Z-API e vincula automaticamente os similares
              aos grupos já configurados. A operação pode levar alguns segundos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmScan(false)}>Cancelar</Button>
            <Button onClick={() => { setConfirmScan(false); handleScanGrupos() }} loading={scanning}>
              Escanear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan result modal */}
      <Dialog open={!!scanResult} onOpenChange={() => { setScanResult(null); setScanFilter("") }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado do Escaneamento</DialogTitle>
            <DialogDescription>
              {scanResult?.total_grupos_zapi} grupos encontrados no Z-API
            </DialogDescription>
          </DialogHeader>

          {scanResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-[#25D366] text-xl font-bold">{scanResult.novos_vinculados}</p>
                  <p className="text-[#3F3F58] text-xs mt-0.5">Novos vinculados</p>
                </div>
                <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-[#7F7F9E] text-xl font-bold">{scanResult.ja_configurados}</p>
                  <p className="text-[#3F3F58] text-xs mt-0.5">Já configurados</p>
                </div>
                <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-[#3F3F58] text-xl font-bold">{scanResult.sem_match}</p>
                  <p className="text-[#3F3F58] text-xs mt-0.5">Sem match</p>
                </div>
              </div>

              {/* Entradas processadas */}
              {(scanResult.entradas_processadas ?? 0) > 0 && (
                <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-[#60A5FA] text-xl font-bold">{scanResult.entradas_processadas}</p>
                  <p className="text-[#3F3F58] text-xs mt-0.5">
                    Entradas processadas
                    {(scanResult.erros_entradas ?? 0) > 0 && (
                      <span className="text-[#F87171] ml-1">({scanResult.erros_entradas} erros)</span>
                    )}
                  </p>
                </div>
              )}

              {/* Name filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3F3F58]" />
                <input
                  type="text"
                  value={scanFilter}
                  onChange={(e) => setScanFilter(e.target.value)}
                  placeholder="Filtrar por nome…"
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#1C1C2C] bg-[#0A0A12] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/40 transition-colors"
                />
              </div>

              {/* Detail list */}
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {scanResult.detalhes
                  .filter((d) => !scanFilter || d.nome.toLowerCase().includes(scanFilter.toLowerCase()))
                  .map((d, i) => (
                  <div
                    key={`${d.grupoWaId || i}-${d.acao}`}
                    className="flex items-start gap-3 bg-[#0A0A12] border border-[#1C1C2C] rounded-lg px-3 py-2.5"
                  >
                    <div className="shrink-0 mt-0.5">
                      {d.acao === "criado" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                      ) : d.acao === "existente" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#7F7F9E]" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#3F3F58]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#EEEEF5] text-xs font-medium truncate">{d.nome}</p>
                      {d.templateNomeFiltro && (
                        <p className="text-[#3F3F58] text-[10px] mt-0.5 truncate">
                          Template: {d.templateNomeFiltro}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {d.leads_count > 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#25D366]/10 text-[#25D366]">
                          {d.leads_count} leads
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-[#3F3F58]">
                        {(d.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setScanResult(null); setScanFilter("") }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit instância dialog */}
      <Dialog open={showEditInstancia} onOpenChange={setShowEditInstancia}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Instância</DialogTitle>
            <DialogDescription>
              Token e Client Token só são alterados se preenchidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9898B0]">Nome *</label>
              <input value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50"
                placeholder="Nome da instância" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9898B0]">Instance ID *</label>
              <input value={editForm.instance_id} onChange={(e) => setEditForm((p) => ({ ...p, instance_id: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] font-mono focus:outline-none focus:border-[#25D366]/50"
                placeholder="Instance ID" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9898B0]">
                Token <span className="text-[#3F3F58] font-normal">(deixe em branco para manter)</span>
              </label>
              <input type="password" value={editForm.token} onChange={(e) => setEditForm((p) => ({ ...p, token: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50"
                placeholder="••••••••" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9898B0]">
                Client Token <span className="text-[#3F3F58] font-normal">(deixe em branco para manter)</span>
              </label>
              <input type="password" value={editForm.client_token} onChange={(e) => setEditForm((p) => ({ ...p, client_token: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50"
                placeholder="••••••••" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9898B0]">Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as "ativo" | "inativo" }))}
                className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditInstancia(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} loading={savingEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete grupo dialog */}
      <Dialog open={!!deleteGrupoDialog} onOpenChange={() => setDeleteGrupoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover grupo monitorado</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o grupo{" "}
              <strong className="text-[#EEEEF5]">{deleteGrupoDialog?.nome_filtro}</strong>?{" "}
              O histórico de entradas também será excluído.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteGrupoDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteGrupo} loading={deletingGrupo}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
