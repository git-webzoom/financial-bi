# Funções SQL / RPC e Triggers — Financial BI

> Fonte: `pg_proc` no schema `public`, verificado em 2026-05-31 (33 funções).
> Ao criar/alterar função: atualize aqui **e** registre no `CHANGELOG.md`.

## Funções de ingestão / processamento
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `process_venda` | `raw_id uuid` | void | Lê `raw_vendas`, faz `upsert_contato`, insere/atualiza em `vendas`, marca processado. Preenche `venda_principal_id` (order bump/upsell → mãe via `payload.last_transaction.id`). |
| `process_trafego` | `p_raw_id uuid` | void | Processa uma linha de `raw_trafego` para `trafego`. |
| `process_raw_trafego_batch` | — | jsonb | Processa lote pendente de `raw_trafego`. **Roda em cron a cada 1 min.** |
| `upsert_contato` | email + 10 campos opcionais | uuid | Email único; só preenche campos NULL (não sobrescreve dados existentes). |

## Webinário / CRM / Grupos
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `upsert_inscrito_webn` | contato, crm, semana, tag, UTMs... | void | Registra inscrito do webinário. |
| `upsert_presenca_webn` | email, nome, telefone, tag, semana | void | Registra presença ao vivo (chamada pelo webhook Hotwebnar). |
| `get_inscritos_semana` | `p_numero int` | json | Lista inscritos de uma semana. |
| `get_compradores_semana` | `p_numero int` | TABLE | Compradores da semana. **Use sempre esta RPC** (evita o bug do `.in()` com 900+ emails). |
| `get_outras_semanas_contatos` | `p_contato_ids[], p_numero` | json | Em quais outras semanas os contatos aparecem. |
| `upsert_grupos_kpis_semana` | `p_numero int` | void | Recalcula KPIs de grupos da semana. |
| `snapshot_membros_inicio_semana` | `p_numero int` | void | Tira foto dos membros no início da semana. |
| `grupos_fechamento_semana` | — | void | Fecha métricas de grupos. **Roda em cron (a cada 1 min, dispara no momento certo).** |

## Lead Score (WEBN)
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `calcular_lead_score` | `p_respostas jsonb` | jsonb | Recebe respostas **já normalizadas** (chave = `variavel` da scorecard), soma `lead_score_pontos` e devolve `{pontos_total, faixa, breakdown}`. Faixas: A+≥104, A≥90, B≥75, C≥53, D<53. Resposta ausente/não listada = 0. `SECURITY DEFINER`. |
| `get_lead_scores` | `p_contato_ids uuid[]` | json | Scores em lote por array de uuid (POST — evita o bug do `.in()`). Retorna `(contato_id, pontos_total, faixa)` só dos que têm score. Usada no `/crm`. `SECURITY DEFINER`. |

## Semanas (captação vs webinário — distintos!)
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `get_semana_atual` | — | int | Semana de **captação (CRM)** atual. |
| `get_semana_webnario_ativa` | — | int | Semana de **webinário** ativa. **Calculada** (mesma fórmula de `listar_semanas_vendas`: `ultima_ocorrencia_brt(config 'webn')` ancorado em `webinario_semanas`, **−1** proposital). **NÃO lê mais** a linha física de `webinario_semanas_presencas`. Garante que Webinário = Vendas sempre. *(Antes lia a linha física e bugava — ver CHANGELOG 2026-06-02.)* |
| `get_periodo_semana` | `p_numero int, p_entidade text = 'captacao'` | TABLE | Datas início/fim/evento da semana. **`'captacao'` (default):** lê `webinario_semanas` (régua Ter→Ter) — usado pelo **CRM**. **`'webn'`:** **calcula** o período pela régua de vendas/webinário (igual `listar_semanas_vendas`; `data_evento = data_inicio` = ao vivo terça 20:00 BRT) — usado por **`/webnario`** e pela aba Webinário do dashboard. *(A versão antiga de 1 arg foi dropada; o default cobre as chamadas de 1 arg — ver CHANGELOG 2026-06-02.)* |
| `ensure_semana_existe` | `p_numero int` | void | Cria a semana de **captação** (`webinario_semanas`) se faltar. |
| `ensure_semana_webnario_existe` | `p_numero int` | void | **No-op desde 2026-06-02** (mantida só porque o cron a chama). Antes criava linhas em `webinario_semanas_presencas` com datas erradas — a semana de webinário agora é **calculada**, não materializada. |
| `auto_criar_proxima_semana` | — | void | Garante a próxima semana. **Cron a cada 5 min.** |
| `listar_semanas_recentes` | `p_limit, p_offset` | TABLE | Semanas recentes pela entidade `captacao` (Ter→Ter). Retorna `numero, inicio, fim` (date). Hoje **não há mais consumidor no frontend** (o tráfego migrou para `listar_semanas_trafego`); mantida para compatibilidade/uso futuro de captação. |
| `listar_semanas_trafego` | `p_limit, p_offset` | TABLE | Semanas para o seletor de **Tráfego** (entidade `trafego`). Lê `semana_config('trafego')`: régua **Qua→Ter** (a Meta entrega gasto só por data, sem hora; `trafego.date_ref` é `date` puro). Usa **`floor()`** no cálculo do número (não divisão inteira): como a régua começa na quarta e a âncora `webinario_semanas` é terça, a "última quarta" fica antes da âncora nas terças (dias_diff negativo) — `floor(-6/7)=-1` alinha o número. Assim, numa terça a semana corrente (Qua anterior→Ter de hoje) é a **mesma numeração da captação −1**; a próxima (quarta) iguala a captação. Usada em `/trafego` e no funil de tráfego do dashboard (`WebinarioClient`). *(Antes usava divisão inteira e ficava +1 adiantado nas terças — ver CHANGELOG 2026-06-02.)* |
| `listar_semanas_vendas` | `p_limit` | TABLE | Semanas para o seletor de Vendas (entidade `webn`). Retorna `numero, inicio, fim` (date) **+ `inicio_ts, fim_ts` (timestamptz)** com o corte de hora real de `semana_config('webn')` em BRT. A numeração é **defasada −1 de propósito** (Vendas/Webinário ficam "uma semana pra trás" vs `listar_semanas_recentes`/`webinario_semanas`). O frontend filtra `data_pedido` por `inicio_ts`/`fim_ts`. |

## KPIs / consultas
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `get_kpis_vendas` | inicio, fim, produto?, marketplace? | json | KPIs agregados de vendas. **`totalVendas` conta só a venda mãe** (`venda_principal_id IS NULL`); faturamento soma mãe + order bumps aprovados do grupo (status por linha). |
| `is_venda_aprovada` | `p_status text` | boolean | Regra única de "venda aprovada". |

## Disparo de jobs / Meta Ads
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `dispatch_meta_ads_sync` | `p_mode text` | void | Dispara `job-meta-ads` (modo daily/weekly). **Cron.** |
| `trigger_meta_ads_initial_sync` | — | trigger | Ao inserir conta em `meta_ad_accounts`, dispara sync inicial. |

## Vault / segurança / auth
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `get_vault_secret` | `p_id uuid` | text | Lê segredo do Vault. |
| `upsert_vault_secret` | secret, name, id? | uuid | Cria/atualiza segredo no Vault. |
| `get_user_perfil` | — | text | Perfil do usuário logado (usado em RLS). |
| `handle_new_user` | — | trigger | Cria `profiles` ao registrar usuário (perfil padrão: visualizador). |

## Utilitários de tempo (BRT)
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `proxima_ocorrencia_brt` | ref, dia, hora | timestamptz | Próxima ocorrência de dia/hora em BRT. |
| `ultima_ocorrencia_brt` | dia, hora | date | Última ocorrência em BRT. |

## Triggers ativos
| Tabela | Trigger | Quando | Função |
|--------|---------|--------|--------|
| `contatos`,`crm`,`dashboard_abas`,`filtros_personalizados`,`integration_tokens`,`ofertas`,`produtos`,`profiles`,`vendas` | `trg_*_updated_at` | BEFORE UPDATE | `set_updated_at` |
| `crm` | `trg_crm_historico_utm` | AFTER UPDATE | `trg_crm_historico_utm` (grava histórico de UTM) |
| `meta_ad_accounts` | `trg_meta_ad_accounts_initial_sync` | AFTER INSERT | `trigger_meta_ads_initial_sync` |
| `meta_ad_accounts` | `trg_meta_ad_accounts_updated_at` | BEFORE UPDATE | `update_meta_ad_accounts_updated_at` |
