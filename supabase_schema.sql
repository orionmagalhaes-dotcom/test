-- ============================================================
-- PulseBox — Schema completo
-- Cole tudo no SQL Editor do Supabase e clique em "Run"
-- ============================================================

-- 1. Tabela principal de perfis (usuarios)
create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  username     text unique not null,
  full_name    text,
  avatar_path  text,
  address      text,
  phone        text,
  alt_email    text,
  metadata     jsonb not null default '{}'::jsonb,
  is_admin     boolean not null default false,
  is_online    boolean not null default false,
  last_seen    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. Tabela de mensagens
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  receiver_id   uuid not null references public.profiles(id) on delete cascade,
  content       text,
  file_path     text,
  file_name     text,
  file_type     text,
  file_size     bigint,
  delivered_at  timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- 3. Tabela de notificações
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  type        text not null default 'info',
  title       text not null,
  body        text,
  message_id  uuid references public.messages(id) on delete set null,
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- 4. Vista de diretório de perfis (usada no inbox)
create or replace view public.profile_directory as
  select id, username, full_name, avatar_path, is_online, is_admin, last_seen
  from public.profiles;

-- 5. Vista admin: engajamento por usuário
create or replace view public.admin_user_engagement as
  select
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_path,
    p.is_online,
    count(distinct n.id) filter (where n.user_id = p.id)             as notifications_received,
    count(distinct n.id) filter (where n.user_id = p.id and n.is_read) as notifications_read,
    count(distinct m.id) filter (where m.sender_id = p.id)           as messages_sent
  from public.profiles p
  left join public.notifications n on n.user_id = p.id
  left join public.messages m on m.sender_id = p.id
  group by p.id;

-- 6. Vista admin: log de entrega de mensagens
create or replace view public.message_delivery_logs_admin as
  select
    m.id as message_id,
    m.sender_id,
    ps.username as sender_username,
    m.receiver_id,
    pr.username as receiver_username,
    m.delivered_at,
    m.read_at,
    m.created_at
  from public.messages m
  join public.profiles ps on ps.id = m.sender_id
  join public.profiles pr on pr.id = m.receiver_id;

-- 7. Desabilitar RLS em todas as tabelas (projeto de teste)
alter table public.profiles     disable row level security;
alter table public.messages     disable row level security;
alter table public.notifications disable row level security;

-- 8. Criar conta admin inicial
insert into public.profiles (id, username, full_name, is_admin, metadata)
values (
  gen_random_uuid(),
  'admin',
  'Administrador',
  true,
  '{"password": "admin123"}'::jsonb
)
on conflict (username) do nothing;
