#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Financial BI — hook Stop: lembrete de documentação
# Quando o Claude termina de responder, se houver mudança em src/, supabase/ ou
# scripts/ SEM mudança correspondente em docs/, injeta um lembrete para atualizar
# a documentação e o docs/CHANGELOG.md antes de subir.
#
# Proteção anti-loop: se o stop já foi disparado por este próprio hook
# (stop_hook_active = true), não bloqueia de novo — apenas encerra.
# ─────────────────────────────────────────────────────────────────────────────

input=$(cat)

# 1) Anti-loop: se já estamos numa continuação disparada por este hook, sai.
echo "$input" | grep -q '"stop_hook_active":[[:space:]]*true' && exit 0

# 2) Vai para a raiz do projeto (fornecida pelo Claude Code).
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# 3) Estado atual do git (inclui arquivos não rastreados).
changed=$(git status --porcelain 2>/dev/null)
[ -z "$changed" ] && exit 0

# 4) Houve mudança em código? (src/ , supabase/ , scripts/)
echo "$changed" | grep -qE '^.. (src/|supabase/|scripts/)' || exit 0

# 5) Houve mudança em docs/*.md? Se sim, está tudo certo — não lembra.
echo "$changed" | grep -qE '^.. docs/.*\.md$' && exit 0

# 6) Código mudou e docs NÃO — injeta o lembrete e pede para o Claude agir.
printf '%s' '{"decision":"block","reason":"LEMBRETE (regra do projeto Financial BI): voce alterou codigo em src/, supabase/ ou scripts/ mas nao atualizou nada em docs/. Antes de finalizar ou subir: (1) atualize o documento da area afetada em docs/; (2) adicione uma entrada em docs/CHANGELOG.md. Se a mudanca ainda esta em andamento e a documentacao sera feita depois, apenas avise o usuario e siga. Detalhes em CLAUDE.md."}'
exit 0
