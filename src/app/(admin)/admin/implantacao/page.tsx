import React from "react"
import Link from "next/link"
import { Rocket, Plus, CheckCircle2, ArrowRight } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Implantação | Funil Perseguição",
}

export default function ImplantacaoPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header breadcrumbs={[{ label: "Implantação" }]} />

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 py-6">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(37,211,102,0.12)] flex items-center justify-center mx-auto">
            <Rocket className="w-8 h-8 text-[#25D366]" />
          </div>
          <h1 className="text-2xl font-bold text-[#EEEEF5]">Wizard de Implantação</h1>
          <p className="text-[#8B8B9E] max-w-md mx-auto">
            Configure um novo cliente do zero em minutos — cliente, Manychat, Z-API, campanha e grupos em 5 passos guiados.
          </p>
        </div>

        {/* Steps overview */}
        <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl p-6 space-y-4">
          <p className="text-sm font-semibold text-[#C4C4D4] uppercase tracking-wider">O que será configurado</p>
          <div className="space-y-3">
            {[
              { step: 1, label: "Cliente + Conta Manychat", desc: "Cadastra o cliente e vincula a API key da Manychat com o Field ID." },
              { step: 2, label: "Instância Z-API", desc: "Configura a integração WhatsApp via Z-API (opcional — pode pular)." },
              { step: 3, label: "Campanha", desc: "Cria a campanha e gera o webhook automático." },
              { step: 4, label: "Grupos WhatsApp", desc: "Detecta grupos, seleciona a tag Manychat de entrada para cada grupo." },
              { step: 5, label: "Checklist de aprovação", desc: "Valida tudo criado e entrega os links e URLs finais." },
            ].map(({ step, label, desc }) => (
              <div key={step} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[rgba(37,211,102,0.15)] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[#25D366] text-sm font-bold">{step}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#EEEEF5]">{label}</p>
                  <p className="text-xs text-[#5A5A72] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Link href="/admin/implantacao/nova">
            <Button className="w-full h-12 text-base font-semibold">
              <Plus className="w-5 h-5 mr-2" />
              Iniciar Nova Implantação
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/clientes">
              <Button variant="outline" className="w-full">
                Ver Clientes
              </Button>
            </Link>
            <Link href="/admin/campanhas">
              <Button variant="outline" className="w-full">
                Ver Campanhas
              </Button>
            </Link>
          </div>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[rgba(37,211,102,0.05)] border border-[rgba(37,211,102,0.15)]">
          <CheckCircle2 className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
          <div className="text-sm text-[#8B8B9E]">
            <span className="text-[#EEEEF5] font-medium">Dica:</span> Ao final da implantação você receberá a URL do webhook pronta para colar no ManyChat e todos os grupos configurados estarão ativos.
          </div>
        </div>
      </main>
    </div>
  )
}
