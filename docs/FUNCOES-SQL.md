# Funções SQL / RPC e Triggers — Financial BI

> Fonte: `pg_proc` no schema `public`, verificado em 2026-05-31 (33 funções).
> Ao criar/alterar função: atualize aqui **e** registre no `CHANGELOG.md`.

## Funções de ingestão / processamento
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `process_venda` | `raw_id uuid` | void | Lê `raw_vendas`, faz `upsert_contato`, insere/atualiza em `vendas`, marca processado. |
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

## Semanas (captação vs webinário — distintos!)
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `get_semana_atual` | — | int | Semana de **captação (CRM)** atual. |
| `get_semana_webnario_ativa` | — | int | Semana de **webinário** ativa. |
| `get_periodo_semana` | `p_numero int` | TABLE | Datas início/fim/evento da semana. |
| `ensure_semana_existe` | `p_numero int` | void | Cria a semana de captação se faltar. |
| `ensure_semana_webnario_existe` | `p_numero int` | void | Cria a semana de webinário se faltar. |
| `auto_criar_proxima_semana` | — | void | Garante a próxima semana. **Cron a cada 5 min.** |
| `listar_semanas_recentes` | `p_limit, p_offset` | TABLE | Semanas recentes (usado nos seletores do frontend). |
| `listar_semanas_vendas` | `p_limit` | TABLE | Semanas com vendas. |

## KPIs / consultas
| Função | Args | Retorno | O que faz |
|--------|------|---------|-----------|
| `get_kpis_vendas` | inicio, fim, produto?, marketplace? | json | KPIs agregados de vendas. |
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
| `contatos`,`crm`,`filtros_personalizados`,`integration_tokens`,`ofertas`,`produtos`,`profiles`,`vendas` | `trg_*_updated_at` | BEFORE UPDATE | `set_updated_at` |
| `crm` | `trg_crm_historico_utm` | AFTER UPDATE | `trg_crm_historico_utm` (grava histórico de UTM) |
| `meta_ad_accounts` | `trg_meta_ad_accounts_initial_sync` | AFTER INSERT | `trigger_meta_ads_initial_sync` |
| `meta_ad_accounts` | `trg_meta_ad_accounts_updated_at` | BEFORE UPDATE | `update_meta_ad_accounts_updated_at` |
