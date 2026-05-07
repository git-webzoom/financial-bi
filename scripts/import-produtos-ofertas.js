// @ts-check
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Erro: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY antes de rodar.')
  process.exit(1)
}

const arquivo = process.argv[2]
if (!arquivo) {
  console.error('Uso: node scripts/import-produtos-ofertas.js <arquivo.xlsx>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function simNaoParaBoolean(valor) {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'string') return valor.trim().toLowerCase() === 'sim'
  return true
}

function paymentTypesParaArray(valor) {
  if (!valor) return []
  return String(valor).split(',').map((s) => s.trim()).filter(Boolean)
}

function excelDateParaISO(valor) {
  if (!valor) return null
  if (typeof valor === 'number') {
    const date = XLSX.SSF.parse_date_code(valor)
    if (!date) return null
    return new Date(Date.UTC(date.y, date.m - 1, date.d, date.H, date.M, date.S)).toISOString()
  }
  const d = new Date(valor)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function contador() {
  return { inseridos: 0, atualizados: 0, erros: 0 }
}

function logResultado(entidade, stats) {
  console.log(`\n── ${entidade} ──────────────────────`)
  console.log(`   Inseridos/atualizados : ${stats.inseridos}`)
  console.log(`   Erros                 : ${stats.erros}`)
}

// ─── Importar Produtos ────────────────────────────────────────────────────────

async function importarProdutos(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet)
  const stats = contador()
  const total = rows.length

  console.log(`\nIniciando importação de ${total} produto(s)...`)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    console.log(`Processando ${i + 1} de ${total} produtos... (${row['Nome'] ?? ''})`)

    const produto = {
      id:             String(row['ID'] ?? '').trim(),
      marketplace_id: String(row['Marketplace ID'] ?? '').trim(),
      marketplace:    String(row['Marketplace'] ?? '').trim(),
      nome:           String(row['Nome'] ?? '').trim(),
    }

    if (!produto.id || !produto.nome) {
      console.warn(`  ⚠ Linha ${i + 2}: ID ou Nome ausente — ignorado.`)
      stats.erros++
      continue
    }

    const { error } = await supabase
      .from('produtos')
      .upsert(produto, { onConflict: 'id' })

    if (error) {
      console.error(`  ✗ Erro ao inserir produto "${produto.nome}": ${error.message}`)
      stats.erros++
    } else {
      stats.inseridos++
    }
  }

  return stats
}

// ─── Importar Ofertas ─────────────────────────────────────────────────────────

async function importarOfertas(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet)
  const stats = contador()
  const total = rows.length

  console.log(`\nIniciando importação de ${total} oferta(s)...`)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    console.log(`Processando ${i + 1} de ${total} ofertas... (${row['Offer Name'] ?? ''})`)

    const oferta = {
      id:                String(row['Offer ID'] ?? '').trim(),
      produto_id:        String(row['Product ID'] ?? '').trim(),
      nome:              String(row['Offer Name'] ?? '').trim(),
      friendly_url:      row['Friendly URL']   ? String(row['Friendly URL']).trim()   : null,
      checkout_url:      row['Checkout URL']   ? String(row['Checkout URL']).trim()   : null,
      valor:             parseFloat(row['Value']) || 0,
      moeda:             String(row['Currency'] ?? 'BRL').trim(),
      ativa:             simNaoParaBoolean(row['Is Active']),
      pagamentos:        paymentTypesParaArray(row['Payment Types']),
      parcelas_default:  row['Installments Default']  ? parseInt(row['Installments Default'])  : null,
      max_sem_juros:     row['Max Without Interest']  ? parseInt(row['Max Without Interest'])  : null,
      mg_created_at:     excelDateParaISO(row['Created At']),
      mg_updated_at:     excelDateParaISO(row['Updated At']),
    }

    if (!oferta.id || !oferta.produto_id || !oferta.nome) {
      console.warn(`  ⚠ Linha ${i + 2}: Offer ID, Product ID ou Offer Name ausente — ignorado.`)
      stats.erros++
      continue
    }

    const { error } = await supabase
      .from('ofertas')
      .upsert(oferta, { onConflict: 'id' })

    if (error) {
      console.error(`  ✗ Erro ao inserir oferta "${oferta.nome}": ${error.message}`)
      stats.erros++
    } else {
      stats.inseridos++
    }
  }

  return stats
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const caminhoAbsoluto = path.resolve(arquivo)
  console.log(`\nLendo arquivo: ${caminhoAbsoluto}`)

  let workbook
  try {
    workbook = XLSX.readFile(caminhoAbsoluto)
  } catch (err) {
    console.error(`Erro ao ler o arquivo: ${err.message}`)
    process.exit(1)
  }

  const abas = workbook.SheetNames
  console.log(`Abas encontradas: ${abas.join(', ')}`)

  const abaProdutos = workbook.Sheets['PRODUTOS']
  const abaOfertas  = workbook.Sheets['OFERTAS']

  if (!abaProdutos) {
    console.error('Aba "PRODUTOS" não encontrada na planilha.')
    process.exit(1)
  }
  if (!abaOfertas) {
    console.error('Aba "OFERTAS" não encontrada na planilha.')
    process.exit(1)
  }

  const statsProdutos = await importarProdutos(abaProdutos)
  const statsOfertas  = await importarOfertas(abaOfertas)

  console.log('\n════════════════════════════════════')
  console.log('  RESULTADO FINAL')
  console.log('════════════════════════════════════')
  logResultado('PRODUTOS', statsProdutos)
  logResultado('OFERTAS',  statsOfertas)
  console.log('\nImportação concluída.\n')
}

main().catch((err) => {
  console.error('Erro inesperado:', err)
  process.exit(1)
})
