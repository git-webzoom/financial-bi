// @ts-check
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

// ─── Config ──────────────────────────────────────────────────────────────────

// Carrega .env.local manualmente
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
  console.error('Uso: node scripts/import-vendas-guru.js caminho/para/planilha.xlsx')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  'Aprovada':        'approved',
  'Completa':        'complete',
  'Reembolsada':     'refunded',
  'Reembolsada Sol.':'refunded_sol',
  'Reclamada':       'chargeback',
}

function parseFloat2(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(String(val).replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseInt2(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseInt(String(val), 10)
  return isNaN(n) ? null : n
}

function parseDataBR(val) {
  if (!val) return null
  const s = String(val).trim()
  // DD/MM/YYYY HH:mm:ss
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (m) {
    const [, dd, mm, yyyy, hh, min, ss] = m
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-03:00`
  }
  // Tenta ISO ou número serial do Excel
  if (!isNaN(Number(s))) {
    const d = XLSX.SSF.parse_date_code(Number(s))
    if (d) {
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.y}-${pad(d.m)}-${pad(d.d)}T${pad(d.H)}:${pad(d.M)}:${pad(d.S)}-03:00`
    }
  }
  return null
}

function str(val) {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  return s === '' ? null : s
}

function strLower(val) {
  const s = str(val)
  return s ? s.toLowerCase() : null
}

// ─── Cache de produtos (marketplace_id numérico → uuid) ──────────────────────

async function carregarProdutos() {
  const { data, error } = await supabase.from('produtos').select('id, marketplace_id')
  if (error) throw new Error('Erro ao carregar produtos: ' + error.message)
  const map = {}
  for (const p of data ?? []) {
    if (p.marketplace_id) map[String(p.marketplace_id)] = p.id
  }
  return map
}

// ─── Upsert contato ──────────────────────────────────────────────────────────

async function upsertContato(row) {
  const email = strLower(row['email contato'])
  if (!email) return null

  const telefone = str(
    (str(row['codigo telefone contato']) ?? '') +
    (str(row['telefone contato']) ?? '')
  ) || null

  const { data, error } = await supabase.rpc('upsert_contato', {
    p_email:                 email,
    p_nome:                  str(row['nome contato']),
    p_telefone:              telefone,
    p_doc:                   str(row['doc contato']),
    p_estado:                str(row['estado contato']),
    p_pais:                  str(row['país contato']),
    p_ac_contact_id:         null,
    p_primeira_captura:      str(row['primeira captura']),
    p_data_primeira_captura: parseDataBR(row['data 1ª captura']),
    p_ultima_captura:        str(row['última captura']),
    p_data_ultima_captura:   parseDataBR(row['data última captura']),
  })

  if (error) throw new Error('upsert_contato falhou: ' + error.message)
  return data
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Lendo planilha: ${arquivo}`)
  const wb = XLSX.readFile(path.resolve(arquivo))
  const ws = wb.Sheets['Vendas']
  if (!ws) {
    console.error('Aba "Vendas" não encontrada na planilha.')
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  console.log(`Total de linhas: ${rows.length}`)

  console.log('Carregando produtos...')
  const produtosMap = await carregarProdutos()

  let inseridas = 0, atualizadas = 0, erros = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if ((i + 1) % 50 === 0 || i === 0) {
      console.log(`Processando linha ${i + 1} de ${rows.length}...`)
    }

    const idTransacao = str(row['id transação'])
    if (!idTransacao) {
      console.warn(`Linha ${i + 1}: sem id de transação, pulando.`)
      erros++
      continue
    }

    try {
      // Contato
      const contatoId = await upsertContato(row)

      // Produto
      const idProdutoMarketplace = str(row['id produto'])
      let produtoId = null
      if (idProdutoMarketplace) {
        produtoId = produtosMap[idProdutoMarketplace] ?? null
        if (!produtoId) {
          console.warn(`  ⚠ Transação ${idTransacao}: produto marketplace_id="${idProdutoMarketplace}" não encontrado.`)
        }
      }

      // Telefone
      const telefone = str(
        (str(row['codigo telefone contato']) ?? '') +
        (str(row['telefone contato']) ?? '')
      ) || null

      const venda = {
        id:               idTransacao,
        contato_id:       contatoId,
        produto_id:       produtoId,
        marketplace:      str(row['nome marketplace']),
        marketplace_id:   str(row['id marketplace']),
        status:           STATUS_MAP[str(row['status'])] ?? str(row['status']),
        pagamento:        str(row['pagamento']),
        parcelas:         parseInt2(row['parcelas']),
        moeda:            str(row['moeda']),
        valor_venda:      parseFloat2(row['valor venda']),
        valor_marketplace:parseFloat2(row['valor marketplace']),
        valor_afiliado:   parseFloat2(row['valor afiliado']),
        valor_liquido:    parseFloat2(row['valor líquido']),
        valor_desconto:   parseFloat2(row['valor desconto']),
        valor_parcela:    parseFloat2(row['valor parcelas']),
        nome_contato:     str(row['nome contato']),
        doc_contato:      str(row['doc contato']),
        email_contato:    strLower(row['email contato']),
        telefone_contato: telefone,
        estado_contato:   str(row['estado contato']),
        pais_contato:     str(row['país contato']),
        motivo_reembolso: str(row['motivo reembolso']),
        data_pedido:      parseDataBR(row['data pedido']),
        data_aprovacao:   parseDataBR(row['data aprovacao']),
        data_cancelamento:parseDataBR(row['data cancelamento']),
        data_garantia:    parseDataBR(row['data garantia']),
        rppc_checkout:    str(row['rppc checkout']),
        utm_source:       str(row['utm_source']),
        utm_campaign:     str(row['utm_campaign']),
        utm_medium:       str(row['utm_medium']),
        utm_content:      str(row['utm_content']),
        nome_oferta:      str(row['nome oferta']),
        url_oferta:       str(row['url oferta']),
        assinatura_ciclo: str(row['assinatura ciclo']),
      }

      const { error, status } = await supabase
        .from('vendas')
        .upsert(venda, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })

      if (error) throw new Error(error.message)

      // status 201 = inserido, 200 = atualizado (upsert retorna 200 para ambos via PostgREST)
      // Contamos como inserida se não havia conflito — não temos como distinguir via upsert simples
      inseridas++
    } catch (err) {
      console.error(`  ✖ Transação ${idTransacao}: ${err.message}`)
      erros++
    }
  }

  console.log(`\n✅ Inseridas/Atualizadas: ${inseridas} | Erros: ${erros}`)
}

main().catch((err) => {
  console.error('Erro fatal:', err.message)
  process.exit(1)
})
