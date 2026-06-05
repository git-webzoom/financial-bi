-- Adiciona a coluna que guarda o "Video View" (3s) do Meta, hoje perdido.
-- O Meta entrega esse número em payload->'actions' como action_type='video_view'.
-- A coluna legada thruplays tentava ler 'video_thruplay_watched' (inexistente) e ficava sempre 0.
-- Hook Rate = video_views_3s / impressions ; Hold Rate = video_watches_75 / video_views_3s.
ALTER TABLE public.trafego
  ADD COLUMN IF NOT EXISTS video_views_3s bigint;

COMMENT ON COLUMN public.trafego.video_views_3s IS
  'Video View (3s) do Meta, extraído de raw_trafego.payload->actions[video_view]. Base do Hook Rate (÷ impressions) e do Hold Rate (video_watches_75 ÷ este). Substitui o uso de thruplays (que ficava 0 por bug de coleta). Origem: Meta Ads.';
