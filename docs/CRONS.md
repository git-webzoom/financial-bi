# Crons (pg_cron) — Financial BI

> Fonte: `cron.job` no banco real, verificado em 2026-05-31 (**11 jobs ativos**).
> Os crons usam `pg_net` (`net.http_post`) para chamar Edge Functions, ou chamam funções SQL direto.
> Ao criar/alterar/remover cron: atualize aqui **e** registre no `CHANGELOG.md`.
> ⚠️ **Não cole o service_role token nos docs.** Ver alerta de segurança em `PENDENCIAS.md`.

| jobid | Nome | Schedule (UTC) | O que dispara |
|-------|------|----------------|---------------|
| 9 | `process-raw-trafego-batch` | `* * * * *` (1 min) | `SELECT process_raw_trafego_batch()` — processa fila de `raw_trafego`. |
| 22 | `job-meta-ads-daily` | `0 */4 * * *` (a cada 4h) | `dispatch_meta_ads_sync('daily')`. |
| 23 | `job-meta-ads-weekly` | `0 2 * * *` (02:00) | `dispatch_meta_ads_sync('weekly')`. |
| 25 | `sync-activecampaign-webn-15min` | `*/15 * * * *` | POST → `job-activecampaign-webn` (`{"semanas": null}`). |
| 26 | `sendflow-grupos` | `0 * * * *` (hora em hora) | POST → `job-sendflow-grupos`. |
| 28 | `job-manager-guru-daily` | `0 6 * * *` (06:00) | POST → `job-manager-guru`. |
| 29 | `sendflow-metricas-daily` | `*/15 * * * *` | POST → `job-sendflow-metricas` (`{"mode":"daily"}`). |
| 30 | `sendflow-metricas-lookback` | `0 3 * * *` (03:00) | POST → `job-sendflow-metricas` (`{"mode":"lookback"}`). |
| 38 | `ensure-proxima-semana` | `*/5 * * * *` | `auto_criar_proxima_semana()`. |
| 39 | `grupos-fechamento-semana` | `* * * * *` (1 min) | `grupos_fechamento_semana()`. |
| 40 | `recalcular-kpi-semana-nova` | `15 22 * * 2` (terça 22:15) | `upsert_grupos_kpis_semana(<semana do webinário ativa>)`. |

> Horários em **UTC**. Lembre: BRT = UTC-3 (ex.: cron `0 6` = 03:00 BRT; `15 22 * * 2` = 19:15 BRT de terça).

## Como inspecionar
```sql
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
-- histórico de execuções:
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

## Cuidados ao mexer
- Mudou um cron que chama Edge Function? Confirme que a function existe e o `verify_jwt` bate com o header enviado.
- Removeu uma function/feature? Desative o cron correspondente para não gerar erro silencioso a cada minuto.
- Nunca duplique um cron com o mesmo propósito — verifique a lista antes de criar.
