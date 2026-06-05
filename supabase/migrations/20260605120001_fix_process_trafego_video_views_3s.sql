-- Corrige process_trafego: passa a popular video_views_3s a partir de actions[].video_view
-- (o "Video View / 3s" do Meta). A coluna thruplays lia 'video_thruplay_watched' (inexistente)
-- e ficava 0 — agora também recebe o mesmo valor (compatibilidade; ninguém no front depende dela).
-- Base da função: versão REAL em produção (não o arquivo local antigo). Mantém todo o resto idêntico.
CREATE OR REPLACE FUNCTION public.process_trafego(p_raw_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_payload         jsonb;
  v_actions         jsonb;
  v_ad_id           text;
  v_existing_id     uuid;
  v_existing_spend  numeric;
  v_existing_raw_id uuid;
  v_lpv             bigint;
  v_vv3             bigint;
BEGIN
  SELECT payload INTO v_payload FROM raw_trafego WHERE id = p_raw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'raw_trafego não encontrado: %', p_raw_id;
  END IF;

  v_actions := COALESCE(v_payload->'actions', '[]'::jsonb);
  v_ad_id   := NULLIF(v_payload->>'ad_id', '');
  v_lpv     := (SELECT (e->>'value')::bigint FROM jsonb_array_elements(v_actions) e WHERE e->>'action_type' = 'landing_page_view' LIMIT 1);
  -- "Video View" (3s) do Meta vem dentro de actions como action_type='video_view'
  v_vv3     := (SELECT (e->>'value')::bigint FROM jsonb_array_elements(v_actions) e WHERE e->>'action_type' = 'video_view' LIMIT 1);

  IF v_ad_id IS NOT NULL THEN
    SELECT id, amount_spent, raw_id
      INTO v_existing_id, v_existing_spend, v_existing_raw_id
      FROM trafego
     WHERE ad_account_id = v_payload->>'ad_account_id'
       AND ad_id  = v_ad_id
       AND date_ref = (v_payload->>'date_start')::date
     LIMIT 1;

    IF FOUND THEN
      IF v_existing_spend >= COALESCE(NULLIF(v_payload->>'spend', '')::numeric, 0) THEN
        -- Spend igual ou menor — deduplicado, mas preenche landing_page_views se estava NULL
        UPDATE trafego
           SET landing_page_views = COALESCE(landing_page_views, v_lpv)
         WHERE id = v_existing_id
           AND landing_page_views IS NULL;

        UPDATE raw_trafego SET processed = true, processed_at = now(), error = NULL WHERE id = p_raw_id;
        RETURN;
      ELSE
        UPDATE raw_trafego SET processed = true, processed_at = now() WHERE id = v_existing_raw_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO trafego (
    ad_account_id, ad_id, adset_id, campaign_id,
    campaign_name, adset_name, ad_name, date_ref,
    impressions, reach, frequency, amount_spent,
    link_clicks, landing_page_views,
    leads, purchases, registrations_completed,
    checkouts_initiated, adds_to_cart, thruplays,
    video_views_3s,
    video_watches_25, video_watches_50, video_watches_75,
    video_watches_95, video_watches_100,
    raw_id
  ) VALUES (
    v_payload->>'ad_account_id',
    v_ad_id,
    NULLIF(v_payload->>'adset_id',    ''),
    NULLIF(v_payload->>'campaign_id', ''),
    v_payload->>'campaign_name',
    v_payload->>'adset_name',
    v_payload->>'ad_name',
    (v_payload->>'date_start')::date,
    NULLIF(v_payload->>'impressions', '')::bigint,
    NULLIF(v_payload->>'reach',       '')::bigint,
    NULLIF(v_payload->>'frequency',   '')::numeric,
    NULLIF(v_payload->>'spend',       '')::numeric,
    COALESCE(
      NULLIF(v_payload->>'inline_link_clicks', '')::bigint,
      NULLIF(v_payload->>'link_clicks',        '')::bigint,
      NULLIF(v_payload->>'clicks',             '')::bigint
    ),
    v_lpv,
    COALESCE((SELECT (e->>'value')::numeric FROM jsonb_array_elements(v_actions) e WHERE e->>'action_type' = 'offsite_conversion.fb_pixel_lead'    LIMIT 1), 0),
    COALESCE((SELECT (e->>'value')::numeric FROM jsonb_array_elements(v_actions) e WHERE e->>'action_type' = 'offsite_conversion.fb_pixel_purchase' LIMIT 1), 0),
    COALESCE((SELECT (e->>'value')::numeric FROM jsonb_array_elements(v_actions) e WHERE e->>'action_type' = 'omni_complete_registration'           LIMIT 1), 0),
    COALESCE((SELECT (e->>'value')::numeric FROM jsonb_array_elements(v_actions) e WHERE e->>'action_type' = 'initiate_checkout'                    LIMIT 1), 0),
    COALESCE((SELECT (e->>'value')::numeric FROM jsonb_array_elements(v_actions) e WHERE e->>'action_type' = 'add_to_cart'                          LIMIT 1), 0),
    -- thruplays (legado): recebe o mesmo 3s para deixar de ficar 0 (ninguém no front depende disso)
    COALESCE(v_vv3, 0),
    v_vv3,
    NULLIF(v_payload->'video_p25_watched_actions' ->0->>'value', '')::numeric,
    NULLIF(v_payload->'video_p50_watched_actions' ->0->>'value', '')::numeric,
    NULLIF(v_payload->'video_p75_watched_actions' ->0->>'value', '')::numeric,
    NULLIF(v_payload->'video_p95_watched_actions' ->0->>'value', '')::numeric,
    NULLIF(v_payload->'video_p100_watched_actions'->0->>'value', '')::numeric,
    p_raw_id
  )
  ON CONFLICT (ad_account_id, ad_id, date_ref) WHERE ad_id IS NOT NULL
  DO UPDATE SET
    adset_id                = EXCLUDED.adset_id,
    campaign_id             = EXCLUDED.campaign_id,
    campaign_name           = EXCLUDED.campaign_name,
    adset_name              = EXCLUDED.adset_name,
    ad_name                 = EXCLUDED.ad_name,
    impressions             = EXCLUDED.impressions,
    reach                   = EXCLUDED.reach,
    frequency               = EXCLUDED.frequency,
    amount_spent            = GREATEST(trafego.amount_spent, EXCLUDED.amount_spent),
    link_clicks             = EXCLUDED.link_clicks,
    landing_page_views      = EXCLUDED.landing_page_views,
    leads                   = EXCLUDED.leads,
    purchases               = EXCLUDED.purchases,
    registrations_completed = EXCLUDED.registrations_completed,
    checkouts_initiated     = EXCLUDED.checkouts_initiated,
    adds_to_cart            = EXCLUDED.adds_to_cart,
    thruplays               = EXCLUDED.thruplays,
    video_views_3s          = EXCLUDED.video_views_3s,
    video_watches_25        = EXCLUDED.video_watches_25,
    video_watches_50        = EXCLUDED.video_watches_50,
    video_watches_75        = EXCLUDED.video_watches_75,
    video_watches_95        = EXCLUDED.video_watches_95,
    video_watches_100       = EXCLUDED.video_watches_100,
    raw_id                  = EXCLUDED.raw_id;

  UPDATE raw_trafego
    SET processed = true, processed_at = now(), error = NULL
   WHERE id = p_raw_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE raw_trafego SET error = SQLERRM WHERE id = p_raw_id;
  RAISE;
END;
$function$;
