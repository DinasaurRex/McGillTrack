create table if not exists public.tracker_social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  share_details boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint tracker_social_profiles_email_lower check (email = lower(email))
);

create unique index if not exists tracker_social_profiles_email_key
on public.tracker_social_profiles (email);

create table if not exists public.tracker_friend_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_email text,
  recipient_email text not null,
  recipient_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint tracker_friend_invites_sender_email_lower check (
    sender_email is null or sender_email = lower(sender_email)
  ),
  constraint tracker_friend_invites_email_lower check (recipient_email = lower(recipient_email)),
  constraint tracker_friend_invites_status_check check (status in ('pending', 'accepted', 'declined'))
);

create unique index if not exists tracker_friend_invites_pending_key
on public.tracker_friend_invites (sender_id, recipient_email)
where status = 'pending';

create table if not exists public.tracker_friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint tracker_friendships_order_check check (user_a < user_b),
  constraint tracker_friendships_distinct_check check (user_a <> user_b)
);

create unique index if not exists tracker_friendships_pair_key
on public.tracker_friendships (user_a, user_b);

create table if not exists public.tracker_availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  start_time time not null,
  end_time time not null,
  source text not null default 'schedule',
  updated_at timestamptz not null default now(),
  constraint tracker_availability_day_check check (
    day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
  ),
  constraint tracker_availability_time_check check (start_time < end_time)
);

create index if not exists tracker_availability_user_day_idx
on public.tracker_availability_windows (user_id, day, start_time);

create table if not exists public.tracker_friend_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracker_friend_team_members (
  team_id uuid not null references public.tracker_friend_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id),
  constraint tracker_friend_team_members_role_check check (role in ('owner', 'member')),
  constraint tracker_friend_team_members_status_check check (status in ('active', 'invited'))
);

alter table public.tracker_social_profiles enable row level security;
alter table public.tracker_friend_invites enable row level security;
alter table public.tracker_friendships enable row level security;
alter table public.tracker_availability_windows enable row level security;
alter table public.tracker_friend_teams enable row level security;
alter table public.tracker_friend_team_members enable row level security;

drop policy if exists "Profiles are visible to owner and friends" on public.tracker_social_profiles;
create policy "Profiles are visible to owner and friends"
on public.tracker_social_profiles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.tracker_friendships friendship
    where (select auth.uid()) in (friendship.user_a, friendship.user_b)
      and user_id in (friendship.user_a, friendship.user_b)
  )
);

drop policy if exists "Users can insert their own social profile" on public.tracker_social_profiles;
create policy "Users can insert their own social profile"
on public.tracker_social_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own social profile" on public.tracker_social_profiles;
create policy "Users can update their own social profile"
on public.tracker_social_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Invite participants can read invites" on public.tracker_friend_invites;
create policy "Invite participants can read invites"
on public.tracker_friend_invites
for select
to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or recipient_email = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Users can send friend invites" on public.tracker_friend_invites;
create policy "Users can send friend invites"
on public.tracker_friend_invites
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and recipient_email <> lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Invite participants can update invites" on public.tracker_friend_invites;
drop policy if exists "Invite recipients can update invites" on public.tracker_friend_invites;
create policy "Invite recipients can update invites"
on public.tracker_friend_invites
for update
to authenticated
using (
  recipient_id = (select auth.uid())
  or recipient_email = lower((select auth.jwt() ->> 'email'))
)
with check (
  recipient_id = (select auth.uid())
  or recipient_email = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Friends can read their friendship" on public.tracker_friendships;
create policy "Friends can read their friendship"
on public.tracker_friendships
for select
to authenticated
using ((select auth.uid()) in (user_a, user_b));

drop policy if exists "Invite participants can create friendship" on public.tracker_friendships;
create policy "Invite participants can create friendship"
on public.tracker_friendships
for insert
to authenticated
with check (
  (select auth.uid()) in (user_a, user_b)
  and exists (
    select 1
    from public.tracker_friend_invites invite
    where invite.status = 'accepted'
      and (
        (invite.sender_id = user_a and invite.recipient_id = user_b)
        or (invite.sender_id = user_b and invite.recipient_id = user_a)
      )
  )
);

drop policy if exists "Friends can delete their friendship" on public.tracker_friendships;
create policy "Friends can delete their friendship"
on public.tracker_friendships
for delete
to authenticated
using ((select auth.uid()) in (user_a, user_b));

drop policy if exists "Availability visible to owner and friends" on public.tracker_availability_windows;
create policy "Availability visible to owner and friends"
on public.tracker_availability_windows
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.tracker_friendships friendship
    where (select auth.uid()) in (friendship.user_a, friendship.user_b)
      and user_id in (friendship.user_a, friendship.user_b)
  )
);

drop policy if exists "Users can insert their own availability" on public.tracker_availability_windows;
create policy "Users can insert their own availability"
on public.tracker_availability_windows
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own availability" on public.tracker_availability_windows;
create policy "Users can update their own availability"
on public.tracker_availability_windows
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own availability" on public.tracker_availability_windows;
create policy "Users can delete their own availability"
on public.tracker_availability_windows
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Team owners and members can read teams" on public.tracker_friend_teams;
create policy "Team owners and members can read teams"
on public.tracker_friend_teams
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1
    from public.tracker_friend_team_members member
    where member.team_id = id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  )
);

drop policy if exists "Users can create their own teams" on public.tracker_friend_teams;
create policy "Users can create their own teams"
on public.tracker_friend_teams
for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Team owners can update teams" on public.tracker_friend_teams;
create policy "Team owners can update teams"
on public.tracker_friend_teams
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Team owners can delete teams" on public.tracker_friend_teams;
create policy "Team owners can delete teams"
on public.tracker_friend_teams
for delete
to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Team members can read their memberships" on public.tracker_friend_team_members;
create policy "Team members can read their memberships"
on public.tracker_friend_team_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.tracker_friend_teams team
    where team.id = team_id
      and team.owner_id = (select auth.uid())
  )
);

drop policy if exists "Team owners can add memberships" on public.tracker_friend_team_members;
create policy "Team owners can add memberships"
on public.tracker_friend_team_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tracker_friend_teams team
    where team.id = team_id
      and team.owner_id = (select auth.uid())
  )
);

drop policy if exists "Team owners can update memberships" on public.tracker_friend_team_members;
create policy "Team owners can update memberships"
on public.tracker_friend_team_members
for update
to authenticated
using (
  exists (
    select 1
    from public.tracker_friend_teams team
    where team.id = team_id
      and team.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.tracker_friend_teams team
    where team.id = team_id
      and team.owner_id = (select auth.uid())
  )
);

drop policy if exists "Team owners can delete memberships" on public.tracker_friend_team_members;
create policy "Team owners can delete memberships"
on public.tracker_friend_team_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.tracker_friend_teams team
    where team.id = team_id
      and team.owner_id = (select auth.uid())
  )
);

grant select, insert, update on public.tracker_social_profiles to authenticated;
grant select, insert, update on public.tracker_friend_invites to authenticated;
grant select, insert, delete on public.tracker_friendships to authenticated;
grant select, insert, update, delete on public.tracker_availability_windows to authenticated;
grant select, insert, update, delete on public.tracker_friend_teams to authenticated;
grant select, insert, update, delete on public.tracker_friend_team_members to authenticated;
