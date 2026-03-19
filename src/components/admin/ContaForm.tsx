"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Zap } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface ContaFormProps {
  mode: "create" | "edit"
  initialData?: {
    id: string
    nome: string
    api_key_hint: string
    page_name?: string | null
    status: "ativo" | "inativo"
  }
}

export function ContaForm({ mode, initialData }: ContaFormProps) {
  const { accessToken } = useAuth()
  const router = useRouter()

  const [nome, setNome] = useState(initialData?.nome || "")
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [changeApiKey, setChangeApiKey] = useState(mode === "create")
  const [status, setStatus] = useState<"ativo" | "inativo">(initialData?.status || "ativo")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!nome.trim()) newErrors.nome = "Nome é obrigatório"
    if (mode === "create" && !apiKey.trim()) newErrors.api_key = "API Key é obrigatória"
    if (mode === "edit" && changeApiKey && !apiKey.trim()) newErrors.api_key = "Insira a nova API Key"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      const body: Record<string, unknown> = { nome, status }
      if (apiKey.trim()) body.api_key = apiKey.trim()

      const url =
        mode === "create"
          ? "/api/admin/contas"
          : `/api/admin/contas/${initialData!.id}`

      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
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
          toast.error(data.message || "Erro ao salvar conta.")
        }
        return
      }

      toast.success(data.message || (mode === "create" ? "Conta criada!" : "Conta atualizada!"))
      router.push("/admin/manychat")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Nome da Conta"
        placeholder="Ex: Página Principal, Bot de Vendas..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        error={errors.nome}
        required
      />

      {mode === "edit" && !changeApiKey ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#C4C4D4]">API Key Manychat</label>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-[#5A5A72] text-sm flex items-center font-mono">
              {initialData?.api_key_hint}
            </div>
            <Button type="button" variant="outline" onClick={() => setChangeApiKey(true)}>
              Alterar chave
            </Button>
          </div>
        </div>
      ) : (
        <Input
          label={mode === "edit" ? "Nova API Key Manychat" : "API Key Manychat"}
          type={showApiKey ? "text" : "password"}
          placeholder="Cole a sua API Key do Manychat aqui"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          error={errors.api_key}
          helperText="Será validada automaticamente ao salvar"
          rightIcon={
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
              tabIndex={-1}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />
      )}

      {mode === "edit" && initialData?.page_name && (
        <div className="flex items-center gap-2 text-sm text-[#8B8B9E] bg-[#111118] border border-[#1E1E2A] rounded-lg px-3 py-2">
          <Zap className="w-4 h-4 text-[#25D366]" />
          <span>Página conectada: <span className="text-[#F1F1F3] font-medium">{initialData.page_name}</span></span>
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-[#111118] border border-[#1E1E2A] rounded-lg">
        <div>
          <p className="text-sm font-medium text-[#C4C4D4]">Status</p>
          <p className="text-xs text-[#5A5A72] mt-0.5">
            {status === "ativo" ? "Conta ativa e pronta para receber leads" : "Conta desativada"}
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
            ? mode === "create"
              ? "Conectando..."
              : "Salvando..."
            : mode === "create"
              ? "Conectar Conta"
              : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  )
}
