'use client'

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Periodo {
  data_inicio: string
  data_fim: string
  data_evento: string
}

interface Props {
  semana: number
  semanaAtual: number
  periodo: Periodo | null
  carregando: boolean
  onMudar: (s: number) => void
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function ehHoje(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const hoje = new Date()
  return d.getFullYear() === hoje.getFullYear() &&
         d.getMonth() === hoje.getMonth() &&
         d.getDate() === hoje.getDate()
}

export default function SeletorSemana({ semana, semanaAtual, periodo, carregando, onMudar }: Props) {
  const isAtual = semana === semanaAtual
  const webinarioHoje = periodo?.data_evento ? ehHoje(periodo.data_evento) : false

  const btnNav: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
    padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.875rem',
    border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent',
    cursor: carregando ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      className="rounded-xl px-4 md:px-5 py-4"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      {/* Layout: nav + centro em linha única, sem wrap */}
      <div className="flex items-center gap-2 md:gap-4">

        {/* Botão anterior */}
        <button
          style={btnNav}
          disabled={carregando}
          onClick={() => onMudar(semana - 1)}
          onMouseEnter={e => { if (!carregando) { (e.currentTarget as HTMLElement).style.color = '#FFFFFF'; (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888888'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Semana Anterior</span>
        </button>

        {/* Centro — cresce para ocupar espaço disponível */}
        <div className="flex-1 text-center min-w-0">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {carregando && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#C9A84C' }} />}
            <p className="text-base md:text-lg font-bold" style={{ color: '#FFFFFF' }}>SEMANA {semana}</p>
            {isAtual && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: '#2A1A0A', color: '#C9A84C', border: '1px solid #C9A84C44' }}
              >
                Semana Atual
              </span>
            )}
            {webinarioHoje && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: '#0F2A1A', color: '#4ADE80', border: '1px solid #4ADE8044' }}
              >
                Webinário hoje
              </span>
            )}
          </div>
          {periodo && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#555555' }}>
              {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)} BRT
              {periodo.data_evento && (
                <span className="hidden sm:inline" style={{ color: '#888888' }}>
                  {' · '}Webinário: {new Date(periodo.data_evento).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })} 20:00
                </span>
              )}
            </p>
          )}
        </div>

        {/* Botão semana atual (só aparece se não estiver na semana atual) */}
        {!isAtual && (
          <button
            style={{ ...btnNav, color: '#C9A84C', borderColor: '#C9A84C44', padding: '0.5rem 0.625rem' }}
            disabled={carregando}
            onClick={() => onMudar(semanaAtual)}
            onMouseEnter={e => { if (!carregando) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            title="Ir para semana atual"
          >
            <span className="hidden md:inline">Semana Atual</span>
            {/* Ícone compacto no mobile quando o botão "Semana Atual" está visível */}
            <span className="md:hidden text-xs font-semibold">Atual</span>
          </button>
        )}

        {/* Botão próxima */}
        <button
          style={{ ...btnNav, opacity: semana >= semanaAtual ? 0.4 : 1, cursor: semana >= semanaAtual ? 'not-allowed' : (carregando ? 'not-allowed' : 'pointer') }}
          disabled={carregando || semana >= semanaAtual}
          onClick={() => onMudar(semana + 1)}
          onMouseEnter={e => { if (!carregando && semana < semanaAtual) { (e.currentTarget as HTMLElement).style.color = '#FFFFFF'; (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888888'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Linha extra no mobile: dia do webinário (escondida acima) */}
      {periodo?.data_evento && (
        <p className="sm:hidden text-xs mt-2 text-center" style={{ color: '#888888' }}>
          Webinário: {new Date(periodo.data_evento).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })} 20:00
        </p>
      )}
    </div>
  )
}
