"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Plus, Zap, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  ToggleRight, ToggleLeft, Hash, AlertCircle, Pencil,
  MessageSquare, Save, WifiOff, Building2, Megaphone,
  Webhook, Users2, Wifi, ChevronRight, Trash2, AlertTriangle, Crown,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { ClienteForm } from "@/components/admin/ClienteForm"
import { NovaCampanhaDialog } from "@/components/admin/NovaCampanhaDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conta {
  id: string
  nome: string
  page_name: string | null
  status: "ativo" | "inativo"
  whatsapp_field_id: number | null
  _count: { webhook_flows: number; contatos_vinculados: number; grupos_monitoramento: number }
}

interface InstanciaZApi {
  id: string
  nome: string
  instance_id: string
  status: "ativo" | "inativo"
  _count: { grupos: number }
}

interface CampanhaItem {
  id: string
  nome: string
  status: "ativo" | "inativo"
  webhooks_count: number
  leads_count: number
  created_at: string
}

interface ClienteData {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  grupo_wa_id: string | null
  grupo_wa_nome: string | null
  instancia_zapi_notif_id: string | null
  contas_manychat: Conta[]
}

type TesteStatus = "idle" | "testing" | "ok" | "error"
type Tab = "dados" | "campanhas" | "contatos" | "manychat" | "zapi" | "notif-wa"

interface ContatoItem {
  id: string
  nome: string
  telefone: string
  email: string | null
  created_at: string
  leads: Array<{
    id: string
    status: string
    grupo_entrou_at: string | null
    campanha: { id: string; nome: string } | null
  }>
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>("dados")
  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Manychat state ───────────────────────────────────────────────────────────
  const [showAddConta, setShowAddConta] = useState(false)
  const [contaNome, setContaNome] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [testeStatus, setTesteStatus] = useState<TesteStatus>("idle")
  const [testeMsg, setTesteMsg] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editFieldConta, setEditFieldConta] = useState<Conta | null>(null)
  const [fieldIdInput, setFieldIdInput] = useState("")
  const [fieldIdLoading, setFieldIdLoading] = useState(false)
  type VerifyState = "idle" | "checking" | "valid" | "invalid"
  const [verifyState, setVerifyState] = useState<VerifyState>("idle")
  const [verifiedField, setVerifiedField] = useState<{ name: string; type: string } | null>(null)
  const [verifyMsg, setVerifyMsg] = useState("")
  const [creatingField, setCreatingField] = useState(false)
  // Field ID for new conta dialog
  const [newFieldId, setNewFieldId] = useState("")
  const [ensureFieldStatus, setEnsureFieldStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [ensureFieldMsg, setEnsureFieldMsg] = useState("")

  // Delete conta dialog
  const [deleteContaDialog, setDeleteContaDialog] = useState<Conta | null>(null)
  const [deleteContaText, setDeleteContaText] = useState("")
  const [deletingContaId, setDeletingContaId] = useState<string | null>(null)

  // ── Notif WA state ───────────────────────────────────────────────────────────
  const [instanciasNotif, setInstanciasNotif] = useState<InstanciaZApi[]>([])
  const [grupoWaId, setGrupoWaId] = useState("")
  const [grupoWaNome, setGrupoWaNome] = useState("")
  const [instanciaNotifId, setInstanciaNotifId] = useState("")
  const [savingWa, setSavingWa] = useState(false)

  // ── Campanhas tab ────────────────────────────────────────────────────────────
  const [campanhas, setCampanhas] = useState<CampanhaItem[]>([])
  const [loadingCampanhas, setLoadingCampanhas] = useState(false)
  const [showNovaCampanha, setShowNovaCampanha] = useState(false)

  // ── Contatos tab ─────────────────────────────────────────────────────────────
  const [contatos, setContatos] = useState<ContatoItem[]>([])
  const [loadingContatos, setLoadingContatos] = useState(false)
  const [contatosTotal, setContatosTotal] = useState(0)
  const [contatosSearch, setContatosSearch] = useState("")

  // ── Z-API tab ────────────────────────────────────────────────────────────────
  const [instancias, setInstancias] = useState<InstanciaZApi[]>([])
  const [loadingInstancias, setLoadingInstancias] = useState(false)
  const [deleteInstanciaDialog, setDeleteInstanciaDialog] = useState<InstanciaZApi | null>(null)
  const [deleteInstanciaText, setDeleteInstanciaText] = useState("")
  const [deletingInstanciaId, setDeletingInstanciaId] = useState<string | null>(null)
  // Nova instância dialog
  const [showAddInstancia, setShowAddInstancia] = useState(false)
  const [instanciaForm, setInstanciaForm] = useState({ nome: "", instance_id: "", token: "", client_token: "" })
  const [instanciaErrors, setInstanciaErrors] = useState<Record<string, string>>({})
  const [addInstanciaLoading, setAddInstanciaLoading] = useState(false)
  const [showInstanciaToken, setShowInstanciaToken] = useState(false)
  const [showInstanciaClientToken, setShowInstanciaClientToken] = useState(false)

  // ── Fetch cliente ────────────────────────────────────────────────────────────

  const fetchCliente = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/clientes/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Cliente não encontrado")
      const data = await res.json()
      setCliente(data.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => { fetchCliente() }, [fetchCliente])

  // Populate WA state from cliente
  useEffect(() => {
    if (!cliente) return
    setGrupoWaId(cliente.grupo_wa_id || "")
    setGrupoWaNome(cliente.grupo_wa_nome || "")
    setInstanciaNotifId(cliente.instancia_zapi_notif_id || "")
  }, [cliente])

  // Load all Z-API instances for notification dropdown
  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/zapi/instancias?per_page=100", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setInstanciasNotif(d.instancias ?? []))
      .catch(() => {})
  }, [accessToken])

  // ── Fetch campanhas (lazy) ───────────────────────────────────────────────────

  const fetchCampanhas = useCallback(async () => {
    if (!accessToken || !id) return
    setLoadingCampanhas(true)
    try {
      const res = await fetch(`/api/admin/campanhas?cliente_id=${id}&per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setCampanhas(data.data || [])
    } catch { /* silent */ } finally {
      setLoadingCampanhas(false)
    }
  }, [accessToken, id])

  // ── Fetch contatos for this client (lazy) ───────────────────────────────────

  const fetchContatos = useCallback(async (search = "") => {
    if (!accessToken || !id) return
    setLoadingContatos(true)
    try {
      const params = new URLSearchParams({ per_page: "50" })
      if (search) params.set("q", search)
      const res = await fetch(`/api/admin/clientes/${id}/contatos?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setContatos(data.data?.contatos || [])
      setContatosTotal(data.data?.pagination?.total || 0)
    } catch { /* silent */ } finally {
      setLoadingContatos(false)
    }
  }, [accessToken, id])

  // ── Fetch Z-API instancias for this client (lazy) ───────────────────────────

  const fetchInstancias = useCallback(async () => {
    if (!accessToken || !id) return
    setLoadingInstancias(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias?cliente_id=${id}&per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setInstancias(data.instancias || [])
    } catch { /* silent */ } finally {
      setLoadingInstancias(false)
    }
  }, [accessToken, id])

  useEffect(() => {
    if (tab === "campanhas" && campanhas.length === 0) fetchCampanhas()
    if (tab === "contatos" && contatos.length === 0) fetchContatos()
    if (tab === "zapi" && instancias.length === 0) fetchInstancias()
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manychat handlers ────────────────────────────────────────────────────────

  async function handleTestarConexao() {
    if (!apiKey.trim()) { setAddErrors((e) => ({ ...e, api_key: "Informe a API Key" })); return }
    setTesteStatus("testing"); setTesteMsg("")
    try {
      const res = await fetch("/api/admin/contas/testar-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTesteStatus("ok"); setTesteMsg(`Conectado: ${data.page_name}`)
        if (!contaNome.trim() && data.page_name) setContaNome(data.page_name)
      } else {
        setTesteStatus("error"); setTesteMsg(data.message || "Falha na conexão")
      }
    } catch {
      setTesteStatus("error"); setTesteMsg("Erro de rede")
    }
  }

  function handleOpenAddConta() {
    setShowAddConta(true); setContaNome(""); setApiKey(""); setShowKey(false)
    setTesteStatus("idle"); setTesteMsg(""); setAddErrors({})
    setNewFieldId(""); setEnsureFieldStatus("idle"); setEnsureFieldMsg("")
  }

  async function handleEnsureField() {
    if (!apiKey.trim()) return
    setEnsureFieldStatus("loading"); setEnsureFieldMsg("")
    try {
      const res = await fetch("/api/admin/contas/ensure-field", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.data?.ok) {
        setEnsureFieldStatus("ok")
        setEnsureFieldMsg(data.data.message)
        if (data.data.field_id) setNewFieldId(String(data.data.field_id))
      } else {
        setEnsureFieldStatus("error")
        setEnsureFieldMsg(data.data?.message || "Erro ao criar o campo.")
      }
    } catch {
      setEnsureFieldStatus("error"); setEnsureFieldMsg("Erro de rede.")
    }
  }

  async function handleAddConta() {
    const errs: Record<string, string> = {}
    if (!contaNome.trim()) errs.conta_nome = "Nome é obrigatório"
    if (!apiKey.trim()) errs.api_key = "API Key é obrigatória"
    if (Object.keys(errs).length > 0) { setAddErrors(errs); return }
    setAddLoading(true)
    try {
      const fieldIdNum = newFieldId.trim() ? parseInt(newFieldId.trim(), 10) : null
      const res = await fetch(`/api/admin/clientes/${id}/contas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nome: contaNome.trim(),
          api_key: apiKey.trim(),
          ...(fieldIdNum && !isNaN(fieldIdNum) && { whatsapp_field_id: fieldIdNum }),
        }),
      })
      const data = await res.json()
      if (res.ok) { toast.success(data.message); setShowAddConta(false); fetchCliente() }
      else { toast.error(data.message || "Erro ao adicionar conta.") }
    } catch { toast.error("Erro de conexão.") } finally { setAddLoading(false) }
  }

  async function handleToggleConta(conta: Conta) {
    setActionLoading(conta.id)
    try {
      const res = await fetch(`/api/admin/contas/${conta.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) { toast.success(data.message); fetchCliente() }
      else { toast.error(data.message || "Erro ao alterar status.") }
    } catch { toast.error("Erro de conexão.") } finally { setActionLoading(null) }
  }

  function handleOpenEditFieldId(conta: Conta) {
    setEditFieldConta(conta)
    setFieldIdInput(conta.whatsapp_field_id ? String(conta.whatsapp_field_id) : "")
    setVerifyState("idle")
    setVerifiedField(null)
    setVerifyMsg("")
    setCreatingField(false)
  }

  async function handleSaveFieldId() {
    if (!editFieldConta) return
    const num = parseInt(fieldIdInput.trim(), 10)
    if (!fieldIdInput.trim() || isNaN(num) || num <= 0) { toast.error("Informe um ID numérico válido."); return }
    setFieldIdLoading(true)
    try {
      const res = await fetch(`/api/admin/contas/${editFieldConta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ whatsapp_field_id: num }),
      })
      const data = await res.json()
      if (res.ok) { toast.success("Field ID salvo."); setEditFieldConta(null); fetchCliente() }
      else { toast.error(data.message || "Erro ao salvar.") }
    } catch { toast.error("Erro de conexão.") } finally { setFieldIdLoading(false) }
  }

  // Debounce auto-verify field_id when editing
  useEffect(() => {
    if (!editFieldConta) return
    const num = parseInt(fieldIdInput.trim(), 10)
    if (!fieldIdInput.trim() || isNaN(num) || num <= 0) {
      setVerifyState("idle"); setVerifiedField(null); return
    }
    setVerifyState("checking"); setVerifiedField(null)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/contas/${editFieldConta.id}/verify-field`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ field_id: num }),
        })
        const data = await res.json()
        if (data.ok) {
          setVerifyState("valid"); setVerifiedField(data.field)
        } else {
          setVerifyState("invalid"); setVerifyMsg(data.message || "Campo não encontrado.")
        }
      } catch {
        setVerifyState("invalid"); setVerifyMsg("Erro ao verificar. Tente novamente.")
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [fieldIdInput, editFieldConta?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateField() {
    if (!editFieldConta) return
    setCreatingField(true)
    try {
      const res = await fetch(`/api/admin/contas/${editFieldConta.id}/ensure-field`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (data.ok && data.field_id) {
        setFieldIdInput(String(data.field_id))
        setVerifyState("valid")
        setVerifiedField({ name: "[esc]whatsapp-id", type: "text" })
        toast.success(data.message)
      } else {
        toast.error(data.message || "Erro ao criar campo.")
      }
    } catch { toast.error("Erro de conexão.") } finally { setCreatingField(false) }
  }

  async function handleDeleteConta(conta: Conta) {
    setDeletingContaId(conta.id)
    try {
      const res = await fetch(`/api/admin/contas/${conta.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Conta removida.")
        setDeleteContaDialog(null)
        setDeleteContaText("")
        fetchCliente()
      } else {
        toast.error(data.message || "Erro ao excluir conta.")
      }
    } catch { toast.error("Erro de conexão.") } finally { setDeletingContaId(null) }
  }

  async function handleDeleteInstancia(inst: InstanciaZApi) {
    setDeletingInstanciaId(inst.id)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${inst.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Instância removida.")
        setDeleteInstanciaDialog(null)
        setDeleteInstanciaText("")
        setInstancias([])
        fetchInstancias()
      } else {
        toast.error(data.message || "Erro ao excluir instância.")
      }
    } catch { toast.error("Erro de conexão.") } finally { setDeletingInstanciaId(null) }
  }

  function handleOpenAddInstancia() {
    setInstanciaForm({ nome: "", instance_id: "", token: "", client_token: "" })
    setInstanciaErrors({})
    setShowInstanciaToken(false)
    setShowInstanciaClientToken(false)
    setShowAddInstancia(true)
  }

  async function handleAddInstancia() {
    const errs: Record<string, string> = {}
    if (!instanciaForm.nome.trim()) errs.nome = "Nome é obrigatório"
    if (!instanciaForm.instance_id.trim()) errs.instance_id = "Instance ID é obrigatório"
    if (!instanciaForm.token.trim()) errs.token = "Token é obrigatório"
    if (!instanciaForm.client_token.trim()) errs.client_token = "Client Token é obrigatório"
    if (Object.keys(errs).length > 0) { setInstanciaErrors(errs); return }

    setAddInstanciaLoading(true)
    try {
      const res = await fetch("/api/admin/zapi/instancias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...instanciaForm, cliente_id: id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Instância conectada com sucesso.")
        setShowAddInstancia(false)
        setInstancias([])
        fetchInstancias()
      } else {
        toast.error(data.message || "Erro ao criar instância.")
      }
    } catch { toast.error("Erro de conexão.") } finally { setAddInstanciaLoading(false) }
  }

  // ── WA handlers ──────────────────────────────────────────────────────────────

  async function handleSaveWa(e: React.FormEvent) {
    e.preventDefault()
    setSavingWa(true)
    try {
      const res = await fetch(`/api/admin/clientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          grupo_wa_id: grupoWaId || null,
          grupo_wa_nome: grupoWaNome || null,
          instancia_zapi_notif_id: instanciaNotifId || null,
        }),
      })
      const data = await res.json()
      if (res.ok) { toast.success("Configuração WhatsApp salva.") }
      else { toast.error(data.message || "Erro ao salvar.") }
    } catch { toast.error("Erro de conexão.") } finally { setSavingWa(false) }
  }

  async function handleDisableWa() {
    setSavingWa(true)
    try {
      const res = await fetch(`/api/admin/clientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ grupo_wa_id: null, grupo_wa_nome: null, instancia_zapi_notif_id: null }),
      })
      const data = await res.json()
      if (res.ok) {
        setGrupoWaId(""); setGrupoWaNome(""); setInstanciaNotifId("")
        toast.success("Notificações WhatsApp desligadas.")
      } else { toast.error(data.message || "Erro ao desligar.") }
    } catch { toast.error("Erro de conexão.") } finally { setSavingWa(false) }
  }

  const waAtivo = !!(instanciaNotifId || grupoWaId)

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Clientes", href: "/admin/clientes" }, { label: "..." }]} />
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Clientes", href: "/admin/clientes" }, { label: "Erro" }]} />
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-[#F87171]">{error || "Cliente não encontrado"}</p>
          <Button variant="outline" onClick={() => router.push("/admin/clientes")}>Voltar</Button>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "dados", label: "Dados" },
    { id: "campanhas", label: "Campanhas" },
    { id: "contatos", label: `Contatos${contatosTotal > 0 ? ` (${contatosTotal})` : ""}` },
    { id: "manychat", label: `Manychat${cliente.contas_manychat.length > 0 ? ` (${cliente.contas_manychat.length})` : ""}` },
    { id: "zapi", label: "Z-API" },
    { id: "notif-wa", label: "Notificações WA" },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Clientes", href: "/admin/clientes" },
          { label: cliente.nome },
        ]}
      />

      <div className="flex-1 overflow-auto">
        {/* Page header */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-[rgba(37,211,102,0.1)] flex items-center justify-center shrink-0">
              <span className="text-[#25D366] font-bold text-lg">{cliente.nome.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-[#F1F1F3] text-xl font-bold">{cliente.nome}</h1>
              {(cliente.email || cliente.telefone) && (
                <p className="text-[#8B8B9E] text-sm">
                  {cliente.email}{cliente.email && cliente.telefone ? " · " : ""}{cliente.telefone}
                </p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[#1E1E2A]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  tab === t.id
                    ? "text-[#25D366] border-[#25D366]"
                    : "text-[#8B8B9E] border-transparent hover:text-[#F1F1F3]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab: Dados ───────────────────────────────────────────────────── */}
        {tab === "dados" && (
          <div className="p-6 max-w-lg">
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
              <ClienteForm mode="edit" initialData={cliente} />
            </div>
          </div>
        )}

        {/* ── Tab: Campanhas ────────────────────────────────────────────────── */}
        {tab === "campanhas" && (
          <div className="p-6 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[#8B8B9E] text-sm">Campanhas vinculadas a este cliente</p>
              <Button size="sm" onClick={() => setShowNovaCampanha(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nova Campanha
              </Button>
            </div>

            {loadingCampanhas ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full" />
              </div>
            ) : campanhas.length === 0 ? (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-14 gap-4">
                <Megaphone className="w-10 h-10 text-[#5A5A72]" />
                <div className="text-center">
                  <p className="text-[#C4C4D4] font-medium">Nenhuma campanha</p>
                  <p className="text-[#5A5A72] text-sm mt-1">Crie a primeira campanha para este cliente</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowNovaCampanha(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Nova Campanha
                </Button>
              </div>
            ) : (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                {campanhas.map((c, idx) => (
                  <Link key={c.id} href={`/admin/campanhas/${c.id}`}>
                    <div className={`flex items-center gap-4 px-5 py-4 hover:bg-[#1C1C28] transition-colors ${idx !== campanhas.length - 1 ? "border-b border-[#1E1E2A]" : ""}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${c.status === "ativo" ? "bg-[#25D366]" : "bg-[#3F3F58]"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#F1F1F3] font-medium text-sm">{c.nome}</p>
                        <p className="text-[#5A5A72] text-xs mt-0.5">{formatDate(c.created_at)}</p>
                      </div>
                      <Badge variant={c.status === "ativo" ? "ativo" : "inativo"}>
                        {c.status === "ativo" ? "Ativa" : "Inativa"}
                      </Badge>
                      <div className="flex items-center gap-3 text-xs text-[#8B8B9E] shrink-0">
                        <span className="flex items-center gap-1"><Webhook className="w-3.5 h-3.5" />{c.webhooks_count}</span>
                        <span className="flex items-center gap-1"><Users2 className="w-3.5 h-3.5" />{c.leads_count}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#3F3F58]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Contatos ─────────────────────────────────────────────────── */}
        {tab === "contatos" && (
          <div className="p-6 max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[#8B8B9E] text-sm">
                {contatosTotal > 0 ? `${contatosTotal} contato${contatosTotal !== 1 ? "s" : ""} vinculados via campanha` : "Contatos vinculados a este cliente via campanha"}
              </p>
              <div className="flex-1 max-w-xs ml-4">
                <input
                  placeholder="Buscar por nome ou telefone..."
                  value={contatosSearch}
                  onChange={(e) => { setContatosSearch(e.target.value); fetchContatos(e.target.value) }}
                  className="w-full h-9 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366] transition-colors"
                />
              </div>
            </div>

            {loadingContatos ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full" />
              </div>
            ) : contatos.length === 0 ? (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-14 gap-4">
                <Users2 className="w-10 h-10 text-[#5A5A72]" />
                <div className="text-center">
                  <p className="text-[#C4C4D4] font-medium">Nenhum contato encontrado</p>
                  <p className="text-[#5A5A72] text-sm mt-1">
                    {contatosSearch ? "Tente ajustar a busca" : "Contatos aparecerão aqui quando leads forem processados"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E1E2A]">
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Contato</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Campanha</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Grupo WA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contatos.map((c) => (
                      <tr key={c.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-[#F1F1F3] text-sm font-medium">{c.nome}</p>
                          <p className="text-[#5A5A72] text-xs mt-0.5">{c.telefone}</p>
                          {c.email && <p className="text-[#5A5A72] text-xs">{c.email}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="space-y-1">
                            {c.leads.map((l) => (
                              <div key={l.id}>
                                {l.campanha && (
                                  <Link href={`/admin/campanhas/${l.campanha.id}`} className="text-[#C4C4D4] text-xs hover:text-[#25D366] transition-colors">
                                    {l.campanha.nome}
                                  </Link>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {c.leads[0] && (() => {
                            const s = c.leads[0].status
                            const variants: Record<string, string> = {
                              sucesso: "bg-[#162516] text-[#25D366] border-[#25D366]/30",
                              falha: "bg-[#2A1616] text-[#F87171] border-[#F87171]/30",
                              processando: "bg-[#1E1E2A] text-[#60A5FA] border-[#60A5FA]/30",
                              aguardando: "bg-[#1A1500] text-[#F59E0B] border-[#F59E0B]/40",
                              pendente: "bg-[#2A2A1E] text-[#F59E0B] border-[#F59E0B]/30",
                              sem_optin: "bg-[#2A2010] text-[#F59E0B] border-[#F59E0B]/30",
                            }
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${variants[s] || ""}`}>
                                {s}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-5 py-3">
                          {c.leads[0]?.grupo_entrou_at ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#25D366]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" />
                              {new Date(c.leads[0].grupo_entrou_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </span>
                          ) : (
                            <span className="text-[#5A5A72] text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Manychat ─────────────────────────────────────────────────── */}
        {tab === "manychat" && (
          <div className="p-6 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[#8B8B9E] text-sm">Contas Manychat vinculadas a este cliente</p>
              <Button size="sm" onClick={handleOpenAddConta}>
                <Plus className="w-4 h-4 mr-1.5" />
                Adicionar Conta
              </Button>
            </div>

            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              {cliente.contas_manychat.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Zap className="w-8 h-8 text-[#5A5A72]" />
                  <p className="text-[#5A5A72] text-sm">Nenhuma conta vinculada</p>
                  <Button size="sm" variant="outline" onClick={handleOpenAddConta}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Adicionar Conta
                  </Button>
                </div>
              ) : (
                cliente.contas_manychat.map((conta, idx) => {
                const isPrincipal = idx === 0
                const isUnica = cliente.contas_manychat.length === 1
                return (
                  <div key={conta.id} className="border-b border-[#1E1E2A] last:border-0 px-5 py-4 hover:bg-[#1C1C28] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[#C4C4D4] text-sm font-medium">{conta.nome}</p>
                          {isPrincipal && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                              <Crown className="w-2.5 h-2.5" />
                              Principal
                            </span>
                          )}
                          <Badge variant={conta.status === "ativo" ? "ativo" : "inativo"}>
                            {conta.status === "ativo" ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <p className="text-[#8B8B9E] text-xs mt-0.5">{conta.page_name || "—"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Hash className="w-3 h-3 text-[#5A5A72]" />
                          {conta.whatsapp_field_id ? (
                            <span className="text-xs font-mono text-[#25D366]">
                              [esc]whatsapp-id · field_id: {conta.whatsapp_field_id}
                            </span>
                          ) : (
                            <span className="text-xs text-[#F59E0B] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              field_id não registrado
                            </span>
                          )}
                          <button
                            onClick={() => handleOpenEditFieldId(conta)}
                            className="text-[#5A5A72] hover:text-[#C4C4D4] transition-colors"
                            title="Editar field ID"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleConta(conta)}
                          disabled={actionLoading === conta.id}
                          className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors disabled:opacity-50"
                          title={conta.status === "ativo" ? "Desativar" : "Ativar"}
                        >
                          {conta.status === "ativo"
                            ? <ToggleRight className="w-5 h-5 text-[#25D366]" />
                            : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => { setDeleteContaDialog(conta); setDeleteContaText("") }}
                          disabled={isUnica}
                          title={isUnica ? "Não é possível excluir a única conta do cliente" : "Excluir conta"}
                          className="p-1.5 text-[#5A5A72] hover:text-[#F87171] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Z-API ────────────────────────────────────────────────────── */}
        {tab === "zapi" && (
          <div className="p-6 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[#8B8B9E] text-sm">Instâncias Z-API vinculadas a este cliente</p>
              <Button size="sm" onClick={handleOpenAddInstancia}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nova Instância
              </Button>
            </div>

            {loadingInstancias ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full" />
              </div>
            ) : instancias.length === 0 ? (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-12 gap-4">
                <Wifi className="w-8 h-8 text-[#5A5A72]" />
                <div className="text-center">
                  <p className="text-[#C4C4D4] font-medium">Nenhuma instância Z-API</p>
                  <p className="text-[#5A5A72] text-sm mt-1">Conecte uma instância para monitorar grupos</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleOpenAddInstancia}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Nova Instância
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {instancias.map((inst) => (
                  <div key={inst.id} className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#252535] hover:bg-[#121220] transition-all">
                    <Link href={`/admin/zapi/${inst.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${inst.status === "ativo" ? "bg-[#22C55E]/10" : "bg-[#13131F]"}`}>
                        <Wifi className={`w-4 h-4 ${inst.status === "ativo" ? "text-[#22C55E]" : "text-[#3F3F58]"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#EEEEF5] font-semibold text-sm">{inst.nome}</p>
                        <p className="text-[#3F3F58] text-xs font-mono mt-0.5 truncate">{inst.instance_id}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[#EEEEF5] text-sm font-semibold">{inst._count.grupos}</p>
                        <p className="text-[#3F3F58] text-[10px]">grupos</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#3F3F58] shrink-0" />
                    </Link>
                    <button
                      onClick={() => { setDeleteInstanciaDialog(inst); setDeleteInstanciaText("") }}
                      title="Excluir instância"
                      className="p-1.5 text-[#3F3F58] hover:text-[#F87171] transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Notificações WA ──────────────────────────────────────────── */}
        {tab === "notif-wa" && (
          <div className="p-6 max-w-lg">
            <div className="mb-4">
              <h2 className="text-[#F1F1F3] text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#25D366]" />
                Notificações WhatsApp
              </h2>
              <p className="text-[#8B8B9E] text-sm mt-1">
                Configure o grupo e a instância Z-API para envio de notificações de demandas.
              </p>
            </div>
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
              <form onSubmit={handleSaveWa} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#F1F1F3]">ID do Grupo WhatsApp</label>
                  <input
                    type="text"
                    value={grupoWaId}
                    onChange={(e) => setGrupoWaId(e.target.value)}
                    placeholder="Ex: 120363xxxxxxxxxx@g.us"
                    className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366]/50 font-mono"
                  />
                  <p className="text-xs text-[#5A5A72]">Z-API → Instâncias → Grupos. Geralmente termina em @g.us.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#F1F1F3]">Nome do Grupo (exibição)</label>
                  <input
                    type="text"
                    value={grupoWaNome}
                    onChange={(e) => setGrupoWaNome(e.target.value)}
                    placeholder="Ex: Suporte DR Marquezine"
                    className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366]/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#F1F1F3]">Instância Z-API para notificações</label>
                  <select
                    value={instanciaNotifId}
                    onChange={(e) => setInstanciaNotifId(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#C4C4D4] focus:outline-none focus:border-[#25D366]/50"
                  >
                    <option value="">Nenhuma (sem notificações WA)</option>
                    {instanciasNotif.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  {waAtivo ? (
                    <Button type="button" variant="outline" size="sm" disabled={savingWa} onClick={handleDisableWa}
                      className="text-[#F87171] border-[#F87171]/30 hover:bg-[#F87171]/10 hover:border-[#F87171]/50">
                      <WifiOff className="w-4 h-4" />
                      Desligar Notificações
                    </Button>
                  ) : <div />}
                  <Button type="submit" loading={savingWa} size="sm">
                    <Save className="w-4 h-4" />
                    Salvar Configuração WA
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Nova Campanha Dialog ─────────────────────────────────────────────── */}
      {cliente && (
        <NovaCampanhaDialog
          open={showNovaCampanha}
          onClose={() => {
            setShowNovaCampanha(false)
            fetchCampanhas()
          }}
          clienteId={id}
          clienteNome={cliente.nome}
          contasManychat={cliente.contas_manychat}
        />
      )}

      {/* ── Add Conta Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showAddConta} onOpenChange={setShowAddConta}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Conta Manychat</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input label="Nome da Conta" placeholder="Ex: Conta Principal..." value={contaNome}
              onChange={(e) => setContaNome(e.target.value)} error={addErrors.conta_nome} required />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                API Key <span className="text-[#F87171]">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setTesteStatus("idle"); setTesteMsg("") }}
                    placeholder="Cole a API Key do Manychat..."
                    className={`w-full h-10 px-3 pr-10 rounded-lg border bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none transition-colors ${addErrors.api_key ? "border-[#F87171]" : "border-[#1E1E2A] focus:border-[#25D366]"}`}
                  />
                  <button type="button" onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A72] hover:text-[#C4C4D4]">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" className="shrink-0 h-10 px-4"
                  onClick={handleTestarConexao} disabled={testeStatus === "testing" || !apiKey.trim()}>
                  {testeStatus === "testing" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Testar"}
                </Button>
              </div>
              {addErrors.api_key && <p className="text-xs text-[#F87171]">{addErrors.api_key}</p>}
              {testeStatus === "ok" && (
                <div className="flex items-center gap-1.5 text-[#25D366]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-xs">{testeMsg}</span>
                </div>
              )}
              {testeStatus === "error" && (
                <div className="flex items-center gap-1.5 text-[#F87171]">
                  <XCircle className="w-3.5 h-3.5" />
                  <span className="text-xs">{testeMsg}</span>
                </div>
              )}
              <p className="text-xs text-[#5A5A72]">Manychat → Configurações → API</p>
            </div>
            {/* Custom Field ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                ID do Custom Field <span className="text-[#5A5A72] font-normal text-xs">(whatsapp-id)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newFieldId}
                  onChange={(e) => setNewFieldId(e.target.value)}
                  placeholder="Ex: 11947822"
                  className="flex-1 h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366] transition-colors font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 h-10 px-4"
                  onClick={handleEnsureField}
                  disabled={ensureFieldStatus === "loading" || !apiKey.trim()}
                >
                  {ensureFieldStatus === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar campo"}
                </Button>
              </div>
              {ensureFieldStatus === "ok" && (
                <div className="flex items-center gap-1.5 text-[#25D366]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-xs">{ensureFieldMsg}</span>
                </div>
              )}
              {ensureFieldStatus === "error" && (
                <div className="flex items-center gap-1.5 text-[#F87171]">
                  <XCircle className="w-3.5 h-3.5" />
                  <span className="text-xs">{ensureFieldMsg}</span>
                </div>
              )}
              <p className="text-xs text-[#5A5A72]">Deixe em branco para criar automaticamente ao adicionar a conta.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddConta(false)} disabled={addLoading}>Cancelar</Button>
            <Button onClick={handleAddConta} loading={addLoading}>Adicionar Conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Conta Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteContaDialog} onOpenChange={(open) => { if (!open) { setDeleteContaDialog(null); setDeleteContaText("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#F87171]">Excluir Conta Manychat</DialogTitle>
          </DialogHeader>

          <p className="text-[#8B8B9E] text-sm">
            Você está prestes a excluir a conta{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteContaDialog?.nome}</span>.
          </p>

          <div className="bg-[#2A1616] border border-[#F87171]/20 rounded-lg p-4 space-y-2">
            <p className="text-[#F87171] text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Dados que serão desvinculados
            </p>
            <ul className="text-xs text-[#C4C4D4] space-y-1 ml-6 list-disc">
              <li>{deleteContaDialog?._count.webhook_flows ?? 0} fluxo(s) de webhook</li>
              <li>{deleteContaDialog?._count.contatos_vinculados ?? 0} contato(s) vinculado(s)</li>
              <li>{deleteContaDialog?._count.grupos_monitoramento ?? 0} grupo(s) monitorado(s)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-[#8B8B9E]">
              Digite <span className="font-mono font-bold text-[#F87171]">excluir</span> para confirmar:
            </p>
            <input
              value={deleteContaText}
              onChange={(e) => setDeleteContaText(e.target.value)}
              placeholder="excluir"
              autoComplete="off"
              className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#F87171]/50 transition-colors"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteContaDialog(null); setDeleteContaText("") }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteContaDialog && handleDeleteConta(deleteContaDialog)}
              disabled={deleteContaText !== "excluir" || deletingContaId === deleteContaDialog?.id}
              loading={deletingContaId === deleteContaDialog?.id}
            >
              Excluir Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nova Instância Z-API Dialog ─────────────────────────────────────── */}
      <Dialog open={showAddInstancia} onOpenChange={(open) => { if (!open) setShowAddInstancia(false) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conectar Instância Z-API</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                Nome <span className="text-[#F87171]">*</span>
              </label>
              <input
                autoFocus
                value={instanciaForm.nome}
                onChange={(e) => setInstanciaForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: WhatsApp Mari Tortella"
                className={`w-full h-10 px-3 rounded-lg border bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none transition-colors ${instanciaErrors.nome ? "border-[#F87171]" : "border-[#1E1E2A] focus:border-[#25D366]"}`}
              />
              {instanciaErrors.nome && <p className="text-xs text-[#F87171]">{instanciaErrors.nome}</p>}
            </div>

            {/* Instance ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                Instance ID <span className="text-[#F87171]">*</span>
              </label>
              <input
                value={instanciaForm.instance_id}
                onChange={(e) => setInstanciaForm((p) => ({ ...p, instance_id: e.target.value }))}
                placeholder="Ex: 3C0A9B2..."
                className={`w-full h-10 px-3 rounded-lg border bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none transition-colors font-mono ${instanciaErrors.instance_id ? "border-[#F87171]" : "border-[#1E1E2A] focus:border-[#25D366]"}`}
              />
              {instanciaErrors.instance_id && <p className="text-xs text-[#F87171]">{instanciaErrors.instance_id}</p>}
              <p className="text-xs text-[#5A5A72]">Painel Z-API → sua instância → copiar Instance ID.</p>
            </div>

            {/* Token */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                Token <span className="text-[#F87171]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showInstanciaToken ? "text" : "password"}
                  value={instanciaForm.token}
                  onChange={(e) => setInstanciaForm((p) => ({ ...p, token: e.target.value }))}
                  placeholder="Token de acesso da instância"
                  className={`w-full h-10 px-3 pr-10 rounded-lg border bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none transition-colors ${instanciaErrors.token ? "border-[#F87171]" : "border-[#1E1E2A] focus:border-[#25D366]"}`}
                />
                <button type="button" onClick={() => setShowInstanciaToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A72] hover:text-[#C4C4D4]">
                  {showInstanciaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {instanciaErrors.token && <p className="text-xs text-[#F87171]">{instanciaErrors.token}</p>}
            </div>

            {/* Client Token */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                Client Token <span className="text-[#F87171]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showInstanciaClientToken ? "text" : "password"}
                  value={instanciaForm.client_token}
                  onChange={(e) => setInstanciaForm((p) => ({ ...p, client_token: e.target.value }))}
                  placeholder="Client token Z-API"
                  className={`w-full h-10 px-3 pr-10 rounded-lg border bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none transition-colors ${instanciaErrors.client_token ? "border-[#F87171]" : "border-[#1E1E2A] focus:border-[#25D366]"}`}
                />
                <button type="button" onClick={() => setShowInstanciaClientToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A72] hover:text-[#C4C4D4]">
                  {showInstanciaClientToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {instanciaErrors.client_token && <p className="text-xs text-[#F87171]">{instanciaErrors.client_token}</p>}
              <p className="text-xs text-[#5A5A72]">Z-API → Security → Client Token (diferente do token da instância).</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInstancia(false)} disabled={addInstanciaLoading}>
              Cancelar
            </Button>
            <Button onClick={handleAddInstancia} loading={addInstanciaLoading}>
              <Wifi className="w-4 h-4" />
              Conectar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Instância Z-API Dialog ───────────────────────────────────── */}
      <Dialog open={!!deleteInstanciaDialog} onOpenChange={(open) => { if (!open) { setDeleteInstanciaDialog(null); setDeleteInstanciaText("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#F87171]">Excluir Instância Z-API</DialogTitle>
          </DialogHeader>

          <p className="text-[#8B8B9E] text-sm">
            Você está prestes a excluir a instância{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteInstanciaDialog?.nome}</span>.
          </p>

          <div className="bg-[#2A1616] border border-[#F87171]/20 rounded-lg p-4 space-y-2">
            <p className="text-[#F87171] text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Dados que serão removidos
            </p>
            <ul className="text-xs text-[#C4C4D4] space-y-1 ml-6 list-disc">
              <li>{deleteInstanciaDialog?._count.grupos ?? 0} grupo(s) monitorado(s)</li>
            </ul>
            {(deleteInstanciaDialog?._count.grupos ?? 0) > 0 && (
              <p className="text-xs text-[#F87171] mt-1">
                Remova todos os grupos antes de excluir a instância.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-[#8B8B9E]">
              Digite <span className="font-mono font-bold text-[#F87171]">excluir</span> para confirmar:
            </p>
            <input
              value={deleteInstanciaText}
              onChange={(e) => setDeleteInstanciaText(e.target.value)}
              placeholder="excluir"
              autoComplete="off"
              className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#F87171]/50 transition-colors"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteInstanciaDialog(null); setDeleteInstanciaText("") }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteInstanciaDialog && handleDeleteInstancia(deleteInstanciaDialog)}
              disabled={deleteInstanciaText !== "excluir" || deletingInstanciaId === deleteInstanciaDialog?.id}
              loading={deletingInstanciaId === deleteInstanciaDialog?.id}
            >
              Excluir Instância
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Field ID Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editFieldConta} onOpenChange={(open) => { if (!open) setEditFieldConta(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Field ID — [esc]whatsapp-id</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-[#1A1A28] border border-[#2A2A3A] rounded-lg p-3 text-xs text-[#8B8B9E]">
              <p className="font-medium text-[#C4C4D4] mb-1">Como encontrar o Field ID</p>
              <p>No Manychat, vá em <span className="text-[#F1F1F3]">Configurações → Campos do Usuário</span>, passe o mouse sobre o campo <span className="font-mono text-[#A78BFA]">[esc]whatsapp-id</span> e anote o ID exibido no tooltip.</p>
              {editFieldConta?.whatsapp_field_id && (
                <p className="mt-2 text-[#25D366]">Field ID atual: <span className="font-mono font-bold">{editFieldConta.whatsapp_field_id}</span></p>
              )}
            </div>
            <Input label="Field ID" placeholder="Ex: 11947822" type="number"
              value={fieldIdInput} onChange={(e) => setFieldIdInput(e.target.value)} required />

            {/* Verification status */}
            {verifyState === "checking" && (
              <div className="flex items-center gap-2 text-xs text-[#8B8B9E]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando no Manychat...
              </div>
            )}
            {verifyState === "valid" && verifiedField && (
              <div className="flex items-center gap-2 text-xs text-[#25D366]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Campo <span className="font-mono">{verifiedField.name}</span> encontrado
                {verifiedField.type !== "text" && (
                  <span className="text-[#F59E0B] ml-1">(tipo: {verifiedField.type} — esperado: text)</span>
                )}
              </div>
            )}
            {verifyState === "invalid" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#F87171]">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  {verifyMsg || "Este campo não existe nesta conta Manychat. Informe outro ID ou crie um."}
                </div>
                <Button size="sm" variant="outline" onClick={handleCreateField} loading={creatingField}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Criar [esc]whatsapp-id automaticamente
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFieldConta(null)} disabled={fieldIdLoading}>Cancelar</Button>
            <Button onClick={handleSaveFieldId} loading={fieldIdLoading}>Salvar Field ID</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
