# CHANGELOG — Financial BI

> **Registre aqui TODA mudança** antes de dar push. O `git push` é bloqueado se este arquivo
> (ou outro `.md` em `docs/`) não tiver sido atualizado junto com mudanças de código.
>
> **Formato de cada entrada** (mais recente no topo):
>
> ```
> ## [AAAA-MM-DD] Título curto da mudança — @autor
> - **O quê:** o que mudou (tabela/função/edge function/cron/frontend).
> - **Por quê:** motivo.
> - **Como testou:** o que rodou para validar (build, query, página).
> - **Impacto/risco:** o que pode ser afetado. Migração? Deploy de function? Cron alterado?
> - **Docs atualizados:** quais arquivos em docs/ foram ajustados.
> ```

---

## [2026-05-31] Habilitar RLS em 5 tabelas expostas — @tiago
- **O quê:** habilitado Row Level Security em `grupos_kpis_semana`, `sendflow_metricas`,
  `webinario_presencas`, `crm_historico_utm`, `sendflow_eventos_grupo` (migration
  `20260531000002_rls_tabelas_expostas.sql`). Policies: SELECT para `authenticated`; INSERT/UPDATE/DELETE
  para `service_role` (padrão de `crm`/`trafego`).
- **Por quê:** estavam SEM RLS → expostas à `anon` key (qualquer um com a chave pública do front lia/escrevia
  todas as linhas). Alerta `rls_disabled_in_public` (nível ERROR) no advisor de segurança do Supabase.
- **Como testou:** (1) mapeado quem lê/escreve cada tabela (front só `/grupos` e `/webnario`; escrita via
  service_role/cron-superuser, que bypassam RLS). (2) Validado no banco com `SET LOCAL ROLE authenticated`
  (lê tudo, incl. embed `contatos`) e `SET LOCAL ROLE anon` (0 linhas em todas). (3) Advisor re-rodado:
  0 erros `rls_disabled_in_public`. (4) Testado no navegador logado: `/grupos`, `/webnario`, `/dashboard`
  e `/configuracoes` mostram dados normalmente.
- **Impacto/risco:** **migração aplicada** no banco. Nenhum job/cron/trigger/webhook afetado (todos usam
  service_role ou superuser). Risco baixo e reversível (`DISABLE ROW LEVEL SECURITY`). NÃO resolve o token
  service_role em texto puro nos crons nem a rotação de chave (itens separados em PENDENCIAS).
- **Docs atualizados:** TABELAS.md (seção RLS), PENDENCIAS.md (movido p/ resolvidos), CHANGELOG.

## [2026-05-31] Abas dinâmicas do dashboard (2 tipos de mockup) — @tiago
- **O quê:** o dashboard deixou de ter abas chumbadas (`['webnario','tpw']`). Criadas as tabelas
  `dashboard_abas` (nome, tipo_mockup, ordem, ativo) e `dashboard_aba_filtros` (vínculos aba↔filtro
  por "papel": trafego/vendas/...). Nova seção **"Abas do Dashboard"** em `/configuracoes` (CRUD admin).
  O dashboard agora monta as abas a partir do banco: a aba **Webnário** segue fixa/intocada e as demais
  são clones de um **mockup** escolhido na criação. Hoje só o mockup **Venda Direta** (o antigo TPW,
  agora parametrizado por props `filtroTrafegoId`/`filtroVendasId`) está disponível; **Captação** fica
  como tipo previsto ("em breve"), sem mudança de schema futura. Novo `src/lib/dashboard-abas.ts`
  (tipos + `PAPEIS_POR_MOCKUP` + `TIPOS_MOCKUP` + `montarAbas`). Seed migra a aba TPW existente.
- **Por quê:** permitir criar vários dashboards (um por funil) sem mexer em código a cada aba,
  escolhendo o filtro de tráfego/vendas de cada aba na página de Configurações.
- **Como testou:** `npm run build` (compila + checagem de tipos OK). Migration aplicada no banco e
  conferida (tabela TPW + 2 vínculos, 8 policies, trigger updated_at). Query do dashboard simulada no
  banco retornou a aba TPW com os 2 vínculos corretos.
- **Impacto/risco:** **migração aplicada** (2 tabelas novas + seed idempotente). RLS no padrão de
  `filtros_personalizados` (SELECT autenticado; escrita só admin). FK `filtro_id` é `ON DELETE SET NULL`
  (apagar um filtro não apaga a aba — vínculo vira "sem filtro = soma tudo"). A aba TPW saiu do hardcode
  e passou a depender do seed; se a tabela for esvaziada, o dashboard mostra só o Webnário.
- **Docs atualizados:** TABELAS.md (2 tabelas + snapshot 27→29), FRONTEND.md (dashboard dinâmico +
  nova seção de config + lib), README.md (snapshot de tabelas), CHANGELOG.

## [2026-05-31] CLAUDE.md: seção de comandos comuns — @tiago
- **O quê:** adicionada seção "Comandos comuns" no topo do `CLAUDE.md` (npm install/dev/build/lint/start).
- **Por quê:** facilitar onboarding; era a única lacuna em relação ao que o `/init` cobriria.
- **Como testou:** revisão manual; sem mudança de código de sistema.
- **Impacto/risco:** nenhum (apenas documentação).
- **Docs atualizados:** CLAUDE.md, CHANGELOG.

## [2026-05-31] Hook de lembrete de docs + limpeza de segredos — @tiago
- **O quê:** (1) Hook `Stop` em `.claude/settings.json` (`.claude/hooks/lembrete-docs.sh`)
  que lembra de atualizar docs/CHANGELOG quando há mudança em src/supabase/scripts sem docs,
  com proteção anti-loop (`stop_hook_active`). (2) Removidos tokens (anon e service_role) que
  estavam em texto puro nas regras de permissão do `.claude/settings.json`. (3) Criado
  `.env.example` como modelo de variáveis (sem valores secretos).
- **Por quê:** padronizar o registro de mudanças automaticamente e evitar vazamento de chave
  de serviço caso o `settings.json` fosse commitado.
- **Como testou:** script do hook testado nos 4 cenários (anti-loop; código sem docs → lembra;
  código com docs → silencia; sem mudanças → silencia). JSON validado com Node.
- **Impacto/risco:** nenhum no sistema. `.env.local` (credenciais reais) continua intacto e
  gitignored. Tokens removidos eram sobras de curl, não credenciais usadas pelo sistema.
- **Docs atualizados:** CHANGELOG; ver também PENDENCIAS.md (alerta de rotação de chave).

## [2026-05-31] Criação da documentação e governança do projeto — @tiago
- **O quê:** criados `CLAUDE.md` (regras de fluxo) e a pasta `docs/` completa
  (README, ARQUITETURA, TABELAS, FUNCOES-SQL, EDGE-FUNCTIONS, CRONS, API-ROUTES,
  FRONTEND, INTEGRACOES, SCRIPTS, PENDENCIAS, CHANGELOG). Adicionado git hook `pre-push`
  que exige atualização de documentação e template de Pull Request.
- **Por quê:** mais pessoas/IA vão mexer no sistema; precisamos de registro único e confiável
  para não quebrar nada.
- **Como testou:** documentação gerada a partir de consultas ao **banco real** (tabelas, funções,
  crons, índices, edge functions) — não das migrations. Hook testado com push simulado.
- **Impacto/risco:** nenhum no sistema em produção (apenas arquivos novos + hook local de git).
- **Docs atualizados:** todos (criação inicial).
