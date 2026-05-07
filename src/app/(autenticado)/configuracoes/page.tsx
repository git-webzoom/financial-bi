import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfiguracoesClient from './_components/ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('perfil')
    .eq('id', user.id)
    .single()

  if (profile?.perfil !== 'admin') redirect('/dashboard')

  const [
    { data: tokens },
    { data: jobs },
    { count: errosVendas },
    { count: errosWebnario },
    { count: errosGrupos },
    { data: metaAccounts },
    { data: metaToken },
  ] = await Promise.all([
    supabase
      .from('integration_tokens')
      .select('integration, ativo, last_sync_at, last_sync_status, expires_at'),
    supabase
      .from('integration_job_runs')
      .select('id, integration, account_id, status, started_at, finished_at, records_fetched, records_inserted, records_error, error_message')
      .order('started_at', { ascending: false })
      .limit(50),
    supabase.from('raw_vendas')
      .select('id', { count: 'exact', head: true })
      .eq('processed', false).not('error', 'is', null),
    supabase.from('raw_webnario')
      .select('id', { count: 'exact', head: true })
      .eq('processed', false).not('error', 'is', null),
    supabase.from('raw_grupos_wpp')
      .select('id', { count: 'exact', head: true })
      .eq('processed', false).not('error', 'is', null),
    supabase
      .from('meta_ad_accounts')
      .select('id, account_id, nome, ativo, last_sync_at, last_sync_status')
      .order('nome'),
    supabase
      .from('integration_tokens')
      .select('expires_at, ativo, last_sync_at, last_sync_status')
      .eq('integration', 'meta_ads')
      .maybeSingle(),
  ])

  const inicial = {
    tokens: tokens ?? [],
    jobs: jobs ?? [],
    webhookErros: [
      { tabela: 'raw_vendas',     count: errosVendas   ?? 0 },
      { tabela: 'raw_webnario',   count: errosWebnario ?? 0 },
      { tabela: 'raw_grupos_wpp', count: errosGrupos   ?? 0 },
    ],
    metaAccounts: metaAccounts ?? [],
    metaToken: metaToken ?? null,
  }

  return <ConfiguracoesClient inicial={inicial} />
}
