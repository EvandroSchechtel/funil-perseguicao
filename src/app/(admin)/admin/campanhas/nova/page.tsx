"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertCircle, Copy,
  Search, ChevronDown, Plus, Trash2, Wifi, Users, Tag,
  Info, X, Loader2, ExternalLink,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

// ── Types ───────────────────────────────────────────────────────────────────

interface Cliente { id: string; nome: string }
interface InstanciaZApi { id: string; nome: string; instance_id: string; cliente_id: string | null }
interface ContaManychat { id: string; nome: string; page_name: string | null }
interface ZApiGroup { phone: string; name: string; isGroup: boolean }
interface ManychatTag { id: number; name: string }

interface GrupoConfig {
  instanciaId: string
  instanciaNome: string
  grupoId: string
  grupoNome: string
  contaManychatId: string
  contaManychatNome: string
  tagId: number
  tagNome: string
  nomeFiltro: string
}

// ── FieldInfo (tour icon) ────────────────────────────────────────────────────

function FieldInfo({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-4 h-4 rounded-full border border-[#3F3F58] text-[#3F3F58] hover:border-[#25D366] hover:text-[#25D366] transition-colors flex items-center justify-center text-[9px] font-bold shrink-0"
        title={title}
      >
        ?
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#EEEEF5]">
              <Info className="w-4 h-4 text-[#25D366]" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-[#9898B0] space-y-2 py-1">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── SearchableSelect ─────────────────────────────────────────────────────────

function SearchableSelect<T>({
  options, value, onChange, getKey, getLabel, placeholder,
  searchPlaceholder = "Buscar...", loading: isLoading, disabled, error,
}: {
  options: T[]; value: string; onChange: (v: string) => void
  getKey: (i: T) => string; getLabel: (i: T) => string
  placeholder: string; searchPlaceholder?: string
  loading?: boolean; disabled?: boolean; error?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => getKey(o) === value)
  const filtered = options.filter((o) => getLabel(o).toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch("") }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => { setOpen((v) => !v); setSearch("") }}
        className={`flex h-10 w-full items-center justify-between rounded-lg border bg-[#13131F] px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#252535] focus:outline-none ${error ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}
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
              <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#13131F] rounded-lg border border-[#1C1C2C] text-sm text-[#EEEEF5] placeholder-[#3F3F58] pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#25D366]/40"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[#3F3F58] text-xs text-center py-4">Nenhum resultado</p>
            ) : filtered.map((o) => (
              <button key={getKey(o)} type="button"
                onClick={() => { onChange(getKey(o)); setOpen(false); setSearch("") }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[#13131F] transition-colors text-left gap-2"
              >
                <span className="text-[#EEEEF5] truncate">{getLabel(o)}</span>
                {getKey(o) === value && <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-[#F87171] mt-1.5">{error}</p>}
    </div>
  )
}

// ── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Dados Básicos", "Grupos WhatsApp", "Revisão"]
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? "bg-[#25D366] text-[#0A0A12]"
                : active ? "bg-[#25D366]/20 border-2 border-[#25D366] text-[#25D366]"
                : "bg-[#13131F] border border-[#1C1C2C] text-[#3F3F58]"
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-[#EEEEF5]" : done ? "text-[#25D366]" : "text-[#3F3F58]"}`}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 transition-all ${done ? "bg-[#25D366]" : "bg-[#1C1C2C]"}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Step 2: Grupo Form ───────────────────────────────────────────────────────

function AddGrupoForm({
  clienteId, instancias, contas, accessToken,
  onAdd,
}: {
  clienteId: string
  instancias: InstanciaZApi[]
  contas: ContaManychat[]
  accessToken: string | null
  onAdd: (g: GrupoConfig) => void
}) {
  const [instanciaId, setInstanciaId] = useState("")
  const [zapiGroups, setZapiGroups] = useState<ZApiGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [grupoId, setGrupoId] = useState("")
  const [grupoNome, setGrupoNome] = useState("")
  const [contaId, setContaId] = useState("")
  const [tags, setTags] = useState<ManychatTag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [tagId, setTagId] = useState("")
  const [tagNome, setTagNome] = useState("")
  const [nomeFiltro, setNomeFiltro] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const clienteInstancias = instancias.filter((i) => i.cliente_id === clienteId)

  async function fetchGroups(id: string) {
    if (!id || !accessToken) return
    setLoadingGroups(true)
    setZapiGroups([])
    setGrupoId("")
    setGrupoNome("")
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}/detectar-grupos`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setZapiGroups((data.grupos || []).filter((g: ZApiGroup) => g.isGroup))
    } catch {
      toast.error("Erro ao buscar grupos.")
    } finally {
      setLoadingGroups(false)
    }
  }

  async function fetchTags(cId: string) {
    if (!cId || !instanciaId || !accessToken) return
    setLoadingTags(true)
    setTags([])
    setTagId("")
    setTagNome("")
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${instanciaId}/tags-manychat?conta_id=${cId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setTags(data.tags || [])
    } catch {
      toast.error("Erro ao buscar tags.")
    } finally {
      setLoadingTags(false)
    }
  }

  function handleAdd() {
    const errs: Record<string, string> = {}
    if (!instanciaId) errs.instancia = "Selecione uma instância"
    if (!grupoId) errs.grupo = "Selecione um grupo"
    if (!contaId) errs.conta = "Selecione uma conta Manychat"
    if (!tagId) errs.tag = "Selecione uma tag"
    if (!nomeFiltro.trim()) errs.filtro = "Informe o nome do grupo para filtro"
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    const instancia = clienteInstancias.find((i) => i.id === instanciaId)
    const conta = contas.find((c) => c.id === contaId)
    const tag = tags.find((t) => String(t.id) === tagId)

    onAdd({
      instanciaId,
      instanciaNome: instancia?.nome || "",
      grupoId,
      grupoNome,
      contaManychatId: contaId,
      contaManychatNome: conta?.nome || "",
      tagId: Number(tagId),
      tagNome: tag?.name || tagNome,
      nomeFiltro: nomeFiltro.trim(),
    })

    // Reset
    setInstanciaId(""); setZapiGroups([]); setGrupoId(""); setGrupoNome("")
    setContaId(""); setTags([]); setTagId(""); setTagNome(""); setNomeFiltro("")
  }

  if (clienteInstancias.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-[#13131F] border border-[#1C1C2C] rounded-xl text-sm text-[#5A5A72]">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Nenhuma instância Z-API vinculada a este cliente. <Link href="/admin/zapi/nova" className="text-[#25D366] hover:underline">Adicionar instância</Link></span>
      </div>
    )
  }

  return (
    <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-5 space-y-4">
      <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Adicionar grupo</p>

      {/* Instância */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
          Instância Z-API
          <FieldInfo title="Instância Z-API">
            <p>A instância Z-API é o WhatsApp conectado ao sistema. Cada instância representa um número de WhatsApp vinculado ao cliente.</p>
            <p className="mt-1">Selecione a instância que tem acesso ao grupo que deseja monitorar.</p>
          </FieldInfo>
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchableSelect
              options={clienteInstancias}
              value={instanciaId}
              onChange={(v) => { setInstanciaId(v); setZapiGroups([]); setGrupoId(""); setGrupoNome("") }}
              getKey={(i) => i.id}
              getLabel={(i) => i.nome}
              placeholder="Selecionar instância"
              error={errors.instancia}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!instanciaId || loadingGroups}
            onClick={() => fetchGroups(instanciaId)}
            className="shrink-0 h-10"
          >
            {loadingGroups ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            Detectar grupos
          </Button>
        </div>
      </div>

      {/* Grupo */}
      {(zapiGroups.length > 0 || grupoId) && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
            Grupo WhatsApp
            <FieldInfo title="Grupo WhatsApp">
              <p>Selecione o grupo que os leads do lançamento vão entrar. O sistema vai monitorar todas as entradas neste grupo.</p>
              <p className="mt-1">O nome do grupo é usado como filtro — apenas entradas cujo grupo coincide com este nome são registradas.</p>
            </FieldInfo>
          </label>
          <SearchableSelect
            options={zapiGroups}
            value={grupoId}
            onChange={(v) => {
              setGrupoId(v)
              const g = zapiGroups.find((g) => g.phone === v)
              const name = g?.name || ""
              setGrupoNome(name)
              setNomeFiltro(name)
            }}
            getKey={(g) => g.phone}
            getLabel={(g) => g.name}
            placeholder="Selecionar grupo"
            searchPlaceholder="Buscar grupo..."
            error={errors.grupo}
          />
          {errors.filtro && !nomeFiltro && <p className="text-xs text-[#F87171]">{errors.filtro}</p>}
        </div>
      )}

      {/* Nome filtro */}
      {grupoId && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
            Nome do grupo (filtro)
            <FieldInfo title="Nome do grupo para filtro">
              <p>Este nome é usado para filtrar os webhooks do Z-API. Apenas entradas em grupos cujo nome contém este texto são registradas.</p>
              <p className="mt-1">Normalmente é o nome exato do grupo. Pode usar parte do nome para capturar múltiplos grupos similares.</p>
            </FieldInfo>
          </label>
          <input
            type="text"
            value={nomeFiltro}
            onChange={(e) => setNomeFiltro(e.target.value)}
            placeholder="Ex: Lançamento Produto X"
            className={`w-full h-10 px-3 rounded-lg border bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none transition-all ${errors.filtro ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}
          />
          {errors.filtro && <p className="text-xs text-[#F87171]">{errors.filtro}</p>}
        </div>
      )}

      {/* Conta Manychat */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
          Conta Manychat
          <FieldInfo title="Conta Manychat">
            <p>A conta Manychat é quem vai receber os leads e aplicar as tags de automação.</p>
            <p className="mt-1">Selecione a conta vinculada ao lançamento atual do cliente.</p>
          </FieldInfo>
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchableSelect
              options={contas}
              value={contaId}
              onChange={(v) => { setContaId(v); setTags([]); setTagId(""); setTagNome("") }}
              getKey={(c) => c.id}
              getLabel={(c) => c.nome}
              placeholder="Selecionar conta"
              error={errors.conta}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!contaId || !instanciaId || loadingTags}
            onClick={() => fetchTags(contaId)}
            className="shrink-0 h-10"
          >
            {loadingTags ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
            Buscar tags
          </Button>
        </div>
      </div>

      {/* Tag */}
      {(tags.length > 0 || tagId) && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
            Tag de entrada
            <FieldInfo title="Tag de entrada (Manychat)">
              <p>Esta tag será aplicada automaticamente no contato do Manychat quando o lead entrar no grupo de WhatsApp.</p>
              <p className="mt-1">Para encontrar os IDs das tags: Manychat → Tags. Use o botão "Buscar tags" para listar todas as tags disponíveis.</p>
            </FieldInfo>
          </label>
          <SearchableSelect
            options={tags}
            value={tagId}
            onChange={(v) => { setTagId(v); setTagNome(tags.find((t) => String(t.id) === v)?.name || "") }}
            getKey={(t) => String(t.id)}
            getLabel={(t) => t.name}
            placeholder="Selecionar tag"
            searchPlaceholder="Buscar tag..."
            error={errors.tag}
          />
        </div>
      )}

      <Button type="button" onClick={handleAdd} className="w-full" variant="outline">
        <Plus className="w-4 h-4" />
        Adicionar grupo
      </Button>
    </div>
  )
}

// ── Checklist Item ───────────────────────────────────────────────────────────

function CheckItem({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        ok ? "bg-[#22C55E]/15 text-[#22C55E]"
        : warn ? "bg-[#F59E0B]/15 text-[#F59E0B]"
        : "bg-[#F87171]/15 text-[#F87171]"
      }`}>
        {ok ? <Check className="w-3 h-3" /> : warn ? <AlertCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
      </div>
      <span className={`text-sm ${ok ? "text-[#EEEEF5]" : warn ? "text-[#F59E0B]" : "text-[#9898B0]"}`}>{label}</span>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NovaCampanhaWizardPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [step, setStep] = useState(1)

  // Step 1 state
  const [nome, setNome] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [descricao, setDescricao] = useState("")
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({})

  // Data
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [instancias, setInstancias] = useState<InstanciaZApi[]>([])
  const [contas, setContas] = useState<ContaManychat[]>([])

  // Step 2 state
  const [grupos, setGrupos] = useState<GrupoConfig[]>([])

  // Step 3 / creation state
  const [creating, setCreating] = useState(false)
  const [criado, setCriado] = useState<{ campanhaId: string; webhookUrl: string; nome: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Load clientes
  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/clientes?per_page=200", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => setClientes(d.data || []))
      .catch(() => {})
      .finally(() => setLoadingClientes(false))
  }, [accessToken])

  // Load instancias when client changes
  const loadClienteData = useCallback(async (cId: string) => {
    if (!cId || !accessToken) return
    try {
      const [instRes, clienteRes] = await Promise.all([
        fetch("/api/admin/zapi/instancias", { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/admin/clientes/${cId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      const [instData, clienteData] = await Promise.all([instRes.json(), clienteRes.json()])
      const allInst: InstanciaZApi[] = instData.instancias || []
      setInstancias(allInst.filter((i) => i.cliente_id === cId))
      setContas(clienteData.data?.contas_manychat || [])
    } catch {}
  }, [accessToken])

  useEffect(() => {
    if (clienteId) loadClienteData(clienteId)
    else { setInstancias([]); setContas([]) }
    setGrupos([])
  }, [clienteId, loadClienteData])

  function validateStep1() {
    const errs: Record<string, string> = {}
    if (!nome.trim()) errs.nome = "Nome é obrigatório"
    if (!clienteId) errs.cliente = "Selecione um cliente"
    setStep1Errors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate() {
    setCreating(true)
    try {
      // 1. Create campaign
      const campRes = await fetch("/api/admin/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          status,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          cliente_id: clienteId || null,
        }),
      })
      const campData = await campRes.json()
      if (!campRes.ok) {
        toast.error(campData.message || "Erro ao criar campanha.")
        return
      }

      const campanhaId = campData.data?.id
      const webhookUrl = campData.webhook?.url_publica || ""

      // 2. Create monitoring groups
      const gruposErrors: string[] = []
      for (const g of grupos) {
        try {
          const res = await fetch(`/api/admin/zapi/instancias/${g.instanciaId}/grupos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              campanha_id: campanhaId,
              conta_manychat_id: g.contaManychatId,
              nome_filtro: g.nomeFiltro,
              tag_manychat_id: g.tagId,
              tag_manychat_nome: g.tagNome,
            }),
          })
          if (!res.ok) gruposErrors.push(g.grupoNome)
        } catch {
          gruposErrors.push(g.grupoNome)
        }
      }

      if (gruposErrors.length > 0) {
        toast.warning(`Campanha criada, mas ${gruposErrors.length} grupo(s) falharam: ${gruposErrors.join(", ")}`)
      }

      setCriado({ campanhaId, webhookUrl, nome: nome.trim() })
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("URL copiada!")
    } catch {}
  }

  // ── Success screen ──────────────────────────────────────────────────────

  if (criado) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Campanhas", href: "/admin/campanhas" }, { label: "Nova Campanha" }]} />
        <div className="p-6 max-w-lg">
          <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] p-8 space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-[#EEEEF5] text-xl font-bold">Campanha criada!</p>
                <p className="text-[#7F7F9E] text-sm mt-1">
                  <span className="text-[#EEEEF5]">{criado.nome}</span> está pronta para receber leads.
                </p>
              </div>
            </div>

            {criado.webhookUrl && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#3F3F58] uppercase tracking-widest">URL do Webhook</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-[#7F7F9E] text-xs flex items-center font-mono overflow-hidden">
                    <span className="truncate">{criado.webhookUrl}</span>
                  </div>
                  <Button type="button" variant="outline" className="shrink-0 h-10 px-3" onClick={() => handleCopy(criado.webhookUrl)}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-[#3F3F58]">Use esta URL no Manychat para enviar leads para esta campanha.</p>
              </div>
            )}

            {grupos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#3F3F58] uppercase tracking-widest">{grupos.length} grupo(s) configurado(s)</p>
                {grupos.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-[#9898B0]">
                    <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span className="truncate">{g.grupoNome}</span>
                    <span className="text-[#3F3F58]">→</span>
                    <span className="text-[#25D366] truncate">{g.tagNome}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/admin/campanhas")} className="flex-1">
                Ver Campanhas
              </Button>
              <Button onClick={() => router.push(`/admin/campanhas/${criado.campanhaId}/editar`)} className="flex-1">
                <ExternalLink className="w-4 h-4" />
                Abrir Campanha
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Wizard ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Campanhas", href: "/admin/campanhas" }, { label: "Nova Campanha" }]} />

      <div className="p-6 max-w-2xl">
        <Link href="/admin/campanhas" className="inline-flex items-center gap-2 text-[#7F7F9E] hover:text-[#EEEEF5] text-sm mb-7 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Campanhas
        </Link>

        <div className="mb-7">
          <h1 className="text-[#EEEEF5] text-2xl font-bold">Nova Campanha</h1>
          <p className="text-[#7F7F9E] text-sm mt-1">Configure passo a passo o lançamento</p>
        </div>

        <StepIndicator current={step} total={3} />

        <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] overflow-hidden">

          {/* ── Step 1: Dados Básicos ── */}
          {step === 1 && (
            <div>
              <div className="px-6 pt-6 pb-2">
                <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest mb-5">Dados da Campanha</p>
                <div className="space-y-4">

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                      Nome da Campanha <span className="text-[#F87171]">*</span>
                      <FieldInfo title="Nome da Campanha">
                        <p>Identifique este lançamento. Use um nome descritivo que inclua o produto e o período.</p>
                        <p className="mt-1">Exemplo: "Lançamento Curso X — Junho 2025"</p>
                      </FieldInfo>
                    </label>
                    <Input
                      placeholder="Ex: Lançamento Produto X, Black Friday..."
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      error={step1Errors.nome}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                      Cliente <span className="text-[#F87171]">*</span>
                      <FieldInfo title="Cliente">
                        <p>Vincule esta campanha a um cliente. Os grupos de WhatsApp e contas Manychat disponíveis serão filtrados para este cliente.</p>
                      </FieldInfo>
                    </label>
                    <SearchableSelect
                      options={clientes}
                      value={clienteId}
                      onChange={setClienteId}
                      getKey={(c) => c.id}
                      getLabel={(c) => c.nome}
                      placeholder="Selecionar cliente"
                      searchPlaceholder="Buscar cliente..."
                      loading={loadingClientes}
                      error={step1Errors.cliente}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0]">Descrição (opcional)</label>
                    <textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descreva o objetivo desta campanha..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50 transition-colors resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#9898B0]">Data de Início</label>
                      <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50 transition-colors" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#9898B0]">Data de Fim</label>
                      <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50 transition-colors" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#13131F] border border-[#1C1C2C] rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-[#EEEEF5]">Status</p>
                      <p className="text-xs text-[#3F3F58] mt-0.5">
                        {status === "ativo" ? "Campanha ativa — aceita leads" : "Campanha inativa"}
                      </p>
                    </div>
                    <Switch checked={status === "ativo"} onCheckedChange={(c) => setStatus(c ? "ativo" : "inativo")} />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
                <Button className="flex-1" onClick={() => { if (validateStep1()) setStep(2) }}>
                  Próximo — Grupos WhatsApp
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Grupos WhatsApp ── */}
          {step === 2 && (
            <div>
              <div className="px-6 pt-6 pb-2 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Grupos WhatsApp</p>
                    <p className="text-[#7F7F9E] text-xs mt-1">
                      Configure quais grupos do WhatsApp serão monitorados e qual tag aplicar no Manychat.
                    </p>
                  </div>
                  <FieldInfo title="Grupos WhatsApp">
                    <p>Cada grupo monitorado é um grupo de WhatsApp do lançamento. Quando um lead entra no grupo, o sistema detecta automaticamente e aplica a tag correspondente no Manychat.</p>
                    <p className="mt-1 text-[#F59E0B]">Este passo é opcional — você pode configurar os grupos depois, na tela de detalhes da campanha.</p>
                  </FieldInfo>
                </div>

                {/* Grupos já adicionados */}
                {grupos.length > 0 && (
                  <div className="space-y-2">
                    {grupos.map((g, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-[#13131F] border border-[#1C1C2C] rounded-xl">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                            <span className="text-[#EEEEF5] font-medium truncate">{g.grupoNome}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[#5A5A72]">
                            <span className="truncate">{g.instanciaNome}</span>
                            <span>·</span>
                            <Tag className="w-3 h-3" />
                            <span className="text-[#25D366] truncate">{g.tagNome}</span>
                            <span>·</span>
                            <span className="truncate">{g.contaManychatNome}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setGrupos((p) => p.filter((_, j) => j !== i))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3F3F58] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add group form */}
                <AddGrupoForm
                  clienteId={clienteId}
                  instancias={instancias}
                  contas={contas}
                  accessToken={accessToken}
                  onAdd={(g) => setGrupos((p) => [...p, g])}
                />
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
                <Button className="flex-1" onClick={() => setStep(3)}>
                  {grupos.length === 0 ? "Pular — Revisar" : `Revisar (${grupos.length} grupo${grupos.length !== 1 ? "s" : ""})`}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Revisão ── */}
          {step === 3 && (
            <div>
              <div className="px-6 pt-6 pb-2 space-y-5">
                <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Revisão e Aprovação</p>

                {/* Checklist */}
                <div className="space-y-2.5">
                  <CheckItem ok={!!nome.trim()} label={nome.trim() ? `Nome: ${nome.trim()}` : "Nome não definido"} />
                  <CheckItem ok={!!clienteId} label={clienteId ? `Cliente: ${clientes.find((c) => c.id === clienteId)?.nome || clienteId}` : "Cliente não selecionado"} />
                  <CheckItem ok={grupos.length > 0} warn={grupos.length === 0} label={grupos.length > 0 ? `${grupos.length} grupo(s) WhatsApp configurado(s)` : "Nenhum grupo WhatsApp — pode ser adicionado depois"} />
                  {grupos.length > 0 && grupos.every((g) => g.tagId) && (
                    <CheckItem ok label="Tags de entrada configuradas em todos os grupos" />
                  )}
                  <CheckItem ok label="Webhook será gerado automaticamente" />
                </div>

                {/* Summary */}
                <div className="bg-[#13131F] border border-[#1C1C2C] rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">Resumo</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div><span className="text-[#5A5A72]">Nome</span><p className="text-[#EEEEF5] font-medium mt-0.5">{nome}</p></div>
                    <div><span className="text-[#5A5A72]">Status</span><p className={`font-medium mt-0.5 ${status === "ativo" ? "text-[#22C55E]" : "text-[#5A5A72]"}`}>{status === "ativo" ? "Ativa" : "Inativa"}</p></div>
                    {dataInicio && <div><span className="text-[#5A5A72]">Início</span><p className="text-[#EEEEF5] mt-0.5">{new Date(dataInicio).toLocaleDateString("pt-BR")}</p></div>}
                    {dataFim && <div><span className="text-[#5A5A72]">Fim</span><p className="text-[#EEEEF5] mt-0.5">{new Date(dataFim).toLocaleDateString("pt-BR")}</p></div>}
                    {descricao && <div className="col-span-2"><span className="text-[#5A5A72]">Descrição</span><p className="text-[#9898B0] mt-0.5">{descricao}</p></div>}
                  </div>
                  {grupos.length > 0 && (
                    <div className="pt-2 border-t border-[#1C1C2C] space-y-1.5">
                      {grupos.map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-[#7F7F9E]">
                          <Users className="w-3 h-3 text-[#25D366]" />
                          <span className="truncate">{g.grupoNome}</span>
                          <span className="text-[#3F3F58]">→</span>
                          <Tag className="w-3 h-3 text-[#A78BFA]" />
                          <span className="text-[#A78BFA] truncate">{g.tagNome}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
                <Button className="flex-1 shadow-lg shadow-[#25D366]/10" loading={creating} onClick={handleCreate}>
                  <CheckCircle2 className="w-4 h-4" />
                  Criar Campanha
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
