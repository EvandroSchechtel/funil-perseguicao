"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/admin/usuarios"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await login(email, password, rememberMe)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Login successful — middleware or AuthContext will redirect
    toast.success("Login realizado com sucesso!")
    router.push(redirectTo)
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
        <p className="text-[#8B8B9E] text-sm mt-2">Sistema de Gerenciamento de Webhooks</p>
      </div>

      {/* Card */}
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-2xl p-8">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Entrar</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">Acesse o painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />

          <Input
            label="Senha"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.20)] rounded-lg px-4 py-3">
              <p className="text-[#F87171] text-sm">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#1E1E2A] bg-[#111118] accent-[#25D366]"
              />
              <span className="text-sm text-[#8B8B9E]">Lembrar-me</span>
            </label>
            <Link
              href="/esqueceu-senha"
              className="text-sm text-[#25D366] hover:text-[#1EBD5A] transition-colors"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>

      <p className="text-center text-[#5A5A72] text-xs mt-6">
        © {new Date().getFullYear()} Funil Perseguição. Todos os direitos reservados.
      </p>
    </div>
  )
}
