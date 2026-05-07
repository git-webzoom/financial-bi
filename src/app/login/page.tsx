'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro('E-mail ou senha inválidos. Verifique seus dados e tente novamente.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0A0A0A' }}
    >
      <div
        className="w-full max-w-md px-10 py-12 rounded-2xl"
        style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
      >
        {/* Logo / Título */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ backgroundColor: '#1A1A1A', border: '1px solid #C9A84C44' }}
          >
            <svg className="w-7 h-7" fill="none" stroke="#C9A84C" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">
            <span style={{ color: '#FFFFFF' }}>Financial </span>
            <span style={{ color: '#C9A84C' }}>BI</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#888888' }}>Automação de Dados</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: '#888888' }}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition"
              style={{
                backgroundColor: '#0A0A0A',
                border: '1px solid #333333',
                color: '#FFFFFF',
              }}
              placeholder="seu@email.com"
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium mb-1" style={{ color: '#888888' }}>
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition"
              style={{
                backgroundColor: '#0A0A0A',
                border: '1px solid #333333',
                color: '#FFFFFF',
              }}
              placeholder="••••••••"
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
          </div>

          {/* Mensagem de erro */}
          {erro && (
            <div
              className="flex items-start gap-2 text-sm rounded-lg px-4 py-3"
              style={{ backgroundColor: '#2A0F0F', border: '1px solid #F8717133', color: '#F87171' }}
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {erro}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-bold transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: '#C9A84C', color: '#000000' }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C' }}
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
