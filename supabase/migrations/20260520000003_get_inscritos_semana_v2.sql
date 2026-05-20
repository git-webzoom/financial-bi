-- Remove workaround de filtro tag_ac — não necessário após separação das tabelas
-- webinario_inscritos só tem leads AC; leads Hotwebnar ficam em webinario_presencas
CREATE OR REPLACE FUNCTION public.get_inscritos_semana(p_numero integer)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT
      wi.id,
      wi.numero_semana,
      wi.data_inscricao,
      wi.utm_source,
      wi.utm_campaign,
      wi.utm_medium,
      wi.utm_content,
      wi.utm_term,
      wi.utm_id,
      wi.crm_id,
      wi.contato_id,
      COALESCE(c.email,    ct.email)    AS crm_email,
      COALESCE(c.nome,     ct.nome)     AS crm_nome,
      COALESCE(c.telefone, ct.telefone) AS crm_telefone,
      c.temperatura AS crm_temperatura,
      c.estado      AS crm_estado,
      c.cidade      AS crm_cidade,
      c.data_cadastro        AS crm_data_cadastro,
      c.emails_enviados      AS crm_emails_enviados,
      c.emails_abertos       AS crm_emails_abertos,
      c.cliques_email        AS crm_cliques_email,
      c.ultima_interacao     AS crm_ultima_interacao,
      c.data_abertura_email  AS crm_data_abertura_email,
      c.ultimo_clique        AS crm_ultimo_clique,
      c.ultimo_envio_email   AS crm_ultimo_envio_email,
      c.limite_engajamento   AS crm_limite_engajamento,
      c.numeros_recadastro   AS crm_numeros_recadastro
    FROM webinario_inscritos wi
    LEFT JOIN crm c  ON c.id = wi.crm_id
    LEFT JOIN contatos ct ON ct.id = wi.contato_id
    WHERE wi.numero_semana = p_numero
    ORDER BY wi.data_inscricao DESC
  ) t;
$function$
