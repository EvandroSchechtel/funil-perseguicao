"use client"

import React, { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function RedefinirSenhaForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") || ""

  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [tokenMessage, setTokenMessage] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      setTokenMessage("Token inválido. Solicite um novo link.")
      return
    }

    fetch(`/api/auth/redefinir-senha?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        setTokenValid(data.valid)
        if (!data.valid) setTokenMessage(data.message || "Token inválido ou expirado.")
      })
      .catch(() => {
        setTokenValid(false)
        setTokenMessage("Erro ao verificar o token.")
      })
  }, [token])

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
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: novaSenha, passwordConfirm: confirmarSenha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Erro ao redefinir senha.")
        return
      }

      setSuccess(true)
      setTimeout(() => router.push("/login"), 3000)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (tokenValid === null) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full mx-auto" />
        <p className="text-[#8B8B9E] text-sm mt-3">Verificando link...</p>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(239,68,68,0.15)] mb-4">
          <XCircle className="w-8 h-8 text-[#F87171]" />
        </div>
        <h2 className="text-[#F1F1F3] text-xl font-bold mb-2">Link inválido</h2>
        <p className="text-[#8B8B9E] text-sm mb-6">{tokenMessage}</p>
        <Link href="/esqueceu-senha">
          <Button>Solicitar novo link</Button>
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(37,211,102,0.15)] mb-4">
          <CheckCircle className="w-8 h-8 text-[#25D366]" />
        </div>
        <h2 className="text-[#F1F1F3] text-xl font-bold mb-2">Senha redefinida!</h2>
        <p className="text-[#8B8B9E] text-sm mb-2">
          Sua senha foi alterada com sucesso.
        </p>
        <p className="text-[#5A5A72] text-xs">Redirecionando para o login...</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[#F1F1F3] text-2xl font-bold">Redefinir senha</h1>
        <p className="text-[#8B8B9E] text-sm mt-1">Crie uma nova senha para sua conta.</p>
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
          label="Confirmar senha"
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
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </Button>
      </form>
    </>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <div className="w-full max-w-md">
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
        <Suspense
          fallback={
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full mx-auto" />
            </div>
          }
        >
          <RedefinirSenhaForm />
        </Suspense>
      </div>
    </div>
  )
}
