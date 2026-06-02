-- Remove a versão antiga get_periodo_semana(integer): tornou-se ambígua (erro 42725)
-- após a criação de get_periodo_semana(integer, text DEFAULT 'captacao') na migration
-- 20260602000008. A nova cobre as chamadas de 1 argumento via o DEFAULT 'captacao'
-- (comportamento idêntico ao original — CRM sem regressão).
DROP FUNCTION IF EXISTS public.get_periodo_semana(integer);
