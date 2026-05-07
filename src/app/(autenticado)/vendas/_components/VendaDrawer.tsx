'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { formatMoeda, formatData } from '@/lib/format'
import type { Venda } from './VendasClient'

const STATUS_BADGE: Record<string, string> = {
  approved:     'bg-green-100 text-green-700',
  complete:     'bg-green-100 text-green-700',
  refunded:     'bg-red-100 text-red-700',
  refunded_sol: 'bg-orange-100 text-orange-700',
  chargeback:   'bg-red-100 text-red-700',
  cancelled:    'bg-gray-100 text-gray-600',
  pending:      'bg-yellow-100 text-yellow-700',
}

const STATUS_LABEL: Record<string, string> = {
  approved:     'Aprovada',
  complete:     'Completa',
  refunded:     'Reembolsada',
  refunded_sol: 'Reembolso Sol.',
  chargeback:   'Chargeback',
  cancelled:    'Cancelada',
  pending:      'Pendente',
}

function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium text-right break-all">{valor ?? '—'}</span>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{titulo}</p>
      <div className="bg-gray-50 rounded-lg px-4 divide-y divide-gray-100">
        {children}
      </div>
    </div>
  )
}

interface Props {
  venda: Venda
  onClose: () => void
}

export default function VendaDrawer({ venda, onClose }: Props) {
  // Fechar com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Painel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200" style={{ backgroundColor: '#1E3A5F' }}>
          <div>
            <p className="text-white font-semibold">Detalhe da Venda</p>
            <p className="text-white/60 text-xs font-mono mt-0.5">{venda.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <Secao titulo="Resumo">
            <Linha label="Status" valor={
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[venda.status] ?? ''}`}>
                {STATUS_LABEL[venda.status] ?? venda.status}
              </span>
            } />
            <Linha label="Valor da Venda"    valor={formatMoeda(venda.valor_venda, venda.moeda)} />
            <Linha label="Valor Líquido"     valor={formatMoeda(venda.valor_liquido, venda.moeda)} />
            <Linha label="Valor Marketplace" valor={formatMoeda(venda.valor_marketplace, venda.moeda)} />
            <Linha label="Valor Afiliado"    valor={formatMoeda(venda.valor_afiliado, venda.moeda)} />
            <Linha label="Desconto"          valor={formatMoeda(venda.valor_desconto, venda.moeda)} />
            <Linha label="Valor Parcela"     valor={formatMoeda(venda.valor_parcela, venda.moeda)} />
            <Linha label="Parcelas"          valor={venda.parcelas ?? '—'} />
            <Linha label="Pagamento"         valor={venda.pagamento?.replace('_', ' ') ?? '—'} />
            {venda.motivo_reembolso && (
              <Linha label="Motivo Reembolso" valor={venda.motivo_reembolso} />
            )}
          </Secao>

          <Secao titulo="Datas">
            <Linha label="Pedido"     valor={formatData(venda.data_pedido)} />
            <Linha label="Aprovação"  valor={formatData(venda.data_aprovacao)} />
            <Linha label="Cancelamento" valor={formatData(venda.data_cancelamento)} />
            <Linha label="Garantia"   valor={formatData(venda.data_garantia)} />
          </Secao>

          <Secao titulo="Produto">
            <Linha label="Produto"        valor={venda.produto_id ?? '—'} />
            <Linha label="Oferta"         valor={venda.nome_oferta ?? '—'} />
            <Linha label="Marketplace"    valor={venda.marketplace} />
            <Linha label="ID Marketplace" valor={venda.marketplace_id} />
          </Secao>

          <Secao titulo="Contato">
            <Linha label="Nome"     valor={venda.nome_contato} />
            <Linha label="E-mail"   valor={venda.email_contato} />
            <Linha label="Telefone" valor={venda.telefone_contato} />
            <Linha label="CPF/Doc"  valor={venda.doc_contato} />
            <Linha label="Estado"   valor={venda.estado_contato} />
            <Linha label="País"     valor={venda.pais_contato} />
          </Secao>

          <Secao titulo="UTMs">
            <Linha label="utm_source"   valor={venda.utm_source} />
            <Linha label="utm_campaign" valor={venda.utm_campaign} />
            <Linha label="utm_medium"   valor={venda.utm_medium} />
            <Linha label="utm_content"  valor={venda.utm_content} />
          </Secao>

        </div>
      </div>
    </>
  )
}
