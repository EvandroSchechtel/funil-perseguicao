"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { WebhookForm } from "@/components/admin/WebhookForm"

interface WebhookData {
  id: string
  nome: string
  flow_ns: string
  flow_nome: string | null
  status: "ativo" | "inativo"
  url_publica: string
  leads_count: number
  conta: { id: string; nome: string }
}

export default function EditarWebhookPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const [webhook, setWebhook] = useState<WebhookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !id) return
    fetch(`/api/admin/webhooks/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Webhook não encontrado")
        return res.json()
      })
      .then((data) => setWebhook(data.webhook))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accessToken, id])

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Webhooks", href: "/admin/webhooks" },
          { label: loading ? "..." : webhook?.nome || "Editar Webhook" },
        ]}
      />

      <div className="p-6 max-w-lg">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Editar Webhook</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Atualize as configurações do webhook
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
          ) : webhook ? (
            <WebhookForm mode="edit" initialData={webhook} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
