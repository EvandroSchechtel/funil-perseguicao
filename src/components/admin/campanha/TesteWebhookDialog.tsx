"use client"

import React, { useState } from "react"
import { FlaskConical, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type WebhookItem, type TesteResultado } from "./types"

interface TesteWebhookDialogProps {
  webhook: WebhookItem | null
  onClose: () => void
  onSuccess: () => void
}

export function TesteWebhookDialog({ webhook, onClose, onSuccess }: TesteWebhookDialogProps) {
  const [testeNome, setTesteNome] = useState("")
  const [testeTelefone, setTesteTelefone] = useState("")
  const [testeErrors, setTesteErrors] = useState<Record<string, string>>({})
  const [testeLoading, setTesteLoading] = useState(false)
  const [testeResultado, setTesteResultado] = useState<TesteResultado>(null)

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose()
      resetState()
    }
  }

  function resetState() {
    setTesteNome("")
    setTesteTelefone("")
    setTesteErrors({})
    setTesteResultado(null)
  }

  async function handleEnviarTeste() {
    if (!webhook) return
    const errs: Record<string, string> = {}
    if (!testeNome.trim()) errs.nome = "Nome é obrigatório"
    if (!testeTelefone.trim()) errs.telefone = "Telefone é obrigatório"
    if (Object.keys(errs).length > 0) { setTesteErrors(errs); return }

    setTesteLoading(true)
    setTesteResultado(null)
    try {
      const res = await fetch(`/api/webhook/${webhook.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: testeNome.trim(), telefone: testeTelefone.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTesteResultado({ ok: true, lead_id: data.lead_id })
        onSuccess()
      } else {
        setTesteResultado({ ok: false, message: data.message || "Erro ao processar." })
      }
    } catch {
      setTesteResultado({ ok: false, message: "Erro de rede." })
    } finally {
      setTesteLoading(false)
    }
  }

  return (
    <Dialog open={!!webhook} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#25D366]" />
            Testar Webhook
          </DialogTitle>
        </DialogHeader>
        {testeResultado ? (
          <div className="py-4 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              {testeResultado.ok ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-[rgba(37,211,102,0.15)] flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[#F1F1F3] font-semibold">Lead enviado com sucesso!</p>
                    <p className="text-[#5A5A72] text-xs mt-1 font-mono">Lead ID: {testeResultado.lead_id}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-[rgba(248,113,113,0.15)] flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-[#F87171]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[#F1F1F3] font-semibold">Falha no envio</p>
                    <p className="text-[#F87171] text-sm mt-1">{testeResultado.message}</p>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTesteResultado(null)} className="flex-1">Testar novamente</Button>
              <Button onClick={() => { onClose(); resetState() }} className="flex-1">Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Input label="Nome" placeholder="Ex: João Silva" value={testeNome} onChange={(e) => setTesteNome(e.target.value)} error={testeErrors.nome} required />
            <Input label="Telefone" placeholder="Ex: 11999999999" value={testeTelefone} onChange={(e) => setTesteTelefone(e.target.value)} error={testeErrors.telefone} required />
            <DialogFooter>
              <Button variant="outline" onClick={() => { onClose(); resetState() }} disabled={testeLoading}>Cancelar</Button>
              <Button onClick={handleEnviarTeste} disabled={testeLoading}>
                {testeLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : <><FlaskConical className="w-4 h-4 mr-2" />Enviar Teste</>}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
