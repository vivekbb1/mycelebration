UPDATE public.events e SET sort_order = r.n FROM (
  SELECT id, row_number() OVER (PARTITION BY invite_id ORDER BY event_date NULLS LAST, start_time NULLS LAST, sort_order) n FROM public.events
) r WHERE r.id = e.id;