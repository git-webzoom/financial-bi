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
   - ⚠️ **2026-05-31:** a `service_role` também aparece em **texto puro no comando de build do EasyPanel**
     (`--build-arg 'SUPABASE_SERVICE_KEY=...'`) e nos logs de build. Reforça a urgência de **rotacionar**
     e de migrar esse valor para um secret do EasyPanel em vez de build-arg. Avaliar também se o build
     realmente precisa da service_role (o front usa a `anon`; a service_role é de runtime/Edge).

3c. **EasyPanel roda Node 18** (`v18.20.5`). O `@supabase/supabase-js@2.105.3` exige Node >= 20
   (warnings `EBADENGINE` no build) e o Node 18 está deprecado. Hoje builda/roda, mas é dívida:
   subir a imagem base para Node 20 LTS no EasyPanel (Nixpacks: `NIXPACKS_NODE_VERSION=20` ou config equivalente).

## 🟡 Dívidas técnicas (sem urgência, sem quebra)
1b. **Aposentar `webinario_semanas_presencas` — Fase 2 (limpeza final, sem urgência).**
   Em **2026-06-10** o FK de `webinario_presencas` foi repointado para `webinario_semanas` (MASTER),
   então a tabela legada **não é mais exigida por nenhum FK** (era a causa do bug 500 toda terça —
   ver CHANGELOG 2026-06-10). **Resta apenas a limpeza (fazer após validar 16/06 e idealmente 23/06):**
   - `DROP TABLE webinario_semanas_presencas` (as linhas antigas viraram inertes).
   - Remover a chamada `ensure_semana_webnario_existe(...)` de `auto_criar_proxima_semana` e dropar a
     função no-op `ensure_semana_webnario_existe`.
   - Remover o `UNION ALL ... webinario_semanas_presencas` do caminho `'captacao'` de
     `get_periodo_semana` (fallback histórico; só dispara se a semana existir **apenas** lá).
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
7. **Drift de `semana_config` (banco ≠ migration).** O banco real tem `captacao`=19:30/19:29 e
   **`webn`=19:00/18:59** (antecipado em 2026-06-10 de 20:00→19:40 via `20260610114500_semana_config_webn_1940.sql`
   e em 2026-07-07 de 19:40→19:00 via `20260707191500_semana_config_webn_1900.sql`, para acessos que chegam antes
   do ao vivo ~19:56 caírem na semana certa). A migration base `20260521000001_simplify_semana_config.sql`
   ainda versiona 20:00/19:59 para ambos; as migrations de 2026-06-10/2026-07-07 corrigem a `webn`, mas a
   `captacao`=19:30 continua só no banco (editada pela tela de Configurações). A fonte da verdade é o banco
   (config gerenciada pela UI). Hoje não quebra — só atenção em recriação do banco a partir das migrations.

8. **Lead Score: só a tabela de pontos (falta a regressão logística completa).** Hoje o `/crm`
   usa a **scorecard** (`lead_score_pontos` + `calcular_lead_score`), aproximação interpretável
   (correlação ~0.56 com o modelo). O modelo estatístico real é uma **regressão logística** (ROC-AUC 0.69)
   — implementá-la exige exportar coeficientes/intercepto do Python e portar o cálculo (sigmoid + calibração).
   Evolução futura, fora do escopo atual.
   - **Reprocessar o modelo a cada 3–4 edições do WEBN** ou quando acumular +100 compradores novos
     (o score envelhece com o comportamento da base).
     - ✅ **Re-score em lote criado (2026-06-03):** RPC `reprocessar_lead_scores()` recalcula todos
       os leads com os pontos atuais da scorecard (a partir de `lead_score.respostas`). **Gatilho:**
       botão **"Recalcular scores"** no `/crm` (ao lado do Exportar CSV) — ou `SELECT
       reprocessar_lead_scores();` no SQL. Rodar **depois de editar `lead_score_pontos`**. Ver
       `FUNCOES-SQL.md`, `FRONTEND.md` e o CHANGELOG. Sem cron/trigger automático (por decisão).
       Obs.: editar a própria tabela `lead_score_pontos` ainda é via SQL (não há tela para a scorecard).
   - **Decisão registrada (`valor` = `R$ 150.000 a R$ 500.000` → -5):** essa faixa não tinha pontuação no
     modelo original (coeficiente da regressão fortemente negativo, ~-1.23); foi definida em **-5** (mesma
     banda de "Acima de R$ 500.000"). As faixas "Até R$ 50 mil"/"Entre R$500K e R$1M"/"Mais que R$5M" do
     modelo **não existem no formulário ATUAL** — ignoradas na scorecard. Ver `PLANO-LEAD-SCORE.md` §5.
     - ⚠️ **Mas existem no formulário ANTIGO** (dados retroativos importados em 2026-06-03, ver
       `SCRIPTS.md` → `importar-lead-score-retroativo.js`). O script mapeou as faixas antigas para as
       atuais por aproximação de valor (só no import, **não** na scorecard): `Até R$ 50 mil`→`R$ 20.000 a
       R$ 50.000` (16); `Entre R$ 50 mil e R$ 150 mil`→`R$ 50.000 a R$ 150.000` (12); `Entre R$ 150 mil e
       R$ 500 mil`→`R$ 150.000 a R$ 500.000` (-5); `Entre R$ 500 mil e R$ 1 mi`/`Entre R$ 1 e R$ 5 mi`/
       `Mais que R$ 5 mi`→`Acima de R$ 500.000` (-5). Se reimportar dados antigos, reusar esse mapeamento.
   - **30,8% dos leads não respondem a pesquisa** → score cai num default perto da média (campos ausentes
     = 0 ponto). Quanto mais completo o form, mais preciso o score.
   - **Defasagem de exibição no /crm (esperado, não é bug):** o score é gravado **na hora** do envio do
     formulário (ligado ao `contato_id` via `upsert_contato`), mas o lead só aparece na lista do /crm quando
     o **cron do ActiveCampaign** (a cada 15 min) traz a linha dele para a tabela `crm`. Janela de até ~15 min
     entre "score no banco" e "lead visível na tela". Quando a linha do `crm` chega, a faixa já aparece
     preenchida. Se algum dia for preciso ver o lead na hora, a fonte seria `lead_score`/`contatos` (que já têm
     o dado imediato), não o `crm`.

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
