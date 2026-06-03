# Scripts — Financial BI

> Localização: `scripts/`. Executados **manualmente** (não há CI/cron chamando-os).
> Ao adicionar/alterar script: atualize aqui **e** registre no `CHANGELOG.md`.

| Script | Roda com | O que faz |
|--------|----------|-----------|
| `import-produtos-ofertas.js` | `node scripts/import-produtos-ofertas.js` | Importa produtos/ofertas de uma planilha XLSX para `produtos`/`ofertas`. |
| `import-vendas-guru.js` | `node scripts/import-vendas-guru.js` | Importa vendas históricas (XLSX export do Manager Guru) para `vendas`. |
| `importar-lead-score-retroativo.js` | `node scripts/importar-lead-score-retroativo.js planilhas/arquivo.csv [--dry-run] [--limit N]` | Importa Lead Score **retroativo** de um CSV (form de pesquisa antigo) para `lead_score`, **preservando a data real** (coluna `data`, DD/MM/AAAA [HH:MM], BRT→UTC) em `created_at`/`updated_at`. Mapeia colunas do CSV → variáveis da scorecard (e faixas antigas de `valor_investido` → atuais, ver `PENDENCIAS.md`); dedup por email (mantém o mais recente); pontua via RPC `calcular_lead_score` (cacheada); cria contato por email quando novo. **Não sobrescreve** quem já tem score (upsert `ignoreDuplicates` em `contato_id`) — preserva os leads do webhook. `--dry-run` só relata; `--limit N` faz lote piloto. |

## Observações
- São **CommonJS** (`require`) — diferente do resto do projeto (TS/ESM). Funcionam, mas são dívida técnica.
- Leem credenciais de `.env.local` (`SUPABASE_SERVICE_KEY`). **Nunca** commitar `.env.local`.
- Por usarem a service key, **ignoram RLS** — rodar com cuidado, de preferência em base de teste primeiro.
