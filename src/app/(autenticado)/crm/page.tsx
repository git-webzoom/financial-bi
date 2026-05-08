import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CrmClient from './_components/CrmClient'

export default async function CrmPage({
  searchParams,
}: {
  searchParams: { semana?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Semana atual via RPC
  const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
  const semanaDefault = semanaAtual as number ?? 172

  const semana = searchParams.semana ? parseInt(searchParams.semana, 10) : semanaDefault
  const semanaValida = isNaN(semana) ? semanaDefault : semana

  // Garante que a semana existe no banco
  await supabase.rpc('ensure_semana_existe', { p_numero: semanaValida })

  // Período da semana selecionada (RPC retorna array, pegar primeiro)
  const { data: periodoRaw } = await supabase.rpc('get_periodo_semana', { p_numero: semanaValida })
  const periodo = Array.isArray(periodoRaw) ? periodoRaw[0] ?? null : periodoRaw ?? null

  // Inscritos da semana — UTMs vêm do webinario_inscritos (congeladas na captação)
  // Dados de engajamento/temperatura vêm do crm (sempre atualizados)
  const { data: inscritos } = await supabase
    .from('webinario_inscritos')
    .select(`
      id,
      numero_semana,
      data_inscricao,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      utm_id,
      crm:crm_id (
        id,
        email,
        nome,
        telefone,
        temperatura,
        estado,
        cidade,
        data_cadastro,
        emails_enviados,
        emails_abertos,
        cliques_email,
        ultima_interacao,
        data_abertura_email,
        ultimo_clique,
        ultimo_envio_email,
        limite_engajamento,
        numeros_recadastro
      ),
      contatos:contato_id (
        id
      )
    `)
    .eq('numero_semana', semanaValida)
    .order('data_inscricao', { ascending: false })

  // Emails dos inscritos para cruzar com vendas
  const emails = (inscritos ?? [])
    .map((i) => (i.crm as { email?: string })?.email)
    .filter(Boolean) as string[]

  // Compradores — emails que têm venda aprovada
  const { data: comprasRaw } = emails.length > 0
    ? await supabase
        .from('vendas')
        .select('email_contato, valor_liquido, status')
        .in('email_contato', emails)
        .in('status', ['approved', 'complete', 'completed', 'paid', 'active', 'confirmed'])
    : { data: [] }

  const compradoresSet = new Set((comprasRaw ?? []).map((v) => v.email_contato))
  const totalPorEmail: Record<string, number> = {}
  for (const v of comprasRaw ?? []) {
    totalPorEmail[v.email_contato] = (totalPorEmail[v.email_contato] ?? 0) + (v.valor_liquido ?? 0)
  }

  // Outras semanas por contato
  const contatoIds = (inscritos ?? [])
    .map((i) => (i.contatos as { id?: string })?.id)
    .filter(Boolean) as string[]

  const { data: outrasSemanasRaw } = contatoIds.length > 0
    ? await supabase
        .from('webinario_inscritos')
        .select('contato_id, numero_semana')
        .in('contato_id', contatoIds)
        .neq('numero_semana', semanaValida)
        .order('numero_semana', { ascending: false })
    : { data: [] }

  const outrasSemanasPorContato: Record<string, number[]> = {}
  for (const os of outrasSemanasRaw ?? []) {
    if (!outrasSemanasPorContato[os.contato_id]) outrasSemanasPorContato[os.contato_id] = []
    outrasSemanasPorContato[os.contato_id].push(os.numero_semana)
  }

  // Monta lista final de inscritos enriquecida
  const inscritosEnriquecidos = (inscritos ?? []).map((i) => {
    const crm = (i.crm as unknown as Record<string, unknown>) ?? {}
    const contato = (i.contatos as unknown as { id?: string }) ?? {}
    const email = crm.email as string ?? ''
    const contatoId = contato.id ?? ''
    return {
      id:             i.id as string,
      contato_id:     contatoId,
      crm_id:         crm.id as string ?? '',
      numero_semana:  i.numero_semana as number,
      data_inscricao: i.data_inscricao as string ?? null,
      email,
      nome:           crm.nome as string ?? null,
      telefone:       crm.telefone as string ?? null,
      // UTMs de captação — congeladas no webinario_inscritos
      utm_source:     i.utm_source as string ?? null,
      utm_campaign:   i.utm_campaign as string ?? null,
      utm_medium:     i.utm_medium as string ?? null,
      utm_content:    i.utm_content as string ?? null,
      utm_term:       i.utm_term as string ?? null,
      utm_id:         i.utm_id as string ?? null,
      // Dados de engajamento — sempre atualizados do crm
      temperatura:    crm.temperatura as string ?? null,
      estado:         crm.estado as string ?? null,
      cidade:         crm.cidade as string ?? null,
      data_cadastro:  crm.data_cadastro as string ?? null,
      emails_enviados:     crm.emails_enviados as number ?? null,
      emails_abertos:      crm.emails_abertos as number ?? null,
      cliques_email:       crm.cliques_email as number ?? null,
      ultima_interacao:    crm.ultima_interacao as string ?? null,
      data_abertura_email: crm.data_abertura_email as string ?? null,
      ultimo_clique:       crm.ultimo_clique as string ?? null,
      ultimo_envio_email:  crm.ultimo_envio_email as string ?? null,
      limite_engajamento:  crm.limite_engajamento as string ?? null,
      numeros_recadastro:  crm.numeros_recadastro as number ?? null,
      comprou:             compradoresSet.has(email),
      valor_compras_total: totalPorEmail[email] ?? 0,
      outras_semanas:      outrasSemanasPorContato[contatoId] ?? [],
    }
  })

  return (
    <CrmClient
      semanaAtual={semanaDefault}
      semanaInicial={semanaValida}
      periodoInicial={periodo ?? null}
      inscritosIniciais={inscritosEnriquecidos}
    />
  )
}
