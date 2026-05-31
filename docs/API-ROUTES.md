# Rotas internas Next.js (`/api`) — Financial BI

> Fonte: `src/app/api/**/route.ts`, verificado em 2026-05-31 (13 rotas).
> São executadas no servidor Next.js (não confundir com Edge Functions Deno).
> Ao adicionar/alterar rota: atualize aqui **e** registre no `CHANGELOG.md`.

| Rota | Propósito |
|------|-----------|
| `POST /api/meta-ads/sync` | Dispara `job-meta-ads` (fire-and-forget). |
| `POST /api/meta-ads/token` | Salva/atualiza token Meta Ads (Vault). |
| `POST /api/activecampaign/sync` | Dispara `job-activecampaign-webn`. |
| `POST /api/activecampaign/token` | Salva/atualiza token ActiveCampaign + base_url. |
| `POST /api/manager-guru/sync` | Dispara `job-manager-guru`. |
| `POST /api/manager-guru/token` | Salva/atualiza token Manager Guru. |
| `POST /api/sendflow/sync-grupos` | Dispara `job-sendflow-grupos`. |
| `POST /api/sendflow/sync-metricas` | Dispara `job-sendflow-metricas`. |
| `POST /api/sendflow/campanha` | Configura campanha Sendflow monitorada. |
| `POST /api/sendflow/token` | Salva/atualiza token Sendflow. |
| `POST /api/reprocessar-webhook` | Reprocessa um payload `raw_*` que falhou. |
| `GET/POST /api/usuarios` | Gestão de usuários/perfis (admin). |
| `GET /api/webhooks-erro` | Lista webhooks/ingestões com erro. |

## Notas
- As rotas `/sync` apenas **disparam** a Edge Function correspondente; a lógica pesada está na function.
- As rotas `/token` escrevem no **Vault** via `upsert_vault_secret` e atualizam `integration_tokens`.
- Painel que usa essas rotas: **Configurações** (`src/app/(autenticado)/configuracoes/`).
