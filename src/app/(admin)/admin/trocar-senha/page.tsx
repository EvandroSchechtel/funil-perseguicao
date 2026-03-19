"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ShieldAlert } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function TrocarSenhaPage() {
  const { user, accessToken, setAccessToken, updateUser } = useAuth()
  const router = useRouter()

  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setFieldErrors({})

    if (novaSenha.length < 8) {
      setFieldErrors({ novaSenha: "A senha deve ter no mínimo 8 caracteres" })
      return
    }

    if (novaSenha !== confirmarSenha) {
      setFieldErrors({ confirmarSenha: "As senhas não coincidem" })
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/admin/perfil/senha", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ novaSenha, confirmarSenha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Erro ao alterar senha.")
        return
      }

      // Update access token with new one (force_password_change = false)
      if (data.access_token) {
        setAccessToken(data.access_token)
      }

      updateUser({ force_password_change: false })
      toast.success("Senha criada com sucesso!")
      router.push("/admin/usuarios")
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center">
            <span className="text-black font-bold text-lg">F</span>
          </div>
          <span className="text-[#F1F1F3] text-2xl font-bold tracking-tight">
            Funil Perseguição
          </span>
        </div>
      </div>

      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-2xl p-8">
        {/* Alert */}
        <div className="flex items-center gap-3 bg-[rgba(250,204,21,0.08)] border border-[rgba(250,204,21,0.20)] rounded-lg px-4 py-3 mb-6">
          <ShieldAlert className="w-5 h-5 text-[#FACC15] shrink-0" />
          <p className="text-[#FACC15] text-sm">
            Por segurança, crie uma nova senha antes de continuar.
          </p>
        </div>

        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Criar nova senha</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Olá, {user?.nome?.split(" ")[0]}! Defina sua senha de acesso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nova senha"
            type={showSenha ? "text" : "password"}
            placeholder="Mínimo 8 caracteres"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            error={fieldErrors.novaSenha}
            helperText="Mínimo 8 caracteres"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                tabIndex={-1}
              >
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
          />

          <Input
            label="Confirmar nova senha"
            type={showConfirmar ? "text" : "password"}
            placeholder="Repita a nova senha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            error={fieldErrors.confirmarSenha}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirmar(!showConfirmar)}
                className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                tabIndex={-1}
              >
                {showConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
          />

          {error && (
            <div className="bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.20)] rounded-lg px-4 py-3">
              <p className="text-[#F87171] text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Salvando..." : "Criar senha e continuar"}
          </Button>
        </form>
      </div>
    </div>
  )
}
