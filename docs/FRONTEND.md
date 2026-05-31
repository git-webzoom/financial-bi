# Frontend — Financial BI

> Next.js 14 (App Router). Rotas autenticadas em `src/app/(autenticado)/`.
> Padrão: **Server Component** (`page.tsx`) carrega dados iniciais via Supabase server →
> passa para o **Client Component** (`_components/*Client.tsx`) que faz filtros/paginação.
> Ao adicionar/alterar página ou componente compartilhado: atualize aqui **e** registre no `CHANGELOG.md`.

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
| `/dashboard` | `dashboard_abas`, `dashboard_aba_filtros`, `filtros_personalizados(_regras)`, `trafego`, `vendas` | Aba **Webnário** fixa (placeholder, à parte) + abas dinâmicas. Cada aba dinâmica é um clone de um **mockup** por `tipo_mockup`: hoje só `venda_direta` (componente `TpwClient`, 6 KPIs + funil, range De/Até). `captacao` é previsto ("em breve"). O filtro de tráfego/vendas de cada aba vem dos vínculos. |
| `/vendas` | `vendas`, `produtos`, `get_kpis_vendas`, `listar_semanas_vendas` | SSR carrega 1ª página; client pagina/filtra. |
| `/crm` | `crm`, `webinario_inscritos`, `get_semana_atual` | Semana de **captação**. |
| `/trafego` | `trafego`, `trafego_reach`, `meta_ad_accounts`, `listar_semanas_recentes` | KPI "Alcance" usa `trafego_reach` quando sem filtro de campanha/adset. Filtro por `adset_name` (sem índice — ver PENDENCIAS). |
| `/grupos` | `sendflow_grupos`, `sendflow_metricas`, `grupos_kpis_semana` | |
| `/webnario` | `webinario_inscritos`, `webinario_presencas`, `get_semana_webnario_ativa` | Semana de **webinário** (distinta do CRM). |
| `/produtos` | `produtos`, `ofertas` | |
| `/configuracoes` | `integration_tokens`, `integration_job_runs`, `meta_ad_accounts`, `filtros_personalizados`, `dashboard_abas` | Usa rotas `/api/*`. Abas: integrações, Meta Ads, ActiveCampaign, Manager Guru, Sendflow, Usuários, Filtros Personalizados, **Abas do Dashboard**, Semanas. |

## Regras de UI já existentes
- Tema escuro/gold (`#C9A84C` sobre `#111`).
- Filtros salvos por módulo: tabelas `filtros_personalizados` (+ `_regras`).
- Abas do dashboard: criadas em Configurações (`dashboard_abas` + `dashboard_aba_filtros`); um único componente-template por `tipo_mockup` (editar o template muda todas as abas daquele tipo). Sem filtro num papel = soma tudo no range.
- Ao mudar Props de um componente compartilhado, **verificar todos os usos** (regra do CLAUDE.md).
