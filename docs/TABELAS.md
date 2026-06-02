# Tabelas — Financial BI

> Fonte: banco real Supabase (`public`), verificado em 2026-05-31.
> Para o detalhe de colunas use `list_tables` (verbose) ou `\d <tabela>` no banco — **o banco é a verdade.**
> Ao criar/alterar/remover tabela ou coluna: atualize esta tabela **e** registre no `CHANGELOG.md`.

## Tabelas de domínio (dados finais usados pelo frontend)

| Tabela | Col. | ~Linhas | O que é / faz |
|--------|------|---------|---------------|
| `contatos` | 14 | 6.843 | Master de pessoas. **Email é chave única** (lowercase/trim). Preenchido por `upsert_contato`. |
| `vendas` | 39 | 4.329 | Transações (approved/refunded/chargeback/...). Vem de `raw_vendas` via `process_venda`. FKs soft p/ produto/oferta/contato. **`venda_principal_id`** (uuid, índice): agrupa order bumps/upsells na venda mãe — NULL = mãe ou avulsa; preenchido por `process_venda` via `payload.last_transaction.id`. Ver INTEGRACOES (Manager Guru). |
| `produtos` | 7 | 209 | Catálogo (Manager Guru). `marketplace_id` único. |
| `ofertas` | 17 | 2.833 | Ofertas/preços por produto. `mg_offer_id` único. |
| `trafego` | 28 | 5.974 | Insights Meta Ads por ad/adset/campanha/dia. Vem de `raw_trafego`. |
| `trafego_reach` | 6 | 113 | **Reach deduplicado em nível de conta** (igual ao BM). Usado no KPI "Alcance" quando NÃO há filtro de campanha/adset. Único por `(ad_account_id, date_ref)`. |
| `crm` | 33 | 4.051 | Engajamento ActiveCampaign (tags, temperatura, e-mails, UTMs). `ac_contact_id` único. |
| `crm_historico_utm` | 10 | 309 | Histórico de mudanças de UTM no CRM (preenchido pelo trigger `trg_crm_historico_utm`). |
| `webinario_inscritos` | 14 | 4.559 | Inscritos no webinário por semana (AC). Único por `(contato_id, numero_semana)`. |
| `webinario_presencas` | 7 | 640 | Presença AO VIVO (webhook Hotwebnar). Único por `(contato_id, numero_semana)`. |
| `sendflow_grupos` | 13 | 30 | Grupos de WhatsApp por campanha Sendflow. |
| `sendflow_metricas` | 6 | 20 | Métricas diárias dos grupos (entradas/saídas/cliques). |
| `sendflow_eventos_grupo` | 8 | 1.829 | Eventos brutos de grupo (entrou/saiu). `evento_id` único. |
| `grupos_kpis_semana` | 6 | 4 | KPIs agregados de grupos por semana. Recalculado por `upsert_grupos_kpis_semana`. |

## Tabelas raw (ingestão / idempotência)

| Tabela | Col. | ~Linhas | O que é / faz |
|--------|------|---------|---------------|
| `raw_vendas` | 7 | 1.196 | Payload bruto de venda (webhook Manager Guru). `idempotency_key` único. Processada por `process_venda`. |
| `raw_trafego` | 9 | 50.107 | Insights brutos Meta Ads. Processada em lote por `process_raw_trafego_batch` (cron a cada 1 min). |
| `raw_crm` | 8 | — | Payload bruto de contatos AC. |

## Tabelas de configuração / sistema

| Tabela | Col. | O que é / faz |
|--------|------|---------------|
| `profiles` | 6 | Usuários autenticados. `perfil` = admin / visualizador. Criado por `handle_new_user`. |
| `integration_tokens` | 11 | Credenciais das integrações. `integration` único; `vault_key` → segredo no Vault; `last_sync_at/status`. |
| `integration_job_runs` | 13 | Histórico de execução dos jobs (status, registros, duração). ~5.194 linhas. |
| `meta_ad_accounts` | 8 | Contas de anúncio Meta cadastradas. INSERT dispara sync inicial (trigger). |
| `semana_config` | 6 | Configuração das semanas (dia/hora de virada em BRT). 3 entidades: `captacao` (Ter→Ter, rege CRM/Grupos), `webn` (Ter→Ter 20:00, rege Vendas/Webinário), `trafego` (Qua→Ter, rege só o Tráfego — Meta entrega gasto só por data, sem hora). |
| `webinario_semanas` | 5 | Definição das semanas de webinário (data_inicio / data_evento / fim). |
| `webinario_semanas_presencas` | 5 | Relação semana ↔ presenças (apoio). |
| `filtros_personalizados` | 7 | Filtros salvos por módulo (trafego/vendas/...). |
| `filtros_personalizados_regras` | 7 | Regras de cada filtro salvo. |
| `dashboard_abas` | 6 | Abas dinâmicas do dashboard. `tipo_mockup` (venda_direta/captacao) define o layout; `ordem`/`ativo`. Nome único (case-insensitive). A aba "Webnário" do dashboard NÃO entra aqui (é fixa no código). |
| `dashboard_aba_filtros` | 5 | Vínculos aba↔filtro por **papel** ('trafego','vendas', futuros). FK p/ `filtros_personalizados` é `ON DELETE SET NULL`. Único por `(aba_id, papel)`. |

## Índices relevantes (não-PK)
- `trafego`: `ad_account_id`, `campaign_name`, `date_ref`; únicos `ad_id+date` e `name+date`.
  - ⚠️ **Não há índice em `adset_name`** apesar de ser filtrado no frontend (ver `PENDENCIAS.md`).
- `vendas`: `contato_id`, `produto_id`, `oferta_id`, `status`, `data_aprovacao`, `email_contato`, `utm_campaign`, `venda_principal_id`.
- `crm`: `ac_contact_id`, `contato_id`, `email`, `tags` (GIN).
- `contatos`: `email` (único), `telefone`, `doc`, `ac_contact_id`.
- `webinario_inscritos`: `contato`, `semana`, `inscricao`.
- `dashboard_abas`: único `lower(nome)`, `ordem`.
- `dashboard_aba_filtros`: `aba_id`; único `(aba_id, papel)`.

> Lista completa de índices: `SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public'`.

## RLS (Row Level Security)
Todas as tabelas de `public` têm RLS habilitado. Padrão geral: **SELECT** liberado para `authenticated`
(o frontend lê como usuário logado); **escrita** só por `service_role` (Edge Functions/webhook) ou,
em tabelas de config, por `admin` (`profiles.perfil='admin'`). Crons que rodam SQL direto executam como
superuser e ignoram RLS.
- Em **2026-05-31** o RLS foi habilitado em 5 tabelas que estavam expostas à `anon` key:
  `grupos_kpis_semana`, `sendflow_metricas`, `webinario_presencas`, `crm_historico_utm`, `sendflow_eventos_grupo`
  (SELECT `authenticated`; escrita `service_role`). Ver `PENDENCIAS.md` / `CHANGELOG.md`.
