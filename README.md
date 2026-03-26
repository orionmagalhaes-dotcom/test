# PulseBox

Chat em tempo real com autenticação simples, notificações, sistema de amigos e painel admin.

## Stack

- **Next.js 15** (App Router) — framework
- **Supabase** — banco de dados PostgreSQL + storage
- **Tailwind CSS** — estilos
- **Lucide React** — ícones
- **date-fns** — formatação de datas

## Configuração

1. Copie `.env.example` → `.env.local` e preencha as variáveis:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

2. Execute o schema completo no [SQL Editor do Supabase](https://supabase.com/dashboard):

```
supabase_schema.sql
```

3. Instale as dependências e inicie o servidor:

```bash
npm install
npm run dev
```

## Credenciais padrão

| Usuário | Senha    |
|---------|----------|
| admin   | admin123 |

## Estrutura

```
src/
├── app/
│   ├── api/
│   │   ├── auth/       # Login, registro, seed admin
│   │   ├── friends/    # Sistema de amigos (enviar, aceitar, recusar)
│   │   └── webhook/    # Notificação global para todos os usuários
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── app-shell.tsx   # Shell principal da aplicação
│   └── ui.tsx          # Primitivos reutilizáveis (Avatar, Card, Dot)
└── lib/
    ├── constants.ts    # Constantes globais
    ├── supabase/
    │   └── client.ts   # Cliente Supabase (browser)
    ├── types.ts        # Tipos TypeScript compartilhados
    └── utils.ts        # Funções utilitárias
```

## Funcionalidades

- **Autenticação** — login/registro sem email (armazenado em `profiles.metadata`)
- **Chat em tempo real** — polling a cada 2s como fallback para Supabase Realtime
- **Notificações** — painel dropdown no sino, toasts no canto inferior direito, som via Web Audio API
- **Sistema de amigos** — buscar por @username, enviar/aceitar/recusar pedidos
- **Painel Admin** — métricas, usuários, log de mensagens, webhook global
- **Perfil** — edição de nome, avatar, telefone, endereço

## Banco de dados

Tabelas: `profiles`, `messages`, `notifications`, `friend_requests`

RLS desabilitada em todas (projeto de teste). Veja `supabase_schema.sql`.
