-- Planning Projects — armazenamento de documentos (mesma estrutura do banco do artefato) com RLS
create schema if not exists app;

create table if not exists public.docs (
  path text primary key,
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists docs_col_idx on public.docs (col);
alter table public.docs enable row level security;

-- administradores fixos (dono do sistema)
create table if not exists app.admins (email text primary key);
insert into app.admins(email) values ('oscar-porto@hotmail.com') on conflict do nothing;

create or replace function app.email() returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- cadastro do usuário em usuarios/<id> (pelo e-mail)
create or replace function app.cadastro() returns jsonb language sql stable security definer set search_path = public, app as $$
  select d.data from public.docs d
   where d.col = 'usuarios' and d.id <> '_cfg' and lower(d.data ->> 'email') = app.email()
   limit 1
$$;

create or replace function app.docs_admin() returns boolean language sql stable security definer set search_path = public, app as $$
  select app.email() <> '' and (
    exists (select 1 from app.admins a where a.email = app.email())
    or coalesce((app.cadastro() ->> 'admin')::boolean, false))
$$;

create or replace function app.is_dono() returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from app.admins a where a.email = app.email())
$$;

-- nível no projeto: 'E' editar, 'V' visualizar, '' sem acesso
create or replace function app.nivel_proj(pid text) returns text language sql stable security definer set search_path = public, app as $$
  select case
    when app.docs_admin() then 'E'
    when app.cadastro() is not null then
      case when app.cadastro() -> 'projetos' ? pid then coalesce(app.cadastro() -> 'projetos' ->> pid, '')
           else coalesce(app.cadastro() ->> 'projPadrao', '') end
    when coalesce((select d.data ->> 'semCadastro' from public.docs d where d.path = 'usuarios/_cfg'), 'V') = 'N' then ''
    else 'V' end
$$;

create or replace function app.pode_ler(p text) returns boolean language sql stable security definer set search_path = public, app as $$
  select case
    when p like 'rascunhos/%' then app.docs_admin()
    when p like 'acessos/%' then app.docs_admin() or p = 'acessos/' || auth.uid()::text
    when p like 'usuarios/%' then app.docs_admin() or p = 'usuarios/_cfg'
      or exists (select 1 from public.docs d where d.path = p and lower(d.data ->> 'email') = app.email())
    when p like 'projetos/%' then app.nivel_proj(split_part(p, '/', 2)) <> ''
    else true end
$$;

create or replace function app.pode_gravar(p text) returns boolean language sql stable security definer set search_path = public, app as $$
  select app.docs_admin()
      or p = 'acessos/' || auth.uid()::text
      or (p like 'projetos/%' and app.nivel_proj(split_part(p, '/', 2)) = 'E')
$$;

drop policy if exists docs_ler on public.docs;
drop policy if exists docs_inserir on public.docs;
drop policy if exists docs_alterar on public.docs;
drop policy if exists docs_excluir on public.docs;
create policy docs_ler on public.docs for select to authenticated using (app.pode_ler(path));
create policy docs_inserir on public.docs for insert to authenticated with check (app.pode_gravar(path));
create policy docs_alterar on public.docs for update to authenticated using (app.pode_gravar(path)) with check (app.pode_gravar(path));
create policy docs_excluir on public.docs for delete to authenticated using (app.pode_gravar(path));

create or replace function app.toca() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists docs_toca on public.docs;
create trigger docs_toca before insert or update on public.docs for each row execute function app.toca();

-- e-mails das contas (último acesso no Cadastro de usuários) — só administradores
create or replace function public.perfis_emails(ids uuid[]) returns table(id uuid, email text)
language sql stable security definer set search_path = public, app, auth as $$
  select u.id, u.email::text from auth.users u where u.id = any(ids) and app.docs_admin()
$$;
revoke all on function public.perfis_emails(uuid[]) from public, anon;
grant execute on function public.perfis_emails(uuid[]) to authenticated;
grant usage on schema app to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
revoke all on public.docs from anon;

alter function app.email() set search_path = '';
alter function app.toca() set search_path = '';
