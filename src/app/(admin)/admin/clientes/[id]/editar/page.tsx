"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Plus, Zap, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ToggleRight, ToggleLeft, Hash, AlertCircle, Pencil, MessageSquare, Save, WifiOff } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { ClienteForm } from "@/components/admin/ClienteForm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Conta {
  id: string
  nome: string
  page_name: string | null
  status: "ativo" | "inativo"
  whatsapp_field_id: number | null
}

interface InstanciaZApi {
  id: string
  nome: string
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

export default function EditarClientePage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add conta dialog
  const [showAddConta, setShowAddConta] = useState(false)
  const [contaNome, setContaNome] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [testeStatus, setTesteStatus] = useState<TesteStatus>("idle")
  const [testeMsg, setTesteMsg] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Edit field ID dialog
  const [editFieldConta, setEditFieldConta] = useState<Conta | null>(null)
  const [fieldIdInput, setFieldIdInput] = useState("")
  const [fieldIdLoading, setFieldIdLoading] = useState(false)

  // WA config
  const [instancias, setInstancias] = useState<InstanciaZApi[]>([])
  const [grupoWaId, setGrupoWaId] = useState("")
  const [grupoWaNome, setGrupoWaNome] = useState("")
  const [instanciaNotifId, setInstanciaNotifId] = useState("")
  const [savingWa, setSavingWa] = useState(false)

  const fetchCliente = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    fetch(`/api/admin/clientes/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Cliente não encontrado")
        return res.json()
      })
      .then((data) => setCliente(data.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accessToken, id])

  useEffect(() => {
    fetchCliente()
  }, [fetchCliente])

  // Load instancias Z-API for notification dropdown
  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/zapi/instancias?per_page=100", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setInstancias(d.data ?? []))
      .catch(() => {})
  }, [accessToken])

  // Populate WA state when cliente loads
  useEffect(() => {
    if (!cliente) return
    setGrupoWaId(cliente.grupo_wa_id || "")
    setGrupoWaNome(cliente.grupo_wa_nome || "")
    setInstanciaNotifId(cliente.instancia_zapi_notif_id || "")
  }, [cliente])

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
      if (res.ok) {
        toast.success("Configuração WhatsApp salva.")
      } else {
        toast.error(data.message || "Erro ao salvar.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSavingWa(false)
    }
  }

  async function handleDisableWa() {
    setSavingWa(true)
    try {
      const res = await fetch(`/api/admin/clientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          grupo_wa_id: null,
          grupo_wa_nome: null,
          instancia_zapi_notif_id: null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setGrupoWaId("")
        setGrupoWaNome("")
        setInstanciaNotifId("")
        toast.success("Notificações WhatsApp desligadas.")
      } else {
        toast.error(data.message || "Erro ao desligar.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSavingWa(false)
    }
  }

  const waAtivo = !!(instanciaNotifId || grupoWaId)

  async function handleTestarConexao() {
    if (!apiKey.trim()) {
      setAddErrors((e) => ({ ...e, api_key: "Informe a API Key" }))
      return
    }
    setTesteStatus("testing")
    setTesteMsg("")
    try {
      const res = await fetch("/api/admin/contas/testar-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTesteStatus("ok")
        setTesteMsg(`Conectado: ${data.page_name}`)
        if (!contaNome.trim() && data.page_name) setContaNome(data.page_name)
      } else {
        setTesteStatus("error")
        setTesteMsg(data.message || "Falha na conexão")
      }
    } catch {
      setTesteStatus("error")
      setTesteMsg("Erro de rede")
    }
  }

  function handleOpenAddConta() {
    setShowAddConta(true)
    setContaNome("")
    setApiKey("")
    setShowKey(false)
    setTesteStatus("idle")
    setTesteMsg("")
    setAddErrors({})
  }

  async function handleAddConta() {
    const newErrors: Record<string, string> = {}
    if (!contaNome.trim()) newErrors.conta_nome = "Nome é obrigatório"
    if (!apiKey.trim()) newErrors.api_key = "API Key é obrigatória"
    if (Object.keys(newErrors).length > 0) {
      setAddErrors(newErrors)
      return
    }

    setAddLoading(true)
    try {
      const res = await fetch(`/api/admin/clientes/${id}/contas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ nome: contaNome.trim(), api_key: apiKey.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setShowAddConta(false)
        fetchCliente()
      } else {
        toast.error(data.message || "Erro ao adicionar conta.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setAddLoading(false)
    }
  }

  async function handleToggleConta(conta: Conta) {
    setActionLoading(conta.id)
    try {
      const res = await fetch(`/api/admin/contas/${conta.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchCliente()
      } else {
        toast.error(data.message || "Erro ao alterar status.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setActionLoading(null)
    }
  }

  function handleOpenEditFieldId(conta: Conta) {
    setEditFieldConta(conta)
    setFieldIdInput(conta.whatsapp_field_id ? String(conta.whatsapp_field_id) : "")
  }

  async function handleSaveFieldId() {
    if (!editFieldConta) return
    const num = parseInt(fieldIdInput.trim(), 10)
    if (!fieldIdInput.trim() || isNaN(num) || num <= 0) {
      toast.error("Informe um ID numérico válido.")
      return
    }
    setFieldIdLoading(true)
    try {
      const res = await fetch(`/api/admin/contas/${editFieldConta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ whatsapp_field_id: num }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Field ID salvo com sucesso.")
        setEditFieldConta(null)
        fetchCliente()
      } else {
        toast.error(data.message || "Erro ao salvar.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setFieldIdLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Clientes", href: "/admin/clientes" },
          { label: loading ? "..." : cliente?.nome || "Editar Cliente" },
        ]}
      />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Cliente Form */}
        <div>
          <div className="mb-4">
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Editar Cliente</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">Atualize as informações do cliente</p>
          </div>
          <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
              </div>
            ) : error ? (
              <div className="text-center py-10">
                <p className="text-[#F87171] text-sm">{error}</p>
              </div>
            ) : cliente ? (
              <ClienteForm mode="edit" initialData={cliente} />
            ) : null}
          </div>
        </div>

        {/* Contas Manychat */}
        {!loading && !error && cliente && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[#F1F1F3] text-lg font-semibold">Contas Manychat</h2>
                <p className="text-[#8B8B9E] text-sm mt-0.5">
                  Contas vinculadas a este cliente
                </p>
              </div>
              <Button size="sm" onClick={handleOpenAddConta}>
                <Plus className="w-4 h-4 mr-1.5" />
                Adicionar Conta
              </Button>
            </div>

            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              {cliente.contas_manychat.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Zap className="w-8 h-8 text-[#5A5A72]" />
                  <p className="text-[#5A5A72] text-sm">Nenhuma conta vinculada</p>
                  <Button size="sm" variant="outline" onClick={handleOpenAddConta}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Adicionar Conta
                  </Button>
                </div>
              ) : (
                <div>
                  {cliente.contas_manychat.map((conta) => (
                    <div key={conta.id} className="border-b border-[#1E1E2A] last:border-0 px-5 py-4 hover:bg-[#1C1C28] transition-colors">
                      <div className="flex items-center gap-3">
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[#C4C4D4] text-sm font-medium">{conta.nome}</p>
                            <Badge variant={conta.status === "ativo" ? "ativo" : "inativo"}>
                              {conta.status === "ativo" ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>
                          <p className="text-[#8B8B9E] text-xs mt-0.5">{conta.page_name || "—"}</p>

                          {/* Field ID row */}
                          <div className="flex items-center gap-2 mt-2">
                            <Hash className="w-3 h-3 text-[#5A5A72]" />
                            {conta.whatsapp_field_id ? (
                              <span className="text-xs font-mono text-[#25D366]">
                                [esc]whatsapp-id · field_id: {conta.whatsapp_field_id}
                              </span>
                            ) : (
                              <span className="text-xs text-[#F59E0B] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                field_id não registrado — informe manualmente
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

                        {/* Toggle */}
                        <button
                          onClick={() => handleToggleConta(conta)}
                          disabled={actionLoading === conta.id}
                          className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors disabled:opacity-50"
                          title={conta.status === "ativo" ? "Desativar" : "Ativar"}
                        >
                          {conta.status === "ativo" ? (
                            <ToggleRight className="w-5 h-5 text-[#25D366]" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WhatsApp / Z-API Config */}
        {!loading && !error && cliente && (
          <div>
            <div className="mb-4">
              <h2 className="text-[#F1F1F3] text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#25D366]" />
                Notificações WhatsApp
              </h2>
              <p className="text-[#8B8B9E] text-sm mt-0.5">
                Configure o grupo e a instância Z-API para envio de notificações de demandas.
              </p>
            </div>

            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
              <form onSubmit={handleSaveWa} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#F1F1F3]">
                    ID do Grupo WhatsApp
                  </label>
                  <input
                    type="text"
                    value={grupoWaId}
                    onChange={(e) => setGrupoWaId(e.target.value)}
                    placeholder="Ex: 120363xxxxxxxxxx@g.us"
                    className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366]/50 font-mono"
                  />
                  <p className="text-xs text-[#5A5A72]">
                    Encontrado em Z-API → Instâncias → Grupos. Geralmente termina em @g.us.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#F1F1F3]">
                    Nome do Grupo (exibição)
                  </label>
                  <input
                    type="text"
                    value={grupoWaNome}
                    onChange={(e) => setGrupoWaNome(e.target.value)}
                    placeholder="Ex: Suporte DR Marquezine"
                    className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366]/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#F1F1F3]">
                    Instância Z-API para notificações
                  </label>
                  <select
                    value={instanciaNotifId}
                    onChange={(e) => setInstanciaNotifId(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#C4C4D4] focus:outline-none focus:border-[#25D366]/50"
                  >
                    <option value="">Nenhuma (sem notificações WA)</option>
                    {instancias.map((inst) => (
                      <option key={inst.id} value={inst.id} className="bg-[#111118]">
                        {inst.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#5A5A72]">
                    A instância usada para enviar mensagens ao grupo do cliente.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  {waAtivo ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingWa}
                      onClick={handleDisableWa}
                      className="text-[#F87171] border-[#F87171]/30 hover:bg-[#F87171]/10 hover:border-[#F87171]/50"
                    >
                      <WifiOff className="w-4 h-4" />
                      Desligar Notificações
                    </Button>
                  ) : (
                    <div />
                  )}
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

      {/* Add Conta Dialog */}
      <Dialog open={showAddConta} onOpenChange={setShowAddConta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Conta Manychat</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Input
              label="Nome da Conta"
              placeholder="Ex: Conta Principal, Página Produto X..."
              value={contaNome}
              onChange={(e) => setContaNome(e.target.value)}
              error={addErrors.conta_nome}
              required
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                API Key <span className="text-[#F87171]">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setTesteStatus("idle")
                      setTesteMsg("")
                    }}
                    placeholder="Cole a API Key do Manychat..."
                    className={`w-full h-10 px-3 pr-10 rounded-lg border bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none transition-colors ${
                      addErrors.api_key ? "border-[#F87171]" : "border-[#1E1E2A] focus:border-[#25D366]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A72] hover:text-[#C4C4D4]"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 h-10 px-4"
                  onClick={handleTestarConexao}
                  disabled={testeStatus === "testing" || !apiKey.trim()}
                >
                  {testeStatus === "testing" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Testar"
                  )}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddConta(false)} disabled={addLoading}>
              Cancelar
            </Button>
            <Button onClick={handleAddConta} loading={addLoading}>
              Adicionar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Field ID Dialog */}
      <Dialog open={!!editFieldConta} onOpenChange={(open) => { if (!open) setEditFieldConta(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Field ID — [esc]whatsapp-id</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-[#1A1A28] border border-[#2A2A3A] rounded-lg p-3 text-xs text-[#8B8B9E]">
              <p className="font-medium text-[#C4C4D4] mb-1">Como encontrar o Field ID</p>
              <p>No Manychat, vá em <span className="text-[#F1F1F3]">Configurações → Campos do Usuário</span>, passe o mouse sobre o campo <span className="font-mono text-[#A78BFA]">[esc]whatsapp-id</span> e anote o ID exibido no tooltip.</p>
              {editFieldConta?.whatsapp_field_id && (
                <p className="mt-2 text-[#25D366]">Field ID atual: <span className="font-mono font-bold">{editFieldConta.whatsapp_field_id}</span></p>
              )}
            </div>

            <Input
              label="Field ID"
              placeholder="Ex: 11947822"
              type="number"
              value={fieldIdInput}
              onChange={(e) => setFieldIdInput(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFieldConta(null)} disabled={fieldIdLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFieldId} loading={fieldIdLoading}>
              Salvar Field ID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
