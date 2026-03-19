import { Header } from "@/components/layout/Header"
import { CampanhaForm } from "@/components/admin/CampanhaForm"

export default function NovaCampanhaPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Campanhas", href: "/admin/campanhas" },
          { label: "Nova Campanha" },
        ]}
      />

      <div className="p-6 max-w-lg">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Nova Campanha</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Crie uma campanha para agrupar webhooks e acompanhar leads de um lançamento
          </p>
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
          <CampanhaForm mode="create" />
        </div>
      </div>
    </div>
  )
}
