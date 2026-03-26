"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useAuth } from "./AuthContext"

interface AlertaSistema {
  id: string
  titulo: string
  mensagem: string
  nivel: string
  referencia_nome?: string | null
  created_at: string
}

interface AlertasContextType {
  alertas: AlertaSistema[]
  alertCount: number
  resolverAlerta: (id: string) => Promise<void>
  resolvingId: string | null
  refresh: () => void
}

const AlertasContext = createContext<AlertasContextType>({
  alertas: [],
  alertCount: 0,
  resolverAlerta: async () => {},
  resolvingId: null,
  refresh: () => {},
})

export function AlertasProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth()
  const [alertas, setAlertas] = useState<AlertaSistema[]>([])
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const fetchAlertas = useCallback(() => {
    if (!accessToken) return
    fetch("/api/admin/alertas", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((json) => {
        setAlertas(json?.data?.ativos ?? [])
      })
      .catch(() => {})
  }, [accessToken])

  useEffect(() => {
    fetchAlertas()
    const id = setInterval(fetchAlertas, 60_000)
    return () => clearInterval(id)
  }, [fetchAlertas])

  const resolverAlerta = useCallback(async (id: string) => {
    if (!accessToken) return
    setResolvingId(id)
    try {
      await fetch(`/api/admin/alertas/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      setAlertas((prev) => prev.filter((a) => a.id !== id))
    } finally {
      setResolvingId(null)
    }
  }, [accessToken])

  return (
    <AlertasContext.Provider value={{
      alertas,
      alertCount: alertas.length,
      resolverAlerta,
      resolvingId,
      refresh: fetchAlertas,
    }}>
      {children}
    </AlertasContext.Provider>
  )
}

export function useAlertas() {
  return useContext(AlertasContext)
}
