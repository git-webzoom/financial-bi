# CLAUDE.md — Regras do Projeto Financial BI

> **Este arquivo é lido automaticamente por qualquer IA (Claude Code) antes de cada tarefa.**
> Humanos também devem seguir estas regras. O objetivo é simples: **não quebrar mais nada.**

---

## 🛠️ Comandos comuns

- `npm install` → instala dependências **e ativa o hook de docs** (via `prepare`)
- `npm run dev` → sobe o app (Next.js) em desenvolvimento
- `npm run build` → build de produção (valida TypeScript/Next)
- `npm run lint` → ESLint
- `npm run start` → roda o build de produção

> Não há testes automatizados no projeto (ver `docs/PENDENCIAS.md`).
> Edge Functions (Deno) e migrations: ver `docs/EDGE-FUNCTIONS.md` e `docs/TABELAS.md`.

---

## ⛔ REGRA DE OURO

**A fonte da verdade é o BANCO DE DADOS REAL (Supabase), não os arquivos de migration.**

O histórico provou que migrations locais ficam desatualizadas (tabelas, crons e funções foram
criados direto no banco). **Nunca afirme que algo "não existe" sem antes consultar o banco ao vivo.**

---

## 🔁 FLUXO OBRIGATÓRIO (toda tarefa, sem exceção)

### ANTES de começar qualquer coisa:
1. Leia `docs/README.md` (índice geral).
2. Leia o(s) documento(s) da área que vai mexer:
   - Mexeu em tabela/coluna? → `docs/TABELAS.md`
   - Mexeu em função SQL/RPC? → `docs/FUNCOES-SQL.md`
   - Mexeu em Edge Function? → `docs/EDGE-FUNCTIONS.md`
   - Mexeu em cron/agendamento? → `docs/CRONS.md`
   - Mexeu em rota Next.js (`/api`)? → `docs/API-ROUTES.md`
   - Mexeu no frontend? → `docs/FRONTEND.md`
   - Mexeu em integração externa? → `docs/INTEGRACOES.md`
3. Se for mexer no banco, **confirme o estado real** com `list_tables` / `execute_sql`
   antes de planejar a mudança.

### DEPOIS de terminar E TESTAR:
4. Atualize o(s) documento(s) afetado(s) em `docs/`.
5. Adicione uma entrada em `docs/CHANGELOG.md` (formato no topo do arquivo).
6. Só então faça commit/push. **O `git push` é bloqueado se o CHANGELOG não foi atualizado.**

> "Testar" significa: rodar/validar de verdade (build, query no banco, página no navegador),
> não apenas "parece certo".

---

## 🧱 REGRAS DE EDIÇÃO (herdadas da memória do projeto — obrigatórias)

1. **Ler o arquivo inteiro antes de editar.**
2. **Contar chaves `{}` / parênteses** ao editar — não deixar bloco quebrado.
3. **Nunca** usar `eslint-disable` do `@typescript-eslint` para "resolver" erro de tipo.
4. **Não** tratar `supabase/functions/*` como Node.js — é **Deno** (imports por URL, `Deno.env`).
5. Ao mudar Props de um componente, **verificar todos os usos** desse componente.
6. **Nunca** commitar ou dar push sem o usuário pedir explicitamente.
7. **CRM e Webinário são entidades DISTINTAS** — nunca agrupar como "crm_webinario".
   CRM = semana de captação (`get_semana_atual`). Webinário = semana do evento (`get_semana_webnario_ativa`).
8. Mudanças no banco que afetam dados: preferir migration versionada em `supabase/migrations/`
   **e** aplicar no banco; manter os dois em sincronia.

---

## 🚫 O QUE NUNCA FAZER

- Não rodar `git push --no-verify` para burlar o hook de documentação.
- Não dropar/alterar tabela, função ou cron sem registrar em `docs/CHANGELOG.md` o motivo.
- Não colocar segredos (tokens, service_role key) em código versionado nem nos docs.
- Não confiar em análise de migrations sem checar o banco real.

---

## 📍 Onde está o quê (mapa rápido)

| Camada | Local | Doc |
|--------|-------|-----|
| Frontend (Next.js 14) | `src/app/` | `docs/FRONTEND.md` |
| Rotas internas API | `src/app/api/**/route.ts` | `docs/API-ROUTES.md` |
| Edge Functions (Deno) | `supabase/functions/` | `docs/EDGE-FUNCTIONS.md` |
| Migrations SQL | `supabase/migrations/` | `docs/TABELAS.md` / `docs/FUNCOES-SQL.md` |
| Crons (pg_cron) | banco: `cron.job` | `docs/CRONS.md` |
| Scripts de import | `scripts/` | `docs/SCRIPTS.md` |
| Problemas conhecidos | — | `docs/PENDENCIAS.md` |

Projeto Supabase: `zbfcrnsfygovzmncmmjz` · Repo: `git-webzoom/financial-bi` · Branch: `main`
