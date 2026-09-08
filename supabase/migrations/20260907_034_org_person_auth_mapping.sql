-- Canonical mapping between organization people and authenticated accounts.
-- Enables reliable "My work" filtering without matching display names.

alter table public.org_people
  add column if not exists auth_email text;

update public.org_people
set auth_email = lower(trim(auth_email))
where auth_email is not null and trim(auth_email) <> '';

create unique index if not exists org_people_auth_email_unique
  on public.org_people (lower(auth_email))
  where auth_email is not null and trim(auth_email) <> '';

alter table public.org_people
  drop constraint if exists org_people_auth_email_format;

alter table public.org_people
  add constraint org_people_auth_email_format
  check (auth_email is null or trim(auth_email) = '' or auth_email = lower(trim(auth_email)));
