import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const [incomingRes, outgoingRes, acceptedRes] = await Promise.all([
    sb.from("friend_requests").select("id, sender_id, status, created_at").eq("receiver_id", userId).eq("status", "pending").order("created_at", { ascending: false }),
    sb.from("friend_requests").select("id, receiver_id, status, created_at").eq("sender_id", userId).order("created_at", { ascending: false }),
    sb.from("friend_requests").select("id, sender_id, receiver_id").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).eq("status", "accepted"),
  ]);

  const incoming = incomingRes.data ?? [];
  const senderIds = incoming.map((r: any) => r.sender_id);
  let senderProfiles: any[] = [];
  if (senderIds.length) {
    const { data } = await sb.from("profiles").select("id, username, full_name, avatar_path").in("id", senderIds);
    senderProfiles = data ?? [];
  }
  const incomingEnriched = incoming.map((r: any) => ({ ...r, sender: senderProfiles.find((p: any) => p.id === r.sender_id) ?? null }));

  const outgoing = outgoingRes.data ?? [];
  const receiverIds = outgoing.map((r: any) => r.receiver_id);
  let receiverProfiles: any[] = [];
  if (receiverIds.length) {
    const { data } = await sb.from("profiles").select("id, username, full_name, avatar_path").in("id", receiverIds);
    receiverProfiles = data ?? [];
  }
  const outgoingEnriched = outgoing.map((r: any) => ({ ...r, receiver: receiverProfiles.find((p: any) => p.id === r.receiver_id) ?? null }));

  const accepted = acceptedRes.data ?? [];
  const friendIds = accepted.map((r: any) => (r.sender_id === userId ? r.receiver_id : r.sender_id));
  let friendProfiles: any[] = [];
  if (friendIds.length) {
    const { data } = await sb.from("profiles").select("id, username, full_name, avatar_path, is_online").in("id", friendIds);
    friendProfiles = data ?? [];
  }
  const acceptedEnriched = accepted.map((r: any) => {
    const friendId = r.sender_id === userId ? r.receiver_id : r.sender_id;
    return { ...r, friend: friendProfiles.find((p: any) => p.id === friendId) ?? null };
  });

  return NextResponse.json({ incoming: incomingEnriched, outgoing: outgoingEnriched, accepted: acceptedEnriched });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, senderId, receiverId, requestId } = body;

    if (action === "send") {
      if (!senderId || !receiverId) return NextResponse.json({ error: "Missing ids" }, { status: 400 });
      if (senderId === receiverId) return NextResponse.json({ error: "Você não pode se adicionar." }, { status: 400 });

      const { data: existing } = await sb
        .from("friend_requests")
        .select("id, status")
        .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === "accepted") return NextResponse.json({ error: "Já são amigos!" }, { status: 409 });
        if (existing.status === "pending") return NextResponse.json({ error: "Pedido já enviado." }, { status: 409 });
        await sb.from("friend_requests").delete().eq("id", existing.id);
      }

      const { error } = await sb.from("friend_requests").insert({ id: crypto.randomUUID(), sender_id: senderId, receiver_id: receiverId, status: "pending" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { data: senderProfile } = await sb.from("profiles").select("username").eq("id", senderId).maybeSingle();
      const senderName = (senderProfile as any)?.username ?? "Alguém";

      await sb.from("notifications").insert({ id: crypto.randomUUID(), user_id: receiverId, actor_id: senderId, type: "friend_request", title: `@${senderName} quer ser seu amigo`, body: "Aceite ou recuse o pedido de amizade." });

      return NextResponse.json({ ok: true, message: "Pedido enviado!" });
    }

    if (action === "accept") {
      const { data: fr } = await sb.from("friend_requests").select("sender_id, receiver_id").eq("id", requestId).maybeSingle();
      const { error } = await sb.from("friend_requests").update({ status: "accepted" }).eq("id", requestId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (fr) {
        const { data: accepterProfile } = await sb.from("profiles").select("username").eq("id", (fr as any).receiver_id).maybeSingle();
        const accepterName = (accepterProfile as any)?.username ?? "Alguém";
        await sb.from("notifications").insert({ id: crypto.randomUUID(), user_id: (fr as any).sender_id, actor_id: (fr as any).receiver_id, type: "friend_accepted", title: `@${accepterName} aceitou seu pedido! 🎉`, body: "Vocês agora são amigos." });
      }
      return NextResponse.json({ ok: true, message: "Amizade aceita!" });
    }

    if (action === "deny") {
      const { error } = await sb.from("friend_requests").update({ status: "rejected" }).eq("id", requestId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, message: "Pedido recusado." });
    }

    if (action === "search") {
      const term = ((body.query ?? "") as string).replace(/^@/, "").trim();
      if (term.length < 2) return NextResponse.json({ results: [] });
      const { data } = await sb.from("profiles").select("id, username, full_name, avatar_path").ilike("username", `%${term}%`).limit(8);
      return NextResponse.json({ results: data ?? [] });
    }

    return NextResponse.json({ error: "Action desconhecida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
