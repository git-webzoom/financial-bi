# Integrações externas — Financial BI

> Credenciais ficam no **Supabase Vault**; `integration_tokens` aponta para elas. **Nunca** versionar segredos.
> Ao mudar uma integração: atualize aqui **e** registre no `CHANGELOG.md`.

| Integração | Direção | Endpoint base | Entra em | Via |
|-----------|---------|---------------|----------|-----|
| **Meta Ads** | Pull | `graph.facebook.com/v21.0` | `raw_trafego` → `trafego`, `trafego_reach` | `job-meta-ads` (cron 4h/diário) |
| **ActiveCampaign** | Pull | `{base_url}/api/3` | `crm`, `webinario_inscritos` | `job-activecampaign-webn` (cron 15 min) |
| **Manager Guru** | Pull | `digitalmanager.guru/api/v2` | `produtos`, `ofertas` | `job-manager-guru` (cron 06:00) |
| **Manager Guru** | Webhook | — | `raw_vendas` → `vendas` | `webhook-manager-guru` |
| **Sendflow** | Pull | `sendflow.pro/sendapi` | `sendflow_grupos`, `sendflow_metricas` | `job-sendflow-grupos` / `job-sendflow-metricas` |
| **Sendflow** | Webhook | — | `sendflow_eventos_grupo` | `webhook-sendflow-grupos` |
| **Hotwebnar** | Webhook | — | `webinario_presencas` | `webhook-hotwebnar` |
| **Supabase Auth** | Nativo | — | `profiles` | `handle_new_user` |

## Detalhes que quebram fácil (atenção)
- **ActiveCampaign**: depende do **padrão exato da tag** de webinário
  (ex.: `TL - VIP WEBN 07 [22 Q4] - INSCRITO - SEMANA {n}`). Se o padrão mudar no AC, o sync para
  silenciosamente. Validar ao depurar inscritos faltando.
- **Meta Ads**: respeitar rate limit (`X-App-Usage`). Token expira — checar `integration_tokens.expires_at`.
- **Sendflow grupos**: a function busca a campanha `Cap-{semana_atual}` automaticamente; se a campanha
  não existir com esse nome, nada é sincronizado.
- **CRM × Webinário**: nunca tratar como a mesma "semana". São RPCs diferentes.

## Onde configurar tokens
Painel **Configurações** → rotas `/api/<integração>/token` → Vault + `integration_tokens`.
