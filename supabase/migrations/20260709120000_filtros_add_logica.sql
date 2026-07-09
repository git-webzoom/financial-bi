-- Adiciona a lógica de combinação das regras (AND/OR) ao filtro personalizado.
-- Até aqui as regras de um filtro eram SEMPRE combinadas com AND (implícito no encadeamento
-- das condições PostgREST). Esta coluna permite escolher "todas as regras" (and) ou
-- "qualquer regra" (or) por filtro inteiro.
--
-- DEFAULT 'and' faz o backfill dos filtros já existentes → comportamento preservado.
-- Valor minúsculo para bater com o resto do código (modulo/operador são minúsculos).
ALTER TABLE public.filtros_personalizados
  ADD COLUMN IF NOT EXISTS logica text NOT NULL DEFAULT 'and'
  CHECK (logica IN ('and', 'or'));
