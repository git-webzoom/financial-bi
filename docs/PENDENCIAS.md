# Pendências, dívidas técnicas e riscos — Financial BI

> Lista viva de problemas conhecidos. Ao resolver um item, mova para "Resolvidos" com data e registre no `CHANGELOG.md`.
> Ao descobrir um problema novo, adicione aqui em vez de deixar só na cabeça.

## 🔴 Segurança (prioridade alta)
1. **service_role JWT em texto puro dentro dos crons** (`cron.job`, jobs 25/28/29/30).
   O token de serviço está hardcoded no `command` dos crons que chamam Edge Functions.
   - Risco: quem tiver acesso de leitura ao schema `cron` lê a chave de serviço (acesso total ao banco).
   - Mitigação sugerida: usar `vault`/`current_setting` para o header, ou um token de menor privilégio.
   - **Não** colar esse token em docs, código ou PRs.

2b. **Considerar rotação da chave `service_role`.** Ela estava em texto puro tanto nos crons
   (`cron.job`) quanto em sobras de comandos no `.claude/settings.json` (já limpo em 2026-05-31).
   Como ficou exposta localmente, o ideal é rotacionar a chave no painel do Supabase e atualizar
   os locais que a usam (`.env.local` de cada dev, headers dos crons). Decisão do responsável.

## 🟡 Dívidas técnicas (sem urgência, sem quebra)
2. **`getToken()` duplicado** nas Edge Functions (meta-ads, sendflow, activecampaign, manager-guru).
   Cada uma reimplementa a busca de token. Centralizar em `supabase/functions/_shared/` reduziria erro.
   Cuidado: assinaturas diferem (algumas precisam de `config`/`expires_at`).
3. **Índice faltando em `trafego.adset_name`**. A coluna é filtrada no frontend (`/trafego`) mas não tem índice.
   Seguro adicionar com `CREATE INDEX CONCURRENTLY`. Hoje não quebra nada, só pode ficar lento com volume.
4. **Rate limit sem backoff exponencial** em `job-activecampaign-webn` e `job-sendflow-metricas`
   (esperas fixas de 60s / pula a request). Melhorar resiliência sem risco de timeout (limite de 10 min folgado).
5. **Scripts de import em CommonJS** (`scripts/*.js`) — inconsistente com TS/ESM do resto. Migração é mecânica.
6. **Logging não-estruturado** nas Edge Functions (`console.log` texto puro). Migrar p/ JSON ajuda observabilidade
   — risco médio: conferir antes se há algum alerta no dashboard que faz parse do texto atual.

## 🟢 Resolvidos / esclarecidos
- ✅ **RLS habilitado nas 5 tabelas que estavam expostas à `anon` key** (2026-05-31):
  `grupos_kpis_semana`, `sendflow_metricas`, `webinario_presencas`, `crm_historico_utm`,
  `sendflow_eventos_grupo`. Antes, qualquer um com a chave pública lia/escrevia tudo. Agora: SELECT
  para `authenticated`, escrita só `service_role`. Validado que `/grupos` e `/webnario` continuam lendo
  e que `anon` passou a ver 0 linhas; advisor de segurança zerou os erros `rls_disabled_in_public`.
  (As 2 tabelas que um relatório dizia estarem "dropadas" — `crm_historico_utm`, `sendflow_eventos_grupo` —
  na verdade existem e recebem escrita: mais um caso de migration ≠ banco real.)
- ✅ `trafego_reach` **existe** no banco (113+ linhas) e o KPI "Alcance" funciona. (Um relatório antigo
  dizia que a tabela não existia — era erro de ter olhado só as migrations, não o banco real.)
- ✅ Existem **11 crons ativos** (pg_cron) — não é verdade que "não há agendamentos".

## Lição que originou a governança
Análises baseadas só em arquivos de migration **divergem do banco real**. Por isso `CLAUDE.md` exige
confirmar no banco antes de afirmar/alterar qualquer coisa.
