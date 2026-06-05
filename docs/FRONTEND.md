# Frontend — Financial BI

> Next.js 14 (App Router). Rotas autenticadas em `src/app/(autenticado)/`.
> Padrão: **Server Component** (`page.tsx`) carrega dados iniciais via Supabase server →
> passa para o **Client Component** (`_components/*Client.tsx`) que faz filtros/paginação.
> Ao adicionar/alterar página ou componente compartilhado: atualize aqui **e** registre no `CHANGELOG.md`.

## Responsividade mobile (padrões)
> Revisado em 2026-06-03 para o sistema parecer um app no celular. Padrões a seguir em telas novas:
- **Containers de página:** `p-4 md:p-6` (não usar `p-6` fixo).
- **KPIs:** fonte responsiva e à prova de transbordo — valor `text-lg sm:text-xl lg:text-2xl` (ou
  `text-base sm:text-lg lg:text-xl` nos cards menores), card com `min-w-0` + `truncate` no valor e no
  label, padding `p-4 sm:p-5`. Há **7 KpiCard** (um por página/mockup, não compartilhados) — manter o
  mesmo padrão em todos. Grids mobile-first (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-…`).
- **Tabelas largas:** no mobile **viram cards empilhados** e no desktop seguem tabela. Padrão: o bloco
  da tabela é `hidden md:block` e logo abaixo um bloco `md:hidden` renderiza cada linha como card
  (nome/destaque no topo + campos `label: valor` num grid de 2-3 colunas). Aplicado em
  `crm/CrmTabela.tsx`, `trafego/TrafegoTabela.tsx`, `vendas/VendasClient.tsx`. O painel/drawer de
  detalhe ao tocar na linha continua igual.
- **App feel:** `src/app/layout.tsx` define `viewport` (device-width, viewportFit=cover) +
  `themeColor #0A0A0A` (barra de status escura).

## Estrutura
```
src/
├── app/
│   ├── login/page.tsx                 Login (Supabase Auth)
│   ├── page.tsx                       Redireciona p/ dashboard ou login
│   ├── (autenticado)/                 Grupo protegido (middleware)
│   │   ├── layout.tsx                 Shell (sidebar/header)
│   │   ├── dashboard/                 KPIs (aba Webnário fixa + abas dinâmicas de dashboard_abas)
│   │   ├── vendas/                    Tabela de vendas + filtros + drawer
│   │   ├── crm/                       CRM por semana (captação)
│   │   ├── trafego/                   Meta Ads (KPIs, gráfico, tabela)
│   │   ├── grupos/                    Grupos WhatsApp (Sendflow)
│   │   ├── webnario/                  Inscritos/presença do webinário
│   │   ├── produtos/                  Catálogo produtos/ofertas
│   │   ├── configuracoes/             Admin: integrações, tokens, usuários, jobs, filtros, abas do dashboard
│   │   └── _components/               Layout compartilhado (Sidebar, Header, Shell)
│   └── api/                           Rotas internas (ver API-ROUTES.md)
├── lib/
│   ├── supabase/{client,server}.ts    Clientes Supabase (browser / server)
│   ├── format.ts                      Formatação (moeda, datas)
│   ├── filtros-personalizados.ts      Tipos/lógica de filtros salvos
│   └── dashboard-abas.ts              Tipos das abas dinâmicas (tipo_mockup, papéis, montarAbas)
└── middleware.ts                      Proteção de rotas (auth)
```

## Páginas e o que carregam
| Rota | Lê de | Observações |
|------|-------|-------------|
| `/dashboard` | `dashboard_abas`, `dashboard_aba_filtros`, `filtros_personalizados(_regras)`, `trafego`, `vendas`, `webinario_inscritos`, `webinario_presencas`, `sendflow_campanhas` | Aba **Webinário** fixa (componente `WebinarioClient`, à parte) + abas dinâmicas. **Webinário:** 7 KPIs (R$ Tráfego, R$ Vendas, Nº Vendas, Ticket Médio, CPA, **CPL** = investido÷leads, ROAS) + funil de **9 passos** (IMPRESSÕES→CLIQUES→PAGE VIEW→LEADS→NO GRUPO→SHOW UP→PITCH→CHECKOUT INICIADO→Nº VENDAS), com `SeletorSemana` no lugar do range De/Até; abre na **semana de captação atual** (`get_semana_atual`) e cada métrica resolve a semana pela função da sua entidade (tráfego=`listar_semanas_trafego` por `date_ref` dia inteiro, régua Qua→Ter, vendas=`listar_semanas_vendas` por `data_pedido` usando os timestamps `inicio_ts`/`fim_ts` com o corte real `webn`, webinário=coluna `numero_semana`); entidades atrasadas naquela semana ficam zeradas, e NO GRUPO = `grupos_kpis_semana.no_grupo_agora` da semana (histórico, mesma fonte do card "No grupo · Semana N" em /grupos). Tráfego/vendas vêm filtrados pelos filtros personalizados fixos **"WEBN"** (trafego) e **"WEBN Sem Renov"** (vendas), via `aplicarRegras`. Cada aba dinâmica é um clone de um **mockup** por `tipo_mockup`: hoje só `venda_direta` (componente `TpwClient`, **7 KPIs** — R$ Tráfego, R$ Vendas, Nº Vendas, **CPM** = investido÷impressões×1000, CPA, Ticket Médio, ROAS — + funil de 5 passos: IMPRESSÕES→CLIQUES→PAGE VIEW→CHECKOUT INICIADO→TOTAL DE VENDAS, range De/Até). `captacao` é previsto ("em breve"). O filtro de tráfego/vendas de cada aba dinâmica vem dos vínculos. Abaixo dos KPIs/funil da aba **Webinário** há o gráfico **"Qualidade dos leads captados"** (`LeadScoreGraficoSemana.tsx`): colunas verticais por nota A+→D (cores das faixas), com nº+% sobre quem preencheu, resumo "X captados · Y preencheram (Z%) · W sem resposta" e legenda com o significado de cada faixa. Dados via RPC `get_lead_score_distribuicao_semana(semana)` (cruza inscritos da semana × `lead_score` por `contato_id`); usa a mesma semana de captação do seletor da aba. **Nota dos funis:** o passo **CHECKOUT INICIADO** vem do **pixel do Facebook** (`trafego.checkouts_initiated`, atribuição do Meta) e segue o **filtro de tráfego** da aba; já o **Nº de Vendas** vem das **vendas reais do sistema** (tabela `vendas`, filtro de vendas). São fontes/metodologias diferentes — checkout (pixel) e vendas (sistema) não batem exatamente, é esperado. **Tabela de vendas** (`TabelaVendasMini.tsx`): abaixo do gráfico de Lead Score (Webinário) e abaixo dos KPIs (mockup venda_direta). Lista 1 linha por **compra** (nome, email, oferta+badge `+N` bumps, valor do grupo), 10/página, clique abre o `VendaDrawer`. Usa a **mesma busca de vendas dos KPIs** (mesmo filtro + régua + status aprovado) e agrupa via `lib/agrupar-compras.ts` (`montarComprasFiltradas`, mesma lógica da /vendas) → o nº de linhas bate com "Nº de Vendas" e a soma com "R$ Vendas". **Performance por Anúncio** (`TabelaAdsPerformance.tsx`, **só mockup venda_direta**, abaixo de tudo): análise de mídia **por anúncio** para os chefes (que não têm acesso ao gerenciador). Busca a RPC `get_trafego_ads_aba(inicio, fim, regras)` passando as **regras do filtro de tráfego da aba** (mesmo `filtroTrafegoId`) e o **range confirmado** dos KPIs (estado `rangeAplicado`, só muda no "Buscar" — não a cada tecla). Renderiza: **(1)** tabela (desktop) / cards (mobile) — colunas Anúncio (+ badge 🎬 Vídeo / 🖼️ Imagem), Gasto, CPM, **Hook**, **Hold**, **Click** (cada taxa com mini-barra colorida: verde/amarelo/vermelho por faixa; imagem mostra "—" em Hook/Hold e CTR no Click), Checkouts; ordenável por Gasto/Hook/CPM; rodapé com totais (gasto + CPM geral). **(2)** gráfico **"Top anúncios por gasto"** (barras horizontais, verde=vídeo/azul=imagem, top 10). **(3)** scatter **"Hook Rate × Gasto"** (só vídeos). ⚠️ **Venda/CPA/ROAS NÃO aparecem por anúncio** — as vendas não carregam qual anúncio gerou a compra (`utm_content` vazio em ~99%); essas métricas ficam só nos **KPIs da aba** (nível agregado). **Tipo img/vídeo** vem do **dado real** (tem `video_views_3s`/`video_watches_75`?), não do nome — um anúncio nomeado `-img-` que rodou como vídeo aparece como 🎬. |
| `/vendas` | `vendas`, `produtos`, `get_kpis_vendas`, `listar_semanas_vendas` | SSR carrega 1ª página; client pagina/filtra. O **seletor de Semana** filtra `vendas.data_pedido` pelos timestamps `inicio_ts`/`fim_ts` da RPC (corte real da entidade `webn`, hoje terça 20:00 → terça 19:59 BRT); os inputs **De/Até** manuais continuam por dia inteiro (00:00→23:59). **Modo filtro personalizado** (ex.: "WEBN Sem Renov"): conta **compras distintas** (`coalesce(venda_principal_id, id)`) — um order bump que passa o filtro mas cuja mãe não passa (mãe sem `WEBN\|`) ainda conta a compra como 1; o valor exibido/somado é só das linhas que passam o filtro (mãe fora do filtro, ex. R$1, não entra). Operadores `menor_*` em `aplicarRegras` incluem registros NULL. Modo normal (sem filtro) usa `get_kpis_vendas` e pagina no banco. |
| `/crm` | `crm`, `webinario_inscritos`, `get_semana_atual`, `lead_score` (via `get_lead_scores`) | Semana de **captação**. Coluna **Lead Score** na tabela: badge da faixa A+/A/B/C/D + pontos (A+/A verde, B amarelo, C azul, D cinza), mesclado por `contato_id`. Scores buscados em lote via `get_lead_scores(uuid[])` (RPC POST — **não** usar `.in()`). Lead sem score → "—" (não quebra). Badge também no cabeçalho do `CrmPainelDetalhe`. Campos `lead_faixa`/`lead_pontos` (opcionais) em `InscritoCrm`. **Timing:** o score é gravado **na hora** do envio do formulário (via `webhook-lead-score` → `upsert_contato` → `lead_score`, ligado ao `contato_id`), mas a **linha do lead no `crm`** só chega pelo cron do ActiveCampaign (a cada 15 min). Então há uma janela de até ~15 min em que o score existe no banco mas o lead **ainda não aparece** na lista do /crm; quando o cron traz a linha do `crm`, a faixa **já aparece preenchida** (o score esperava). Não é perda de dado — é atraso de **exibição**. **Botão "Recalcular scores"** (cabeçalho "Inscritos da Semana", ao lado do Exportar CSV): pede confirmação e chama a RPC `reprocessar_lead_scores()` (re-score em lote — recalcula todos os leads com a pontuação atual da scorecard); ao terminar mostra um aviso inline (`N reprocessados · N pontos · N faixas`) e recarrega a semana visível. Usar **após editar `lead_score_pontos`**. Disponível a qualquer usuário logado (`EXECUTE` da RPC liberado para `authenticated`). |
| `/trafego` | `trafego`, `trafego_reach`, `meta_ad_accounts`, `listar_semanas_trafego` | Seletor de Semana usa `listar_semanas_trafego` (entidade `trafego`, régua **Qua→Ter** por dia inteiro — a Meta não manda hora). Mesma numeração da captação. Filtra `trafego.date_ref` por `inicio`/`fim` (date puro, `.gte/.lte`). KPI "Alcance" usa `trafego_reach` quando sem filtro de campanha/adset. Filtro por `adset_name` (sem índice — ver PENDENCIAS). |
| `/grupos` | `sendflow_grupos`, `sendflow_metricas`, `grupos_kpis_semana` | |
| `/webnario` | `webinario_inscritos`, `webinario_presencas`, `get_semana_webnario_ativa` | Semana de **webinário** (distinta do CRM). |
| `/produtos` | `produtos`, `ofertas` | |
| `/configuracoes` | `integration_tokens`, `integration_job_runs`, `meta_ad_accounts`, `filtros_personalizados`, `dashboard_abas`, `semana_config` | Usa rotas `/api/*`. Abas: integrações, Meta Ads, ActiveCampaign, Manager Guru, Sendflow, Usuários, Filtros Personalizados, **Abas do Dashboard**, Semanas. Aba **Semanas**: 3 cards (`captacao` = CRM/Grupos, `webn` = Vendas/Webinário, `trafego` = só Tráfego, Qua→Ter), upsert direto em `semana_config` por entidade. Tráfego ignora hora (filtra `date_ref` por dia inteiro); só dia importa. |

## Regras de UI já existentes
- Tema escuro/gold (`#C9A84C` sobre `#111`).
- Filtros salvos por módulo: tabelas `filtros_personalizados` (+ `_regras`).
- Abas do dashboard: criadas em Configurações (`dashboard_abas` + `dashboard_aba_filtros`); um único componente-template por `tipo_mockup` (editar o template muda todas as abas daquele tipo). Sem filtro num papel = soma tudo no range.
- Ao mudar Props de um componente compartilhado, **verificar todos os usos** (regra do CLAUDE.md).
