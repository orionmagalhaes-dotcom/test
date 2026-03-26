import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // Use service role key if available, otherwise fall back to anon (requires RLS disabled)
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "register") {
      const { username, fullName, password } = body;
      if (!username || username.length < 2) {
        return NextResponse.json({ error: "Username muito curto." }, { status: 400 });
      }

      // Check if username already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: "Username já em uso." }, { status: 409 });
      }

      const id = crypto.randomUUID();
      const { error } = await supabase.from("profiles").insert({
        id,
        username,
        full_name: fullName || null,
        metadata: { password },
      });

      if (error) {
        console.error("INSERT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id, username });
    }

    if (action === "login") {
      const { identifier, password } = body;
      const username = identifier?.replace(/^@/, "").trim();

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, metadata")
        .eq("username", username)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
      }

      const storedPwd = (data.metadata as any)?.password;
      // If no password is stored (old admin bootstrap), allow any password
      if (storedPwd && storedPwd !== password) {
        return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
      }

      return NextResponse.json({ id: data.id, username: data.username });
    }

    if (action === "seed_admin") {
      // Create admin account if it doesn't exist
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", "admin")
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ message: "Admin já existe.", id: existing.id });
      }

      const id = crypto.randomUUID();
      const { error } = await supabase.from("profiles").insert({
        id,
        username: "admin",
        full_name: "Administrador",
        is_admin: true,
        metadata: { password: "admin123" },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ message: "Admin criado!", id, username: "admin", password: "admin123" });
    }

    return NextResponse.json({ error: "Action desconhecida" }, { status: 400 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
