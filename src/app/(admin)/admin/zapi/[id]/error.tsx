"use client"

import { useEffect } from "react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function ZApiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[ZApi page error]", error)
  }, [error])

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Z-API / WhatsApp", href: "/admin/zapi" },
          { label: "Erro" },
        ]}
      />
      <div className="flex flex-col items-center justify-center flex-1 gap-5 p-8">
        <div className="w-12 h-12 rounded-2xl bg-[#F87171]/10 border border-[#F87171]/20 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-[#F87171]" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <p className="text-[#EEEEF5] font-semibold">Ocorreu um erro ao carregar esta página</p>
          <p className="text-[#F87171] text-sm font-mono bg-[#0A0A12] border border-[#1C1C2C] rounded-lg px-4 py-3 text-left break-all">
            {error.message || "Erro desconhecido"}
          </p>
          {error.stack && (
            <p className="text-[#3F3F58] text-[10px] font-mono bg-[#0A0A12] border border-[#1C1C2C] rounded-lg px-4 py-3 text-left whitespace-pre-wrap break-all mt-2 max-h-48 overflow-y-auto">
              {error.stack}
            </p>
          )}
          {error.digest && (
            <p className="text-[#3F3F58] text-xs">digest: {error.digest}</p>
          )}
        </div>
        <Button onClick={reset} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </div>
    </div>
  )
}
