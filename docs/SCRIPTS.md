# Scripts — Financial BI

> Localização: `scripts/`. Executados **manualmente** (não há CI/cron chamando-os).
> Ao adicionar/alterar script: atualize aqui **e** registre no `CHANGELOG.md`.

| Script | Roda com | O que faz |
|--------|----------|-----------|
| `import-produtos-ofertas.js` | `node scripts/import-produtos-ofertas.js` | Importa produtos/ofertas de uma planilha XLSX para `produtos`/`ofertas`. |
| `import-vendas-guru.js` | `node scripts/import-vendas-guru.js` | Importa vendas históricas (XLSX export do Manager Guru) para `vendas`. |

## Observações
- São **CommonJS** (`require`) — diferente do resto do projeto (TS/ESM). Funcionam, mas são dívida técnica.
- Leem credenciais de `.env.local` (`SUPABASE_SERVICE_KEY`). **Nunca** commitar `.env.local`.
- Por usarem a service key, **ignoram RLS** — rodar com cuidado, de preferência em base de teste primeiro.
