"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Plus, Zap, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ToggleRight, ToggleLeft } from "lucide-react"
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
}

interface ClienteData {
  id: string
  nome: string
  email: string | null
  telefone: string | null
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
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E1E2A]">
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Conta</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Página</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {cliente.contas_manychat.map((conta) => (
                      <tr key={conta.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-[#C4C4D4] text-sm font-medium">{conta.nome}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[#8B8B9E] text-sm">{conta.page_name || "—"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={conta.status === "ativo" ? "ativo" : "inativo"}>
                            {conta.status === "ativo" ? "Ativa" : "Inativa"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
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
    </div>
  )
}
