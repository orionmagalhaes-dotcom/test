import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Exportando POST para receber webhooks externos
export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase não configurado no servidor" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // O webhook espera: { "action": "notify_all" | "send_message", "content": "..." }
    const action = payload.action;
    const content = payload.content;

    if (!action || !content) {
      return NextResponse.json(
        { error: "Payload inválido. Envie 'action' e 'content'." },
        { status: 400 }
      );
    }

    if (action === "notify_all") {
      // Cria uma requisição buscando todos os perfis para mandar uma notificação
      const { data: users, error: userError } = await supabase
        .from("profiles")
        .select("id");

      if (userError) throw userError;

      const notificationsData = (users || []).map((u) => ({
        user_id: u.id,
        type: "system_alert",
        title: "Alerta de Webhook do Sistema",
        body: content,
        is_read: false,
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsData);

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        message: `Notificações disparadas para ${notificationsData.length} usuários.`,
      });
    }

    return NextResponse.json(
      { error: "Action desconhecida" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Erro processando webhook:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar o webhook", details: error.message },
      { status: 500 }
    );
  }
}
