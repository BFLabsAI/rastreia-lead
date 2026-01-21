-- Create users table for custom internal authentication
create table if not exists public.users_clientes_bf_labs (
    id uuid default gen_random_uuid() primary key,
    email text unique not null,
    password text not null, -- Storing plain/hashed password here. For production, ensure these are hashed.
    role text default 'user', -- 'user', 'admin', 'super_admin'
    client_ids jsonb default '[]'::jsonb, -- Array of accessible client IDs or ["*"] for super_admin
    created_at timestamptz default now()
);

-- Disable RLS for this internal table as requested
alter table public.users_clientes_bf_labs disable row level security;

-- Create index for faster lookups
create index if not exists idx_users_email on public.users_clientes_bf_labs(email);

-- Comment
comment on table public.users_clientes_bf_labs is 'Table for custom internal authentication users and their client access';
