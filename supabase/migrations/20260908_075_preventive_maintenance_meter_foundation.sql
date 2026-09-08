-- Modern preventive-maintenance foundation, additive to legacy BM03 maintenance_plan.
-- Keeps existing IATF forms intact while adding UpKeep/Atlas-class schedules and meters.

create table if not exists public.cmms_checklist_template (
  template_id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_checklist_template_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.cmms_checklist_template_item (
  template_item_id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.cmms_checklist_template(template_id) on delete cascade,
  sequence_no integer not null default 1,
  item_type text not null default 'CHECK',
  label text not null,
  description text,
  required boolean not null default false,
  unit text,
  min_value numeric,
  max_value numeric,
  choices jsonb not null default '[]'::jsonb,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cmms_checklist_template_item_type_valid check (item_type in ('CHECK','TEXT','NUMBER','PASS_FAIL','METER','PHOTO','SIGNATURE')),
  constraint cmms_checklist_template_item_label_not_blank check (btrim(label) <> ''),
  constraint cmms_checklist_template_item_range_valid check (min_value is null or max_value is null or min_value <= max_value),
  unique(template_id, sequence_no)
);

create table if not exists public.cmms_meter (
  meter_id uuid primary key default gen_random_uuid(),
  equipment_id text not null references public.equipment_master(equipment_id) on delete cascade,
  name text not null,
  meter_type text not null default 'COUNTER',
  unit text not null,
  rollover_value numeric,
  active boolean not null default true,
  archived_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_meter_name_not_blank check (btrim(name) <> ''),
  constraint cmms_meter_unit_not_blank check (btrim(unit) <> ''),
  constraint cmms_meter_type_valid check (meter_type in ('COUNTER','HOURS','CYCLES','DISTANCE','ENERGY','CUSTOM')),
  constraint cmms_meter_rollover_positive check (rollover_value is null or rollover_value > 0)
);

create table if not exists public.cmms_meter_reading (
  reading_id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references public.cmms_meter(meter_id) on delete cascade,
  reading_value numeric not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  source_type text not null default 'MANUAL',
  note text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cmms_meter_reading_source_valid check (source_type in ('MANUAL','IMPORT','IOT','WORK_ORDER','API'))
);

create table if not exists public.cmms_pm_schedule (
  schedule_id uuid primary key default gen_random_uuid(),
  equipment_id text not null references public.equipment_master(equipment_id) on delete cascade,
  legacy_plan_id text references public.maintenance_plan(plan_id) on delete set null,
  checklist_template_id uuid references public.cmms_checklist_template(template_id) on delete set null,
  title text not null,
  description text,
  schedule_type text not null default 'TIME',
  priority text,
  active boolean not null default true,
  start_at timestamptz not null default now(),
  next_due_at timestamptz,
  time_interval integer,
  time_unit text,
  meter_id uuid references public.cmms_meter(meter_id) on delete set null,
  meter_interval numeric,
  next_meter_due numeric,
  lead_time_minutes integer not null default 0,
  default_person_id uuid references public.cmms_person(person_id) on delete set null,
  default_team_id uuid references public.cmms_team(team_id) on delete set null,
  last_generated_at timestamptz,
  last_generated_work_order_id text references public.maintenance_work_order(work_order_id) on delete set null,
  archived_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_pm_schedule_title_not_blank check (btrim(title) <> ''),
  constraint cmms_pm_schedule_type_valid check (schedule_type in ('TIME','METER','EITHER')),
  constraint cmms_pm_schedule_time_unit_valid check (time_unit is null or time_unit in ('HOURS','DAYS','WEEKS','MONTHS','YEARS')),
  constraint cmms_pm_schedule_time_interval_positive check (time_interval is null or time_interval > 0),
  constraint cmms_pm_schedule_meter_interval_positive check (meter_interval is null or meter_interval > 0),
  constraint cmms_pm_schedule_lead_nonnegative check (lead_time_minutes >= 0),
  constraint cmms_pm_schedule_time_config check (
    schedule_type = 'METER' or (time_interval is not null and time_unit is not null and next_due_at is not null)
  ),
  constraint cmms_pm_schedule_meter_config check (
    schedule_type = 'TIME' or (meter_id is not null and meter_interval is not null and next_meter_due is not null)
  )
);

create index if not exists cmms_checklist_template_active_idx on public.cmms_checklist_template(active, archived_at, name);
create index if not exists cmms_checklist_template_item_template_idx on public.cmms_checklist_template_item(template_id, sequence_no);
create index if not exists cmms_meter_equipment_idx on public.cmms_meter(equipment_id, active, archived_at);
create index if not exists cmms_meter_reading_meter_idx on public.cmms_meter_reading(meter_id, recorded_at desc);
create index if not exists cmms_pm_schedule_due_idx on public.cmms_pm_schedule(active, archived_at, next_due_at);
create index if not exists cmms_pm_schedule_meter_idx on public.cmms_pm_schedule(meter_id, active, archived_at, next_meter_due);
create index if not exists cmms_pm_schedule_equipment_idx on public.cmms_pm_schedule(equipment_id, active);

-- Public-schema Data API tables: explicit RLS and read policies.
do $$
declare t text;
begin
  foreach t in array array[
    'cmms_checklist_template','cmms_checklist_template_item','cmms_meter','cmms_meter_reading','cmms_pm_schedule'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)',
      t || '_read', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_app_role() in (''MANAGER'',''ADMIN'')) with check (public.current_app_role() in (''MANAGER'',''ADMIN''))',
      t || '_manage', t
    );
  end loop;
end $$;

-- Maintenance/Supervisor may add meter readings without getting master-data write access.
drop policy if exists cmms_meter_reading_insert on public.cmms_meter_reading;
create policy cmms_meter_reading_insert on public.cmms_meter_reading
for insert to authenticated
with check (public.current_app_role() in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN'));

revoke all on table public.cmms_checklist_template from anon;
revoke all on table public.cmms_checklist_template_item from anon;
revoke all on table public.cmms_meter from anon;
revoke all on table public.cmms_meter_reading from anon;
revoke all on table public.cmms_pm_schedule from anon;
grant select on table public.cmms_checklist_template to authenticated;
grant select on table public.cmms_checklist_template_item to authenticated;
grant select on table public.cmms_meter to authenticated;
grant select, insert on table public.cmms_meter_reading to authenticated;
grant select on table public.cmms_pm_schedule to authenticated;

comment on table public.cmms_pm_schedule is 'Normalized preventive-maintenance schedules. Legacy BM03 maintenance_plan remains authoritative for existing IATF records and may be linked through legacy_plan_id.';
