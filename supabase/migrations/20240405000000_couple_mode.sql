-- Active couple sessions
create table couple_sessions (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references auth.users(id),
  joined_by uuid references auth.users(id),
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  session_code text unique not null, -- For easy sharing
  deleted_at timestamp with time zone -- For soft deletion
);

-- Track swipes in the session
create table couple_swipes (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references couple_sessions(id),
  food_item_id uuid,
  user_id uuid references auth.users(id),
  decision boolean,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  -- Add unique constraint to prevent duplicate swipes
  unique(session_id, user_id, food_item_id)
);

-- Store matches when both users like the same item
create table couple_matches (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references couple_sessions(id),
  food_item_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  -- Add unique constraint to prevent duplicate matches
  unique(session_id, food_item_id)
);

-- Add indexes for performance
create index idx_couple_sessions_code on couple_sessions(session_code);
create index idx_couple_swipes_session on couple_swipes(session_id);
create index idx_couple_matches_session on couple_matches(session_id);

-- Create a stored procedure for atomic swipe and match checking
create or replace function record_swipe_and_check_match(
  p_session_id uuid,
  p_user_id uuid,
  p_food_item_id uuid,
  p_decision boolean
) returns void as $$
declare
  v_match_exists boolean;
begin
  -- Insert the swipe
  insert into couple_swipes (session_id, user_id, food_item_id, decision)
  values (p_session_id, p_user_id, p_food_item_id, p_decision)
  on conflict (session_id, user_id, food_item_id) do nothing;
  
  -- Check if both users have swiped right on this item
  select exists (
    select 1 from couple_swipes
    where session_id = p_session_id
    and food_item_id = p_food_item_id
    and decision = true
    group by session_id, food_item_id
    having count(*) = 2
  ) into v_match_exists;
  
  -- If both users liked it, create a match
  if v_match_exists then
    begin
      insert into couple_matches (session_id, food_item_id)
      values (p_session_id, p_food_item_id);
    exception
      when unique_violation then
        -- Ignore duplicate match errors (race condition)
        null;
    end;
  end if;
end;
$$ language plpgsql;

-- Add RLS policies
alter table couple_sessions enable row level security;
alter table couple_swipes enable row level security;
alter table couple_matches enable row level security;

-- Policies for couple_sessions
create policy "Users can view their own sessions"
  on couple_sessions for select
  using (auth.uid() = created_by or auth.uid() = joined_by);

create policy "Users can create sessions"
  on couple_sessions for insert
  with check (auth.uid() = created_by);

create policy "Users can join sessions"
  on couple_sessions for update
  using (auth.uid() = joined_by and joined_by is null)
  with check (auth.uid() = joined_by);

create policy "Users can end their own sessions"
  on couple_sessions for update
  using (auth.uid() = created_by or auth.uid() = joined_by)
  with check (status = 'completed' or deleted_at is not null);

-- Policies for couple_swipes
create policy "Users can view swipes in their sessions"
  on couple_swipes for select
  using (
    exists (
      select 1 from couple_sessions
      where id = couple_swipes.session_id
      and (auth.uid() = created_by or auth.uid() = joined_by)
    )
  );

create policy "Users can record swipes in their sessions"
  on couple_swipes for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1 from couple_sessions
      where id = couple_swipes.session_id
      and (auth.uid() = created_by or auth.uid() = joined_by)
    )
  );

-- Policies for couple_matches
create policy "Users can view matches in their sessions"
  on couple_matches for select
  using (
    exists (
      select 1 from couple_sessions
      where id = couple_matches.session_id
      and (auth.uid() = created_by or auth.uid() = joined_by)
    )
  );

-- Function to handle joining a session by code
create or replace function handle_join_session(
  p_session_code text,
  p_joining_user_id uuid
) returns couple_sessions as $$
declare
  v_session record;
begin
  -- Select the session matching the code, ensuring it's active and not already joined
  select * into v_session
  from couple_sessions
  where session_code = p_session_code
    and status = 'active'
    and joined_by is null
    and deleted_at is null -- Also check soft delete
  for update; -- Lock the row for update

  -- Check if session was found and meets criteria
  if not found then
    -- Could be not found, already joined, or inactive. Raise a generic error.
    -- The client-side can provide a user-friendly message.
    raise exception 'Session not found, already joined, or inactive for code %', p_session_code;
  end if;

  -- Check if the joining user is the same as the creator
  if v_session.created_by = p_joining_user_id then
      raise exception 'The creator cannot join their own session.';
  end if;

  -- Update the session with the joining user's ID
  update couple_sessions
  set joined_by = p_joining_user_id
  where id = v_session.id
  returning * into v_session; -- Return the updated session row

  return v_session;
end;
$$ language plpgsql security definer; 