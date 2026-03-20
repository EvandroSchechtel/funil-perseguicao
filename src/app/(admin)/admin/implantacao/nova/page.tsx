"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertCircle, X,
  Loader2, Building2, Zap, Wifi, Megaphone, ClipboardCheck,
  Eye, EyeOff, Search, ChevronDown, Plus, Trash2, Tag, Users,
  Info, ExternalLink, Copy,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

// ── Types ────────────────────────────────────────────────────────────────────

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

interface CreatedResources {
  clienteId: string
  clienteNome: string
  contaId: string
  contaNome: string
  instanciaId: string | null
  instanciaNome: string | null
  campanhaId: string
  campanhaUrl: string
  webhookUrl: string
  grupos: GrupoConfig[]
}

type StepId = 1 | 2 | 3 | 4 | 5

// ── FieldInfo (tour / help icon) ─────────────────────────────────────────────

function FieldInfo({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-4 h-4 rounded-full border border-[#3F3F58] text-[#3F3F58] hover:border-[#25D366] hover:text-[#25D366] transition-colors flex items-center justify-center text-[9px] font-bold shrink-0"
      >?</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#EEEEF5]">
              <Info className="w-4 h-4 text-[#25D366]" />{title}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-[#9898B0] space-y-2 py-1">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── SearchableSelect ──────────────────────────────────────────────────────────

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
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled || isLoading} onClick={() => { setOpen((v) => !v); setSearch("") }}
        className={`flex h-10 w-full items-center justify-between rounded-lg border bg-[#13131F] px-3 py-2 text-sm transition-all disabled:opacity-40 hover:border-[#252535] focus:outline-none ${error ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}>
        <span className={selected ? "text-[#EEEEF5]" : "text-[#3F3F58]"}>{isLoading ? "Carregando…" : selected ? getLabel(selected) : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#3F3F58] shrink-0" />
      </button>
      {open && !isLoading && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#1C1C2C] bg-[#0F0F1A] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="p-2 border-b border-[#1C1C2C]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3F3F58]" />
              <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#13131F] rounded-lg border border-[#1C1C2C] text-sm text-[#EEEEF5] placeholder-[#3F3F58] pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#25D366]/40" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[#3F3F58] text-xs text-center py-4">Nenhum resultado</p>
            ) : filtered.map((o) => (
              <button key={getKey(o)} type="button" onClick={() => { onChange(getKey(o)); setOpen(false); setSearch("") }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[#13131F] transition-colors text-left gap-2">
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

// ── Step Header ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Cliente", icon: Building2 },
  { id: 2, label: "Z-API", icon: Wifi },
  { id: 3, label: "Campanha", icon: Megaphone },
  { id: 4, label: "Grupos WA", icon: Users },
  { id: 5, label: "Aprovação", icon: ClipboardCheck },
]

function StepIndicator({ current }: { current: StepId }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = s.id < current
        const active = s.id === current
        const Icon = s.icon
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                done ? "bg-[#25D366] text-[#0A0A12]"
                : active ? "bg-[#25D366]/15 border-2 border-[#25D366] text-[#25D366]"
                : "bg-[#13131F] border border-[#1C1C2C] text-[#3F3F58]"
              }`}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-[#EEEEF5]" : done ? "text-[#25D366]" : "text-[#3F3F58]"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1.5 mb-4 min-w-[16px] transition-all ${done ? "bg-[#25D366]" : "bg-[#1C1C2C]"}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Check Item ────────────────────────────────────────────────────────────────

function CheckItem({ ok, warn, skip, label, sub }: { ok: boolean; warn?: boolean; skip?: boolean; label: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        ok ? "bg-[#22C55E]/15 text-[#22C55E]"
        : skip ? "bg-[#3F3F58]/20 text-[#3F3F58]"
        : warn ? "bg-[#F59E0B]/15 text-[#F59E0B]"
        : "bg-[#F87171]/15 text-[#F87171]"
      }`}>
        {ok ? <Check className="w-3 h-3" /> : skip ? <X className="w-2.5 h-2.5" /> : warn ? <AlertCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      </div>
      <div>
        <p className={`text-sm ${ok ? "text-[#EEEEF5]" : warn || skip ? "text-[#7F7F9E]" : "text-[#9898B0]"}`}>{label}</p>
        {sub && <p className="text-xs text-[#3F3F58] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImplantacaoPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [step, setStep] = useState<StepId>(1)
  const [resources, setResources] = useState<Partial<CreatedResources>>({})
  const [copied, setCopied] = useState(false)

  // ── Step 1: Cliente ─────────────────────────────────────────────────────────
  const [s1Nome, setS1Nome] = useState("")
  const [s1Email, setS1Email] = useState("")
  const [s1Tel, setS1Tel] = useState("")
  const [s1ContaNome, setS1ContaNome] = useState("")
  const [s1ApiKey, setS1ApiKey] = useState("")
  const [s1ShowKey, setS1ShowKey] = useState(false)
  const [s1TesteStatus, setS1TesteStatus] = useState<"idle" | "testing" | "ok" | "error">("idle")
  const [s1TesteMsg, setS1TesteMsg] = useState("")
  const [s1FieldId, setS1FieldId] = useState("")
  const [s1Errors, setS1Errors] = useState<Record<string, string>>({})
  const [s1Loading, setS1Loading] = useState(false)

  async function testarManychat() {
    if (!s1ApiKey.trim()) { setS1Errors((p) => ({ ...p, api_key: "Informe a API Key" })); return }
    setS1TesteStatus("testing"); setS1TesteMsg("")
    try {
      const res = await fetch("/api/admin/contas/testar-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ api_key: s1ApiKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setS1TesteStatus("ok")
        setS1TesteMsg(`Conectado: ${data.page_name}`)
        if (!s1ContaNome.trim() && data.page_name) setS1ContaNome(data.page_name)
      } else {
        setS1TesteStatus("error")
        setS1TesteMsg(data.message || "Falha na conexão")
      }
    } catch {
      setS1TesteStatus("error"); setS1TesteMsg("Erro de rede")
    }
  }

  async function handleStep1() {
    const errs: Record<string, string> = {}
    if (!s1Nome.trim()) errs.nome = "Nome é obrigatório"
    if (!s1ContaNome.trim()) errs.conta_nome = "Nome da conta é obrigatório"
    if (!s1ApiKey.trim()) errs.api_key = "API Key é obrigatória"
    if (s1TesteStatus === "error") errs.api_key = "Conexão falhou — verifique a API Key"
    if (Object.keys(errs).length > 0) { setS1Errors(errs); return }

    setS1Loading(true)
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nome: s1Nome.trim(),
          email: s1Email.trim() || undefined,
          telefone: s1Tel.trim() || undefined,
          primeira_conta: { nome: s1ContaNome.trim(), api_key: s1ApiKey.trim() },
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "Erro ao criar cliente."); return }

      const clienteId = data.data?.cliente?.id || data.data?.id
      const contaId = data.data?.conta?.id

      // Save field ID if provided
      if (s1FieldId.trim() && contaId) {
        await fetch(`/api/admin/contas/${contaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ whatsapp_field_id: parseInt(s1FieldId.trim(), 10) }),
        }).catch(() => {})
      }

      setResources((p) => ({
        ...p,
        clienteId,
        clienteNome: s1Nome.trim(),
        contaId,
        contaNome: s1ContaNome.trim(),
        grupos: [],
      }))
      setStep(2)
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setS1Loading(false)
    }
  }

  // ── Step 2: Z-API ───────────────────────────────────────────────────────────
  const [s2Nome, setS2Nome] = useState("")
  const [s2InstanceId, setS2InstanceId] = useState("")
  const [s2Token, setS2Token] = useState("")
  const [s2ClientToken, setS2ClientToken] = useState("")
  const [s2Loading, setS2Loading] = useState(false)
  const [s2Errors, setS2Errors] = useState<Record<string, string>>({})

  async function handleStep2() {
    if (!s2Nome.trim() || !s2InstanceId.trim() || !s2Token.trim() || !s2ClientToken.trim()) {
      const errs: Record<string, string> = {}
      if (!s2Nome.trim()) errs.nome = "Nome é obrigatório"
      if (!s2InstanceId.trim()) errs.instance_id = "Instance ID é obrigatório"
      if (!s2Token.trim()) errs.token = "Token é obrigatório"
      if (!s2ClientToken.trim()) errs.client_token = "Client Token é obrigatório"
      setS2Errors(errs); return
    }
    setS2Loading(true)
    try {
      const res = await fetch("/api/admin/zapi/instancias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nome: s2Nome.trim(),
          instance_id: s2InstanceId.trim(),
          token: s2Token.trim(),
          client_token: s2ClientToken.trim(),
          cliente_id: resources.clienteId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "Erro ao conectar instância."); return }
      setResources((p) => ({ ...p, instanciaId: data.instancia?.id, instanciaNome: s2Nome.trim() }))
      setStep(3)
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setS2Loading(false)
    }
  }

  function skipStep2() {
    setResources((p) => ({ ...p, instanciaId: null, instanciaNome: null }))
    setStep(3)
  }

  // ── Step 3: Campanha ────────────────────────────────────────────────────────
  const [s3Nome, setS3Nome] = useState("")
  const [s3Desc, setS3Desc] = useState("")
  const [s3Status, setS3Status] = useState<"ativo" | "inativo">("ativo")
  const [s3Inicio, setS3Inicio] = useState("")
  const [s3Fim, setS3Fim] = useState("")
  const [s3Errors, setS3Errors] = useState<Record<string, string>>({})
  const [s3Loading, setS3Loading] = useState(false)

  async function handleStep3() {
    if (!s3Nome.trim()) { setS3Errors({ nome: "Nome é obrigatório" }); return }
    setS3Errors({})
    setS3Loading(true)
    try {
      const res = await fetch("/api/admin/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nome: s3Nome.trim(),
          descricao: s3Desc.trim() || null,
          status: s3Status,
          data_inicio: s3Inicio || null,
          data_fim: s3Fim || null,
          cliente_id: resources.clienteId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "Erro ao criar campanha."); return }
      setResources((p) => ({
        ...p,
        campanhaId: data.data?.id,
        campanhaUrl: `/admin/campanhas/${data.data?.id}`,
        webhookUrl: data.webhook?.url_publica || "",
      }))
      setStep(4)
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setS3Loading(false)
    }
  }

  // ── Step 4: Grupos ──────────────────────────────────────────────────────────
  const [grupos, setGrupos] = useState<GrupoConfig[]>([])
  const [s4InstanciaId, setS4InstanciaId] = useState("")
  const [s4ZapiGroups, setS4ZapiGroups] = useState<{ phone: string; name: string; isGroup: boolean }[]>([])
  const [s4LoadingGroups, setS4LoadingGroups] = useState(false)
  const [s4GrupoId, setS4GrupoId] = useState("")
  const [s4GrupoNome, setS4GrupoNome] = useState("")
  const [s4ContaId, setS4ContaId] = useState(resources.contaId || "")
  const [s4Tags, setS4Tags] = useState<{ id: number; name: string }[]>([])
  const [s4LoadingTags, setS4LoadingTags] = useState(false)
  const [s4TagId, setS4TagId] = useState("")
  const [s4NomeFiltro, setS4NomeFiltro] = useState("")
  const [s4Errors, setS4Errors] = useState<Record<string, string>>({})
  const [s4Loading, setS4Loading] = useState(false)

  // Auto-select the created instance
  useEffect(() => {
    if (resources.instanciaId && !s4InstanciaId) setS4InstanciaId(resources.instanciaId)
    if (resources.contaId && !s4ContaId) setS4ContaId(resources.contaId)
  }, [resources.instanciaId, resources.contaId, s4InstanciaId, s4ContaId])

  async function fetchS4Groups() {
    if (!s4InstanciaId || !accessToken) return
    setS4LoadingGroups(true); setS4ZapiGroups([]); setS4GrupoId(""); setS4GrupoNome("")
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${s4InstanciaId}/detectar-grupos`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setS4ZapiGroups((data.grupos || []).filter((g: { isGroup: boolean }) => g.isGroup))
    } catch { toast.error("Erro ao buscar grupos.") }
    finally { setS4LoadingGroups(false) }
  }

  async function fetchS4Tags() {
    if (!s4ContaId || !s4InstanciaId || !accessToken) return
    setS4LoadingTags(true); setS4Tags([]); setS4TagId("")
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${s4InstanciaId}/tags-manychat?conta_id=${s4ContaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setS4Tags(data.tags || [])
    } catch { toast.error("Erro ao buscar tags.") }
    finally { setS4LoadingTags(false) }
  }

  function addGrupo() {
    const errs: Record<string, string> = {}
    if (!s4GrupoId) errs.grupo = "Selecione um grupo"
    if (!s4ContaId) errs.conta = "Conta obrigatória"
    if (!s4TagId) errs.tag = "Selecione uma tag"
    if (!s4NomeFiltro.trim()) errs.filtro = "Informe o nome filtro"
    if (Object.keys(errs).length > 0) { setS4Errors(errs); return }
    setS4Errors({})
    setGrupos((p) => [...p, {
      instanciaId: s4InstanciaId,
      instanciaNome: resources.instanciaNome || "",
      grupoId: s4GrupoId, grupoNome: s4GrupoNome,
      contaManychatId: s4ContaId, contaManychatNome: resources.contaNome || "",
      tagId: Number(s4TagId),
      tagNome: s4Tags.find((t) => String(t.id) === s4TagId)?.name || "",
      nomeFiltro: s4NomeFiltro.trim(),
    }])
    setS4GrupoId(""); setS4GrupoNome(""); setS4TagId(""); setS4NomeFiltro("")
  }

  async function handleStep4() {
    setS4Loading(true)
    const errors: string[] = []
    for (const g of grupos) {
      try {
        const res = await fetch(`/api/admin/zapi/instancias/${g.instanciaId}/grupos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            campanha_id: resources.campanhaId,
            conta_manychat_id: g.contaManychatId,
            nome_filtro: g.nomeFiltro,
            tag_manychat_id: g.tagId,
            tag_manychat_nome: g.tagNome,
          }),
        })
        if (!res.ok) errors.push(g.grupoNome)
      } catch { errors.push(g.grupoNome) }
    }
    if (errors.length > 0) toast.warning(`${errors.length} grupo(s) falharam: ${errors.join(", ")}`)
    setResources((p) => ({ ...p, grupos }))
    setS4Loading(false)
    setStep(5)
  }

  function copyWebhook() {
    if (!resources.webhookUrl) return
    navigator.clipboard.writeText(resources.webhookUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("URL copiada!")
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Implantação", href: "/admin/implantacao" },
        { label: "Nova Implantação" },
      ]} />

      <div className="p-6 max-w-2xl">
        <Link href="/admin/implantacao" className="inline-flex items-center gap-2 text-[#7F7F9E] hover:text-[#EEEEF5] text-sm mb-7 transition-colors">
          <ArrowLeft className="w-4 h-4" />Voltar
        </Link>

        <div className="mb-7">
          <h1 className="text-[#EEEEF5] text-2xl font-bold">Nova Implantação</h1>
          <p className="text-[#7F7F9E] text-sm mt-1">Configure um novo cliente passo a passo — do cadastro ao primeiro grupo monitorado.</p>
        </div>

        <StepIndicator current={step} />

        <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] overflow-hidden">

          {/* ── STEP 1: Cliente + Manychat ── */}
          {step === 1 && (
            <div>
              <div className="px-6 pt-6 pb-4 space-y-5">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="text-[#EEEEF5] font-semibold text-sm">Dados do Cliente</p>
                    <p className="text-[#3F3F58] text-xs">Cadastro inicial + conta Manychat</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                      Nome do cliente <span className="text-[#F87171]">*</span>
                    </label>
                    <Input placeholder="Ex: Mari Tortella, Dr. Silva..." value={s1Nome}
                      onChange={(e) => setS1Nome(e.target.value)} error={s1Errors.nome} autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0]">E-mail</label>
                    <Input type="email" placeholder="contato@empresa.com" value={s1Email} onChange={(e) => setS1Email(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0]">Telefone</label>
                    <Input placeholder="11999999999" value={s1Tel} onChange={(e) => setS1Tel(e.target.value)} />
                  </div>
                </div>

                <div className="border-t border-[#1C1C2C] pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#A78BFA]" />
                    <p className="text-[#EEEEF5] font-semibold text-sm">Conta Manychat</p>
                    <FieldInfo title="O que é Manychat?">
                      <p>Manychat é a plataforma de automação de mensagens. Cada cliente tem uma ou mais contas Manychat ligadas às suas páginas/produtos.</p>
                      <p className="mt-1">A API Key é encontrada em: <strong className="text-[#EEEEF5]">Manychat → Configurações → API</strong></p>
                    </FieldInfo>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0]">Nome da conta <span className="text-[#F87171]">*</span></label>
                    <Input placeholder="Ex: Conta Principal, Página Produto..." value={s1ContaNome}
                      onChange={(e) => setS1ContaNome(e.target.value)} error={s1Errors.conta_nome} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0]">API Key Manychat <span className="text-[#F87171]">*</span></label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input type={s1ShowKey ? "text" : "password"} value={s1ApiKey}
                          onChange={(e) => { setS1ApiKey(e.target.value); setS1TesteStatus("idle") }}
                          placeholder="Cole a API Key do Manychat..."
                          className={`w-full h-10 px-3 pr-10 rounded-lg border bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none transition-all ${s1Errors.api_key ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}
                        />
                        <button type="button" onClick={() => setS1ShowKey((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3F3F58] hover:text-[#9898B0]">
                          {s1ShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button type="button" variant="outline" className="shrink-0 h-10"
                        disabled={s1TesteStatus === "testing" || !s1ApiKey.trim()} onClick={testarManychat}>
                        {s1TesteStatus === "testing" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Testar"}
                      </Button>
                    </div>
                    {s1Errors.api_key && <p className="text-xs text-[#F87171]">{s1Errors.api_key}</p>}
                    {s1TesteStatus === "ok" && (
                      <div className="flex items-center gap-1.5 text-[#25D366]">
                        <CheckCircle2 className="w-3.5 h-3.5" /><span className="text-xs">{s1TesteMsg}</span>
                      </div>
                    )}
                    {s1TesteStatus === "error" && (
                      <div className="flex items-center gap-1.5 text-[#F87171]">
                        <AlertCircle className="w-3.5 h-3.5" /><span className="text-xs">{s1TesteMsg}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                      Field ID — [esc]whatsapp-id
                      <FieldInfo title="Field ID [esc]whatsapp-id">
                        <p>Campo customizado no Manychat que armazena o número de WhatsApp do contato (no formato usado pelo Z-API).</p>
                        <p className="mt-1">Para encontrar: <strong className="text-[#EEEEF5]">Manychat → Configurações → Campos do Usuário</strong> → passe o mouse sobre <code className="text-[#A78BFA]">[esc]whatsapp-id</code> e anote o ID numérico no tooltip.</p>
                        <p className="mt-1 text-[#F59E0B]">Pode ser preenchido depois, mas é necessário para que o sistema detecte contatos duplicados.</p>
                      </FieldInfo>
                    </label>
                    <Input type="number" placeholder="Ex: 11947822 (opcional por agora)" value={s1FieldId}
                      onChange={(e) => setS1FieldId(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => router.push("/admin/implantacao")}>Cancelar</Button>
                <Button className="flex-1" loading={s1Loading} onClick={handleStep1}>
                  Criar cliente e continuar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Z-API ── */}
          {step === 2 && (
            <div>
              <div className="px-6 pt-6 pb-4 space-y-5">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                    <Wifi className="w-4 h-4 text-[#22C55E]" />
                  </div>
                  <div>
                    <p className="text-[#EEEEF5] font-semibold text-sm">Instância Z-API</p>
                    <p className="text-[#3F3F58] text-xs">Conecte o WhatsApp do cliente ao sistema</p>
                  </div>
                  <FieldInfo title="O que é Z-API?">
                    <p>Z-API é o serviço que conecta um número de WhatsApp ao sistema. Com ele, o sistema consegue detectar quando leads entram em grupos do WhatsApp.</p>
                    <p className="mt-1">Para obter as credenciais: <strong className="text-[#EEEEF5]">painel.z-api.io</strong> → selecione sua instância → copie Instance ID e Token.</p>
                    <p className="mt-1">Client Token: <strong className="text-[#EEEEF5]">Z-API → Security → Client Token</strong></p>
                  </FieldInfo>
                </div>

                <Input label="Nome da instância" placeholder="Ex: WhatsApp Mari Tortella"
                  value={s2Nome} onChange={(e) => setS2Nome(e.target.value)} error={s2Errors.nome} autoFocus />
                <Input label="Instance ID" placeholder="Ex: 3C0A9B2A1234..."
                  value={s2InstanceId} onChange={(e) => setS2InstanceId(e.target.value)} error={s2Errors.instance_id} />
                <Input label="Token" type="password" placeholder="Token de acesso da instância"
                  value={s2Token} onChange={(e) => setS2Token(e.target.value)} error={s2Errors.token} />
                <Input label="Client Token" type="password" placeholder="Client token Z-API"
                  value={s2ClientToken} onChange={(e) => setS2ClientToken(e.target.value)} error={s2Errors.client_token} />
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={skipStep2} className="text-[#5A5A72]">
                  Pular por agora
                </Button>
                <Button className="flex-1" loading={s2Loading} onClick={handleStep2}>
                  Conectar e continuar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Campanha ── */}
          {step === 3 && (
            <div>
              <div className="px-6 pt-6 pb-4 space-y-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <p className="text-[#EEEEF5] font-semibold text-sm">Criar Campanha</p>
                    <p className="text-[#3F3F58] text-xs">O lançamento atual do cliente</p>
                  </div>
                  <FieldInfo title="O que é uma Campanha?">
                    <p>Uma campanha agrupa todos os leads de um lançamento específico. Cada campanha tem um webhook exclusivo para receber leads do Manychat.</p>
                    <p className="mt-1">Exemplo: "Lançamento Curso X — Junho 2025"</p>
                  </FieldInfo>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9898B0]">Nome da campanha <span className="text-[#F87171]">*</span></label>
                  <Input placeholder="Ex: Lançamento Produto X, Black Friday..." value={s3Nome}
                    onChange={(e) => setS3Nome(e.target.value)} error={s3Errors.nome} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9898B0]">Descrição (opcional)</label>
                  <textarea value={s3Desc} onChange={(e) => setS3Desc(e.target.value)} rows={2}
                    placeholder="Objetivo desta campanha..."
                    className="w-full px-3 py-2 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0]">Início</label>
                    <input type="date" value={s3Inicio} onChange={(e) => setS3Inicio(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0]">Fim</label>
                    <input type="date" value={s3Fim} onChange={(e) => setS3Fim(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-[#13131F] border border-[#1C1C2C] rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#EEEEF5]">Status</p>
                    <p className="text-xs text-[#3F3F58] mt-0.5">{s3Status === "ativo" ? "Ativa — aceita leads" : "Inativa"}</p>
                  </div>
                  <Switch checked={s3Status === "ativo"} onCheckedChange={(c) => setS3Status(c ? "ativo" : "inativo")} />
                </div>
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4" /></Button>
                <Button className="flex-1" loading={s3Loading} onClick={handleStep3}>
                  Criar campanha e continuar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Grupos ── */}
          {step === 4 && (
            <div>
              <div className="px-6 pt-6 pb-4 space-y-5">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-[#A78BFA]" />
                  </div>
                  <div>
                    <p className="text-[#EEEEF5] font-semibold text-sm">Grupos WhatsApp</p>
                    <p className="text-[#3F3F58] text-xs">Quais grupos serão monitorados neste lançamento</p>
                  </div>
                  <FieldInfo title="Grupos monitorados">
                    <p>Configure os grupos de WhatsApp do lançamento. Quando um lead entrar em um desses grupos, o sistema detecta e aplica automaticamente a tag correspondente no Manychat.</p>
                    <p className="mt-1 text-[#F59E0B]">Este passo é opcional e pode ser configurado depois.</p>
                  </FieldInfo>
                </div>

                {!resources.instanciaId ? (
                  <div className="flex items-center gap-2 p-4 bg-[#13131F] border border-[#1C1C2C] rounded-xl text-sm text-[#5A5A72]">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Instância Z-API não configurada. Os grupos podem ser adicionados depois em <strong className="text-[#9898B0]">Z-API → Instância → Grupos</strong></span>
                  </div>
                ) : (
                  <>
                    {grupos.length > 0 && (
                      <div className="space-y-2">
                        {grupos.map((g, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-[#13131F] border border-[#1C1C2C] rounded-xl">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#EEEEF5] font-medium truncate">{g.grupoNome}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Tag className="w-3 h-3 text-[#A78BFA]" />
                                <span className="text-xs text-[#A78BFA] truncate">{g.tagNome}</span>
                              </div>
                            </div>
                            <button onClick={() => setGrupos((p) => p.filter((_, j) => j !== i))}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3F3F58] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add group form */}
                    <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-4 space-y-4">
                      <p className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">Adicionar grupo</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1 h-10"
                          disabled={s4LoadingGroups} onClick={fetchS4Groups}>
                          {s4LoadingGroups ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
                          Detectar grupos
                        </Button>
                      </div>
                      {s4ZapiGroups.length > 0 && (
                        <SearchableSelect options={s4ZapiGroups} value={s4GrupoId}
                          onChange={(v) => {
                            setS4GrupoId(v)
                            const g = s4ZapiGroups.find((g) => g.phone === v)
                            setS4GrupoNome(g?.name || ""); setS4NomeFiltro(g?.name || "")
                          }}
                          getKey={(g) => g.phone} getLabel={(g) => g.name}
                          placeholder="Selecionar grupo" searchPlaceholder="Buscar grupo..."
                          error={s4Errors.grupo} />
                      )}
                      {s4GrupoId && (
                        <input type="text" value={s4NomeFiltro} onChange={(e) => setS4NomeFiltro(e.target.value)}
                          placeholder="Nome do grupo (filtro)"
                          className={`w-full h-10 px-3 rounded-lg border bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none transition-all ${s4Errors.filtro ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1 h-10"
                          disabled={!s4ContaId || !s4InstanciaId || s4LoadingTags} onClick={fetchS4Tags}>
                          {s4LoadingTags ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Tag className="w-3.5 h-3.5 mr-1.5" />}
                          Buscar tags Manychat
                        </Button>
                      </div>
                      {s4Tags.length > 0 && (
                        <SearchableSelect options={s4Tags} value={s4TagId}
                          onChange={setS4TagId} getKey={(t) => String(t.id)} getLabel={(t) => t.name}
                          placeholder="Selecionar tag de entrada" searchPlaceholder="Buscar tag..."
                          error={s4Errors.tag} />
                      )}
                      {(s4Errors.grupo || s4Errors.tag || s4Errors.filtro) && (
                        <p className="text-xs text-[#F87171]">Preencha todos os campos para adicionar.</p>
                      )}
                      <Button type="button" onClick={addGrupo} className="w-full" variant="outline">
                        <Plus className="w-4 h-4" />Adicionar grupo
                      </Button>
                    </div>
                  </>
                )}
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4" /></Button>
                <Button variant="outline" onClick={() => { setResources((p) => ({ ...p, grupos: [] })); setStep(5) }}>
                  Pular
                </Button>
                <Button className="flex-1" loading={s4Loading} onClick={handleStep4}>
                  {grupos.length === 0 ? "Pular e finalizar" : `Salvar ${grupos.length} grupo(s)`}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Aprovação ── */}
          {step === 5 && (
            <div>
              <div className="px-6 pt-6 pb-4 space-y-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                    <ClipboardCheck className="w-4 h-4 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="text-[#EEEEF5] font-semibold text-sm">Implantação Concluída!</p>
                    <p className="text-[#3F3F58] text-xs">Revise o que foi configurado</p>
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-3">
                  <CheckItem ok={!!resources.clienteId} label={`Cliente: ${resources.clienteNome || "—"}`} sub="Cadastro e conta Manychat criados" />
                  <CheckItem ok={!!resources.instanciaId} warn={!resources.instanciaId} skip={!resources.instanciaId}
                    label={resources.instanciaId ? `Z-API: ${resources.instanciaNome}` : "Z-API não configurada"}
                    sub={resources.instanciaId ? "Instância conectada" : "Configure depois em Z-API / Grupos WA"} />
                  <CheckItem ok={!!resources.campanhaId} label={`Campanha: ${s3Nome}`} sub="Webhook gerado automaticamente" />
                  <CheckItem ok={(resources.grupos?.length ?? 0) > 0} warn={(resources.grupos?.length ?? 0) === 0}
                    label={`${resources.grupos?.length || 0} grupo(s) monitorado(s) configurado(s)`}
                    sub={(resources.grupos?.length ?? 0) === 0 ? "Configure depois na campanha" : undefined} />
                </div>

                {/* Webhook URL */}
                {resources.webhookUrl && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">URL do Webhook</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-[#7F7F9E] text-xs flex items-center font-mono overflow-hidden">
                        <span className="truncate">{resources.webhookUrl}</span>
                      </div>
                      <Button type="button" variant="outline" className="shrink-0 h-10 px-3" onClick={copyWebhook}>
                        {copied ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-[#3F3F58]">Configure este URL no flow do Manychat para enviar leads para esta campanha.</p>
                  </div>
                )}

                {/* Links */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">Próximos passos</p>
                  <div className="space-y-1.5">
                    {resources.clienteId && (
                      <Link href={`/admin/clientes/${resources.clienteId}/editar`}
                        className="flex items-center gap-2 text-sm text-[#7F7F9E] hover:text-[#25D366] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />Configurar notificações WA do cliente
                      </Link>
                    )}
                    {resources.campanhaId && (
                      <Link href={`/admin/campanhas/${resources.campanhaId}`}
                        className="flex items-center gap-2 text-sm text-[#7F7F9E] hover:text-[#25D366] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />Ver campanha
                      </Link>
                    )}
                    {resources.instanciaId && (
                      <Link href={`/admin/zapi/${resources.instanciaId}`}
                        className="flex items-center gap-2 text-sm text-[#7F7F9E] hover:text-[#25D366] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />Gerenciar instância Z-API
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => router.push("/admin/implantacao")}>Ver Implantações</Button>
                <Button className="flex-1" onClick={() => router.push("/admin/implantacao/nova")}>
                  <Plus className="w-4 h-4" />Nova Implantação
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
