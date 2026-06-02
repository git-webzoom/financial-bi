# PLANO DE IMPLEMENTAÇÃO — Lead Score (WEBN)

> **Para a IA que vai implementar:** este documento é o plano completo. Leia-o inteiro antes de
> escrever qualquer código. Siga as **fases na ordem**. Tudo aqui é **aditivo** — não altera nenhuma
> tabela, função, cron, edge function ou página existente (a única exceção é a página `/crm`, que
> ganha uma coluna nova de forma aditiva). **Não refatore nada fora do escopo.**
>
> Antes de começar: leia `CLAUDE.md`, `docs/TABELAS.md`, `docs/FUNCOES-SQL.md`,
> `docs/EDGE-FUNCTIONS.md`, `docs/INTEGRACOES.md` e `docs/FRONTEND.md`.
> **Confirme o estado real no banco** (`list_tables` / `execute_sql`) antes de criar qualquer coisa.

---

## 1. Objetivo

Implementar o **Lead Score WEBN** (modelo de tabela de pontos) no Financial BI:
- Receber, via **webhook**, as respostas da pesquisa que hoje estão no ActiveCampaign.
- Calcular um **score em pontos** e classificar o lead numa **faixa** (A+, A, B, C, D).
- Exibir a faixa/pontos de cada lead na página **/crm**, ligando por `contato_id` (email).

> O modelo completo é uma **regressão logística** (ROC-AUC 0.69), mas implementamos a **tabela de
> pontos** (aproximação interpretável, correlação 0.56 com o modelo). A regressão completa fica para
> uma fase futura (exige exportar coeficientes/intercepto do Python — fora deste plano).

---

## 2. Contexto e origem dos dados (IMPORTANTE)

- As respostas da pesquisa **existem como custom fields no ActiveCampaign** (ex.:
  `WEBN. Qual a sua faixa de idade?`, `WEBN. Qual o seu nível de escolaridade?`, etc.).
- Hoje uma automação do AC despeja esses dados numa planilha Google. **Vamos adicionar uma ação
  "Webhook" nessa automação** apontando para a nova Edge Function. A planilha não é nosso problema.
- **NÃO sabemos ainda o formato exato** que o AC envia (nomes dos campos e, principalmente, o
  **texto exato das respostas**). Por isso a **Fase 0 é capturar o payload real** antes de mapear
  pontos. **Não invente os nomes/valores** — confirme com o dado real (regra de ouro do projeto).
- **Não há autenticação por token** neste webhook (decisão do produto). A função aceita o POST direto.

### Tabelas hoje (confirmado no banco real em 2026-06-02)
- `crm` **não tem** nenhum campo da pesquisa (só UTMs, engajamento de e-mail, tags).
- `webinario_inscritos` só tem semana/tag/UTMs.
- `raw_crm` está vazia. → **O score precisa de uma estrutura nova; nada existe hoje.**

---

## 3. Arquitetura (segue o padrão raw → processo → domínio do projeto)

```
Automação AC (lead preenche a pesquisa WEBN)
        │  ação "Webhook"  → POST (JSON ou form-urlencoded)
        ▼
[Edge Function Deno]  webhook-lead-score   (verify_jwt = false)
        │ 1) grava o corpo cru em  raw_lead_score
        │ 2) extrai email + respostas (mapeia nomes de campo do AC → variáveis do modelo)
        │ 3) upsert_contato(email, nome, telefone)  → contato_id
        │ 4) RPC calcular_lead_score(respostas) → pontos_total + faixa + breakdown
        │ 5) upsert em  lead_score  (onConflict contato_id)
        │ 6) marca raw_lead_score.processed = true
        ▼
[Tabela]  lead_score   (1 linha por contato)
        │
        ▼
Página /crm  → busca lead_score dos contatos visíveis → badge da faixa + pontos
```

Decisão de design (já validada com o dono): **tabela dedicada** ligada por `contato_id`
(resolvido pelo email via `upsert_contato`), e **exibição dentro do /crm**. Não criar colunas na
tabela `crm`.

---

## 4. A TABELA DE PONTOS (fonte da verdade do cálculo)

São **10 variáveis**. Para cada resposta, somam-se os pontos. "Não respondeu" / valor ausente = **0**.
Estes valores vêm da calculadora do modelo (arquivo `webn_leadscore.html`, função `calcScore`).

> ⚠️ Os textos abaixo são os **rótulos do modelo**. Na Fase 1 você vai **alinhar** esses textos ao
> que o AC realmente envia (podem diferir em acento/pontuação). O alinhamento é feito na tabela
> `lead_score_pontos`, sem mudar código.

### renda (Renda Mensal)
| Resposta | Pontos |
|---|---|
| Acima de R$20.000 | 25 |
| R$5.001 a R$10.000 | 18 |
| R$10.001 a R$20.000 | 16 |
| R$3.001 a R$5.000 | 10 |
| R$1.501 a R$3.000 | 0 |
| Menos de R$1.500 | -8 |

### escolaridade
| Resposta | Pontos |
|---|---|
| Pós-Graduação ou Mestrado | 20 |
| Graduação Completa | 10 |
| Graduação Incompleta | 4 |
| Até Ensino Médio Completo | 0 |

### profissao
| Resposta | Pontos |
|---|---|
| Empresário | 18 |
| Servidor Público | 15 |
| Aposentado | 5 |
| CLT / Colaborador PJ | 4 |
| Autônomo | 3 |
| Desempregado | -10 |

### conhece (Tempo que Conhece)
| Resposta | Pontos |
|---|---|
| Acima de 1 ano | 20 |
| 6 a 12 meses | 18 |
| 3 a 6 meses | 10 |
| 1 a 3 meses | 5 |
| Acabei de conhecer (anúncio) | 0 |

### cripto (Investe em Cripto)
| Resposta | Pontos |
|---|---|
| Sim, já invisto em cripto | 20 |
| Não, mas invisto em outros ativos | 8 |
| Não invisto em nada ainda | 0 |

### valor (Valor Investido Atualmente)
| Resposta | Pontos |
|---|---|
| R$ 10.000 a R$ 20.000 | 18 |
| R$ 20.000 a R$ 50.000 | 16 |
| R$ 1.000 a R$ 10.000 | 14 |
| R$ 50.000 a R$ 150.000 | 12 |
| Até R$ 50 mil | 8 |
| Menos de R$ 1.000 | 4 |
| Entre R$ 500 mil e R$ 1 milhão | -5 |
| Mais que R$ 5 milhões | -8 |

### idade (Faixa Etária)
| Resposta | Pontos |
|---|---|
| Entre 56 e 65 anos | 14 |
| Entre 46 e 55 anos | 12 |
| Acima de 65 anos | 8 |
| Entre 36 e 45 anos | 6 |
| Entre 26 e 35 anos | 0 |
| Entre 18 e 25 anos | -15 |

### disponivel_mes (Disponível por Mês)
| Resposta | Pontos |
|---|---|
| Acima de R$ 3.000 | 22 |
| R$ 1.000 a R$ 3.000 | 18 |
| R$ 500 a R$ 1.000 | 12 |
| R$ 100 a R$ 500 | 5 |
| Menos de R$ 100 | 0 |

### dificuldade (Principal Dificuldade)
| Resposta | Pontos |
|---|---|
| Falta de conhecimento técnico | 10 |
| Falta de confiança no mercado | 5 |
| Falta de experiência | 3 |
| Falta de capital | -3 |

### objetivo (Objetivo Financeiro)
| Resposta | Pontos |
|---|---|
| Construir patrimônio para minha família | 8 |
| Ter liberdade financeira e viver de renda | 5 |
| Aprender a investir com segurança | 5 |
| Ganhar dinheiro rápido e mudar de vida | 3 |
| Ter uma renda extra | 3 |

### Faixas (corte por pontos totais)
| Faixa | Pontos | Conversão esperada | Lift |
|---|---|---|---|
| A+ | ≥ 104 | ~9,2% | 5,8× |
| A | 90–103 | ~4,4% | 2,8× |
| B | 75–89 | ~3,2% | 2,0× |
| C | 53–74 | ~1,8% | 1,1× |
| D | < 53 | ~0,8% | 0,5× |

> Para barra de progresso (opcional, igual ao HTML): `min = -33`, `max = 159`.

### Ações recomendadas por faixa (texto do modelo, para exibir no /crm)
- **A+** — Remarketing premium imediato. Perfil de comprador claro; prioridade máxima.
- **A** — Nurturing ativo + remarketing; sequência personalizada.
- **B** — Nurturing padrão com atenção; retargeting em até 2 edições.
- **C** — Fluxo padrão de remarketing; sem investimento adicional.
- **D** — Baixo investimento; foco dos recursos em A+/A.

> As variáveis `gênero`, `sonho`, `diferencial` e `capital alocado` aparecem na pesquisa mas **não
> entram na tabela de pontos** (só na regressão logística completa). Ignorar nesta fase.

---

## 5. FASES DE IMPLEMENTAÇÃO (executar nesta ordem)

### FASE 0 — Captura do payload real (NÃO calcula score ainda)
**Objetivo:** descobrir o formato exato que o AC envia, sem assumir nada.

1. **Migration** `supabase/migrations/20260602000002_raw_lead_score.sql`:
   ```sql
   CREATE TABLE raw_lead_score (
     id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
     payload       jsonb,                 -- corpo se for JSON
     payload_text  text,                  -- corpo cru (se vier form-urlencoded)
     content_type  text,
     processed     boolean     NOT NULL DEFAULT false,
     processed_at  timestamptz,
     error         text,
     received_at   timestamptz NOT NULL DEFAULT now()
   );
   ALTER TABLE raw_lead_score ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "raw_lead_score_write_service" ON raw_lead_score
     FOR ALL TO service_role USING (true) WITH CHECK (true);
   -- (sem policy de SELECT para authenticated: o frontend não lê raw)
   ```
   Aplicar com `apply_migration` E versionar o arquivo (manter banco e repo em sincronia).

2. **Edge Function** `supabase/functions/webhook-lead-score/index.ts` em **modo captura**:
   - Padrão idêntico ao `webhook-hotwebnar` (ver `supabase/functions/webhook-hotwebnar/index.ts`):
     `Deno.serve`, `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, helper `json()`.
   - `verify_jwt = false` no deploy (`deploy_edge_function`).
   - Aceitar `POST`. Ler `content-type`. Tentar `req.json()`; se falhar, `req.text()` (form-urlencoded).
   - Inserir tudo em `raw_lead_score` (payload OU payload_text + content_type). Responder `200 {received:true}`.
   - **Não** chamar `upsert_contato` nem calcular nada ainda.

3. **Configurar o AC** (feito pelo dono): adicionar ação "Webhook" na automação apontando para a URL
   `https://<projeto>.supabase.co/functions/v1/webhook-lead-score`. Disparar **2–3 leads de teste**.

4. **Verificar** com `execute_sql`: `SELECT content_type, payload, payload_text FROM raw_lead_score
   ORDER BY received_at DESC LIMIT 5;` → anotar os **nomes de campo** e o **texto exato das respostas**.

> Saída da Fase 0: a lista real de `field name → variável` e os textos exatos das respostas.

---

### FASE 1 — Tabelas de domínio + tabela de pontos (com os textos REAIS)
1. **Migration** `20260602000003_lead_score_schema.sql`:
   ```sql
   -- Tabela de referência da pontuação (config — editável p/ re-score futuro)
   CREATE TABLE lead_score_pontos (
     id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     variavel  text NOT NULL,        -- 'renda','idade',...
     resposta  text NOT NULL,        -- TEXTO EXATO como vem do AC (alinhado na Fase 0)
     pontos    int  NOT NULL,
     UNIQUE (variavel, resposta)
   );

   -- Score por contato (1 linha por lead)
   CREATE TABLE lead_score (
     id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     contato_id    uuid NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
     email         text,
     ac_contact_id text,
     respostas     jsonb,            -- { "renda":"...", "idade":"...", ... } normalizado
     breakdown     jsonb,            -- { "renda":25, "idade":14, ... }
     pontos_total  int  NOT NULL DEFAULT 0,
     faixa         text NOT NULL DEFAULT 'D',
     raw_id        uuid REFERENCES raw_lead_score(id),
     created_at    timestamptz NOT NULL DEFAULT now(),
     updated_at    timestamptz NOT NULL DEFAULT now(),
     UNIQUE (contato_id)
   );
   CREATE INDEX idx_lead_score_contato_id ON lead_score(contato_id);
   CREATE INDEX idx_lead_score_faixa       ON lead_score(faixa);
   CREATE INDEX idx_lead_score_email       ON lead_score(email);

   -- updated_at automático (reaproveita a função existente do projeto)
   CREATE TRIGGER trg_lead_score_updated_at BEFORE UPDATE ON lead_score
     FOR EACH ROW EXECUTE FUNCTION set_updated_at();

   -- RLS (padrão do projeto: SELECT authenticated / escrita service_role)
   ALTER TABLE lead_score        ENABLE ROW LEVEL SECURITY;
   ALTER TABLE lead_score_pontos ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "lead_score_select" ON lead_score
     FOR SELECT TO authenticated USING (true);
   CREATE POLICY "lead_score_write_service" ON lead_score
     FOR ALL TO service_role USING (true) WITH CHECK (true);
   CREATE POLICY "lead_score_pontos_select" ON lead_score_pontos
     FOR SELECT TO authenticated USING (true);
   CREATE POLICY "lead_score_pontos_write_service" ON lead_score_pontos
     FOR ALL TO service_role USING (true) WITH CHECK (true);
   ```

2. **Migration** `20260602000004_lead_score_pontos_seed.sql`: inserir TODAS as linhas da seção 4,
   **usando o texto exato das respostas confirmado na Fase 0**. Uma linha por (variavel, resposta).
   Não precisa cadastrar "Não respondeu" (ausência = 0 por padrão no cálculo).

---

### FASE 2 — Função de cálculo (RPC)
**Migration** `20260602000005_calcular_lead_score.sql`:
```sql
CREATE OR REPLACE FUNCTION calcular_lead_score(p_respostas jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_key   text;
  v_resp  text;
  v_pts   int;
  v_total int := 0;
  v_break jsonb := '{}'::jsonb;
  v_faixa text;
BEGIN
  FOR v_key, v_resp IN SELECT key, value::text FROM jsonb_each_text(p_respostas) LOOP
    SELECT pontos INTO v_pts
      FROM lead_score_pontos
     WHERE variavel = v_key AND resposta = v_resp
     LIMIT 1;
    v_pts := COALESCE(v_pts, 0);          -- resposta desconhecida → 0 (e logar p/ revisão)
    v_total := v_total + v_pts;
    v_break := v_break || jsonb_build_object(v_key, v_pts);
  END LOOP;

  v_faixa := CASE
    WHEN v_total >= 104 THEN 'A+'
    WHEN v_total >=  90 THEN 'A'
    WHEN v_total >=  75 THEN 'B'
    WHEN v_total >=  53 THEN 'C'
    ELSE 'D'
  END;

  RETURN jsonb_build_object('pontos_total', v_total, 'faixa', v_faixa, 'breakdown', v_break);
END;
$$;
```
**Testar** com `execute_sql` antes de seguir, ex.:
`SELECT calcular_lead_score('{"renda":"Acima de R$20.000","idade":"Entre 56 e 65 anos"}'::jsonb);`
→ deve devolver `pontos_total: 39, faixa: "D"` (ajuste os textos aos reais).

---

### FASE 3 — Edge Function em modo "scoring" (completa)
Atualizar `webhook-lead-score/index.ts` para, além de gravar o raw:
1. Extrair `email` (campo de email do AC), `nome`, `telefone`.
2. Mapear nomes de campo do AC → chaves de variável (dicionário fixo na função, definido com os
   nomes reais da Fase 0). Montar `respostas` jsonb normalizado.
3. `const { data: contatoId } = await supabase.rpc('upsert_contato', { p_email, p_nome, p_telefone })`.
4. `const { data: score } = await supabase.rpc('calcular_lead_score', { p_respostas: respostas })`.
5. `upsert` em `lead_score` (onConflict: `contato_id`) com `respostas`, `breakdown`, `pontos_total`,
   `faixa`, `email`, `ac_contact_id`, `raw_id`.
6. Marcar `raw_lead_score.processed = true` (e `error` em caso de falha, sem derrubar a request).
7. Responder `200 { received:true, faixa, pontos_total }`.

Re-deploy com `deploy_edge_function` (verify_jwt = false). Disparar leads de teste e conferir
`SELECT email, pontos_total, faixa FROM lead_score ORDER BY updated_at DESC LIMIT 10;`.

---

### FASE 4 — Exibição no /crm
- Ler antes: `src/app/(autenticado)/crm/page.tsx`, `_components/CrmClient.tsx`, `_components/CrmTabela.tsx`.
- A página é SSR + Client; a lista de leads é montada no `CrmClient`. Após obter os leads da semana,
  buscar o score dos contatos visíveis e **mesclar por `contato_id`**:
  ```ts
  const ids = leads.map(l => l.contato_id).filter(Boolean)
  const { data: scores } = await supabase
    .from('lead_score')
    .select('contato_id, pontos_total, faixa')
    .in('contato_id', ids)
  // mapear por contato_id e anexar a cada lead
  ```
  > Cuidado: `.in()` com muitos ids tem limite de URL. Se a lista de leads passar de ~300, paginar a
  > busca de score em lotes (ou criar uma RPC `get_lead_scores(ids uuid[])`). Ver lição do
  > `get_compradores_semana` em `docs/FUNCOES-SQL.md`.
- Adicionar **coluna "Lead Score"** no `CrmTabela`: badge da faixa (cores A+/A verde, B amarelo,
  C azul, D cinza — paleta do HTML) + os pontos. Opcional: tooltip com a ação recomendada.
- **Aditivo**: não remover colunas nem mudar Props existentes sem checar todos os usos (regra do projeto).

---

## 6. O que NÃO fazer (proteções)
- ❌ Não alterar `crm`, `process_venda`, `job-activecampaign-webn`, nem qualquer cron/edge function existente.
- ❌ Não adicionar colunas de pesquisa na tabela `crm`.
- ❌ Não assumir nomes/valores do AC — usar os reais da Fase 0.
- ❌ Não exigir token (decisão do produto) — mas validar que o body tem email; sem email, responder 400.
- ❌ Não commitar/pushar sem o dono pedir.

---

## 7. Testes obrigatórios (antes de dizer "pronto")
1. **RPC**: `SELECT calcular_lead_score('{...}')` com casos conhecidos (A+, D, resposta inexistente → 0).
2. **Webhook captura** (Fase 0): payload real chega em `raw_lead_score`.
3. **Webhook scoring** (Fase 3): lead de teste gera linha em `lead_score` com faixa coerente.
4. **Re-score**: reenviar o mesmo lead com respostas diferentes → `lead_score` atualiza (onConflict).
5. **Lead sem cadastro prévio**: webhook cria o contato via `upsert_contato` e pontua.
6. **/crm**: badge aparece nos leads que têm score; quem não tem score não quebra a página.
7. **Build**: `npm run build` sem erros de TypeScript.

---

## 8. Documentação a atualizar ao final (regra do projeto)
- `docs/TABELAS.md` → `raw_lead_score`, `lead_score`, `lead_score_pontos` (+ índices/RLS).
- `docs/FUNCOES-SQL.md` → `calcular_lead_score`.
- `docs/EDGE-FUNCTIONS.md` → `webhook-lead-score`.
- `docs/INTEGRACOES.md` → ActiveCampaign (nova saída via webhook para o lead score).
- `docs/FRONTEND.md` → coluna Lead Score em `/crm`.
- `docs/CHANGELOG.md` → entrada no formato padrão.
- `docs/PENDENCIAS.md` → registrar que a **regressão logística completa** fica como evolução futura
  (precisa exportar coeficientes/intercepto do modelo Python) e que o modelo deve ser **reprocessado
  a cada 3–4 edições** ou +100 compradores novos.

---

## 9. Resumo dos artefatos a criar
| # | Artefato | Tipo |
|---|---|---|
| 1 | `supabase/migrations/20260602000002_raw_lead_score.sql` | Migration (tabela raw + RLS) |
| 2 | `supabase/functions/webhook-lead-score/index.ts` | Edge Function (Deno) |
| 3 | `supabase/migrations/20260602000003_lead_score_schema.sql` | Migration (lead_score + lead_score_pontos + RLS + trigger) |
| 4 | `supabase/migrations/20260602000004_lead_score_pontos_seed.sql` | Migration (seed da tabela de pontos) |
| 5 | `supabase/migrations/20260602000005_calcular_lead_score.sql` | Migration (RPC de cálculo) |
| 6 | `src/app/(autenticado)/crm/_components/CrmTabela.tsx` (+ `CrmClient.tsx`) | Frontend (coluna aditiva) |

> Numeração das migrations: a última existente é `20260602000001`. Use `20260602000002+`.
> Se alguém já tiver criado migrations nesse intervalo, **confirme no banco** (`list_migrations`) e
> ajuste a numeração para não colidir.
