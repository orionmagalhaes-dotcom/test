import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Env vars ausentes" }, { status: 500 });
  }

  // Service role client bypasses RLS entirely
  const supabase = createClient(url, serviceKey);

  const steps: Record<string, string> = {};

  // Step 1: Create profiles table
  const { error: e1 } = await supabase.rpc("exec_ddl", {
    ddl: `
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
    `,
  });
  steps["profiles"] = e1 ? e1.message : "OK";

  // Step 2: Try direct insert to profiles (works if table exists)
  const { error: insertErr } = await supabase.from("profiles").insert({
    username: "admin",
    full_name: "Administrador",
    is_admin: true,
    metadata: { password: "admin123" },
  });

  if (insertErr && insertErr.code !== "23505") {
    // 23505 = unique violation (already exists)
    steps["admin_insert"] = insertErr.message;
  } else {
    steps["admin_insert"] = insertErr?.code === "23505" ? "Admin já existe" : "Admin criado";
  }

  return NextResponse.json({ steps });
}
