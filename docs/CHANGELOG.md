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
