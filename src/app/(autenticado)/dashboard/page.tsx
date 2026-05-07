import { DollarSign, ShoppingCart, TrendingUp, Zap } from 'lucide-react'

const kpis = [
  {
    label: 'Faturamento Bruto',
    valor: 'R$ 0,00',
    icon: DollarSign,
    cor: '#1E3A5F',
  },
  {
    label: 'Total de Vendas',
    valor: '0',
    icon: ShoppingCart,
    cor: '#2563EB',
  },
  {
    label: 'Total Investido',
    valor: 'R$ 0,00',
    icon: TrendingUp,
    cor: '#7C3AED',
  },
  {
    label: 'ROAS',
    valor: '0,00x',
    icon: Zap,
    cor: '#059669',
  },
]

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map(({ label, valor, icon: Icon, cor }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: cor + '15' }}
              >
                <Icon className="w-5 h-5" style={{ color: cor }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{valor}</p>
          </div>
        ))}
      </div>

      {/* Mensagem de estado vazio */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-dashed flex flex-col items-center justify-center py-20 px-6 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: '#1E3A5F15' }}
        >
          <Zap className="w-7 h-7" style={{ color: '#1E3A5F' }} />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Nenhum dado disponível</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          Configure as integrações para começar a receber dados e visualizar os indicadores do seu negócio.
        </p>
      </div>

    </div>
  )
}
