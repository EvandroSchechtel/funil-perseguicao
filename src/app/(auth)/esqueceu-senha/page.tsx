"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function EsqueceuSenhaPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/esqueceu-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      // Always show success (to prevent email enumeration)
      setSent(true)
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
        {sent ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(37,211,102,0.15)] mb-4">
              <CheckCircle className="w-8 h-8 text-[#25D366]" />
            </div>
            <h2 className="text-[#F1F1F3] text-xl font-bold mb-2">Email enviado!</h2>
            <p className="text-[#8B8B9E] text-sm mb-6">
              Se o email <strong className="text-[#F1F1F3]">{email}</strong> estiver cadastrado,
              você receberá as instruções para redefinir a senha em instantes.
            </p>
            <p className="text-[#5A5A72] text-xs mb-6">Não recebeu? Verifique a pasta de spam.</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-[#25D366] text-sm hover:text-[#1EBD5A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-[#F1F1F3] text-2xl font-bold">Esqueceu a senha?</h1>
              <p className="text-[#8B8B9E] text-sm mt-1">
                Informe seu email e enviaremos um link de recuperação.
              </p>
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
              />

              {error && (
                <div className="bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.20)] rounded-lg px-4 py-3">
                  <p className="text-[#F87171] text-sm">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-[#8B8B9E] text-sm hover:text-[#F1F1F3] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
