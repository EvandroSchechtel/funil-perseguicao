import { Header } from "@/components/layout/Header"
import { ContaForm } from "@/components/admin/ContaForm"

export default function NovaContaPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Manychat", href: "/admin/manychat" },
          { label: "Nova Conta" },
        ]}
      />

      <div className="p-6 max-w-lg">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Conectar Conta Manychat</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Adicione uma nova conexão com seu workspace Manychat
          </p>
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
          <ContaForm mode="create" />
        </div>
      </div>
    </div>
  )
}
