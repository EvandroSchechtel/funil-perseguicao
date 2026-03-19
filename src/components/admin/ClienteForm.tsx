"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface ClienteFormProps {
  mode: "create" | "edit"
  initialData?: {
    id: string
    nome: string
    email: string | null
    telefone: string | null
  }
}

type TesteStatus = "idle" | "testing" | "ok" | "error"

export function ClienteForm({ mode, initialData }: ClienteFormProps) {
  const { accessToken } = useAuth()
  const router = useRouter()

  // Cliente fields
  const [nome, setNome] = useState(initialData?.nome || "")
  const [email, setEmail] = useState(initialData?.email || "")
  const [telefone, setTelefone] = useState(initialData?.telefone || "")

  // Primeira conta (create only)
  const [contaNome, setContaNome] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [testeStatus, setTesteStatus] = useState<TesteStatus>("idle")
  const [testeMsg, setTesteMsg] = useState("")

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleTestarConexao() {
    if (!apiKey.trim()) {
      setErrors((e) => ({ ...e, api_key: "Informe a API Key antes de testar" }))
      return
    }
    setTesteStatus("testing")
    setTesteMsg("")
    try {
      // Use the existing test endpoint — for now just fire the real POST with a dummy
      // client to validate; we use a lightweight fetch to our own manychat test route
      const res = await fetch("/api/admin/contas/testar-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTesteStatus("ok")
        setTesteMsg(`Conectado: ${data.page_name}`)
        if (!contaNome.trim() && data.page_name) {
          setContaNome(data.page_name)
        }
      } else {
        setTesteStatus("error")
        setTesteMsg(data.message || "Falha na conexão")
      }
    } catch {
      setTesteStatus("error")
      setTesteMsg("Erro de rede ao testar")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!nome.trim()) newErrors.nome = "Nome é obrigatório"
    if (mode === "create") {
      if (!contaNome.trim()) newErrors.conta_nome = "Nome da conta é obrigatório"
      if (!apiKey.trim()) newErrors.api_key = "API Key é obrigatória"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> =
        mode === "create"
          ? {
              nome: nome.trim(),
              email: email.trim() || null,
              telefone: telefone.trim() || null,
              primeira_conta: {
                nome: contaNome.trim(),
                api_key: apiKey.trim(),
              },
            }
          : {
              nome: nome.trim(),
              email: email.trim() || null,
              telefone: telefone.trim() || null,
            }

      const url =
        mode === "create"
          ? "/api/admin/clientes"
          : `/api/admin/clientes/${initialData!.id}`

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
            if (key === "primeira_conta") {
              // nested errors from zod
              const nested = msgs as Record<string, string[]>
              if (nested.nome) fieldErrors.conta_nome = nested.nome[0]
              if (nested.api_key) fieldErrors.api_key = nested.api_key[0]
            } else {
              fieldErrors[key] = (msgs as string[])[0]
            }
          }
          setErrors(fieldErrors)
        } else {
          toast.error(data.message || "Erro ao salvar cliente.")
        }
        return
      }

      toast.success(data.message || (mode === "create" ? "Cliente criado!" : "Cliente atualizado!"))
      router.push("/admin/clientes")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Dados do Cliente ── */}
      <Input
        label="Nome do Cliente"
        placeholder="Ex: Empresa ABC, João Silva..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        error={errors.nome}
        required
      />

      <Input
        label="Email (opcional)"
        placeholder="contato@empresa.com"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />

      <Input
        label="Telefone (opcional)"
        placeholder="(11) 99999-9999"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        error={errors.telefone}
      />

      {/* ── Primeira Conta Manychat (create only) ── */}
      {mode === "create" && (
        <div className="space-y-4 pt-2">
          <div className="border-t border-[#1E1E2A] pt-4">
            <p className="text-sm font-semibold text-[#F1F1F3]">Conta Manychat</p>
            <p className="text-xs text-[#5A5A72] mt-0.5">
              Vincule a primeira conta Manychat deste cliente
            </p>
          </div>

          <Input
            label="Nome da Conta"
            placeholder="Ex: Conta Principal, Página do Produto..."
            value={contaNome}
            onChange={(e) => setContaNome(e.target.value)}
            error={errors.conta_nome}
            required
          />

          {/* API Key com botão de mostrar/ocultar e testar */}
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
                    errors.api_key
                      ? "border-[#F87171] focus:border-[#F87171]"
                      : "border-[#1E1E2A] focus:border-[#25D366]"
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
            {errors.api_key && (
              <p className="text-xs text-[#F87171]">{errors.api_key}</p>
            )}
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
            <p className="text-xs text-[#5A5A72]">
              Encontre em Manychat → Configurações → API
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {loading
            ? mode === "create" ? "Criando..." : "Salvando..."
            : mode === "create" ? "Criar Cliente" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  )
}
