-- User roles table
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','editor','viewer')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.user_roles enable row level security;

-- RLS policies for user_roles
create policy "Users can view all roles"
  on public.user_roles for select
  to authenticated
  using (true);

create policy "Admins and editors can manage roles"
  on public.user_roles for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('admin','editor')
    )
  );

-- Sections (report groups)
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_index int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.sections enable row level security;

create policy "Users can view sections"
  on public.sections for select
  to authenticated
  using (true);

create policy "Admins and editors can manage sections"
  on public.sections for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('admin','editor')
    )
  );

-- Reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.sections(id) on delete set null,
  slug text unique,
  title text not null,
  description text,
  sort_index int not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reports enable row level security;

create policy "Users can view reports"
  on public.reports for select
  to authenticated
  using (true);

create policy "Admins and editors can manage reports"
  on public.reports for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('admin','editor')
    )
  );

-- Tiles (3 per report)
create table public.report_tiles (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  position int not null check (position between 1 and 3),
  title text not null,
  sql text not null,
  format text default 'number',
  decimals int default 0,
  refresh_seconds int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (report_id, position)
);

alter table public.report_tiles enable row level security;

create policy "Users can view tiles"
  on public.report_tiles for select
  to authenticated
  using (true);

create policy "Admins and editors can manage tiles"
  on public.report_tiles for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('admin','editor')
    )
  );

-- Report table (SQL query)
create table public.report_tables (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  sql text not null,
  default_page_size int default 25,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.report_tables enable row level security;

create policy "Users can view report tables"
  on public.report_tables for select
  to authenticated
  using (true);

create policy "Admins and editors can manage report tables"
  on public.report_tables for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('admin','editor')
    )
  );

-- Table column preferences
create table public.report_table_columns (
  id uuid primary key default gen_random_uuid(),
  report_table_id uuid not null references public.report_tables(id) on delete cascade,
  column_key text not null,
  label text,
  visible boolean default true,
  col_order int default 0,
  width int,
  format text default 'auto',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (report_table_id, column_key)
);

alter table public.report_table_columns enable row level security;

create policy "Users can view columns"
  on public.report_table_columns for select
  to authenticated
  using (true);

create policy "Admins and editors can manage columns"
  on public.report_table_columns for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role in ('admin','editor')
    )
  );

-- App-wide settings
create table public.app_settings (
  id int primary key default 1,
  organization_name text default 'Reports MVP',
  timezone text default 'UTC',
  check (id = 1)
);

alter table public.app_settings enable row level security;

create policy "Users can view settings"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "Admins can manage settings"
  on public.app_settings for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur 
      where ur.user_id = auth.uid() 
      and ur.role = 'admin'
    )
  );

-- Insert default settings
insert into public.app_settings (id, organization_name, timezone)
values (1, 'Reports MVP', 'UTC');

-- Demo data tables
create table public.vehicles (
  id serial primary key,
  plate text not null,
  status text not null check (status in ('moving','parked','offline')),
  last_seen_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

create policy "Users can view vehicles"
  on public.vehicles for select
  to authenticated
  using (true);

create table public.trips (
  id serial primary key,
  vehicle_id int references public.vehicles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  distance_km numeric(10,2),
  avg_speed_kmh numeric(10,2)
);

alter table public.trips enable row level security;

create policy "Users can view trips"
  on public.trips for select
  to authenticated
  using (true);

create table public.parking_events (
  id serial primary key,
  vehicle_id int references public.vehicles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min int
);

alter table public.parking_events enable row level security;

create policy "Users can view parking"
  on public.parking_events for select
  to authenticated
  using (true);

create table public.speeding_events (
  id serial primary key,
  vehicle_id int references public.vehicles(id) on delete cascade,
  event_time timestamptz not null,
  speed_kmh numeric(10,2),
  limit_kmh int
);

alter table public.speeding_events enable row level security;

create policy "Users can view speeding"
  on public.speeding_events for select
  to authenticated
  using (true);

-- Seed vehicles (30 vehicles)
insert into public.vehicles (plate, status, last_seen_at) values
('ABC-1234', 'moving', now() - interval '5 minutes'),
('XYZ-5678', 'parked', now() - interval '2 hours'),
('DEF-9012', 'offline', now() - interval '1 day'),
('GHI-3456', 'moving', now() - interval '10 minutes'),
('JKL-7890', 'parked', now() - interval '30 minutes'),
('MNO-2345', 'moving', now() - interval '15 minutes'),
('PQR-6789', 'offline', now() - interval '3 days'),
('STU-0123', 'parked', now() - interval '1 hour'),
('VWX-4567', 'moving', now() - interval '2 minutes'),
('YZA-8901', 'parked', now() - interval '45 minutes'),
('BCD-2346', 'moving', now() - interval '8 minutes'),
('EFG-6780', 'offline', now() - interval '2 days'),
('HIJ-0124', 'parked', now() - interval '3 hours'),
('KLM-4568', 'moving', now() - interval '1 minute'),
('NOP-8902', 'parked', now() - interval '20 minutes'),
('QRS-2347', 'moving', now() - interval '12 minutes'),
('TUV-6781', 'offline', now() - interval '5 days'),
('WXY-0125', 'parked', now() - interval '90 minutes'),
('ZAB-4569', 'moving', now() - interval '3 minutes'),
('CDE-8903', 'parked', now() - interval '15 minutes'),
('FGH-2348', 'moving', now() - interval '7 minutes'),
('IJK-6782', 'offline', now() - interval '1 day'),
('LMN-0126', 'parked', now() - interval '2 hours'),
('OPQ-4560', 'moving', now() - interval '4 minutes'),
('RST-8904', 'parked', now() - interval '25 minutes'),
('UVW-2349', 'moving', now() - interval '6 minutes'),
('XYZ-6783', 'offline', now() - interval '4 days'),
('ABC-0127', 'parked', now() - interval '50 minutes'),
('DEF-4561', 'moving', now() - interval '9 minutes'),
('GHI-8905', 'parked', now() - interval '35 minutes');

-- Seed trips (80 trips)
insert into public.trips (vehicle_id, start_time, end_time, distance_km, avg_speed_kmh)
select 
  (random() * 29 + 1)::int,
  now() - (random() * interval '30 days'),
  now() - (random() * interval '30 days') + (random() * interval '2 hours'),
  (random() * 100 + 5)::numeric(10,2),
  (random() * 60 + 30)::numeric(10,2)
from generate_series(1, 80);

-- Seed parking events (80 events)
insert into public.parking_events (vehicle_id, started_at, ended_at, duration_min)
select 
  (random() * 29 + 1)::int,
  now() - (random() * interval '30 days'),
  now() - (random() * interval '30 days') + (random() * interval '4 hours'),
  (random() * 240 + 10)::int
from generate_series(1, 80);

-- Seed speeding events (40 events)
insert into public.speeding_events (vehicle_id, event_time, speed_kmh, limit_kmh)
select 
  (random() * 29 + 1)::int,
  now() - (random() * interval '30 days'),
  (random() * 40 + 80)::numeric(10,2),
  case 
    when random() < 0.5 then 50
    when random() < 0.8 then 80
    else 100
  end
from generate_series(1, 40);