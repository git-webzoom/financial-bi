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
