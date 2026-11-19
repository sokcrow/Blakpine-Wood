-- Portal independiente de mapas, guardados y motores. Aplicar con el rol de migraciones.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists bw_private;
revoke all on schema bw_private from public, anon, authenticated;
grant usage on schema bw_private to authenticated;

create table public.bw_campaigns (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 1 and 80),
 ruleset text not null check (ruleset in ('legacy','dnd','moon-system')),
 status text not null default 'active' check (status in ('active','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index bw_campaigns_owner on public.bw_campaigns(owner_id);
create table public.bw_memberships (
 campaign_id uuid not null references public.bw_campaigns(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check (status in ('active','expelled')),
 joined_at timestamptz not null default now(),
 expelled_at timestamptz,
 primary key (campaign_id,user_id),
 check ((status='expelled') = (expelled_at is not null))
);
create index bw_memberships_user on public.bw_memberships(user_id,campaign_id) where status='active';
create table public.bw_invitations (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.bw_campaigns(id) on delete cascade,
 code_hash bytea not null unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 revoked_at timestamptz
);
create index bw_invitations_campaign on public.bw_invitations(campaign_id);

alter table public.bw_campaigns enable row level security;
alter table public.bw_memberships enable row level security;
alter table public.bw_invitations enable row level security;
revoke all on public.bw_campaigns,public.bw_memberships,public.bw_invitations from public,anon,authenticated;
grant select on public.bw_campaigns,public.bw_memberships to authenticated;

-- SECURITY DEFINER evita recursión entre las políticas; nunca acepta una cuenta del cliente.
create function bw_private.is_dm(p_campaign uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bw_campaigns where id=p_campaign and owner_id=auth.uid());
$$;
create function bw_private.can_read(p_campaign uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bw_campaigns c where c.id=p_campaign and
 (c.owner_id=auth.uid() or exists(select 1 from public.bw_memberships m
 where m.campaign_id=c.id and m.user_id=auth.uid() and m.status='active')));
$$;
revoke all on function bw_private.is_dm(uuid),bw_private.can_read(uuid) from public,anon,authenticated;
grant execute on function bw_private.is_dm(uuid),bw_private.can_read(uuid) to authenticated;
create policy bw_campaign_read on public.bw_campaigns for select to authenticated using (bw_private.can_read(id));
create policy bw_member_read on public.bw_memberships for select to authenticated
 using (bw_private.is_dm(campaign_id) or (user_id=auth.uid() and status='active'));

create function public.bw_create_campaign(p_name text,p_ruleset text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'BW_AUTH_REQUIRED'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then raise exception 'BW_INVALID_NAME'; end if;
 -- Moon es visible pero no se habilita ni siquiera mediante peticiones directas.
 if p_ruleset is null or p_ruleset not in ('legacy','dnd') then raise exception 'BW_RULESET_UNAVAILABLE'; end if;
 insert into public.bw_campaigns(owner_id,name,ruleset) values(auth.uid(),btrim(p_name),p_ruleset) returning id into v_id;
 return v_id;
end; $$;

create function public.bw_create_invitation(p_campaign uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_code text; v_inv public.bw_invitations;
begin
 perform 1 from public.bw_campaigns where id=p_campaign and owner_id=auth.uid() and status='active' for update;
 if not found then raise exception 'BW_DM_REQUIRED'; end if;
 v_code=encode(extensions.gen_random_bytes(24),'hex');
 insert into public.bw_invitations(campaign_id,code_hash)
 values(p_campaign,extensions.digest(v_code,'sha256')) returning * into v_inv;
 return jsonb_build_object('id',v_inv.id,'code',v_code,'expires_at',v_inv.expires_at);
end; $$;

create function public.bw_list_invitations(p_campaign uuid)
returns table(id uuid,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not bw_private.is_dm(p_campaign) then raise exception 'BW_DM_REQUIRED'; end if;
 return query select i.id,i.created_at,i.expires_at,i.revoked_at from public.bw_invitations i
 where i.campaign_id=p_campaign order by i.created_at desc;
end; $$;

create function public.bw_join_campaign(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_campaign uuid; v_status text;
begin
 if auth.uid() is null then raise exception 'BW_AUTH_REQUIRED'; end if;
 if p_code is null or p_code !~ '^[0-9a-fA-F]{48}$' then raise exception 'BW_INVITATION_INVALID'; end if;
 select i.campaign_id into v_campaign from public.bw_invitations i
 where i.code_hash=extensions.digest(lower(p_code),'sha256');
 if v_campaign is null then raise exception 'BW_INVITATION_INVALID'; end if;
 -- Todas las mutaciones de miembros e invitaciones bloquean primero la campaña.
 perform 1 from public.bw_campaigns where id=v_campaign and status='active' for update;
 if not found then raise exception 'BW_INVITATION_INVALID'; end if;
 perform 1 from public.bw_invitations where campaign_id=v_campaign
 and code_hash=extensions.digest(lower(p_code),'sha256') and revoked_at is null and expires_at>now();
 if not found then raise exception 'BW_INVITATION_INVALID'; end if;
 select status into v_status from public.bw_memberships where campaign_id=v_campaign and user_id=auth.uid();
 if v_status='expelled' then raise exception 'BW_MEMBERSHIP_EXPELLED'; end if;
 if not bw_private.is_dm(v_campaign) then
  insert into public.bw_memberships(campaign_id,user_id) values(v_campaign,auth.uid()) on conflict do nothing;
 end if;
 return v_campaign;
end; $$;

create function public.bw_expel_member(p_campaign uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.bw_campaigns where id=p_campaign and owner_id=auth.uid() for update;
 if not found then raise exception 'BW_DM_REQUIRED'; end if;
 if p_user=auth.uid() then raise exception 'BW_CANNOT_EXPEL_DM'; end if;
 update public.bw_memberships set status='expelled',expelled_at=now() where campaign_id=p_campaign and user_id=p_user and status='active';
 if not found then raise exception 'BW_MEMBER_NOT_FOUND'; end if;
end; $$;

create function public.bw_revoke_invitation(p_campaign uuid,p_invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.bw_campaigns where id=p_campaign and owner_id=auth.uid() for update;
 if not found then raise exception 'BW_DM_REQUIRED'; end if;
 update public.bw_invitations set revoked_at=coalesce(revoked_at,now()) where id=p_invitation and campaign_id=p_campaign;
 if not found then raise exception 'BW_INVITATION_INVALID'; end if;
end; $$;

revoke all on function public.bw_create_campaign(text,text),public.bw_create_invitation(uuid),
 public.bw_list_invitations(uuid),public.bw_join_campaign(text),public.bw_expel_member(uuid,uuid),
 public.bw_revoke_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bw_create_campaign(text,text),public.bw_create_invitation(uuid),
 public.bw_list_invitations(uuid),public.bw_join_campaign(text),public.bw_expel_member(uuid,uuid),
 public.bw_revoke_invitation(uuid,uuid) to authenticated;
commit;
