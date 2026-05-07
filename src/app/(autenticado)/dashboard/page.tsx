import { DollarSign, ShoppingCart, TrendingUp, Zap } from 'lucide-react'

const kpis = [
  { label: 'Faturamento Bruto', valor: 'R$ 0,00',  icon: DollarSign },
  { label: 'Total de Vendas',   valor: '0',         icon: ShoppingCart },
  { label: 'Total Investido',   valor: 'R$ 0,00',  icon: TrendingUp },
  { label: 'ROAS',              valor: '0,00x',     icon: Zap },
]

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map(({ label, valor, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-6"
            style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>{label}</span>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#C9A84C1A' }}
              >
                <Icon className="w-5 h-5" style={{ color: '#C9A84C' }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>{valor}</p>
          </div>
        ))}
      </div>

      {/* Mensagem de estado vazio */}
      <div
        className="rounded-xl border-dashed flex flex-col items-center justify-center py-20 px-6 text-center"
        style={{ backgroundColor: '#111111', border: '1px dashed #222222' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: '#C9A84C1A' }}
        >
          <Zap className="w-7 h-7" style={{ color: '#C9A84C' }} />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: '#FFFFFF' }}>Nenhum dado disponível</h2>
        <p className="text-sm max-w-sm" style={{ color: '#888888' }}>
          Configure as integrações para começar a receber dados e visualizar os indicadores do seu negócio.
        </p>
      </div>

    </div>
  )
}
