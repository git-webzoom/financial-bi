# PLANO DE IMPLEMENTAÇÃO — Lead Score (WEBN)

> **Para a IA que vai implementar:** este é o plano completo. Leia-o inteiro antes de codar.
> Tudo aqui é **aditivo** — não altera nenhuma tabela, função, cron ou edge function existente.
> A única mudança em código existente é uma **coluna nova** na página `/crm` (Fase 6).
>
> Antes de começar: leia `CLAUDE.md`, `docs/TABELAS.md`, `docs/FUNCOES-SQL.md`,
> `docs/EDGE-FUNCTIONS.md`, `docs/INTEGRACOES.md`, `docs/FRONTEND.md`.
> **Confirme o estado real no banco** (`list_tables` / `list_migrations` / `execute_sql`) antes de criar nada.

---

## 1. Objetivo

Calcular o **Lead Score WEBN** (modelo de **tabela de pontos**) e exibir a faixa (A+/A/B/C/D) de cada
lead na página **/crm**. Os dados vêm **direto do formulário de pesquisa** (não do ActiveCampaign).

> O modelo completo é uma regressão logística (ROC-AUC 0.69); implementamos a **tabela de pontos**
> (aproximação interpretável, correlação 0.56). A regressão completa fica para o futuro (precisa
> exportar coeficientes/intercepto do Python — fora deste plano).

---

## 2. Origem dos dados — webhook DIRETO do formulário

O formulário de pesquisa é uma **página HTML/JS própria** (landing da financialmove). Hoje ele só
envia as respostas para o **ActiveCampaign** (via `fetch` para `proc.php`). Vamos **adicionar um
segundo envio**, em paralelo, para a nossa Edge Function. **O envio ao AC continua intacto.**

- **Nós controlamos o payload** → o contrato é definido por nós (ver seção 3). Não há "fase de
  captura/descoberta" como seria via AC.
- `nome`, `email`, `telefone` chegam como **UTM na URL** da página anterior (captura) e ficam em
  inputs hidden / localStorage (`goesUserEmail`, etc.). O `email` é a **chave** que liga ao `contato`.
- As 14 perguntas estão no código do form com `name` e `value` fixos (ver seção 4).
- **Sem token de autenticação** (decisão do produto). A função valida só que veio `email`.

### Campos do formulário (name → o que é)
`genero`, `idade`, `escolaridade`, `profissional`, `renda`, `investe_cripto`, `valor_investido`,
`disponivel_mes`, `tempo_tasso`, `capital`, `objetivo_cripto`, `dificuldade_cripto`, `sonho`,
`diferencial_tasso`.

> Destes 14, **só 10 entram no score** (renda, escolaridade, profissional, tempo_tasso, investe_cripto,
> valor_investido, idade, disponivel_mes, dificuldade_cripto, objetivo_cripto). Os outros 4 (`genero`,
> `capital`, `sonho`, `diferencial_tasso`) **guardamos como dado** (úteis para a regressão futura) mas
> contribuem **0 ponto** agora.

### Estado atual do banco (confirmado em 2026-06-02)
`crm` e `webinario_inscritos` não têm campos de pesquisa; `raw_crm` vazia. Nada existe hoje — tudo é novo.

---

## 3. Contrato do webhook (o JSON que o formulário vai enviar)

`POST https://zbfcrnsfygovzmncmmjz.supabase.co/functions/v1/webhook-lead-score`
`Content-Type: application/json`

```json
{
  "email": "lead@exemplo.com",
  "nome": "Fulano",
  "telefone": "5511999999999",
  "respostas": {
    "genero": "Masculino",
    "idade": "Entre 46 e 55 anos",
    "escolaridade": "Pós-Graduação ou Mestrado",
    "profissional": "Empresário",
    "renda": "Acima de R$20.000",
    "investe_cripto": "Sim, já invisto em cripto",
    "valor_investido": "R$ 50.000 a R$ 150.000",
    "disponivel_mes": "Acima de R$ 3.000",
    "tempo_tasso": "Acima de 1 ano",
    "capital": "Criptomoedas",
    "objetivo_cripto": "Construir patrimônio para minha família",
    "dificuldade_cripto": "Falta de conhecimento técnico",
    "sonho": "Empreender",
    "diferencial_tasso": "Poder tirar dúvidas ao vivo com quem realmente vive de cripto"
  }
}
```
> O form manda os **nomes de campo dele** (`profissional`, `investe_cripto`, `tempo_tasso`, etc.).
> A Edge Function normaliza esses nomes para as **variáveis do score** (seção 5, dicionário fixo).

---

## 4. Arquitetura (padrão raw → processo → domínio do projeto)

```
Formulário (browser do lead) — ao enviar:
   ├─ fetch → ActiveCampaign (continua como hoje)
   └─ fetch → [Edge Function] webhook-lead-score   (CORS habilitado!)
                  │ 1) grava o corpo cru em raw_lead_score
                  │ 2) normaliza nomes de campo → variáveis
                  │ 3) upsert_contato(email, nome, telefone) → contato_id
                  │ 4) RPC calcular_lead_score(respostas) → pontos_total + faixa + breakdown
                  │ 5) upsert em lead_score (onConflict contato_id)
                  │ 6) marca raw processed
                  ▼
              [Tabela] lead_score → join por contato_id → badge no /crm
```

---

## 5. A TABELA DE PONTOS (com os textos EXATOS do formulário)

Some os pontos das 10 variáveis. Resposta ausente / não listada = **0**.
Faixas: **A+ ≥104 · A 90–103 · B 75–89 · C 53–74 · D <53**.

> Os textos abaixo já foram **conferidos contra o formulário real**. Use-os exatamente assim no seed.
> A coluna "variável" é a chave normalizada (o que vai no `lead_score_pontos.variavel` e no JSON da RPC).

### renda  *(campo `renda`)*
| Resposta (texto do form) | Pontos |
|---|---|
| Acima de R$20.000 | 25 |
| R$5.001 a R$10.000 | 18 |
| R$10.001 a R$20.000 | 16 |
| R$3.001 a R$5.000 | 10 |
| R$1.501 a R$3.000 | 0 |
| Menos de R$1.500 | -8 |

### escolaridade  *(campo `escolaridade`)*
| Resposta | Pontos |
|---|---|
| Pós-Graduação ou Mestrado | 20 |
| Graduação Completa | 10 |
| Graduação Incompleta | 4 |
| Até Ensino Médio Completo | 0 |

### profissao  *(campo `profissional`)*
| Resposta | Pontos |
|---|---|
| Empresário | 18 |
| Servidor Público | 15 |
| Aposentado | 5 |
| CLT / Colaborador PJ | 4 |
| Autônomo | 3 |
| Desempregado | -10 |

### conhece  *(campo `tempo_tasso`)*
| Resposta | Pontos |
|---|---|
| Acima de 1 ano | 20 |
| 6 a 12 meses | 18 |
| 3 a 6 meses | 10 |
| 1 a 3 meses | 5 |
| Acabei de conhecer por um anúncio | 0 |

### cripto  *(campo `investe_cripto`)*
| Resposta | Pontos |
|---|---|
| Sim, já invisto em cripto | 20 |
| Não, mas faço outros investimentos (Renda Fixa, Bolsa de Valores, etc) | 8 |
| Não, também não faço outros investimentos ainda | 0 |

### valor  *(campo `valor_investido`)*
| Resposta | Pontos |
|---|---|
| R$ 10.000 a R$ 20.000 | 18 |
| R$ 20.000 a R$ 50.000 | 16 |
| R$ 1.000 a R$ 10.000 | 14 |
| R$ 50.000 a R$ 150.000 | 12 |
| Menos de R$ 1.000 | 4 |
| **R$ 150.000 a R$ 500.000** | **-5** ✅ (decisão confirmada) |
| Acima de R$ 500.000 | -5 |

> ✅ **DECISÃO CONFIRMADA (valor):** a opção `R$ 150.000 a R$ 500.000` não tinha pontuação no modelo
> original (coeficiente da regressão fortemente negativo, ~-1.23). **Definido em -5** (mesma banda de
> "Acima de R$ 500.000"). As faixas "Até R$ 50 mil"/"Entre R$500K e R$1M"/"Mais que R$5M" do modelo
> **não existem no form** — ignorar.

### idade  *(campo `idade`)*
| Resposta | Pontos |
|---|---|
| Entre 56 e 65 anos | 14 |
| Entre 46 e 55 anos | 12 |
| Acima de 65 anos | 8 |
| Entre 36 e 45 anos | 6 |
| Entre 26 e 35 anos | 0 |
| Entre 18 e 25 anos | -15 |

### disponivel_mes  *(campo `disponivel_mes`)*
| Resposta | Pontos |
|---|---|
| Acima de R$ 3.000 | 22 |
| R$ 1.000 a R$ 3.000 | 18 |
| R$ 500 a R$ 1.000 | 12 |
| R$ 100 a R$ 500 | 5 |
| Menos de R$ 100 | 0 |

### dificuldade  *(campo `dificuldade_cripto`)*
| Resposta | Pontos |
|---|---|
| Falta de conhecimento técnico | 10 |
| Falta de confiança no mercado | 5 |
| Falta de experiência | 3 |
| Falta de capital | -3 |

### objetivo  *(campo `objetivo_cripto`)*
| Resposta | Pontos |
|---|---|
| Construir patrimônio para minha família | 8 |
| Ter liberdade financeira e viver de renda | 5 |
| Aprender a investir com segurança e autonomia | 5 |
| Ganhar dinheiro rápido e mudar de vida | 3 |
| Ter uma renda extra para complementar o salário | 3 |

### Mapeamento campo do form → variável (para a Edge Function)
```
genero            → (não pontua, só guarda)
idade             → idade
escolaridade      → escolaridade
profissional      → profissao
renda             → renda
investe_cripto    → cripto
valor_investido   → valor
disponivel_mes    → disponivel_mes
tempo_tasso       → conhece
capital           → (não pontua, só guarda)
objetivo_cripto   → objetivo
dificuldade_cripto→ dificuldade
sonho             → (não pontua, só guarda)
diferencial_tasso → (não pontua, só guarda)
```

### Ações recomendadas por faixa (exibir no /crm)
- **A+** (≥104, ~9,2%) — Remarketing premium imediato; prioridade máxima.
- **A** (90–103, ~4,4%) — Nurturing ativo + remarketing personalizado.
- **B** (75–89, ~3,2%) — Nurturing padrão com atenção; retargeting até 2 edições.
- **C** (53–74, ~1,8%) — Fluxo padrão; sem investimento adicional.
- **D** (<53, ~0,8%) — Baixo investimento; focar recursos em A+/A.

---

## 6. FASES DE IMPLEMENTAÇÃO (nesta ordem)

### FASE 1 — Tabelas + RLS
**Migration** `supabase/migrations/20260602000002_lead_score_schema.sql` (confirmar numeração com `list_migrations`):
```sql
-- RAW (corpo cru do webhook)
CREATE TABLE raw_lead_score (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload      jsonb,
  processed    boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz NOT NULL DEFAULT now()
);

-- Tabela de pontos (config — editável p/ re-score sem mudar código)
CREATE TABLE lead_score_pontos (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variavel text NOT NULL,
  resposta text NOT NULL,      -- TEXTO EXATO do form
  pontos   int  NOT NULL,
  UNIQUE (variavel, resposta)
);

-- Score por contato (1 linha por lead)
CREATE TABLE lead_score (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id   uuid NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  email        text,
  respostas    jsonb,          -- todas as 14 respostas (inclui as não pontuadas)
  breakdown    jsonb,          -- pontos por variável
  pontos_total int  NOT NULL DEFAULT 0,
  faixa        text NOT NULL DEFAULT 'D',
  raw_id       uuid REFERENCES raw_lead_score(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contato_id)
);
CREATE INDEX idx_lead_score_contato_id ON lead_score(contato_id);
CREATE INDEX idx_lead_score_faixa      ON lead_score(faixa);
CREATE INDEX idx_lead_score_email      ON lead_score(email);

CREATE TRIGGER trg_lead_score_updated_at BEFORE UPDATE ON lead_score
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS (padrão do projeto: SELECT authenticated / escrita service_role)
ALTER TABLE raw_lead_score    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_pontos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_lead_score_write_service"   ON raw_lead_score    FOR ALL    TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_score_select"              ON lead_score        FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_score_write_service"       ON lead_score        FOR ALL    TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_score_pontos_select"       ON lead_score_pontos FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_score_pontos_write_service"ON lead_score_pontos FOR ALL    TO service_role USING (true) WITH CHECK (true);
```
Aplicar com `apply_migration` **e** versionar o arquivo (banco e repo em sincronia).

### FASE 2 — Seed da tabela de pontos
**Migration** `20260602000003_lead_score_pontos_seed.sql`: `INSERT` de **todas** as linhas da seção 5,
com o **texto exato do form**. Confirmar a decisão do `valor R$ 150.000 a R$ 500.000` antes.

### FASE 3 — RPC de cálculo
**Migration** `20260602000004_calcular_lead_score.sql`:
```sql
CREATE OR REPLACE FUNCTION calcular_lead_score(p_respostas jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_key text; v_resp text; v_pts int; v_total int := 0;
        v_break jsonb := '{}'::jsonb; v_faixa text;
BEGIN
  FOR v_key, v_resp IN SELECT key, value::text FROM jsonb_each_text(p_respostas) LOOP
    SELECT pontos INTO v_pts FROM lead_score_pontos
      WHERE variavel = v_key AND resposta = v_resp LIMIT 1;
    v_pts := COALESCE(v_pts, 0);
    v_total := v_total + v_pts;
    v_break := v_break || jsonb_build_object(v_key, v_pts);
  END LOOP;
  v_faixa := CASE WHEN v_total>=104 THEN 'A+' WHEN v_total>=90 THEN 'A'
                  WHEN v_total>=75 THEN 'B'  WHEN v_total>=53 THEN 'C' ELSE 'D' END;
  RETURN jsonb_build_object('pontos_total', v_total, 'faixa', v_faixa, 'breakdown', v_break);
END; $$;
```
**Testar** antes de seguir: `SELECT calcular_lead_score('{"renda":"Acima de R$20.000","idade":"Entre 56 e 65 anos","disponivel_mes":"Acima de R$ 3.000"}'::jsonb);`
→ esperado `pontos_total = 61, faixa = "C"`.

### FASE 4 — Edge Function `webhook-lead-score` (com CORS!)
`supabase/functions/webhook-lead-score/index.ts`. Padrão do `webhook-hotwebnar`, **MAIS CORS**
(é chamada do navegador do lead):
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (d: unknown, s: number) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

// form-field → variável do score
const MAP: Record<string,string> = {
  idade:'idade', escolaridade:'escolaridade', profissional:'profissao', renda:'renda',
  investe_cripto:'cripto', valor_investido:'valor', disponivel_mes:'disponivel_mes',
  tempo_tasso:'conhece', objetivo_cripto:'objetivo', dificuldade_cripto:'dificuldade',
  // genero/capital/sonho/diferencial_tasso → não pontuam (não entram no MAP)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')   return json({ error: 'method not allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  // grava raw sempre (mesmo sem email)
  const { data: raw } = await supabase.from('raw_lead_score').insert({ payload: body }).select('id').single()

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
  if (!email) return json({ error: 'email required' }, 400)
  const nome = typeof body.nome === 'string' ? body.nome.trim() || null : null
  const telefone = typeof body.telefone === 'string' ? body.telefone.trim() || null : null
  const respFromForm = (body.respostas ?? {}) as Record<string, string>

  // normaliza p/ variáveis pontuáveis
  const respScore: Record<string,string> = {}
  for (const [campo, variavel] of Object.entries(MAP)) {
    if (respFromForm[campo]) respScore[variavel] = respFromForm[campo]
  }

  const { data: contatoId } = await supabase.rpc('upsert_contato',
    { p_email: email, p_nome: nome, p_telefone: telefone })
  const { data: score } = await supabase.rpc('calcular_lead_score', { p_respostas: respScore })

  const { error: upErr } = await supabase.from('lead_score').upsert({
    contato_id: contatoId, email,
    respostas: respFromForm,                 // guarda TODAS as 14
    breakdown: (score as any).breakdown,
    pontos_total: (score as any).pontos_total,
    faixa: (score as any).faixa,
    raw_id: raw?.id ?? null,
  }, { onConflict: 'contato_id' })
  if (upErr) { console.error(upErr); return json({ error: 'save failed' }, 500) }

  await supabase.from('raw_lead_score').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', raw?.id)
  return json({ received: true, faixa: (score as any).faixa, pontos_total: (score as any).pontos_total }, 200)
})
```
Deploy com `deploy_edge_function` (**verify_jwt = false**). Testar com `curl`/Postman usando o JSON da
seção 3 **antes** de mexer no formulário; conferir `SELECT email, pontos_total, faixa FROM lead_score`.

### FASE 5 — Alterar o formulário (landing — FORA deste repositório)
No `avfEnviarFormulario()`, **antes** do `fetch` que vai ao AC, adicionar o envio paralelo (fire-and-forget,
`keepalive: true` para sobreviver ao redirect):
```js
// === Envio paralelo para o Financial BI (lead score) ===
const WEBHOOK_BI = 'https://zbfcrnsfygovzmncmmjz.supabase.co/functions/v1/webhook-lead-score';
const respostas = {};
for (const fieldName of Object.keys(FIELD_MAPPING)) {           // FIELD_MAPPING já tem os 14 campos
  const sel = document.querySelector(`#antivirus-form-container input[name="${fieldName}"]:checked`);
  if (sel) respostas[fieldName] = sel.value;
}
fetch(WEBHOOK_BI, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, nome, telefone, respostas }),
  keepalive: true,
}).catch(e => console.error('lead score:', e));
// ↓ segue o envio normal para o ActiveCampaign (NÃO mexer)
```
> O envio ao AC permanece exatamente como está. Se o webhook do BI falhar, o `.catch` evita
> qualquer impacto no fluxo do lead (redirect acontece normalmente).

### FASE 6 — Exibir no /crm
- Ler antes: `crm/page.tsx`, `_components/CrmClient.tsx`, `_components/CrmTabela.tsx`.
- No `CrmClient`, após obter os leads, buscar os scores e mesclar por `contato_id`:
  ```ts
  const ids = leads.map(l => l.contato_id).filter(Boolean)
  const { data: scores } = await supabase.from('lead_score')
    .select('contato_id, pontos_total, faixa').in('contato_id', ids)
  ```
  > Se a lista passar de ~300 ids, paginar em lotes ou criar RPC `get_lead_scores(ids uuid[])`
  > (lição do `.in()` — ver `get_compradores_semana`).
- Adicionar **coluna "Lead Score"** no `CrmTabela`: badge da faixa + pontos (cores: A+/A verde,
  B amarelo, C azul, D cinza). Tooltip opcional com a ação recomendada. **Aditivo** — não mexer em
  Props/colunas existentes sem checar todos os usos.

### FASE 7 — Docs + testes (ver seções 7 e 8)

---

## 7. O que NÃO fazer
- ❌ Não alterar `crm`, `process_venda`, `job-activecampaign-webn`, nem qualquer cron/edge function existente.
- ❌ Não adicionar campos de pesquisa na tabela `crm`.
- ❌ Não mexer no envio ao ActiveCampaign do formulário (só **adicionar** o envio paralelo).
- ❌ Não esquecer o **CORS/OPTIONS** na Edge Function (ela é chamada do browser).
- ❌ Não commitar/pushar sem o dono pedir.

---

## 8. Testes obrigatórios (antes de "pronto")
1. **RPC**: `calcular_lead_score` com casos conhecidos (A+, D, resposta inexistente → 0).
2. **Edge Function via curl** (contrato da seção 3): cria linha em `lead_score` com faixa coerente.
3. **CORS**: `OPTIONS` responde 200 com `Access-Control-Allow-Origin`.
4. **Form real**: preencher o formulário → conferir `lead_score` populando + AC recebendo normal.
5. **Re-envio**: mesmo email com respostas diferentes → `lead_score` atualiza (onConflict).
6. **Lead novo**: sem cadastro prévio → `upsert_contato` cria o contato e pontua.
7. **Sem email**: webhook grava raw e responde 400, sem quebrar.
8. **/crm**: badge aparece; leads sem score não quebram a página.
9. **Build**: `npm run build` sem erros.

---

## 9. Documentação a atualizar ao final
- `docs/TABELAS.md` → `raw_lead_score`, `lead_score`, `lead_score_pontos`.
- `docs/FUNCOES-SQL.md` → `calcular_lead_score`.
- `docs/EDGE-FUNCTIONS.md` → `webhook-lead-score` (nota: tem CORS, chamada do browser).
- `docs/INTEGRACOES.md` → nova entrada "Formulário WEBN (webhook inbound)".
- `docs/FRONTEND.md` → coluna Lead Score em `/crm`.
- `docs/CHANGELOG.md` → entrada padrão.
- `docs/PENDENCIAS.md` → regressão logística completa (evolução futura) + reprocessar modelo a cada
  3–4 edições; e registrar a decisão tomada para `valor R$ 150.000 a R$ 500.000`.

---

## 10. Artefatos a criar
| # | Artefato | Tipo |
|---|---|---|
| 1 | `supabase/migrations/20260602000002_lead_score_schema.sql` | Migration (3 tabelas + RLS + trigger) |
| 2 | `supabase/migrations/20260602000003_lead_score_pontos_seed.sql` | Migration (seed dos pontos) |
| 3 | `supabase/migrations/20260602000004_calcular_lead_score.sql` | Migration (RPC) |
| 4 | `supabase/functions/webhook-lead-score/index.ts` | Edge Function (Deno, com CORS) |
| 5 | Trecho de envio no formulário (landing) | JS — **fora deste repo** |
| 6 | `src/app/(autenticado)/crm/_components/CrmTabela.tsx` (+ `CrmClient.tsx`) | Frontend (coluna aditiva) |

> Numeração das migrations: confirme a última com `list_migrations` e use a sequência seguinte.
