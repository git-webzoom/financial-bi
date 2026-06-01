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
