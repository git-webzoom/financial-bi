# Edge Functions (Deno) — Financial BI

> Fonte: Supabase (9 funções ATIVAS) + `supabase/functions/`, verificado em 2026-05-31.
> ⚠️ São **Deno**, não Node.js: imports por URL, `Deno.env.get(...)`, sem `require`.
> Ao alterar/deployar uma function: atualize aqui **e** registre no `CHANGELOG.md`.

| Slug | verify_jwt | Tipo | Disparada por | O que faz |
|------|-----------|------|---------------|-----------|
| `job-meta-ads` | ✅ | Pull | `dispatch_meta_ads_sync` (cron 4h/diário) + `/api/meta-ads/sync` | Busca insights de ad/adset/campanha na Graph API v21.0 → `raw_trafego`. Também grava reach por conta em `trafego_reach`. Respeita rate limit (X-App-Usage). |
| `job-meta-ads-resync` | ✅ | Pull | manual | Re-sincroniza contas específicas (reprocessamento). |
| `job-activecampaign-webn` | ❌ | Pull | **cron a cada 15 min** + `/api/activecampaign/sync` | Busca contatos AC por tag de webinário → `crm` + `webinario_inscritos`. Preserva UTMs de venda. Paginação 100/req, 250ms entre chamadas. |
| `job-manager-guru` | ❌ | Pull | **cron diário 06:00** + `/api/manager-guru/sync` | Busca produtos e ofertas (paginação por cursor) → `produtos`, `ofertas`. |
| `job-sendflow-grupos` | ❌ | Pull | **cron de hora em hora** + `/api/sendflow/sync-grupos` | Sincroniza grupos WhatsApp da campanha `Cap-{semana_atual}` → `sendflow_grupos`. |
| `job-sendflow-metricas` | ✅ | Pull | **cron 15 min (daily) + 03:00 (lookback)** + `/api/sendflow/sync-metricas` | Métricas diárias dos grupos → `sendflow_metricas`; recalcula KPIs da semana. |
| `webhook-manager-guru` | ❌ | Webhook (in) | Manager Guru (POST) | Recebe venda → grava `raw_vendas` → dispara `process_venda`. Idempotente via `idempotency_key`. |
| `webhook-hotwebnar` | ❌ | Webhook (in) | Hotwebnar (POST) | Recebe presença ao vivo → `upsert_presenca_webn` → `webinario_presencas`. |
| `webhook-sendflow-grupos` | ❌ | Webhook (in) | Sendflow (POST) | Recebe eventos de entrada/saída de grupo → `sendflow_eventos_grupo`. |

## Notas
- **`verify_jwt`**: funções com ✅ exigem `Authorization: Bearer <service_role>` (os crons enviam).
  Funções de webhook usam ❌ porque o provedor externo não tem JWT — validam por token próprio no corpo/URL.
- Padrão de busca de token: cada function lê `integration_tokens` + Vault. **Código duplicado** entre elas
  (ver oportunidade de centralização em `PENDENCIAS.md`).
- Histórico de cada execução fica em `integration_job_runs`.

## Como ver/editar
- Código local: `supabase/functions/<slug>/index.ts`
- No banco: ferramentas MCP `list_edge_functions` / `get_edge_function` / `deploy_edge_function`
- **Sempre** que mudar o código local, faça o deploy correspondente (e vice-versa) — mantenha em sincronia.
