# Arquitetura — Financial BI

## Stack
- **Frontend:** Next.js 14 (App Router, React 18, Server + Client Components)
- **Estilo:** Tailwind CSS · Gráficos: Recharts · Ícones: Lucide
- **Backend:** Supabase — Postgres + Edge Functions (Deno) + Auth + pg_cron + pg_net + Vault
- **Hospedagem de dados:** projeto Supabase `zbfcrnsfygovzmncmmjz`

## Como os dados entram (ingestão)

```
                       ┌─────────────── FONTES EXTERNAS ───────────────┐
                       │ Meta Ads · ActiveCampaign · Sendflow ·         │
                       │ Manager Guru · Hotwebnar                       │
                       └───────────────────┬───────────────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
        PULL (crons)                    WEBHOOK (inbound)           PULL (manual)
              │                            │                            │
   ┌──────────▼─────────┐      ┌───────────▼───────────┐     ┌──────────▼─────────┐
   │ Edge Functions     │      │ webhook-manager-guru   │     │ Rotas /api/*/sync  │
   │ job-meta-ads       │      │ webhook-hotwebnar      │     │ (disparam as edge  │
   │ job-activecampaign │      │ webhook-sendflow-grupos│     │  functions)        │
   │ job-sendflow-*     │      └───────────┬───────────┘     └──────────┬─────────┘
   │ job-manager-guru   │                  │                            │
   └──────────┬─────────┘                  │                            │
              │                            │                            │
              ▼                            ▼                            ▼
        ┌───────────────────── TABELAS raw_* (payload bruto) ──────────────────────┐
        │ raw_trafego · raw_vendas · raw_crm                                        │
        └───────────────────────────────┬──────────────────────────────────────────┘
                                         │ processamento (funções SQL / cron)
                                         ▼
        ┌──────────────────── TABELAS DE DOMÍNIO ───────────────────────────────────┐
        │ trafego · trafego_reach · vendas · contatos · crm · produtos · ofertas ·   │
        │ webinario_inscritos · webinario_presencas · sendflow_grupos · ...          │
        └───────────────────────────────┬──────────────────────────────────────────┘
                                         │
                                         ▼
                            FRONTEND (Next.js) lê via Supabase client/server
```

## Padrões importantes
- **Tabelas `raw_*`** guardam o payload bruto (idempotência + reprocessamento). São processadas
  por funções SQL (`process_venda`, `process_trafego`, `process_raw_trafego_batch`).
- **Timezone:** aplicação opera em **BRT (UTC-3)**. Há funções utilitárias `*_brt`.
- **Semanas:** dois conceitos distintos e independentes:
  - **Semana de captação (CRM):** `get_semana_atual()`
  - **Semana de webinário:** `get_semana_webnario_ativa()`
  - Podem estar em números diferentes ao mesmo tempo. **Nunca unificar.**
- **Segredos:** ficam no **Supabase Vault**; `integration_tokens.vault_key` aponta para o segredo.
  Funções `get_vault_secret` / `upsert_vault_secret` manipulam.

## Camadas e responsáveis
Veja o mapa em `../CLAUDE.md` e os documentos específicos de cada camada.
