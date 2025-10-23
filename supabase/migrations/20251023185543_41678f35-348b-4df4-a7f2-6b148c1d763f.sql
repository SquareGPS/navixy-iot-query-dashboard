-- Function to execute SQL safely
CREATE OR REPLACE FUNCTION public.execute_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE format('SELECT jsonb_agg(row_to_json(t.*)) FROM (%s) t', query) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Seed admin user role (you'll need to sign up with admin@example.com first)
-- This will be added after first signup

-- Seed sections
INSERT INTO public.sections (id, name, sort_index) VALUES
(gen_random_uuid(), 'Movement', 1),
(gen_random_uuid(), 'Driving Quality', 2);

-- Get section IDs
DO $$
DECLARE
  movement_section_id uuid;
  quality_section_id uuid;
  fleet_report_id uuid;
  speeding_report_id uuid;
BEGIN
  SELECT id INTO movement_section_id FROM public.sections WHERE name = 'Movement' LIMIT 1;
  SELECT id INTO quality_section_id FROM public.sections WHERE name = 'Driving Quality' LIMIT 1;

  -- Insert Fleet Status report
  INSERT INTO public.reports (id, section_id, slug, title, description, sort_index)
  VALUES (gen_random_uuid(), movement_section_id, 'fleet-status', 'Fleet Status', 'Real-time overview of vehicle statuses', 1)
  RETURNING id INTO fleet_report_id;

  -- Insert tiles for Fleet Status
  INSERT INTO public.report_tiles (report_id, position, title, sql, format, decimals) VALUES
  (fleet_report_id, 1, 'Moving', 'select count(*)::int from public.vehicles where status = ''moving''', 'number', 0),
  (fleet_report_id, 2, 'Parked', 'select count(*)::int from public.vehicles where status = ''parked''', 'number', 0),
  (fleet_report_id, 3, 'Offline', 'select count(*)::int from public.vehicles where status = ''offline''', 'number', 0);

  -- Insert table for Fleet Status
  INSERT INTO public.report_tables (report_id, sql, default_page_size)
  VALUES (fleet_report_id, 'select id, plate, status, last_seen_at from public.vehicles order by last_seen_at desc', 25);

  -- Insert Speeding Violations report
  INSERT INTO public.reports (id, section_id, slug, title, description, sort_index)
  VALUES (gen_random_uuid(), quality_section_id, 'speeding-violations', 'Speeding Violations', 'Track and analyze speeding incidents', 1)
  RETURNING id INTO speeding_report_id;

  -- Insert tiles for Speeding
  INSERT INTO public.report_tiles (report_id, position, title, sql, format, decimals) VALUES
  (speeding_report_id, 1, 'Last 7 Days', 'select count(*)::int from public.speeding_events where event_time >= now() - interval ''7 days''', 'number', 0),
  (speeding_report_id, 2, 'Avg Over Limit', 'select coalesce(avg(speed_kmh - limit_kmh),0)::numeric(10,2) from public.speeding_events', 'decimal', 2),
  (speeding_report_id, 3, 'Vehicles Affected', 'select count(distinct vehicle_id)::int from public.speeding_events', 'number', 0);

  -- Insert table for Speeding
  INSERT INTO public.report_tables (report_id, sql, default_page_size)
  VALUES (speeding_report_id, 'select se.id, v.plate, se.event_time, se.speed_kmh, se.limit_kmh, (se.speed_kmh - se.limit_kmh) as over_kmh from public.speeding_events se join public.vehicles v on v.id = se.vehicle_id order by se.event_time desc', 25);
END $$;