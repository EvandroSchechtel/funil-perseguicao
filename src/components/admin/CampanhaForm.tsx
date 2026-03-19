"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface CampanhaFormProps {
  mode: "create" | "edit"
  initialData?: {
    id: string
    nome: string
    descricao: string | null
    status: "ativo" | "inativo"
    data_inicio: string | null
    data_fim: string | null
  }
}

export function CampanhaForm({ mode, initialData }: CampanhaFormProps) {
  const { accessToken } = useAuth()
  const router = useRouter()

  const [nome, setNome] = useState(initialData?.nome || "")
  const [descricao, setDescricao] = useState(initialData?.descricao || "")
  const [status, setStatus] = useState<"ativo" | "inativo">(initialData?.status || "ativo")
  const [dataInicio, setDataInicio] = useState(
    initialData?.data_inicio ? initialData.data_inicio.slice(0, 10) : ""
  )
  const [dataFim, setDataFim] = useState(
    initialData?.data_fim ? initialData.data_fim.slice(0, 10) : ""
  )
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!nome.trim()) newErrors.nome = "Nome é obrigatório"

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

      toast.success(data.message || (mode === "create" ? "Campanha criada!" : "Campanha atualizada!"))
      router.push("/admin/campanhas")
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
        label="Nome da Campanha"
        placeholder="Ex: Lançamento Produto X, Black Friday..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        error={errors.nome}
        required
      />

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
