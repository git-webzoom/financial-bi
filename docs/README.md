# 📚 Documentação — Financial BI

> **Comece sempre por aqui.** Esta é a fonte central de conhecimento do sistema.
> Antes de mexer em qualquer coisa, leia o documento da área correspondente.
> Depois de mexer, **atualize o documento e o CHANGELOG** (ver `../CLAUDE.md`).

## Regra de ouro
A **fonte da verdade é o banco real (Supabase)**, não as migrations locais. Sempre confirme no banco.

---

## Índice

| Documento | O que contém |
|-----------|--------------|
| [ARQUITETURA.md](ARQUITETURA.md) | Visão geral, stack, fluxo de dados ponta a ponta |
| [TABELAS.md](TABELAS.md) | Todas as 26 tabelas do banco, o que cada uma faz |
| [FUNCOES-SQL.md](FUNCOES-SQL.md) | Funções/RPC e triggers do Postgres |
| [EDGE-FUNCTIONS.md](EDGE-FUNCTIONS.md) | As 9 Edge Functions (Deno) |
| [CRONS.md](CRONS.md) | Os 11 agendamentos (pg_cron) ativos |
| [API-ROUTES.md](API-ROUTES.md) | Rotas internas Next.js (`/api`) |
| [FRONTEND.md](FRONTEND.md) | Páginas, módulos e componentes |
| [INTEGRACOES.md](INTEGRACOES.md) | Meta Ads, ActiveCampaign, Sendflow, Manager Guru, Hotwebnar |
| [SCRIPTS.md](SCRIPTS.md) | Scripts de importação manual |
| [PENDENCIAS.md](PENDENCIAS.md) | Problemas conhecidos, dívidas técnicas e riscos de segurança |
| [CHANGELOG.md](CHANGELOG.md) | Registro de **toda** mudança feita no sistema |

---

## Snapshot do sistema (atualizado em 2026-05-31)

- **Stack:** Next.js 14 + Supabase (Postgres + Edge Functions Deno) + Tailwind + Recharts
- **Tabelas:** 26 · **Funções SQL:** 33 · **Edge Functions:** 9 · **Crons ativos:** 11 · **Rotas API:** 13
- **Projeto Supabase:** `zbfcrnsfygovzmncmmjz`
- **Repositório:** `git-webzoom/financial-bi` (branch `main`)

> Sempre que esses números mudarem, atualize este snapshot.
