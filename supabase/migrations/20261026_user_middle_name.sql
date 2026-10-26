-- Optional middle name; existing residents retain NULL.
begin;
alter table public.users add column if not exists middle_name text;
comment on column public.users.middle_name is 'Optional resident middle name; NULL when not supplied.';
notify pgrst, 'reload schema';
commit;
