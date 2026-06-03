// @ts-check
//
// Importação RETROATIVA de Lead Score a partir de uma planilha CSV.
//
// Por que existe: o Lead Score foi implementado em 02/06/2026; só há ~52 leads (do webhook).
// Esta planilha tem os dados de pesquisa de janeiro até 02/06/2026. Precisamos popular
// `lead_score` com esses dados PASSADOS, preservando a DATA REAL de cada lead (coluna `data`).
//
// Pontos-chave (ver docs/PLANO + CHANGELOG):
//  - NÃO usa a edge function nem upsert_contato (gravariam a data de HOJE). Faz INSERT direto
//    em `lead_score` com created_at/updated_at = data real. O trigger é BEFORE UPDATE, então
//    INSERT com created_at explícito é preservado.
//  - Pontuação vem da RPC calcular_lead_score (fonte única); cacheada por combinação de respostas.
//  - Nomes de coluna do CSV → variáveis da scorecard via MAP_COLUNA. valor_investido tem faixas
//    do FORM ANTIGO → mapeadas por aproximação em MAP_VALOR.
//  - Dedup por email (mantém a DATA MAIS RECENTE). Email que já tem score → PULA (não sobrescreve
//    os 52 do webhook): upsert com ignoreDuplicates no onConflict contato_id.
//  - Data DD/MM/AAAA [HH:MM] interpretada como BRT (UTC-3) → convertida para UTC ao gravar.
//
// Uso:
//   node scripts/importar-lead-score-retroativo.js planilhas/leadscore_retroativo_020626.csv [--dry-run] [--limit N]
//     --dry-run : só conta/relata, não grava nada
//     --limit N : processa apenas as N primeiras linhas (após dedup) — para o lote piloto

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

// ─── Config / .env.local ───────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Erro: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY em .env.local')
  process.exit(1)
}

const arquivo = process.argv[2]
if (!arquivo) {
  console.error('Uso: node scripts/importar-lead-score-retroativo.js caminho/planilha.csv [--dry-run] [--limit N]')
  process.exit(1)
}
const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : null
})()

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Mapeamentos ────────────────────────────────────────────────────────────────

// coluna do CSV → variável da scorecard (lead_score_pontos.variavel). Só estas 10 pontuam.
const MAP_COLUNA = {
  idade: 'idade',
  escolaridade: 'escolaridade',
  profissao: 'profissao',
  renda: 'renda',
  conhece: 'conhece',
  investe_cripto: 'cripto',
  valor_investido: 'valor',
  disponivel_mes: 'disponivel_mes',
  dificuldade: 'dificuldade',
  objetivo: 'objetivo',
}

// 14 respostas guardadas em lead_score.respostas (inclui as não pontuadas — igual ao webhook).
// chave = nome de campo "do form" equivalente ao que o webhook gravaria.
const COLUNAS_RESPOSTAS = {
  genero: 'genero',
  idade: 'idade',
  escolaridade: 'escolaridade',
  profissao: 'profissional',        // webhook usa "profissional"
  renda: 'renda',
  investe_cripto: 'investe_cripto',
  valor_investido: 'valor_investido',
  disponivel_mes: 'disponivel_mes',
  conhece: 'tempo_tasso',           // webhook usa "tempo_tasso"
  capital_alocado: 'capital',       // webhook usa "capital"
  objetivo: 'objetivo_cripto',      // webhook usa "objetivo_cripto"
  dificuldade: 'dificuldade_cripto',// webhook usa "dificuldade_cripto"
  sonho: 'sonho',
  diferencial: 'diferencial_tasso', // webhook usa "diferencial_tasso"
}

// valor_investido: faixas do FORM ANTIGO (CSV) → resposta da scorecard atual (aproximação por valor).
// As que já batem com a scorecard passam direto (identidade).
const MAP_VALOR = {
  'Até R$ 50 mil': 'R$ 20.000 a R$ 50.000',
  'Entre R$ 50 mil e R$ 150 mil': 'R$ 50.000 a R$ 150.000',
  'Entre R$ 150 mil e R$ 500 mil': 'R$ 150.000 a R$ 500.000',
  'Entre R$ 500 mil e R$ 1 milhão': 'Acima de R$ 500.000',
  'Entre R$ 1 milhão e R$ 5 milhões': 'Acima de R$ 500.000',
  'Mais que R$ 5 milhões': 'Acima de R$ 500.000',
  // já batem com a scorecard (identidade, não precisam de entrada, mas explícito é mais seguro):
  'R$ 1.000 a R$ 10.000': 'R$ 1.000 a R$ 10.000',
  'R$ 10.000 a R$ 20.000': 'R$ 10.000 a R$ 20.000',
  'R$ 20.000 a R$ 50.000': 'R$ 20.000 a R$ 50.000',
  'R$ 50.000 a R$ 150.000': 'R$ 50.000 a R$ 150.000',
  'Menos de R$ 1.000': 'Menos de R$ 1.000',
  'R$ 150.000 a R$ 500.000': 'R$ 150.000 a R$ 500.000',
  'Acima de R$ 500.000': 'Acima de R$ 500.000',
}

// ─── Parser de CSV (RFC-4180: aspas, vírgulas internas, \r\n) ─────────────────────
function parseCSV(texto) {
  const linhas = []
  let campo = ''
  let registro = []
  let dentroAspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } // aspas escapada ""
        else dentroAspas = false
      } else campo += c
    } else {
      if (c === '"') dentroAspas = true
      else if (c === ',') { registro.push(campo); campo = '' }
      else if (c === '\n') { registro.push(campo); linhas.push(registro); registro = []; campo = '' }
      else if (c === '\r') { /* ignora; \n trata a quebra */ }
      else campo += c
    }
  }
  // último campo/registro (arquivo sem \n final)
  if (campo.length > 0 || registro.length > 0) { registro.push(campo); linhas.push(registro) }
  return linhas
}

// ─── Data BR → ISO UTC (BRT = UTC-3) ─────────────────────────────────────────────
// "DD/MM/AAAA" ou "DD/MM/AAAA HH:MM". Só-data => 00:00 BRT.
function dataBRtoUTC(val) {
  if (!val) return null
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!m) return null
  const [, dia, mes, ano, hh, mm] = m
  // monta como UTC e soma 3h para converter BRT→UTC
  const ms = Date.UTC(+ano, +mes - 1, +dia, hh ? +hh : 0, mm ? +mm : 0, 0)
  return new Date(ms + 3 * 60 * 60 * 1000).toISOString()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────
function nz(v) { const t = (v ?? '').toString().trim(); return t === '' ? null : t }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Importação retroativa de Lead Score ===`)
  console.log(`Arquivo: ${arquivo}${DRY_RUN ? '  [DRY-RUN]' : ''}${LIMIT ? `  [limit ${LIMIT}]` : ''}\n`)

  const texto = fs.readFileSync(path.resolve(arquivo), 'utf-8')
  const linhas = parseCSV(texto)
  const header = linhas[0].map((h) => h.trim())
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  console.log(`Linhas no CSV (sem header): ${linhas.length - 1}`)

  // 1) Monta registros + dedup por email (mantém data mais recente)
  const porEmail = new Map()
  let semEmail = 0, semData = 0
  for (let r = 1; r < linhas.length; r++) {
    const row = linhas[r]
    if (!row || row.length < header.length) continue
    const email = (row[idx.email] ?? '').toLowerCase().trim()
    if (!email) { semEmail++; continue }
    const dataUTC = dataBRtoUTC(row[idx.data])
    if (!dataUTC) { semData++; continue }
    const existente = porEmail.get(email)
    if (!existente || dataUTC > existente.dataUTC) {
      porEmail.set(email, { row, idx, email, dataUTC })
    }
  }
  let registros = [...porEmail.values()].sort((a, b) => a.dataUTC.localeCompare(b.dataUTC))
  console.log(`Emails distintos (após dedup): ${registros.length}  | sem email: ${semEmail} | sem data válida: ${semData}`)
  if (LIMIT) { registros = registros.slice(0, LIMIT); console.log(`Limitado a ${registros.length} (piloto).`) }

  // 2) Quais emails já têm score? (não sobrescrever os do webhook)
  // .in() com lista grande estoura o limite de URL (lição do get_compradores_semana) → lotes pequenos.
  const emailsComScore = new Set()
  {
    const todos = registros.map((x) => x.email)
    const IN_BATCH = 200
    for (let i = 0; i < todos.length; i += IN_BATCH) {
      const lote = todos.slice(i, i + IN_BATCH)
      const { data, error } = await supabase.from('lead_score').select('email').in('email', lote)
      if (error) { console.error('Erro consultando lead_score existente:', error.message); process.exit(1) }
      for (const d of data ?? []) if (d.email) emailsComScore.add(d.email.toLowerCase())
    }
  }
  console.log(`Já possuem score (serão pulados): ${emailsComScore.size}`)

  // 3) Cache de pontuação por combinação de respostas (evita ~10 mil round-trips)
  const cacheScore = new Map()
  async function pontuar(respScore) {
    const chave = JSON.stringify(respScore)
    if (cacheScore.has(chave)) return cacheScore.get(chave)
    const { data, error } = await supabase.rpc('calcular_lead_score', { p_respostas: respScore })
    if (error) throw new Error(`calcular_lead_score: ${error.message}`)
    cacheScore.set(chave, data)
    return data
  }

  // 4) Processa: monta respostas, pontua, resolve contato, prepara linhas para insert
  const aInserir = []        // { contato_id, email, ... } prontos p/ upsert em lead_score
  const faixaPrev = {}       // contagem prevista por faixa
  let pulados = 0, novosContatos = 0, contatosReusados = 0, erros = 0

  for (const reg of registros) {
    if (emailsComScore.has(reg.email)) { pulados++; continue }
    const { row, idx: I } = reg

    // respScore (10 variáveis, com valor mapeado)
    const respScore = {}
    for (const [coluna, variavel] of Object.entries(MAP_COLUNA)) {
      let v = nz(row[I[coluna]])
      if (!v) continue
      if (variavel === 'valor') { v = MAP_VALOR[v] ?? v } // mapeia faixa antiga → atual
      respScore[variavel] = v
    }
    // respFull (14 respostas, nomes equivalentes ao webhook)
    const respFull = {}
    for (const [coluna, campoForm] of Object.entries(COLUNAS_RESPOSTAS)) {
      const v = nz(row[I[coluna]])
      if (v) respFull[campoForm] = v
    }

    let score
    try { score = await pontuar(respScore) } catch (e) { console.error(`${reg.email}: ${e.message}`); erros++; continue }
    faixaPrev[score.faixa] = (faixaPrev[score.faixa] ?? 0) + 1

    // resolve contato_id (reusa por email; cria se novo) — só fora do dry-run
    let contatoId = null
    if (!DRY_RUN) {
      const { data: existe } = await supabase.from('contatos').select('id').eq('email', reg.email).maybeSingle()
      if (existe) { contatoId = existe.id; contatosReusados++ }
      else {
        const { data: novo, error: errC } = await supabase.from('contatos').insert({
          email: reg.email,
          nome: nz(row[I.nome]),
          telefone: nz(row[I.telefone]),
          estado: nz(row[I.estado]),
          data_primeira_captura: reg.dataUTC,
          created_at: reg.dataUTC,
          updated_at: reg.dataUTC,
        }).select('id').single()
        if (errC || !novo) { console.error(`contato ${reg.email}: ${errC?.message ?? 'sem id'}`); erros++; continue }
        contatoId = novo.id; novosContatos++
      }
    } else {
      // no dry-run não resolvemos contato (seria 1 query por email — lento e desnecessário)
      continue // não acumula para insert
    }

    aInserir.push({
      contato_id: contatoId,
      email: reg.email,
      respostas: respFull,
      breakdown: score.breakdown,
      pontos_total: score.pontos_total,
      faixa: score.faixa,
      created_at: reg.dataUTC,
      updated_at: reg.dataUTC,
    })
  }

  console.log(`\n--- Resumo do processamento ---`)
  console.log(`A pontuar (não pulados): ${registros.length - pulados}`)
  console.log(`Pulados (já com score):  ${pulados}`)
  console.log(`Contatos novos:          ${novosContatos}`)
  console.log(`Contatos reusados:       ${contatosReusados}`)
  console.log(`Erros:                   ${erros}`)
  console.log(`Combinações distintas de score (cache): ${cacheScore.size}`)
  console.log(`Distribuição de faixa PREVISTA:`, faixaPrev)

  if (DRY_RUN) { console.log(`\n[DRY-RUN] Nada foi gravado.\n`); return }

  // 5) Insere em lead_score em lotes (ignoreDuplicates: não sobrescreve nada já existente)
  const BATCH = 500
  let inseridos = 0
  for (let i = 0; i < aInserir.length; i += BATCH) {
    const lote = aInserir.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('lead_score')
      .upsert(lote, { onConflict: 'contato_id', ignoreDuplicates: true, count: 'exact' })
    if (error) { console.error(`Lote ${i / BATCH}: ${error.message}`); erros++ }
    else inseridos += (count ?? lote.length)
    process.stdout.write(`\rInseridos ~${Math.min(i + BATCH, aInserir.length)}/${aInserir.length}`)
    await sleep(50)
  }
  console.log(`\n\n✅ Concluído. lead_score upsert: ${aInserir.length} linhas enviadas (erros: ${erros}).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
