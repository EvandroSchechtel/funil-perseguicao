"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Copy, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface Cliente {
  id: string
  nome: string
}

interface CampanhaFormProps {
  mode: "create" | "edit"
  initialData?: {
    id: string
    nome: string
    descricao: string | null
    status: "ativo" | "inativo"
    data_inicio: string | null
    data_fim: string | null
    cliente: { id: string; nome: string } | null
  }
}

interface CriadaInfo {
  campanhaId: string
  webhookId: string
  webhookUrl: string
  nome: string
}

export function CampanhaForm({ mode, initialData }: CampanhaFormProps) {
  const { accessToken } = useAuth()
  const router = useRouter()

  const [nome, setNome] = useState(initialData?.nome || "")
  const [descricao, setDescricao] = useState(initialData?.descricao || "")
  const [status, setStatus] = useState<"ativo" | "inativo">(initialData?.status || "ativo")
  const [clienteId, setClienteId] = useState(initialData?.cliente?.id || "")
  const [dataInicio, setDataInicio] = useState(
    initialData?.data_inicio ? initialData.data_inicio.slice(0, 10) : ""
  )
  const [dataFim, setDataFim] = useState(
    initialData?.data_fim ? initialData.data_fim.slice(0, 10) : ""
  )
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [criada, setCriada] = useState<CriadaInfo | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchClientes = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch("/api/admin/clientes?per_page=200", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setClientes(data.data || [])
    } catch {
      // silently fail
    } finally {
      setLoadingClientes(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("URL copiada!")
    } catch {
      toast.error("Erro ao copiar.")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!nome.trim()) newErrors.nome = "Nome é obrigatório"
    if (mode === "create" && !clienteId) newErrors.cliente_id = "Selecione um cliente"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        status,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        cliente_id: clienteId || null,
      }

      const url =
        mode === "create"
          ? "/api/admin/campanhas"
          : `/api/admin/campanhas/${initialData!.id}`

      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.errors) {
          const fieldErrors: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(data.errors)) {
            fieldErrors[key] = (msgs as string[])[0]
          }
          setErrors(fieldErrors)
        } else {
          toast.error(data.message || "Erro ao salvar campanha.")
        }
        return
      }

      if (mode === "create" && data.webhook) {
        setCriada({
          campanhaId: data.data.id,
          webhookId: data.webhook.id,
          webhookUrl: data.webhook.url_publica,
          nome: data.data.nome,
        })
      } else {
        toast.success(data.message || "Campanha atualizada!")
        router.push("/admin/campanhas")
        router.refresh()
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  // Tela de sucesso após criação
  if (criada) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-14 h-14 rounded-full bg-[rgba(37,211,102,0.15)] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
          </div>
          <div className="text-center">
            <p className="text-[#F1F1F3] font-semibold text-lg">Campanha criada!</p>
            <p className="text-[#8B8B9E] text-sm mt-1">
              Um webhook foi gerado automaticamente para <span className="text-[#F1F1F3]">{criada.nome}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[#C4C4D4]">URL do Webhook</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-[#8B8B9E] text-xs flex items-center font-mono overflow-hidden">
              <span className="truncate">{criada.webhookUrl}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 h-10 px-3"
              onClick={() => handleCopy(criada.webhookUrl)}
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-[#5A5A72]">
            Agora adicione os flows Manychat para ativar a distribuição de leads
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/campanhas")}
            className="flex-1"
          >
            Ver Campanhas
          </Button>
          <Button
            onClick={() => router.push(`/admin/webhooks/${criada.webhookId}/editar`)}
            className="flex-1"
          >
            Adicionar Flows
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Nome da Campanha"
        placeholder="Ex: Lançamento Produto X, Black Friday..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        error={errors.nome}
        required
      />

      {/* Cliente Select */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#C4C4D4]">
          Cliente {mode === "create" && <span className="text-[#F87171]">*</span>}
        </label>
        {loadingClientes ? (
          <div className="h-10 rounded-lg border border-[#1E1E2A] bg-[#111118] flex items-center px-3">
            <span className="text-[#5A5A72] text-sm">Carregando clientes...</span>
          </div>
        ) : clientes.length === 0 ? (
          <div className="h-10 rounded-lg border border-[rgba(248,113,113,0.3)] bg-[#2A1616] flex items-center px-3">
            <span className="text-[#F87171] text-sm">
              Nenhum cliente cadastrado.{" "}
              <a href="/admin/clientes/novo" className="underline">Criar cliente</a>
            </span>
          </div>
        ) : (
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors"
          >
            <option value="">Selecione um cliente...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        {errors.cliente_id && (
          <p className="text-xs text-[#F87171]">{errors.cliente_id}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#C4C4D4]">Descrição (opcional)</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva o objetivo desta campanha..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366] transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#C4C4D4]">Data de Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#C4C4D4]">Data de Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-[#111118] border border-[#1E1E2A] rounded-lg">
        <div>
          <p className="text-sm font-medium text-[#C4C4D4]">Status</p>
          <p className="text-xs text-[#5A5A72] mt-0.5">
            {status === "ativo" ? "Campanha ativa" : "Campanha desativada"}
          </p>
        </div>
        <Switch
          checked={status === "ativo"}
          onCheckedChange={(checked) => setStatus(checked ? "ativo" : "inativo")}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {loading
            ? mode === "create" ? "Criando..." : "Salvando..."
            : mode === "create" ? "Criar Campanha" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  )
}
