# CHANGELOG — Financial BI

> **Registre aqui TODA mudança** antes de dar push. O `git push` é bloqueado se este arquivo
> (ou outro `.md` em `docs/`) não tiver sido atualizado junto com mudanças de código.
>
> **Formato de cada entrada** (mais recente no topo):
>
> ```
> ## [AAAA-MM-DD] Título curto da mudança — @autor
> - **O quê:** o que mudou (tabela/função/edge function/cron/frontend).
> - **Por quê:** motivo.
> - **Como testou:** o que rodou para validar (build, query, página).
> - **Impacto/risco:** o que pode ser afetado. Migração? Deploy de function? Cron alterado?
> - **Docs atualizados:** quais arquivos em docs/ foram ajustados.
> ```

---

## [2026-06-03] Importação retroativa de Lead Score (planilha CSV) — @claude
- **O quê:** novo script `scripts/importar-lead-score-retroativo.js` que importa ~10,6 mil leads
  retroativos (de jan a 02/06/2026) de `planilhas/leadscore_retroativo_020626.csv` para `lead_score`,
  **preservando a data real** de cada lead (coluna `data`). Como o Lead Score só foi ligado em
  02/06, a base só tinha os leads do webhook; este import preenche todo o histórico anterior.
- **Como funciona / decisões:**
  - **Data real:** grava `created_at`/`updated_at` com a data do CSV (DD/MM/AAAA [HH:MM], interpretada
    como **BRT→UTC**; só-data → 00:00 BRT). INSERT direto (NÃO via edge function/upsert, que gravariam
    hoje); o trigger é BEFORE UPDATE, então o `created_at` explícito é preservado.
  - **Mapeamento de colunas** CSV → variáveis da scorecard (9 batem exato; `valor_investido` do form
    ANTIGO foi mapeado por aproximação de valor — ver `PENDENCIAS.md` e `SCRIPTS.md`).
  - **Pontuação** pela RPC `calcular_lead_score` (fonte única; cacheada por combinação distinta).
  - **Dedup** por email (mantém o mais recente; só 5 emails repetidos). **Não sobrescreve** quem já
    tem score (upsert `ignoreDuplicates` em `contato_id`) — os leads reais do webhook ficam intactos.
  - Cria contato por email quando novo (com `data_primeira_captura`/`created_at` = data real); reusa
    se o email já é contato.
- **Por quê:** ter o histórico de Lead Score visível no `/crm` desde o início da captação, não só de ontem.
- **Como testou:** `--dry-run` (10.591 distintos, 0 sem email/data, 9 já com score, distribuição de
  faixa coerente) → lote piloto `--limit 50` (created_at em jan/2026 = data real; 92/A e 76/B batendo
  com o cálculo manual; integridade 0 divergências) → import completo. Verificação final no banco:
  `SUM(breakdown)==pontos_total` e `faixa==regra` sem divergências; `MIN(created_at)` em jan/2026.
- **Impacto/risco:** **aditivo** — só INSERT em `lead_score`/`contatos`. Nenhuma tabela/função/cron/
  edge function existente alterada. Roda manualmente com a service key (ignora RLS — `docs/SCRIPTS.md`).
  Reexecutável/idempotente (quem já tem score é pulado). A planilha NÃO é commitada (dado de leads).
- **Docs atualizados:** `SCRIPTS.md` (novo script), `PENDENCIAS.md` (mapeamento valor antigo→atual),
  este CHANGELOG.

## [2026-06-03] Re-score em lote do Lead Score (RPC + botão no /crm) — @claude
- **O quê:**
  - Nova função SQL **`reprocessar_lead_scores()`** (migration
    `20260603143000_reprocessar_lead_scores.sql`). Recalcula TODOS os leads de `lead_score` com os
    pontos atuais da scorecard, a partir das respostas já guardadas em `lead_score.respostas` —
    sem reenviar formulário. Sobrescreve `pontos_total/faixa/breakdown` só onde mudou e devolve
    `{total_processados, pontos_mudaram, faixas_mudaram}`. Reaproveita `calcular_lead_score()`.
  - **Frontend:** botão **"Recalcular scores"** no `/crm` (`CrmClient.tsx`, cabeçalho "Inscritos da
    Semana", ao lado do Exportar CSV). Pede `confirm()`, chama a RPC, mostra aviso inline com o
    resultado e recarrega a semana visível. Aditivo — não mexe em Props/colunas existentes.
- **Por quê:** o score é congelado no momento do envio (webhook). Se a tabela `lead_score_pontos`
  for editada, os leads antigos não recalculavam — a base misturava régua velha e nova. Pendência
  já prevista no `docs/PLANO-LEAD-SCORE.md` (seção 9, "reprocessar modelo a cada 3–4 edições").
  O botão dá a alavanca pela tela (o usuário perguntou onde isso apareceria no frontend).
- **Como testou:** no banco real (50 leads):
  - **Idempotência:** `SELECT reprocessar_lead_scores();` → `pontos_mudaram=0, faixas_mudaram=0`.
  - **Mudança reversível:** `BEGIN; UPDATE lead_score_pontos SET pontos=pontos+5 WHERE variavel='renda';
    SELECT reprocessar_lead_scores(); ROLLBACK;` → reportou `50 pontos / 9 faixas` mudaram; após
    ROLLBACK o ponto de `renda Acima de R$20.000` voltou a 25 e o re-score voltou a 0 mudanças.
  - **Integridade pós-reprocesso:** `SUM(breakdown)==pontos_total` (0 divergências) e
    `faixa==regra de corte` (0 divergências) em 50 leads.
  - **Frontend:** `npm run build` OK (26/26 páginas, types válidos; `/crm` 16.5→16.9 kB).
- **Impacto/risco:** **aditivo** — nenhuma tabela/função/cron/edge function existente foi tocada.
  Disparo pelo botão (qualquer usuário logado — `EXECUTE` da RPC liberado a `authenticated`) com
  confirmação. ⚠️ **Acoplamento:** a função replica o MAP form→variável da Edge Function
  `webhook-lead-score/index.ts` (SQL não lê o TS); se aquele MAP mudar, atualizar esta função
  junto — documentado em comentário na migration e em `FUNCOES-SQL.md`.
- **Docs atualizados:** `FUNCOES-SQL.md` (nova RPC na seção Lead Score), `FRONTEND.md` (botão no
  `/crm`), `PENDENCIAS.md` (pendência de reprocesso marcada como atendida — o gatilho agora é o botão).

## [2026-06-02] Fix: período do Webinário pela régua webn + aposenta linhas físicas — @claude
- **O quê:**
  - **`get_periodo_semana`** ganhou o parâmetro `p_entidade text DEFAULT 'captacao'`. Default mantém o
    comportamento original (lê `webinario_semanas`, régua captação) — **CRM intacto**. Com `'webn'`,
    **calcula** o período pela régua de vendas/webinário (mesma matemática de `listar_semanas_vendas`;
    `data_evento = data_inicio`). Migration `20260602000008`.
  - **Dropada a versão antiga `get_periodo_semana(integer)`** (1 arg), que ficou ambígua (erro 42725)
    após a sobrecarga. A nova `(integer, text DEFAULT 'captacao')` cobre as chamadas de 1 arg. Migration
    `20260602000009`.
  - **Frontend:** 3 chamadas do Webinário passaram a enviar `p_entidade: 'webn'` —
    `webnario/page.tsx:32`, `webnario/_components/WebnarioClient.tsx:37`,
    `dashboard/_components/WebinarioClient.tsx:141`. As 2 chamadas do CRM (`crm/page.tsx:28`,
    `crm/_components/CrmClient.tsx:71`) ficaram como estavam.
  - **`ensure_semana_webnario_existe` virou no-op** (migration `20260602000010`): o cron
    `auto_criar_proxima_semana` para de inserir linhas em `webinario_semanas_presencas` (que tinham
    datas erradas e eram a raiz do bug). A função é mantida porque o cron a chama; só não cria mais nada.
- **Por quê:** completar o fix de numeração de semanas (entrada anterior). O **número** já estava certo,
  mas o **período exibido** no seletor de Webinário/Vendas ainda vinha da régua de captação (Ter→Ter),
  mostrando intervalo deslocado. Agora mostra a régua webn correta (ex: semana 175 = 02/06 20:00 →
  09/06 19:59 BRT). E a tabela física `webinario_semanas_presencas`, que não é mais fonte de verdade,
  deixa de receber lixo do cron.
- **Como testou:** `npm run build` OK (26/26 páginas). Queries no banco real: `get_periodo_semana(175,'webn')`
  → 02/06 20:00 → 09/06 19:59 BRT; `get_periodo_semana(175)` (1 arg) → 26/05 → 02/06 (idêntico a
  `webinario_semanas`, sem regressão no CRM); ambiguidade de função resolvida. Painel de sanidade:
  captação=176, tráfego=175, vendas=175, webinário=175.
- **Impacto/risco:** **Baixo.** `get_periodo_semana` ganhou param opcional (retrocompatível); a versão de
  1 arg foi dropada mas o default a substitui. Nenhuma função SQL além do cron usa
  `ensure_semana_webnario_existe`. As linhas físicas já existentes em `webinario_semanas_presencas`
  permanecem (inofensivas); só não são mais criadas/atualizadas. Deploy do app necessário (mudança de
  frontend) — lembrar que o EasyPanel só pega a `main`.
- **Docs atualizados:** FUNCOES-SQL.md (`get_periodo_semana`, `ensure_semana_webnario_existe`,
  `ensure_semana_existe`), PENDENCIAS.md (item 1b resolvido parcialmente), CHANGELOG.md.

## [2026-06-02] Fix: numeração de semanas — Webinário e Tráfego desalinhados — @claude
- **O quê:**
  - **`get_semana_webnario_ativa()`** reescrita para **calcular** a semana (mesma fórmula de
    `listar_semanas_vendas`: `ultima_ocorrencia_brt(config 'webn')` ancorado em `webinario_semanas`,
    com **−1** proposital) em vez de ler a linha física de `webinario_semanas_presencas`. Migration
    `20260602000006_fix_get_semana_webnario_ativa_calcula.sql`.
  - **`listar_semanas_trafego()`** passou a usar **`floor()`** no cálculo do número em vez de divisão
    inteira. Migration `20260602000007_fix_listar_semanas_trafego_floor.sql`.
  - **Correção de dados:** os inscritos/presenças que caíram na semana **176** do webinário foram
    movidos para a **175** (`webinario_inscritos`: 3→175; `webinario_presencas`: 80 movidas + 9
    duplicatas apagadas por colisão com `UNIQUE(contato_id, numero_semana)`). Resultado: 681 inscritos
    e 135 presenças na 175, **0 na 176**.
  - **Limpeza:** removida a linha **176 órfã** de `webinario_semanas_presencas` (criada cedo demais) e
    restaurada `data_fim` da 175 para `data_inicio + 7 dias`.
- **Por quê:** dois bugs de numeração de semana.
  1. **Webinário:** mostrava 176 quando o webinário real era 175; leads novos caíam na 176. Causa: a
     função lia a linha física de `webinario_semanas_presencas`, criada cedo demais por
     `ensure_semana_webnario_existe` (config 'webn' terça 20:00 vs evento real terça 19:30), o que
     encurtava a 175 para ~30 min e fazia a função pular para a 176.
  2. **Tráfego:** mostrava 176 numa terça, quando a semana corrente (Qua 27/05→Ter 02/06) ainda era a
     175 (a 176 do tráfego só começa quarta 03/06). Causa: divisão inteira truncando `-6/7=0` (deveria
     ser `-1`) — régua Qua→Ter com âncora na terça gera dias_diff negativo. `floor()` corrige.
  Webinário e Vendas são a MESMA entidade `webn` e agora dão SEMPRE o mesmo número.
- **Como testou:** queries no banco real (Supabase). Painel de sanidade pós-fix:
  `get_semana_atual()=176` (captação), `listar_semanas_trafego(1)=175` (vira 176 quarta 03/06),
  `listar_semanas_vendas(1)=175`, `get_semana_webnario_ativa()=175`. Simulei a virada de quarta 03/06
  (tráfego→176, período 03–09/06) e validei `floor` vs divisão inteira para dias_diff de -8 a +14.
  Conferida a contagem de inscritos/presenças (175 vs 176) antes e depois do move.
- **Impacto/risco:** **Baixo.** Só 2 funções SQL trocadas (`CREATE OR REPLACE`), sem mudança de
  assinatura. `get_semana_webnario_ativa` é usada pela Edge Function `webhook-hotwebnar` (presenças do
  webinário ao vivo) e por `/webnario` — ambas passam a receber 175. Captação e Vendas **não** sofriam
  o bug do tráfego (régua terça = âncora). **Pendência pré-existente NÃO tocada:** `get_periodo_semana`
  ainda retorna o período pela régua de captação (`webinario_semanas`), não pela de vendas/webn — ver
  PENDENCIAS.md. `auto_criar_proxima_semana`/`ensure_semana_webnario_existe` seguem criando linhas
  físicas, mas elas não afetam mais o NÚMERO da semana ativa.
- **Docs atualizados:** FUNCOES-SQL.md (linhas `get_semana_webnario_ativa` e `listar_semanas_trafego`),
  PENDENCIAS.md (novo item sobre as linhas físicas de `webinario_semanas_presencas`), CHANGELOG.md.

## [2026-06-02] Docs: registra defasagem de exibição do Lead Score no /crm — @tiago
- **O quê:** documentado o comportamento de **timing** do Lead Score: o score é gravado na hora do envio
  do formulário (via `webhook-lead-score` → `upsert_contato` → `lead_score`, por `contato_id`), mas o lead
  só aparece na lista do /crm quando o cron do ActiveCampaign (15 min) traz a linha para `crm`. Janela de
  até ~15 min entre "score no banco" e "lead visível na tela"; quando a linha do `crm` chega, a faixa já
  aparece preenchida.
- **Por quê:** evitar que o atraso de exibição seja confundido com bug/perda de dado no futuro.
- **Como testou:** N/A — só documentação (sem mudança de código/banco).
- **Impacto/risco:** nenhum. Apenas registro de comportamento já existente e esperado.
- **Docs atualizados:** FRONTEND.md (linha do /crm), PENDENCIAS.md (item Lead Score), CHANGELOG.md.

## [2026-06-02] Feat: Lead Score WEBN (tabela de pontos) — webhook do formulário + coluna no /crm — @tiago
- **O quê (tudo aditivo):**
  - **3 tabelas novas:** `raw_lead_score` (corpo cru do webhook), `lead_score_pontos` (scorecard, 51 linhas
    seed), `lead_score` (1 linha/contato: respostas, breakdown, pontos_total, faixa A+/A/B/C/D). RLS padrão
    (SELECT `authenticated` / escrita `service_role`) + trigger `set_updated_at`.
  - **2 RPCs:** `calcular_lead_score(jsonb)` (soma a scorecard → `{pontos_total, faixa, breakdown}`) e
    `get_lead_scores(uuid[])` (leitura em lote p/ o /crm via POST — evita o bug do `.in()`).
  - **Edge Function `webhook-lead-score`** (Deno, `verify_jwt=false`, **com CORS/OPTIONS** — chamada do
    navegador): grava raw → normaliza nomes do form → `upsert_contato` → `calcular_lead_score` → upsert
    em `lead_score`.
  - **Frontend `/crm`:** nova **coluna "Lead Score"** (badge faixa+pontos) em `CrmTabela`, badge no
    cabeçalho de `CrmPainelDetalhe`, merge por `contato_id` em `CrmClient` (campos opcionais
    `lead_faixa`/`lead_pontos` em `InscritoCrm`).
  - **Formulário (landing, FORA deste repo):** adicionar envio paralelo ao webhook (fire-and-forget,
    `keepalive`); **o envio ao ActiveCampaign não muda**. Código em `PLANO-LEAD-SCORE.md` Anexo A.
- **Por quê:** priorizar remarketing pelos leads com maior propensão de compra (A+/A concentram ~33% dos
  compradores). Implementa a **tabela de pontos** (aproximação da regressão ROC-AUC 0.69; correlação ~0.56).
- **Migrations:** `20260602000002_lead_score_schema`, `..._0003_lead_score_pontos_seed`,
  `..._0004_calcular_lead_score`, `..._0005_get_lead_scores` (aplicadas no banco **e** versionadas).
- **Como testou (de verdade):** seed conferido (51 linhas, min/max por variável); RPC `calcular_lead_score`
  em 6 casos (61→C do plano, 125→A+, -33→D, resposta inexistente→0, vazio→0/D, valor -5); webhook via curl:
  **OPTIONS→200+CORS**, POST UTF-8→`167/A+`, re-envio→atualiza (1 linha, onConflict), sem-email→400+grava raw,
  JSON inválido→400; `get_lead_scores` (null sem match, shape correto com match); `npm run build` → "Compiled
  successfully"; lint dos arquivos novos sem warnings (os 3 do `CrmPainelDetalhe` são pré-existentes). Dados
  de teste limpos do banco.
- **Impacto/risco:** baixo — **nada existente foi tocado** (crm, process_venda, crons, edge functions, envio
  ao AC: intactos). Lead sem score → "—" no /crm (não quebra). Edge function deployada (v1). **Falta** a Fase 5
  no ar (publicar o `<script>` atualizado na landing) p/ os scores começarem a popular com leads reais.
- **Docs atualizados:** TABELAS.md, FUNCOES-SQL.md, EDGE-FUNCTIONS.md, INTEGRACOES.md, FRONTEND.md,
  PENDENCIAS.md, README.md (snapshot), CHANGELOG.md.

## [2026-06-02] Feat: 3º card "Semana tráfego" na aba Semanas (Configurações) — @tiago
- **O quê:** a aba **Semanas** em Configurações passou de 2 para **3 cards**. Novo card "Semana
  tráfego" (entidade `trafego`) permite configurar a régua do tráfego pela tela. A descrição do
  card de captação foi corrigida (era "CRM, Grupos e Tráfego" → agora "CRM e Grupos", pois o
  Tráfego saiu da captação na mudança anterior).
- **Por quê:** complementa o feat anterior do mesmo dia — antes a régua do tráfego ficava fixa
  no banco; agora é editável na UI como `captacao` e `webn`.
- **Mudança (só `src/app/(autenticado)/configuracoes/_components/ConfiguracoesClient.tsx`):**
  +entrada `trafego` em `ENTIDADES_SEMANA`; grid `lg:grid-cols-2` → `lg:grid-cols-3`; subtítulo
  da aba atualizado. O componente genérico `CardSemanaConfig` (upsert por `onConflict: 'entidade'`)
  não mudou — já lida com qualquer entidade. **Sem mudança de banco/SQL** (entidade `trafego` e
  RPC `listar_semanas_trafego` já existiam).
- **Nota de comportamento:** o card mostra dia + hora (igual aos outros), mas o tráfego filtra
  `date_ref` por **dia inteiro** — a hora gravada não afeta o filtro; só o dia importa. Régua
  correta = início Quarta / fim Terça.
- **Como testou:** `npm run build` → "Compiled successfully", tipos OK; `/configuracoes` compila.
  Tela (Configurações › Semanas): 3 cards, o de tráfego pré-preenchido com Quarta→Terça do banco.
- **Impacto/risco:** baixo — só UI da aba Semanas; salvar grava em `semana_config('trafego')` e
  reflete no seletor de /trafego e no funil do dashboard (via `listar_semanas_trafego`, que lê a
  config ao vivo).
- **Docs atualizados:** FRONTEND.md, CHANGELOG.md.

## [2026-06-02] Feat: Semana própria para o Tráfego (Qua→Ter) — @tiago
- **O quê:** o **Tráfego** ganhou régua de semana própria. Antes seguia a entidade `captacao`
  (Ter→Ter, junto com CRM/Grupos). Agora usa a nova entidade `trafego` em `semana_config`:
  início **Quarta (00:00)**, fim **Terça (23:59)** — dias cheios.
- **Por quê:** a Meta (Meta Ads) entrega gasto/impressões **só por data, sem hora**
  (`trafego.date_ref` é `date` puro). Como o ciclo do evento (`webn`) vira terça 20:00 e o que
  foi gasto até 19:59 de terça não conta naquela semana, o tráfego precisa contar de quarta a
  terça para ficar alinhado ao ciclo. Mantém o **mesmo número** da captação (semana atual 175),
  só a janela começa um dia depois.
- **Mudança (banco):** migration `20260602000001_semana_trafego.sql` — INSERT entidade `trafego`
  (dia_inicio=3, dia_fim=2) + nova RPC `listar_semanas_trafego` (cópia de `listar_semanas_recentes`
  lendo `semana_config('trafego')`, mesma âncora de numeração `webinario_semanas`). Aplicada no
  banco real (zbfcrnsfygovzmncmmjz).
- **Mudança (frontend):** `trafego/page.tsx` e `dashboard/_components/WebinarioClient.tsx` (3 chamadas
  RPC) trocam `listar_semanas_recentes` → `listar_semanas_trafego`. Variável `semCapt` renomeada para
  `semTrafego`. Shape de retorno idêntico (`{numero, inicio, fim}`); seletor segue filtrando `date_ref`
  por dia inteiro.
- **O que NÃO mudou:** `listar_semanas_recentes` (entidade `captacao`) e `listar_semanas_vendas`
  (`webn`) intactas; CRM, Grupos, Vendas e Webinário sem alteração; aba "Semanas" em Configurações
  segue com 2 cards; cron `ensure-proxima-semana` inalterado (numeração-âncora é a mesma).
- **Como testou:** `npm run build` → "Compiled successfully", tipos OK, 26 páginas. Banco:
  `listar_semanas_trafego(3,0)` → sem 175 = **27/05 (Qua)→02/06 (Ter)**, sem 174 = **20/05→26/05**;
  `listar_semanas_recentes`/`listar_semanas_vendas` retornam exatamente o que retornavam antes.
  Teste de navegador (seletor /trafego e aba Webinário): feito manualmente pelo usuário.
- **Impacto/risco:** baixo/isolado — `listar_semanas_recentes` era usada **só** pelo tráfego no
  frontend; CRM/Grupos usam `get_semana_atual`/`get_periodo_semana`/`grupos_kpis_semana`, não essa RPC.
- **Docs atualizados:** FUNCOES-SQL.md, TABELAS.md, FRONTEND.md, README.md (snapshot 33→34 funções),
  CHANGELOG.md.

## [2026-06-01] Fix: Dashboard Webinário conta compras distintas (Nº de Vendas) — @tiago
- **O quê:** o card **Nº DE VENDAS** da aba Webinário (`WebinarioClient`) mostrava 14 quando o correto é
  **16** (Semana 174). O **R$ VENDAS** já estava certo (R$ 9.865,80). A contagem usava
  `venda_principal_id == null` (só mães), perdendo as 2 compras cujo item WEBN é um order bump e a mãe
  ("Sala VIP Mensal") não tem `WEBN|` — mesmo bug já corrigido na aba Vendas.
- **Mudança (só `src/app/(autenticado)/dashboard/_components/WebinarioClient.tsx`):** `numVendas` passa a
  contar **compras distintas** (`Set(coalesce(venda_principal_id, id))`), igual à aba Vendas. Adicionado
  `id` ao `select` da query de vendas (necessário para a contagem por compra).
- **O que NÃO mudou:** janela/faturamento (já corretos via `inicio_ts`/`fim_ts`), tráfego, webinário, grupos.
- **Como testou:** `npx tsc --noEmit` exit 0. Banco (Semana 174, janela 20:00→19:59, filtro WEBN):
  só-mães = 14 vs compras distintas = **16** / R$ 9.865,80.
- **Impacto/risco:** baixo — só a contagem do card de vendas do Dashboard; alinha com a aba Vendas.
- **Docs atualizados:** CHANGELOG.md.

## [2026-06-01] Fix: corte de hora da semana mantido em TODOS os caminhos de busca de Vendas — @tiago
- **O quê:** o corte de hora da semana (entidade `webn`, terça 20:00→19:59) só era aplicado no clique do
  seletor de Semana. Ao clicar **Buscar**, trocar o **funil/filtro** ou **paginar**, a busca voltava a usar
  data pura (00:00→23:59), trazendo vendas da manhã do dia de corte (semana errada). Ex.: Semana 174 mostrava
  18 em vez de **16**.
- **Mudança (só `src/app/(autenticado)/vendas/_components/VendasClient.tsx`):** os estados
  `semanaInicioTs`/`semanaFimTs` (antes órfãos) passam a guardar o corte de hora da semana e são usados em
  TODOS os caminhos: o seletor de Semana os preenche; `aplicarFiltros` (Buscar) e `mudarPagina` usam
  `semanaInicioTs || dataInicio`; `handleFiltroSalvo` herda via `aplicarFiltros`; editar **DE/ATÉ** manual
  chama `limparSemana()` (zera semana → período por dia inteiro); `limparFiltros` também zera os ts.
- **O que NÃO mudou:** nenhuma SQL (`listar_semanas_vendas`/`get_kpis_vendas`/`semana_config` intactos),
  função `buscar()` (já tratava "tem T → usa hora"), contagem por compra, `aplicarRegras`, modo e-mails, Tráfego.
- **Como testou:** `npx tsc --noEmit` exit 0; `next build` compila + checa tipos OK (geração SSR crasha por
  pressão de memória do Windows, não por código); dev server roda. Banco (régua correta): Semana 174 corte
  20:00 = **16 / R$ 9.865,80** vs janela 00:00 = 18. Validação visual no navegador pendente (login do usuário).
- **Impacto/risco:** baixo — só frontend da aba Vendas; centraliza o corte de hora num único par de estados.
- **Docs atualizados:** CHANGELOG.md.

## [2026-06-01] Fix: contagem/faturamento de Vendas com filtro personalizado (order bumps + ciclo NULL) — @tiago
- **O quê:** na aba `/vendas` com filtro personalizado (ex.: "WEBN Sem Renov"), a contagem/faturamento ficava
  errada quando uma compra tinha a **mãe fora do filtro** mas **order bumps dentro** (ex.: mãe "Sala VIP Mensal"
  sem `WEBN|` + bumps `[WEBN|UPSELL]`). Essas compras sumiam. Também: filtro com operador "menor/menor igual"
  (ex.: `assinatura_ciclo <= 1`) excluía vendas de **ciclo NULL** (compra avulsa) porque no Postgres `NULL <= 1`
  é falso. Resultado da Semana 174: mostrava 13, o correto é **16 vendas / R$ 9.865,80**.
- **Mudanças (só frontend):**
  - `src/lib/filtros-personalizados.ts` — `aplicarRegras`: operadores `menor_que`/`menor_igual` passam a incluir
    NULL (`campo.lt/lte.n OR campo.is.null`). Afeta qualquer filtro com esses operadores (hoje só "WEBN Sem Renov").
  - `src/app/(autenticado)/vendas/_components/VendasClient.tsx`:
    - `calcularKpisLocais`: conta **compras distintas** (`Set(coalesce(venda_principal_id, id))`) em vez de
      `venda_principal_id == null` — bump cuja mãe não passou o filtro ainda conta a compra como 1.
    - novo `montarComprasFiltradas`: no modo filtro personalizado, agrupa as linhas filtradas por compra, busca as
      mães faltantes (para exibir 1 linha/compra) e soma valor/qtd **só das linhas que passam o filtro** (o valor da
      mãe fora do filtro, ex. R$1, NÃO entra). Paginação no client (volume baixo, padrão já usado no modo e-mails).
    - `mudarPagina`: modo filtro personalizado pagina no client (buffer), como o modo e-mails.
- **O que NÃO mudou (proteção):** `get_kpis_vendas` (RPC, usada só SEM filtro personalizado — dashboards intactos),
  caminho normal (paginação no banco), caminho por e-mails (CRM), Tráfego, numeração de semana, `semana_config`.
- **Como testou:** `npx tsc --noEmit` limpo; `npm run build` limpo. Banco (espelhando a lógica do código):
  Semana 174 + WEBN → 19 linhas → **16 compras** → faturamento **R$ 9.865,80** (exclui R$2 das 2 mães "Sala VIP
  Mensal R$1"). Sem a inclusão de NULL daria 15/R$ 9.768,80; sem agrupar por compra daria 13.
- **Impacto/risco:** baixo-médio — muda contagem/faturamento APENAS no modo filtro personalizado da aba Vendas.
  Validação visual no navegador pendente (login do usuário).
- **Docs atualizados:** FRONTEND.md, CHANGELOG.md.

## [2026-06-01] Fix: seletor de Semana em Vendas respeita o corte de hora (terça 20:00→19:59) — @tiago
- **O quê:** o seletor de **Semana** da aba `/vendas` (e o card de vendas da aba Webinário do dashboard)
  filtrava `vendas.data_pedido` por **data-calendário (00:00→23:59)**, ignorando o corte real configurado em
  `semana_config('webn')`. Agora a RPC `listar_semanas_vendas` retorna também `inicio_ts`/`fim_ts` (timestamptz)
  com a hora do corte (hoje **terça 20:00 → terça 19:59** BRT), e o frontend filtra por esses timestamps.
- **Banco (migration `20260601000001_listar_semanas_vendas_corte_hora.sql`, aplicada):** `DROP`+recria
  `listar_semanas_vendas` adicionando `inicio_ts`/`fim_ts` (lê `hora_inicio`/`hora_fim` de `semana_config('webn')`,
  interpretadas em `America/Sao_Paulo`). **A defasagem de numeração `-1` foi MANTIDA — é proposital** (Vendas/Webinário
  ficam uma semana pra trás). `listar_semanas_recentes` (Tráfego/CRM) **não mudou** — tráfego filtra `date_ref` (dia inteiro).
- **Frontend:** `vendas/page.tsx` e `VendasClient.tsx` (interface `SemanaOpcao` ganhou `inicio_ts`/`fim_ts`; o seletor
  passa os timestamps para `buscar()`, que só concatena `T00:00`/`T23:59` quando a origem é input De/Até manual).
  `WebinarioClient.tsx` usa `rangeVendas.inicio_ts`/`fim_ts` no card de vendas (com fallback p/ dia inteiro).
- **Como testou:** `npm run build` limpo (tipos OK). Banco: `listar_semanas_vendas(4)` → topo continua **174**
  (numeração intacta), Semana 174 = **26/05 20:00 → 02/06 19:59 BRT**. A venda de teste `a1e01a50` (26/05 20:41)
  agora cai **dentro** da 174. Boundary: a janela correta tem **128** vendas vs **141** na janela bugada antiga
  (13 vendas de 26/05 antes das 20:00, que são da semana 173, deixaram de ser contadas na 174).
- **Impacto/risco:** baixo-médio — só leitura/filtro; muda a contagem de vendas perto do corte (terça) na aba Vendas
  e no card de vendas do dashboard Webinário (correção desejada). Não toca Tráfego/CRM nem `semana_config`.
- **Drift conhecido:** `semana_config` no banco (`captacao`=19:30/19:29, `webn`=20:00/19:59, editados pela tela de
  Configurações) **diverge** da migration `20260521000001` (que versiona 20:00/19:59 para ambos). A fonte da verdade
  é o banco; a config não foi sobrescrita (é gerenciada pela UI). Anotado em PENDENCIAS.
- **Docs atualizados:** FUNCOES-SQL.md, FRONTEND.md, CHANGELOG.md, PENDENCIAS.md.

## [2026-05-31] Fix: aba Webinário — "NO GRUPO" usa histórico da semana — @tiago
- **O quê:** a métrica **NO GRUPO** do funil da aba Webinário (`WebinarioClient`) deixou de usar o
  `total_membros` da campanha Sendflow fixa (valor atual, igual em todas as semanas) e passou a usar
  `grupos_kpis_semana.no_grupo_agora` filtrado por `numero_semana` — o **histórico por semana**, mesma fonte
  do card "No grupo · Semana N" da página `/grupos`. Removida a constante `CAMPANHA_GRUPO_ID` (sem uso).
- **Por quê:** o usuário apontou que NO GRUPO aparecia idêntico em todas as semanas (pegava o valor ao vivo da
  campanha, não o snapshot histórico daquela semana).
- **Como testou:** `npm run build` limpo. Banco: NO GRUPO agora varia por semana — 175→388, 174→605, 173→925.
- **Impacto/risco:** baixo — só frontend, uma query trocada na aba Webinário (ainda não em produção).
- **Docs atualizados:** CHANGELOG, FRONTEND.md.

## [2026-05-31] Feat: agrupar order bumps/upsells da Manager Guru na venda principal — @tiago
- **O quê:** uma compra com order bumps/upsells deixou de contar como N vendas e passa a contar como **1**
  (faturamento = soma dos itens aprovados). Nova coluna `vendas.venda_principal_id` (uuid + índice) liga cada
  bump à transação mãe via `payload.last_transaction.id`.
- **Banco (migrations 20260531000003/4/5, aplicadas no banco):**
  - `20260531000003` — `ADD COLUMN venda_principal_id` + índice + **backfill** (151 bumps vinculados; 5 órfãos ficam NULL).
  - `20260531000004` — `process_venda` preenche `venda_principal_id` (cópia pura do id → funciona mesmo se o bump
    chega antes da mãe; idempotente via COALESCE no ON CONFLICT).
  - `20260531000005` — `get_kpis_vendas`: `totalVendas` conta só mães aprovadas; faturamento soma mãe + bumps
    aprovados (status por linha).
- **Frontend:** `/vendas` (`page.tsx`, `VendasClient`) lista **1 linha por compra** (`venda_principal_id IS NULL`),
  com badge **"+N"** na oferta e **valor total** do grupo; `VendaDrawer` ganhou seção "Itens da compra" (mãe + bumps).
  Dashboards `TpwClient`/`WebinarioClient`: `numVendas` conta só mães (`venda_principal_id == null`); receita inalterada.
- **Chave de agrupamento (validada no banco):** `last_transaction.id` (156/156 bumps têm; sem cadeias). O
  `checkout_source` foi descartado (contaminação por email/doc; reutilizado entre dias).
- **Como testou:** `npm run build` limpo. Banco: caso olivernet (mãe R$1 + 3 bumps) → 3 bumps vinculados,
  `valor_total_grupo = R$ 692,90`. Dia 31/05: Nº de vendas caiu de **19 → 13** (exatamente os 6 bumps aprovados
  do dia), faturamento **R$ 1.594,22 inalterado**.
- **Impacto/risco:** médio — muda contagem de vendas em todo o sistema. Mitigado: faturamento preservado;
  `webhook-manager-guru` (Edge) e `get_compradores_semana` **não mudaram**; MVs `mv_vendas_*` não existem no banco
  (estavam só em arquivo) → nada a recriar.
- **Docs atualizados:** TABELAS (coluna+índice), FUNCOES-SQL (process_venda/get_kpis_vendas), INTEGRACOES
  (seção Manager Guru), CHANGELOG.

## [2026-05-31] Feat: aba Webinário do dashboard (funil de 8 passos + KPIs por semana) — @tiago
- **O quê:** a aba fixa **Webinário** do dashboard deixou de ser placeholder e virou um dashboard real.
  Novo componente `src/app/(autenticado)/dashboard/_components/WebinarioClient.tsx` (Client) ligado em
  `dashboard/page.tsx` no lugar do "Conteúdo do Webinário em breve". Também: o funil do mockup
  `venda_direta` (`TpwClient`) teve o conteúdo centralizado (`text-center`/`justify-center`) e a grafia
  "Webnário" → "Webinário" foi corrigida nos textos de UI (aba do dashboard, placeholder e Configurações).
- **Layout:** mesmo estilo do mockup `venda_direta` — 6 KPI cards à esquerda (~65%) + funil à direita (~35%).
  No lugar do range De/Até, reutiliza o `SeletorSemana` (de `crm/_components`). Funil com **8 passos**:
  IMPRESSÕES, CLIQUES NO LINK, PAGE VIEW, LEADS, NO GRUPO, SHOW UP, PITCH, Nº VENDAS (cada um com % de
  conversão vs o anterior). `FUNIL_WIDTHS` estendido para 8 larguras.
- **Regra de semanas (cada entidade tem a SUA):** o seletor mostra UM número de semana, mas cada métrica
  resolve o período pela função da própria entidade — tráfego por `listar_semanas_recentes` (captação,
  filtra `trafego.date_ref`), vendas por `listar_semanas_vendas` (filtra `vendas.data_pedido`), webinário
  por coluna `numero_semana` (`webinario_inscritos`/`webinario_presencas`). **NO GRUPO** = `total_membros`
  da campanha Sendflow fixa `OEZjXU3Pish6qR8gF7fv` (ao vivo, não varia com a semana). Status de venda
  aprovado mantém a regra do mockup (`approved/complete/completed/paid/active/confirmed`).
- **Semana de referência = CAPTAÇÃO atual** (`get_semana_atual`): a aba abre na semana de captação.
  Entidades que ainda não chegaram nessa semana (webinário/vendas atrasados) ficam **zeradas**
  (range nulo / sem linhas) — comportamento desejado.
- **Filtros personalizados fixos:** tráfego é filtrado pelo filtro **"WEBN"** (`1b4386d9…`, módulo trafego)
  e vendas pelo filtro **"WEBN Sem Renov"** (`0ec3aba7…`, módulo vendas), aplicados via `aplicarRegras`
  (mesmo mecanismo das abas dinâmicas). Afeta os 6 KPIs e os passos IMPRESSÕES/CLIQUES/PAGE VIEW/Nº VENDAS;
  LEADS/NO GRUPO/SHOW UP/PITCH não usam filtro. (IDs fixos no componente, não vêm de `dashboard_abas`.)
- **Como testou:** `npm run build` limpo (TypeScript/Next OK, `/dashboard` compila). Lógica validada no
  banco real para a semana ativa 174, COM os filtros WEBN aplicados: IMPRESSÕES 263.931, CLIQUES 3.596,
  PAGE VIEW 2.562, LEADS 730, NO GRUPO 384, SHOW UP 205, PITCH 96, Nº VENDAS 15 (R$ 9.477,80) — os totais
  de tráfego/vendas caíram vs. sem filtro (eram 372.058 / 149), confirmando o filtro; tráfego usou 19–26/05
  e vendas usou 26/05–02/06 (semanas deslocadas, como esperado). Também validada a semana de captação atual
  175 (padrão da aba): IMPRESSÕES 158.519, CLIQUES 2.185, PAGE VIEW 1.498, LEADS 445, NO GRUPO 384,
  SHOW UP 0, PITCH 0, Nº VENDAS 0 — confirmando que webinário (ativo na 174) e vendas (sem semana 175)
  ficam zerados. Pendente: validação visual pelo usuário.
- **Ajuste visual dos cards:** nos dois mockups (`WebinarioClient` e `TpwClient`) o container dos KPIs ganhou
  `lg:items-start` + `auto-rows-min` para os cards não esticarem verticalmente acompanhando a altura do funil.
- **Impacto/risco:** baixo — só frontend, nenhuma mudança de banco/migration/cron. `TpwClient.tsx` teve apenas
  ajuste de layout dos cards (lógica intacta; KpiCard/Funil foram copiados, não extraídos, no novo componente).
- **Docs atualizados:** CHANGELOG, FRONTEND.md (linha do `/dashboard`).

## [2026-05-31] Fix: build do EasyPanel quebrando no script `prepare` — @tiago
- **O quê:** `package.json` → script `prepare` mudou de `git config core.hooksPath .githooks`
  para `git config core.hooksPath .githooks || true`.
- **Por quê:** o build do EasyPanel (Docker/Nixpacks) roda `npm install` num diretório SEM `.git`,
  então o `prepare` falhava com `fatal: not in a git directory` (exit 128) e **abortava o build inteiro**
  → a versão nova (abas dinâmicas + RLS) não subia, app continuava na versão antiga. O `|| true` ignora
  a falha quando não há git (container), mantendo o hook ativo no dev local (onde há git).
- **Como testou:** `npm run prepare` local (exit 0, hooks configurados) e simulação sem git
  (`git config ... || true` → exit 0). Pendente: redeploy no EasyPanel confirmar build verde.
- **Impacto/risco:** baixíssimo; só afeta o passo de configuração de hooks. Destrava o deploy em produção.
- **Docs atualizados:** CHANGELOG. Ver também PENDENCIAS (Node 18 no EasyPanel; service_role exposta no build).
- **O quê:** habilitado Row Level Security em `grupos_kpis_semana`, `sendflow_metricas`,
  `webinario_presencas`, `crm_historico_utm`, `sendflow_eventos_grupo` (migration
  `20260531000002_rls_tabelas_expostas.sql`). Policies: SELECT para `authenticated`; INSERT/UPDATE/DELETE
  para `service_role` (padrão de `crm`/`trafego`).
- **Por quê:** estavam SEM RLS → expostas à `anon` key (qualquer um com a chave pública do front lia/escrevia
  todas as linhas). Alerta `rls_disabled_in_public` (nível ERROR) no advisor de segurança do Supabase.
- **Como testou:** (1) mapeado quem lê/escreve cada tabela (front só `/grupos` e `/webnario`; escrita via
  service_role/cron-superuser, que bypassam RLS). (2) Validado no banco com `SET LOCAL ROLE authenticated`
  (lê tudo, incl. embed `contatos`) e `SET LOCAL ROLE anon` (0 linhas em todas). (3) Advisor re-rodado:
  0 erros `rls_disabled_in_public`. (4) Testado no navegador logado: `/grupos`, `/webnario`, `/dashboard`
  e `/configuracoes` mostram dados normalmente.
- **Impacto/risco:** **migração aplicada** no banco. Nenhum job/cron/trigger/webhook afetado (todos usam
  service_role ou superuser). Risco baixo e reversível (`DISABLE ROW LEVEL SECURITY`). NÃO resolve o token
  service_role em texto puro nos crons nem a rotação de chave (itens separados em PENDENCIAS).
- **Docs atualizados:** TABELAS.md (seção RLS), PENDENCIAS.md (movido p/ resolvidos), CHANGELOG.

## [2026-05-31] Abas dinâmicas do dashboard (2 tipos de mockup) — @tiago
- **O quê:** o dashboard deixou de ter abas chumbadas (`['webnario','tpw']`). Criadas as tabelas
  `dashboard_abas` (nome, tipo_mockup, ordem, ativo) e `dashboard_aba_filtros` (vínculos aba↔filtro
  por "papel": trafego/vendas/...). Nova seção **"Abas do Dashboard"** em `/configuracoes` (CRUD admin).
  O dashboard agora monta as abas a partir do banco: a aba **Webnário** segue fixa/intocada e as demais
  são clones de um **mockup** escolhido na criação. Hoje só o mockup **Venda Direta** (o antigo TPW,
  agora parametrizado por props `filtroTrafegoId`/`filtroVendasId`) está disponível; **Captação** fica
  como tipo previsto ("em breve"), sem mudança de schema futura. Novo `src/lib/dashboard-abas.ts`
  (tipos + `PAPEIS_POR_MOCKUP` + `TIPOS_MOCKUP` + `montarAbas`). Seed migra a aba TPW existente.
- **Por quê:** permitir criar vários dashboards (um por funil) sem mexer em código a cada aba,
  escolhendo o filtro de tráfego/vendas de cada aba na página de Configurações.
- **Como testou:** `npm run build` (compila + checagem de tipos OK). Migration aplicada no banco e
  conferida (tabela TPW + 2 vínculos, 8 policies, trigger updated_at). Query do dashboard simulada no
  banco retornou a aba TPW com os 2 vínculos corretos.
- **Impacto/risco:** **migração aplicada** (2 tabelas novas + seed idempotente). RLS no padrão de
  `filtros_personalizados` (SELECT autenticado; escrita só admin). FK `filtro_id` é `ON DELETE SET NULL`
  (apagar um filtro não apaga a aba — vínculo vira "sem filtro = soma tudo"). A aba TPW saiu do hardcode
  e passou a depender do seed; se a tabela for esvaziada, o dashboard mostra só o Webnário.
- **Docs atualizados:** TABELAS.md (2 tabelas + snapshot 27→29), FRONTEND.md (dashboard dinâmico +
  nova seção de config + lib), FUNCOES-SQL.md (trigger `trg_dashboard_abas_updated_at`),
  README.md (snapshot de tabelas), CHANGELOG.

## [2026-06-02] Lead Score: anexo com o código do formulário atualizado — @tiago
- **O quê:** adicionado o **Anexo A** ao `docs/PLANO-LEAD-SCORE.md` — o `<script>` completo do
  formulário já com o envio paralelo ao webhook do Financial BI (constante `WEBHOOK_BI`, função
  `avfEnviarLeadScore`, chamada em `avfEnviarFormulario`). Envio ao ActiveCampaign intacto.
- **Por quê:** deixar tudo num lugar só para a outra IA / para quem atualiza a landing.
- **Impacto/risco:** nenhum — documentação. O código do form é da landing (fora deste repo).
- **Docs atualizados:** PLANO-LEAD-SCORE (Anexo A), CHANGELOG.

## [2026-06-02] Lead Score: plano revisado para webhook DIRETO do formulário — @tiago
- **O quê:** `docs/PLANO-LEAD-SCORE.md` reescrito. Origem dos dados mudou de "webhook via
  ActiveCampaign" para "webhook direto do formulário" (landing HTML/JS própria). Agora o contrato do
  payload é definido por nós (JSON com as 14 respostas); a tabela de pontos foi conferida 1:1 contra
  os textos reais do form; adicionado tratamento de **CORS/OPTIONS** na Edge Function (é chamada do
  browser do lead) e o trecho JS a adicionar no formulário (envio paralelo, sem mexer no envio ao AC).
- **Por quê:** o form é código próprio → controlamos o payload, eliminando a "fase de captura".
- **Pontos de atenção registrados:** textos de `investe_cripto`/`tempo_tasso` diferem do modelo (usar
  os do form); **decisão pendente** dos pontos de `valor = R$ 150.000 a R$ 500.000` (proposto -5).
- **Impacto/risco:** nenhum — só documentação/planejamento.
- **Docs atualizados:** PLANO-LEAD-SCORE, CHANGELOG.

## [2026-06-02] Plano de implementação do Lead Score WEBN (versão inicial via AC) — @tiago
- **O quê:** criado `docs/PLANO-LEAD-SCORE.md` — primeira versão (origem via ActiveCampaign).
  Substituída no mesmo dia pela versão "webhook direto do formulário" (acima).
- **Impacto/risco:** nenhum — documentação.
- **Docs atualizados:** PLANO-LEAD-SCORE (novo), README (índice), CHANGELOG.

## [2026-05-31] CLAUDE.md: seção de comandos comuns — @tiago
- **O quê:** adicionada seção "Comandos comuns" no topo do `CLAUDE.md` (npm install/dev/build/lint/start).
- **Por quê:** facilitar onboarding; era a única lacuna em relação ao que o `/init` cobriria.
- **Como testou:** revisão manual; sem mudança de código de sistema.
- **Impacto/risco:** nenhum (apenas documentação).
- **Docs atualizados:** CLAUDE.md, CHANGELOG.

## [2026-05-31] Hook de lembrete de docs + limpeza de segredos — @tiago
- **O quê:** (1) Hook `Stop` em `.claude/settings.json` (`.claude/hooks/lembrete-docs.sh`)
  que lembra de atualizar docs/CHANGELOG quando há mudança em src/supabase/scripts sem docs,
  com proteção anti-loop (`stop_hook_active`). (2) Removidos tokens (anon e service_role) que
  estavam em texto puro nas regras de permissão do `.claude/settings.json`. (3) Criado
  `.env.example` como modelo de variáveis (sem valores secretos).
- **Por quê:** padronizar o registro de mudanças automaticamente e evitar vazamento de chave
  de serviço caso o `settings.json` fosse commitado.
- **Como testou:** script do hook testado nos 4 cenários (anti-loop; código sem docs → lembra;
  código com docs → silencia; sem mudanças → silencia). JSON validado com Node.
- **Impacto/risco:** nenhum no sistema. `.env.local` (credenciais reais) continua intacto e
  gitignored. Tokens removidos eram sobras de curl, não credenciais usadas pelo sistema.
- **Docs atualizados:** CHANGELOG; ver também PENDENCIAS.md (alerta de rotação de chave).

## [2026-05-31] Criação da documentação e governança do projeto — @tiago
- **O quê:** criados `CLAUDE.md` (regras de fluxo) e a pasta `docs/` completa
  (README, ARQUITETURA, TABELAS, FUNCOES-SQL, EDGE-FUNCTIONS, CRONS, API-ROUTES,
  FRONTEND, INTEGRACOES, SCRIPTS, PENDENCIAS, CHANGELOG). Adicionado git hook `pre-push`
  que exige atualização de documentação e template de Pull Request.
- **Por quê:** mais pessoas/IA vão mexer no sistema; precisamos de registro único e confiável
  para não quebrar nada.
- **Como testou:** documentação gerada a partir de consultas ao **banco real** (tabelas, funções,
  crons, índices, edge functions) — não das migrations. Hook testado com push simulado.
- **Impacto/risco:** nenhum no sistema em produção (apenas arquivos novos + hook local de git).
- **Docs atualizados:** todos (criação inicial).
