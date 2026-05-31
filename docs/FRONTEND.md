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
│   │   ├── dashboard/                 KPIs (abas Webnário / TPW)
│   │   ├── vendas/                    Tabela de vendas + filtros + drawer
│   │   ├── crm/                       CRM por semana (captação)
│   │   ├── trafego/                   Meta Ads (KPIs, gráfico, tabela)
│   │   ├── grupos/                    Grupos WhatsApp (Sendflow)
│   │   ├── webnario/                  Inscritos/presença do webinário
│   │   ├── produtos/                  Catálogo produtos/ofertas
│   │   ├── configuracoes/             Admin: integrações, tokens, usuários, jobs
│   │   └── _components/               Layout compartilhado (Sidebar, Header, Shell)
│   └── api/                           Rotas internas (ver API-ROUTES.md)
├── lib/
│   ├── supabase/{client,server}.ts    Clientes Supabase (browser / server)
│   ├── format.ts                      Formatação (moeda, datas)
│   └── filtros-personalizados.ts      Tipos/lógica de filtros salvos
└── middleware.ts                      Proteção de rotas (auth)
```

## Páginas e o que carregam
| Rota | Lê de | Observações |
|------|-------|-------------|
| `/dashboard` | `get_kpis_vendas` etc. | Abas Webnário / TPW. |
| `/vendas` | `vendas`, `produtos`, `get_kpis_vendas`, `listar_semanas_vendas` | SSR carrega 1ª página; client pagina/filtra. |
| `/crm` | `crm`, `webinario_inscritos`, `get_semana_atual` | Semana de **captação**. |
| `/trafego` | `trafego`, `trafego_reach`, `meta_ad_accounts`, `listar_semanas_recentes` | KPI "Alcance" usa `trafego_reach` quando sem filtro de campanha/adset. Filtro por `adset_name` (sem índice — ver PENDENCIAS). |
| `/grupos` | `sendflow_grupos`, `sendflow_metricas`, `grupos_kpis_semana` | |
| `/webnario` | `webinario_inscritos`, `webinario_presencas`, `get_semana_webnario_ativa` | Semana de **webinário** (distinta do CRM). |
| `/produtos` | `produtos`, `ofertas` | |
| `/configuracoes` | `integration_tokens`, `integration_job_runs`, `meta_ad_accounts` | Usa rotas `/api/*`. |

## Regras de UI já existentes
- Tema escuro/gold (`#C9A84C` sobre `#111`).
- Filtros salvos por módulo: tabelas `filtros_personalizados` (+ `_regras`).
- Ao mudar Props de um componente compartilhado, **verificar todos os usos** (regra do CLAUDE.md).
