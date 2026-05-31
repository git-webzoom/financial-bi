<!-- Financial BI — Checklist obrigatório de PR. Ver CLAUDE.md -->

## O que muda
<!-- Descreva a mudança em 1-3 linhas -->

## Áreas afetadas
- [ ] Frontend (`src/`)
- [ ] Edge Functions (`supabase/functions/`)
- [ ] Banco: tabelas/colunas
- [ ] Banco: funções/RPC ou triggers
- [ ] Crons (pg_cron)
- [ ] Rotas API (`src/app/api`)
- [ ] Scripts
- [ ] Integrações externas

## Checklist (não fundir sem isto)
- [ ] **Li a documentação da área** antes de começar (`docs/`).
- [ ] **Confirmei o estado real no banco** antes de mexer (quando aplicável).
- [ ] **Testei** de verdade (build / query / página) — descrevi abaixo como.
- [ ] **Atualizei os docs** da(s) área(s) afetada(s).
- [ ] **Adicionei entrada no `docs/CHANGELOG.md`**.
- [ ] Não incluí segredos (tokens, service_role) em código ou docs.
- [ ] Se mexi em function/cron, mantive **código local e banco em sincronia**.

## Como testei
<!-- Comandos rodados, telas verificadas, queries -->

## Risco / rollback
<!-- O que pode quebrar e como reverter -->
