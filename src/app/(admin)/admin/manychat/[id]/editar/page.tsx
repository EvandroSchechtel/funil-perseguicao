"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { ContaForm } from "@/components/admin/ContaForm"

interface ContaData {
  id: string
  nome: string
  api_key_hint: string
  page_name: string | null
  status: "ativo" | "inativo"
}

export default function EditarContaPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const [conta, setConta] = useState<ContaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !id) return
    fetch(`/api/admin/contas/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Conta não encontrada")
        return res.json()
      })
      .then((data) => setConta(data.conta))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accessToken, id])

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Manychat", href: "/admin/manychat" },
          { label: loading ? "..." : conta?.nome || "Editar Conta" },
        ]}
      />

      <div className="p-6 max-w-lg">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Editar Conta</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Atualize as configurações da conta Manychat
          </p>
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-[#F87171] text-sm">{error}</p>
            </div>
          ) : conta ? (
            <ContaForm mode="edit" initialData={conta} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
