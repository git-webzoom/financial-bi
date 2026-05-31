---
description: Carrega as regras do projeto e prepara a IA para começar com segurança
---

Você está começando uma tarefa no projeto **Financial BI**. Antes de qualquer coisa:

1. **Leia o `CLAUDE.md`** (raiz) e o **`docs/README.md`**. Eles contêm as regras
   obrigatórias e o índice de toda a documentação do sistema.

2. **Leia o(s) documento(s) da área** que a tarefa vai envolver, em `docs/`:
   - Tabela/coluna → `docs/TABELAS.md`
   - Função SQL/RPC ou trigger → `docs/FUNCOES-SQL.md`
   - Edge Function (Deno) → `docs/EDGE-FUNCTIONS.md`
   - Cron/agendamento → `docs/CRONS.md`
   - Rota Next.js `/api` → `docs/API-ROUTES.md`
   - Frontend/página/componente → `docs/FRONTEND.md`
   - Integração externa → `docs/INTEGRACOES.md`
   - Problemas conhecidos → `docs/PENDENCIAS.md`

Regras que você DEVE seguir sem exceção:

- **A fonte da verdade é o BANCO REAL (Supabase), não as migrations locais.**
  Nunca afirme que algo existe ou não existe sem confirmar no banco
  (`list_tables` / `execute_sql`). Já houve erros por confiar só nos arquivos.
- **Não altere nada antes de me explicar** o que vai mudar, por quê e o que pode
  ser afetado. Espere minha confirmação.
- **Teste de verdade** (build / query / página) antes de dizer que está pronto.
- Ao terminar, **atualize os docs da área afetada e adicione uma entrada em
  `docs/CHANGELOG.md`**.
- **Nunca** faça commit ou push sem eu pedir explicitamente.
- Edge Functions são **Deno**, não Node.js. CRM e Webinário são entidades
  **distintas** — nunca unifique.

Agora, antes de começar:
- Confirme em 2-3 linhas o que entendeu das regras.
- Diga **qual documento você vai ler primeiro** com base na tarefa.
- Se eu ainda não descrevi a tarefa, pergunte o que eu preciso.
