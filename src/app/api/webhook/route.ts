import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Always use service role key so RLS doesn't block the insert
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { action, content } = payload;

    if (!action || !content?.trim()) {
      return NextResponse.json(
        { error: "Payload inválido. Envie 'action' e 'content'." },
        { status: 400 }
      );
    }

    if (action === "notify_all") {
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id");

      if (usersError) {
        console.error("Erro buscando usuários:", usersError);
        return NextResponse.json({ error: usersError.message }, { status: 500 });
      }

      if (!users || users.length === 0) {
        return NextResponse.json({ message: "Nenhum usuário encontrado." });
      }

      const notifications = users.map((u) => ({
        id: crypto.randomUUID(),
        user_id: u.id,
        type: "system_alert",
        title: "📢 Mensagem do Sistema",
        body: content.trim(),
        is_read: false,
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        console.error("Erro inserindo notificações:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `✅ Notificações enviadas para ${notifications.length} usuário(s).`,
      });
    }

    return NextResponse.json({ error: "Action desconhecida" }, { status: 400 });
  } catch (err: any) {
    console.error("Erro no webhook:", err);
    return NextResponse.json(
      { error: "Erro interno: " + (err.message ?? "desconhecido") },
      { status: 500 }
    );
  }
}
