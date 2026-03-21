"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Zap, Hash, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
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
    whatsapp_field_id?: number | null
    limite_diario?: number | null
    uso_hoje?: number
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

  // Limite diário state
  const [limiteDiario, setLimiteDiario] = useState(
    initialData?.limite_diario ? String(initialData.limite_diario) : ""
  )

  // Custom field state
  const [hasCustomField, setHasCustomField] = useState<boolean | null>(
    initialData?.whatsapp_field_id != null ? true : mode === "edit" ? null : null
  )
  const [whatsappFieldId, setWhatsappFieldId] = useState(
    initialData?.whatsapp_field_id ? String(initialData.whatsapp_field_id) : ""
  )
  type FieldLookupState = "idle" | "fetching" | "found" | "not-found"
  const [fieldLookupState, setFieldLookupState] = useState<FieldLookupState>("idle")

  // Auto-lookup [esc]whatsapp-id field when API key is entered
  useEffect(() => {
    if (!changeApiKey || !apiKey.trim()) {
      setFieldLookupState("idle")
      return
    }
    setFieldLookupState("fetching")
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/contas/lookup-field", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ api_key: apiKey.trim() }),
        })
        const data = await res.json()
        if (res.ok && data.data?.ok && data.data.field_id) {
          setFieldLookupState("found")
          setWhatsappFieldId(String(data.data.field_id))
          setHasCustomField(true)
        } else {
          setFieldLookupState("not-found")
          setHasCustomField((prev) => (prev === null ? false : prev))
        }
      } catch {
        setFieldLookupState("idle")
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [apiKey, changeApiKey, accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!nome.trim()) newErrors.nome = "Nome é obrigatório"
    if (mode === "create" && !apiKey.trim()) newErrors.api_key = "API Key é obrigatória"
    if (mode === "edit" && changeApiKey && !apiKey.trim()) newErrors.api_key = "Insira a nova API Key"
    if (hasCustomField === true && !whatsappFieldId.trim()) {
      newErrors.whatsapp_field_id = "Informe o ID do custom field"
    }
    if (whatsappFieldId.trim() && isNaN(Number(whatsappFieldId))) {
      newErrors.whatsapp_field_id = "O ID deve ser um número"
    }
    if (limiteDiario.trim() && (isNaN(Number(limiteDiario)) || Number(limiteDiario) <= 0)) {
      newErrors.limite_diario = "Deve ser um número maior que zero"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      const body: Record<string, unknown> = { nome, status }
      if (apiKey.trim()) body.api_key = apiKey.trim()

      // Include whatsapp_field_id if user answered the question
      if (hasCustomField === true && whatsappFieldId.trim()) {
        body.whatsapp_field_id = Number(whatsappFieldId.trim())
      } else if (hasCustomField === false) {
        // Will be created automatically by the API
        body.whatsapp_field_id = null
      }

      // Include limite_diario (null = unlimited)
      if (mode === "edit") {
        body.limite_diario = limiteDiario.trim() ? Number(limiteDiario.trim()) : null
      }

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

      {/* Custom Field [esc]whatsapp-id */}
      <div className="space-y-3 p-4 bg-[#111118] border border-[#1E1E2A] rounded-lg">
        <div>
          <p className="text-sm font-medium text-[#C4C4D4]">Custom Field <span className="font-mono text-[#25D366]">[esc]whatsapp-id</span></p>
          <p className="text-xs text-[#5A5A72] mt-0.5">
            Usado para localizar subscribers no Manychat pelo número de telefone
          </p>
        </div>

        {/* Auto-lookup status */}
        {fieldLookupState === "fetching" && (
          <div className="flex items-center gap-1.5 text-xs text-[#8B8B9E]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando campo automaticamente...
          </div>
        )}
        {fieldLookupState === "found" && (
          <div className="flex items-center gap-1.5 text-xs text-[#25D366]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Campo encontrado e pré-preenchido automaticamente
          </div>
        )}
        {fieldLookupState === "not-found" && (
          <div className="flex items-center gap-1.5 text-xs text-[#F59E0B]">
            <AlertCircle className="w-3.5 h-3.5" /> Campo não encontrado — será criado automaticamente ao conectar
          </div>
        )}

        {initialData?.whatsapp_field_id && hasCustomField !== false ? (
          // Already configured — show current ID with option to change
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#0B0B0F] text-sm">
              <Hash className="w-3.5 h-3.5 text-[#25D366]" />
              <span className="text-[#25D366] font-mono">{whatsappFieldId || initialData.whatsapp_field_id}</span>
              <span className="text-[#5A5A72] text-xs ml-1">field_id configurado</span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setHasCustomField(true); setWhatsappFieldId(String(initialData.whatsapp_field_id)) }}
              className="text-xs"
            >
              Alterar
            </Button>
          </div>
        ) : hasCustomField === null ? (
          // Question: already have the field?
          <div className="space-y-2">
            <p className="text-xs text-[#8B8B9E]">Já tem o custom field <span className="font-mono">[esc]whatsapp-id</span> criado no Manychat?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHasCustomField(true)}
                className="flex-1 py-2 rounded-lg border border-[#1E1E2A] text-sm text-[#C4C4D4] hover:border-[#25D366] hover:text-[#25D366] transition-colors"
              >
                Sim, tenho o ID
              </button>
              <button
                type="button"
                onClick={() => setHasCustomField(false)}
                className="flex-1 py-2 rounded-lg border border-[#1E1E2A] text-sm text-[#C4C4D4] hover:border-[#25D366] hover:text-[#25D366] transition-colors"
              >
                Não, criar automaticamente
              </button>
            </div>
          </div>
        ) : hasCustomField === true ? (
          // Input for field ID
          <div className="space-y-2">
            <Input
              placeholder="Ex: 11947822"
              value={whatsappFieldId}
              onChange={(e) => setWhatsappFieldId(e.target.value)}
              error={errors.whatsapp_field_id}
              helperText="Encontre em Manychat → Settings → Custom Fields → [esc]whatsapp-id → ID"
              leftIcon={<Hash className="w-4 h-4" />}
            />
            <button
              type="button"
              onClick={() => setHasCustomField(null)}
              className="text-xs text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
            >
              ← Voltar
            </button>
          </div>
        ) : (
          // hasCustomField === false
          <div className="flex items-center gap-2 text-xs text-[#8B8B9E] bg-[#1C1C28] rounded-lg px-3 py-2">
            <Zap className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
            O campo será criado automaticamente ao conectar a conta
            <button
              type="button"
              onClick={() => setHasCustomField(null)}
              className="ml-auto text-[#5A5A72] hover:text-[#8B8B9E]"
            >
              Alterar
            </button>
          </div>
        )}
      </div>

      {/* Limite diário — only in edit mode */}
      {mode === "edit" && (
        <div className="space-y-2 p-4 bg-[#111118] border border-[#1E1E2A] rounded-lg">
          <div>
            <p className="text-sm font-medium text-[#C4C4D4]">Limite diário de envios</p>
            <p className="text-xs text-[#5A5A72] mt-0.5">Deixe em branco para envios ilimitados</p>
          </div>
          <Input
            type="number"
            min="1"
            placeholder="Ex: 500"
            value={limiteDiario}
            onChange={(e) => setLimiteDiario(e.target.value)}
            error={errors.limite_diario}
          />
          {initialData?.uso_hoje !== undefined && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5A72]">Enviados hoje</span>
                <span className="text-[#C4C4D4] font-medium">
                  {initialData.uso_hoje}
                  {initialData.limite_diario ? ` / ${initialData.limite_diario}` : ""}
                </span>
              </div>
              {initialData.limite_diario && (
                <div className="h-1.5 bg-[#1E1E2A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((initialData.uso_hoje / initialData.limite_diario) * 100))}%`,
                      backgroundColor:
                        initialData.uso_hoje >= initialData.limite_diario
                          ? "#F87171"
                          : initialData.uso_hoje / initialData.limite_diario > 0.8
                          ? "#FBBF24"
                          : "#25D366",
                    }}
                  />
                </div>
              )}
            </div>
          )}
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
            ? mode === "create" ? "Conectando..." : "Salvando..."
            : mode === "create" ? "Conectar Conta" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  )
}
