'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { formatMoeda, formatData } from '@/lib/format'
import type { Venda } from './VendasClient'

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  approved:     { bg: '#0F2A1A', text: '#4ADE80' },
  complete:     { bg: '#0F2A1A', text: '#4ADE80' },
  refunded:     { bg: '#2A0F0F', text: '#F87171' },
  refunded_sol: { bg: '#2A1A0F', text: '#FB923C' },
  chargeback:   { bg: '#2A0F0F', text: '#F87171' },
  cancelled:    { bg: '#1A1A1A', text: '#888888' },
  pending:      { bg: '#2A2A0F', text: '#FACC15' },
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
    <div className="flex justify-between gap-4 py-2 last:border-0" style={{ borderBottom: '1px solid #1E1E1E' }}>
      <span className="text-sm shrink-0" style={{ color: '#888888' }}>{label}</span>
      <span className="text-sm font-medium text-right break-all" style={{ color: '#FFFFFF' }}>{valor ?? '—'}</span>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#555555' }}>{titulo}</p>
      <div className="rounded-lg px-4" style={{ backgroundColor: '#0A0A0A', border: '1px solid #1E1E1E' }}>
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const badge = STATUS_BADGE[venda.status] ?? { bg: '#1A1A1A', text: '#888888' }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      />

      {/* Painel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-lg z-50 flex flex-col shadow-2xl"
        style={{ backgroundColor: '#111111', borderLeft: '1px solid #222222' }}
      >

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid #222222' }}
        >
          <div>
            <p className="font-semibold" style={{ color: '#FFFFFF' }}>Detalhe da Venda</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#555555' }}>{venda.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: '#888888' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#FFFFFF'
              ;(e.currentTarget as HTMLElement).style.backgroundColor = '#333333'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = '#888888'
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <Secao titulo="Resumo">
            <Linha label="Status" valor={
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
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
            <Linha label="Pedido"       valor={formatData(venda.data_pedido)} />
            <Linha label="Aprovação"    valor={formatData(venda.data_aprovacao)} />
            <Linha label="Cancelamento" valor={formatData(venda.data_cancelamento)} />
            <Linha label="Garantia"     valor={formatData(venda.data_garantia)} />
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
