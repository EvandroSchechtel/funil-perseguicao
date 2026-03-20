"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Copy, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface Campanha {
  id: string
  nome: string
  status: "ativo" | "inativo"
}

interface WebhookFormProps {
  mode: "create" | "edit"
  initialData?: {
    id: string
    nome: string
    status: "ativo" | "inativo"
    url_publica: string
    leads_count?: number
    campanha: { id: string; nome: string } | null
  }
}

export function WebhookForm({ mode, initialData }: WebhookFormProps) {
  const { accessToken } = useAuth()
  const router = useRouter()

  const [nome, setNome] = useState(initialData?.nome || "")
  const [campanhaId, setCampanhaId] = useState(initialData?.campanha?.id || "")
  const [status, setStatus] = useState<"ativo" | "inativo">(initialData?.status || "ativo")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loadingCampanhas, setLoadingCampanhas] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchCampanhas = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch("/api/admin/campanhas?per_page=100&status=ativo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setCampanhas(data.data || [])
    } catch {
      // silently fail
    } finally {
      setLoadingCampanhas(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchCampanhas()
  }, [fetchCampanhas])

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
    if (!campanhaId) newErrors.campanha_id = "Campanha é obrigatória"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        nome: nome.trim(),
        campanha_id: campanhaId,
        status,
      }

      const url =
        mode === "create"
          ? "/api/admin/webhooks"
          : `/api/admin/webhooks/${initialData!.id}`

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
          toast.error(data.message || "Erro ao salvar webhook.")
        }
        return
      }

      toast.success(data.message || (mode === "create" ? "Webhook criado!" : "Webhook atualizado!"))
      router.push("/admin/webhooks")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* URL Pública (edit only) */}
      {mode === "edit" && initialData?.url_publica && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#C4C4D4]">URL Pública do Webhook</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-[#8B8B9E] text-xs flex items-center font-mono overflow-hidden">
              <span className="truncate">{initialData.url_publica}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 h-10 px-3"
              onClick={() => handleCopy(initialData.url_publica)}
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          {(initialData.leads_count ?? 0) > 0 && (
            <p className="text-xs text-[#5A5A72]">
              {initialData.leads_count} lead{initialData.leads_count !== 1 ? "s" : ""} recebido{initialData.leads_count !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      <Input
        label="Nome do Webhook"
        placeholder="Ex: Landing Page Produto, Anúncio Facebook..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        error={errors.nome}
        required
      />

      {/* Campanha Select — obrigatório */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#C4C4D4]">
          Campanha <span className="text-[#F87171]">*</span>
        </label>
        {loadingCampanhas ? (
          <div className="h-10 rounded-lg border border-[#1E1E2A] bg-[#111118] flex items-center px-3">
            <span className="text-[#5A5A72] text-sm">Carregando campanhas…</span>
          </div>
        ) : (
          <select
            value={campanhaId}
            onChange={(e) => setCampanhaId(e.target.value)}
            className={`w-full h-10 px-3 rounded-lg border bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors ${errors.campanha_id ? "border-[#F87171]" : "border-[#1E1E2A]"}`}
          >
            <option value="">— Selecionar campanha —</option>
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        {errors.campanha_id ? (
          <p className="text-xs text-[#F87171]">{errors.campanha_id}</p>
        ) : (
          <p className="text-xs text-[#5A5A72]">Todos os leads deste webhook serão agrupados nesta campanha</p>
        )}
      </div>

      <div className="flex items-center justify-between p-4 bg-[#111118] border border-[#1E1E2A] rounded-lg">
        <div>
          <p className="text-sm font-medium text-[#C4C4D4]">Status</p>
          <p className="text-xs text-[#5A5A72] mt-0.5">
            {status === "ativo" ? "Webhook ativo e recebendo leads" : "Webhook desativado — não aceita novos leads"}
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
            : mode === "create" ? "Criar Webhook" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  )
}
