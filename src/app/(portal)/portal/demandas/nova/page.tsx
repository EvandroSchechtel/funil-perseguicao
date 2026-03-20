"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  titulo: string
  tipo: string
  prioridade: string
  descricao: string
}

interface FormErrors {
  titulo?: string
  tipo?: string
  descricao?: string
}

// ---------------------------------------------------------------------------
// Select component (styled to match design system)
// ---------------------------------------------------------------------------

function Select({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[#F1F1F3]">
        {label}
        {required && <span className="text-[#F87171] ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="flex h-10 w-full rounded-lg border border-[#1E1E2A] bg-[#111118] px-3 py-2 text-sm text-[#F1F1F3] transition-colors focus:border-[#25D366] focus:outline-none focus:shadow-[0_0_0_2px_rgba(37,211,102,0.15)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#111118]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const tipoOptions = [
  { value: "nova_campanha", label: "Nova Campanha" },
  { value: "ajuste_funil", label: "Ajuste de Funil" },
  { value: "relatorio_customizado", label: "Relatório Customizado" },
  { value: "suporte_tecnico", label: "Suporte Técnico" },
  { value: "outro", label: "Outro" },
]

const prioridadeOptions = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NovaDemandaPage() {
  const { accessToken } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    titulo: "",
    tipo: "nova_campanha",
    prioridade: "normal",
    descricao: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.titulo.trim()) errs.titulo = "Título é obrigatório."
    if (!form.tipo) errs.tipo = "Selecione o tipo."
    if (!form.descricao.trim()) {
      errs.descricao = "Descrição é obrigatória."
    } else if (form.descricao.trim().length < 20) {
      errs.descricao = "Descrição deve ter pelo menos 20 caracteres."
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    if (!accessToken) return

    setLoading(true)
    try {
      const res = await fetch("/api/portal/demandas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "Erro ao criar demanda.")
        return
      }
      toast.success("Demanda criada com sucesso!")
      router.push(`/portal/demandas/${data.id}`)
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="h-16 bg-[#0B0B0F] border-b border-[#1E1E2A] flex items-center px-6 sticky top-0 z-20">
        <Link
          href="/portal/demandas"
          className="flex items-center gap-1.5 text-[#8B8B9E] hover:text-[#F1F1F3] transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
      </header>

      <div className="flex-1 p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Nova Demanda</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Descreva o que você precisa e nossa equipe entrará em contato.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6 space-y-5">
            {/* Título */}
            <Input
              label="Título"
              placeholder="Ex: Ajuste na campanha de remarketing"
              value={form.titulo}
              onChange={(e) => setField("titulo", e.target.value)}
              error={errors.titulo}
              required
            />

            {/* Tipo + Prioridade side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Tipo"
                value={form.tipo}
                onChange={(v) => setField("tipo", v)}
                options={tipoOptions}
                required
              />
              <Select
                label="Prioridade"
                value={form.prioridade}
                onChange={(v) => setField("prioridade", v)}
                options={prioridadeOptions}
              />
            </div>

            {/* Descrição */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[#F1F1F3]">
                Descrição <span className="text-[#F87171] ml-0.5">*</span>
              </label>
              <textarea
                value={form.descricao}
                onChange={(e) => setField("descricao", e.target.value)}
                placeholder="Descreva em detalhes o que você precisa, contexto, expectativas..."
                rows={6}
                required
                className={`w-full rounded-lg border bg-[#111118] px-3 py-2.5 text-sm text-[#F1F1F3] placeholder:text-[#5A5A72] transition-colors resize-none focus:outline-none focus:shadow-[0_0_0_2px_rgba(37,211,102,0.15)] ${
                  errors.descricao
                    ? "border-[#F87171] focus:border-[#F87171]"
                    : "border-[#1E1E2A] focus:border-[#25D366]"
                }`}
              />
              <div className="flex items-center justify-between">
                {errors.descricao ? (
                  <p className="text-xs text-[#F87171]">{errors.descricao}</p>
                ) : (
                  <p className="text-xs text-[#5A5A72]">Mínimo de 20 caracteres</p>
                )}
                <span
                  className={`text-xs ${
                    form.descricao.length < 20 ? "text-[#5A5A72]" : "text-[#25D366]"
                  }`}
                >
                  {form.descricao.length} / 20+
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Link href="/portal/demandas">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={loading}>
              Criar Demanda
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
