"use client";

import Image from "next/image";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

function useEvent<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: any[]) => ref.current(...args), []) as unknown as T;
}
import {
  BarChartBig,
  Bell,
  Check,
  CheckCheck,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import {
  ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_PASSWORD,
  APP_NAME,
  APP_TAGLINE,
  AVATAR_BUCKET,
  MESSAGE_BUCKET,
} from "@/lib/constants";
import { demoUsers } from "@/lib/demo-users";
import {
  getPreferredSessionMode,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  setPreferredSessionMode,
} from "@/lib/supabase/client";
import type {
  AdminDeliveryLog,
  AdminUserEngagement,
  AppProfile,
  DirectoryProfile,
  MessageRecord,
  NotificationRecord,
  SessionMode,
} from "@/lib/types";
import {
  atUsername,
  cn,
  formatChatTime,
  formatRelativeTime,
  formatStatusTime,
  getInitials,
  humanFileSize,
  isImageMimeType,
  normaliseUsername,
  trimMessage,
} from "@/lib/utils";

type AuthMode = "login" | "register";
type ActiveSection = "inbox" | "profile" | "admin";
type AdminTab = "overview" | "users" | "messages" | "webhook";

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass-panel glass-panel-strong rounded-[28px] border px-5 py-5 shadow-sm sm:px-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Avatar({
  label,
  src,
  size = 48,
}: {
  label: string;
  src?: string | null;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-2xl border border-white/70 bg-slate-100"
      style={{ height: size, width: size }}
    >
      {src ? (
        <Image
          alt={label}
          className="object-cover"
          fill
          sizes={`${size}px`}
          src={src}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-amber-300 to-cyan-300 font-semibold text-slate-900">
          {getInitials(label)}
        </div>
      )}
    </div>
  );
}

function Dot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-2.5 w-2.5 rounded-full",
        online ? "bg-emerald-500" : "bg-slate-300",
      )}
    />
  );
}

export function AppShell() {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (configured ? getSupabaseBrowserClient() : null),
    [configured],
  );

  // Simple dev session: { userId: string, username: string }
  const [session, setSession] = useState<{ userId: string; username: string } | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>("local");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeSection, setActiveSection] = useState<ActiveSection>("inbox");
  const [bootMessage, setBootMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyAuth, setBusyAuth] = useState(false);
  const [busyProfile, setBusyProfile] = useState(false);
  const [busySend, setBusySend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [engagement, setEngagement] = useState<AdminUserEngagement[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<AdminDeliveryLog[]>([]);
  const [presenceIds, setPresenceIds] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [messageUrls, setMessageUrls] = useState<Record<string, string>>({});
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [webhookMsg, setWebhookMsg] = useState("");
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [authForm, setAuthForm] = useState({
    identifier: "",
    email: "",
    username: "",
    fullName: "",
    password: "",
  });
  const [profileForm, setProfileForm] = useState({
    username: "",
    fullName: "",
    address: "",
    phone: "",
    altEmail: "",
  });

  const currentUserId = session?.userId ?? null;
  const deferredSearch = useDeferredValue(search);
  const deferredComposer = useDeferredValue(composer);

  const avatarUrl = (path?: string | null) =>
    !supabase || !path
      ? null
      : supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;

  const hydrate = useEvent(async (userId: string) => {
    if (!supabase) {
      return;
    }

    const [profileRes, directoryRes, messagesRes, notificationsRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("profile_directory").select("*").order("username"),
        supabase
          .from("messages")
          .select("*")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("created_at", { ascending: true })
          .limit(300),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

    const nextProfile = (profileRes.data as AppProfile | null) ?? null;
    if (nextProfile && nextProfile.username === "admin") {
      nextProfile.is_admin = true;
    }
    const nextDirectory = (directoryRes.data ?? []) as DirectoryProfile[];
    const nextMessages = (messagesRes.data ?? []) as MessageRecord[];
    const nextNotifications = (notificationsRes.data ?? []) as NotificationRecord[];

    let nextEngagement: AdminUserEngagement[] = [];
    let nextLogs: AdminDeliveryLog[] = [];

    if (nextProfile?.is_admin) {
      const [engRes, logsRes] = await Promise.all([
        supabase.from("admin_user_engagement").select("*").order("username"),
        supabase
          .from("message_delivery_logs_admin")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(80),
      ]);
      nextEngagement = (engRes.data ?? []) as AdminUserEngagement[];
      nextLogs = (logsRes.data ?? []) as AdminDeliveryLog[];
    }

    startTransition(() => {
      setProfile(nextProfile);
      setDirectory(nextDirectory);
      setMessages(nextMessages);
      setNotifications(nextNotifications);
      setEngagement(nextEngagement);
      setDeliveryLogs(nextLogs);
      setProfileForm({
        username: nextProfile?.username ?? "",
        fullName: nextProfile?.full_name ?? "",
        address: nextProfile?.address ?? "",
        phone: nextProfile?.phone ?? "",
        altEmail: nextProfile?.alt_email ?? "",
      });
      if (!selectedUserId || !nextDirectory.some((item) => item.id === selectedUserId)) {
        setSelectedUserId(nextDirectory.find((item) => item.id !== userId)?.id ?? null);
      }
    });

    const errorMessage =
      profileRes.error?.message ||
      directoryRes.error?.message ||
      messagesRes.error?.message ||
      notificationsRes.error?.message;

    if (errorMessage) {
      setFeedback(errorMessage);
    }
  });

  const refresh = useEvent(async () => {
    if (currentUserId) {
      await hydrate(currentUserId);
    }
  });

  // ─── Notification sound (Web Audio API, no file needed) ─────────────────
  const playNotifSound = useEvent(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.3);
    } catch {}
  });

  const notifyMessage = useEvent((row: Partial<MessageRecord>, eventType: string) => {
    if (eventType === "INSERT" && row.receiver_id === currentUserId) {
      // Play sound always (whether app is visible or not)
      playNotifSound();
      // Show browser notification when tab is in background
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        if ("Notification" in window && Notification.permission === "granted") {
          const sender = directory.find((item) => item.id === row.sender_id);
          const name = sender?.full_name || sender?.username || "Alguém";
          new Notification(`Nova mensagem de ${name}`, { body: row.content || "Enviou um anexo." });
        }
      }
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!configured || !supabase) return;
    setSessionMode(getPreferredSessionMode());

    // Restore session from localStorage
    const stored = window.localStorage.getItem("dev_session");
    if (stored) {
      try { setSession(JSON.parse(stored)); } catch {}
    }

    // Seed admin account via server route (bypasses RLS)
    void fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_admin" }),
    })
      .then((r) => r.json())
      .then((r) => setBootMessage(r.message ?? r.error ?? null))
      .catch(() => setBootMessage("Erro ao verificar admin."));
  }, [configured, supabase]);

  useEffect(() => {
    if (!currentUserId) {
      setProfile(null);
      setDirectory([]);
      setMessages([]);
      setNotifications([]);
      setEngagement([]);
      setDeliveryLogs([]);
      return;
    }
    setLoading(true);
    void hydrate(currentUserId).finally(() => setLoading(false));
  }, [currentUserId, hydrate]);

  useEffect(() => {
    if (!supabase || !currentUserId) {
      return;
    }
    const channel = supabase.channel(`pulsebox-db-${currentUserId}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      (payload) => {
        const row = (payload.new || payload.old) as Partial<MessageRecord>;
        if (row.sender_id === currentUserId || row.receiver_id === currentUserId) {
          // Optimistically update messages state immediately
          if (payload.eventType === "INSERT" && payload.new) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === (payload.new as MessageRecord).id)) return prev;
              return [...prev, payload.new as MessageRecord];
            });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setMessages((prev) => prev.map((m) => m.id === (payload.new as MessageRecord).id ? (payload.new as MessageRecord) : m));
          } else if (payload.eventType === "DELETE" && payload.old) {
            setMessages((prev) => prev.filter((m) => m.id !== (payload.old as MessageRecord).id));
          }
          notifyMessage(row, payload.eventType);
          // Still do a full refresh for profile/directory sync
          void refresh();
        }
      },
    );
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => {
        const row = payload.new as Partial<NotificationRecord>;
        if (row.user_id === currentUserId) {
          setNotifications((prev) => [payload.new as NotificationRecord, ...prev]);
          playNotifSound();
        }
      },
    );
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications" },
      (payload) => {
        const row = payload.new as Partial<NotificationRecord>;
        if (row.user_id === currentUserId) {
          setNotifications((prev) => prev.map((n) => n.id === (payload.new as NotificationRecord).id ? (payload.new as NotificationRecord) : n));
        }
      },
    );
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      () => void refresh(),
    );
    if (profile?.is_admin) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_delivery_logs" },
        () => void refresh(),
      );
    }
    void channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, profile?.is_admin, refresh, supabase]);

  // ─── Polling fallback (2s) ─────────────────────────────────────────────────
  // Supabase Realtime requires auth JWT; since we use fake sessions, we also
  // poll the DB every 2 seconds so messages appear without page reload.
  useEffect(() => {
    if (!supabase || !currentUserId) return;
    let lastMsgTime = new Date().toISOString();
    let lastNotifTime = new Date().toISOString();

    const tick = async () => {
      // Fetch new messages since last poll
      const { data: newMsgs } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .gt("created_at", lastMsgTime)
        .order("created_at", { ascending: true });

      if (newMsgs && newMsgs.length > 0) {
        lastMsgTime = newMsgs[newMsgs.length - 1].created_at;
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const added = (newMsgs as MessageRecord[]).filter((m) => !ids.has(m.id));
          if (added.length === 0) return prev;
          // Play sound for incoming messages
          added.forEach((m) => {
            if (m.receiver_id === currentUserId) {
              playNotifSound();
              if (typeof document !== "undefined" && document.visibilityState === "hidden") {
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Nova mensagem", { body: m.content || "Enviou um anexo." });
                }
              }
            }
          });
          return [...prev, ...added];
        });
      }

      // Fetch new notifications since last poll
      const { data: newNotifs } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUserId)
        .gt("created_at", lastNotifTime)
        .order("created_at", { ascending: false });

      if (newNotifs && newNotifs.length > 0) {
        lastNotifTime = newNotifs[0].created_at;
        setNotifications((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          const added = (newNotifs as NotificationRecord[]).filter((n) => !ids.has(n.id));
          return added.length > 0 ? [...added, ...prev] : prev;
        });
      }
    };

    const id = setInterval(() => { void tick(); }, 2000);
    return () => clearInterval(id);
  }, [currentUserId, supabase, playNotifSound]);

  const syncPresence = useEvent(
    (state: Record<string, Array<{ userId?: string }>>) => {
      setPresenceIds(
        Object.values(state)
          .flat()
          .map((item) => item.userId)
          .filter((item): item is string => Boolean(item)),
      );
    },
  );

  useEffect(() => {
    if (!supabase || !currentUserId) {
      return;
    }
    const channel = supabase.channel("pulsebox-presence", {
      config: { presence: { key: currentUserId } },
    });
    channel.on("presence", { event: "sync" }, () => {
      syncPresence(
        channel.presenceState<{ userId?: string }>() as Record<
          string,
          Array<{ userId?: string }>
        >,
      );
    });
    void channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: currentUserId });
        await supabase
          .from("profiles")
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq("id", currentUserId);
      }
    });
    return () => {
      void supabase
        .from("profiles")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("id", currentUserId);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase, syncPresence]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const pending = messages.filter((item) => item.file_path && !messageUrls[item.id]);
    if (!pending.length) {
      return;
    }
    let ignore = false;
    void Promise.all(
      pending.map(async (item) => {
        const { data } = await supabase.storage
          .from(MESSAGE_BUCKET)
          .createSignedUrl(item.file_path!, 3600);
        return [item.id, data?.signedUrl ?? ""] as const;
      }),
    ).then((entries) => {
      if (ignore) {
        return;
      }
      setMessageUrls((current) => {
        const next = { ...current };
        for (const [id, url] of entries) {
          if (url) {
            next[id] = url;
          }
        }
        return next;
      });
    });
    return () => {
      ignore = true;
    };
  }, [messageUrls, messages, supabase]);

  const users = useMemo(
    () =>
      directory.map((item) => ({
        ...item,
        is_online: presenceIds.includes(item.id) || item.is_online,
      })),
    [directory, presenceIds],
  );

  const unreadMap = useMemo(() => {
    const next = new Map<string, number>();
    for (const message of messages) {
      if (message.receiver_id === currentUserId && !message.read_at) {
        next.set(message.sender_id, (next.get(message.sender_id) ?? 0) + 1);
      }
    }
    return next;
  }, [currentUserId, messages]);

  const conversations = useMemo(() => {
    return users
      .filter((item) => item.id !== currentUserId)
      .map((item) => {
        const lastMessage =
          messages
            .filter(
              (message) =>
                (message.sender_id === currentUserId &&
                  message.receiver_id === item.id) ||
                (message.receiver_id === currentUserId &&
                  message.sender_id === item.id),
            )
            .at(-1) ?? null;

        return {
          user: item,
          unread: unreadMap.get(item.id) ?? 0,
          lastMessage,
        };
      })
      .sort((left, right) => {
        const leftAt = left.lastMessage?.created_at ?? "";
        const rightAt = right.lastMessage?.created_at ?? "";
        if (leftAt !== rightAt) {
          return rightAt.localeCompare(leftAt);
        }
        return left.user.username.localeCompare(right.user.username);
      });
  }, [currentUserId, messages, unreadMap, users]);

  const visibleConversations = useMemo(() => {
    if (!deferredSearch.trim()) {
      return conversations;
    }
    const query = deferredSearch.toLowerCase();
    return conversations.filter(
      ({ user }) =>
        user.username.toLowerCase().includes(query) ||
        (user.full_name ?? "").toLowerCase().includes(query),
    );
  }, [conversations, deferredSearch]);

  const selectedUser = users.find((item) => item.id === selectedUserId) ?? null;
  const thread = messages.filter(
    (message) =>
      selectedUserId &&
      ((message.sender_id === currentUserId &&
        message.receiver_id === selectedUserId) ||
        (message.receiver_id === currentUserId &&
          message.sender_id === selectedUserId)),
  );
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const mentionQuery =
    deferredComposer.match(/(?:^|\s)@([a-z0-9._-]{0,24})$/i)?.[1] ?? null;
  const mentionSuggestions =
    mentionQuery === null
      ? []
      : users
          .filter((item) => item.id !== currentUserId)
          .filter((item) =>
            item.username.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6);
  const selectedSummary =
    engagement.find((item) => item.user_id === selectedUserId) ?? null;
  const selectedLogs = (
    selectedUserId
      ? deliveryLogs.filter(
          (item) =>
            item.sender_id === selectedUserId || item.receiver_id === selectedUserId,
        )
      : deliveryLogs
  ).slice(0, 10);

  useEffect(() => {
    if (!supabase || !currentUserId || !selectedUserId) {
      return;
    }
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("receiver_id", currentUserId)
      .eq("sender_id", selectedUserId)
      .is("read_at", null);
    void supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", currentUserId)
      .eq("actor_id", selectedUserId)
      .is("read_at", null);
  }, [currentUserId, selectedUserId, supabase]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAuth(true);
    setFeedback(null);
    try {
      if (authMode === "login") {
        const identifier = authForm.identifier.trim();
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", identifier, password: authForm.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha no login.");
        const s = { userId: data.id, username: data.username };
        window.localStorage.setItem("dev_session", JSON.stringify(s));
        setSession(s);
      } else {
        const username = normaliseUsername(authForm.username);
        if (username.length < 2) throw new Error("Use um @username com pelo menos 2 caracteres.");
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "register", username, fullName: authForm.fullName.trim(), password: authForm.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha no cadastro.");
        const s = { userId: data.id, username: data.username };
        window.localStorage.setItem("dev_session", JSON.stringify(s));
        setSession(s);
      }
    } catch (error: any) {
      console.error(error);
      setFeedback(error?.message || "Falha ao autenticar.");
    } finally {
      setBusyAuth(false);
    }
  }

  async function sendMessage() {
    if (!supabase || !currentUserId || !selectedUserId) {
      return;
    }
    const content = trimMessage(composer);
    if (!content && !attachment) {
      return;
    }
    setBusySend(true);
    try {
      let fileData: Partial<MessageRecord> = {};
      if (attachment) {
        const path = `${currentUserId}/${Date.now()}-${attachment.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "-",
        )}`;
        const { error: uploadError } = await supabase.storage
          .from(MESSAGE_BUCKET)
          .upload(path, attachment, { upsert: false });
        if (uploadError) {
          throw uploadError;
        }
        fileData = {
          file_path: path,
          file_name: attachment.name,
          file_type: attachment.type,
          file_size: attachment.size,
        };
      }
      const { error } = await supabase.from("messages").insert({
        sender_id: currentUserId,
        receiver_id: selectedUserId,
        content: content || null,
        ...fileData,
      });
      if (error) {
        throw error;
      }
      setComposer("");
      setAttachment(null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao enviar.");
    } finally {
      setBusySend(false);
    }
  }

  async function saveProfile() {
    if (!supabase || !currentUserId) {
      return;
    }
    setBusyProfile(true);
    try {
      const username = normaliseUsername(profileForm.username);
      if (username.length < 3) {
        throw new Error("Use um @username valido.");
      }
      let nextAvatarPath = profile?.avatar_path ?? null;
      if (avatarFile) {
        nextAvatarPath = `${currentUserId}/${Date.now()}-${avatarFile.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "-",
        )}`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(nextAvatarPath, avatarFile, { upsert: true });
        if (uploadError) {
          throw uploadError;
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          full_name: profileForm.fullName.trim() || null,
          address: profileForm.address.trim() || null,
          phone: profileForm.phone.trim() || null,
          alt_email: profileForm.altEmail.trim() || null,
          avatar_path: nextAvatarPath,
        })
        .eq("id", currentUserId);
      if (error) {
        throw error;
      }
      setAvatarFile(null);
      await refresh();
      setFeedback("Perfil atualizado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao salvar perfil.");
    } finally {
      setBusyProfile(false);
    }
  }

  async function toggleSessionMode(nextMode: SessionMode) {
    setSessionMode(nextMode);
    setPreferredSessionMode(nextMode);
  }

  async function markNotificationRead(id: string) {
    if (!supabase) {
      return;
    }
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function sendWebhook() {
    setWebhookBusy(true);
    setWebhookResult(null);
    try {
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "notify_all", content: webhookMsg }),
      });
      const data = await res.json();
      setWebhookResult({ ok: res.ok, msg: data.message || data.error || (res.ok ? "Enviado!" : "Erro.") });
      if (res.ok) setWebhookMsg("");
    } catch {
      setWebhookResult({ ok: false, msg: "Falha na requisição." });
    } finally {
      setWebhookBusy(false);
    }
  }

  async function signOut() {
    if (supabase && currentUserId) {
      await supabase.from("profiles").update({ is_online: false, last_seen: new Date().toISOString() }).eq("id", currentUserId);
    }
    window.localStorage.removeItem("dev_session");
    setSession(null);
  }

  if (!configured) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Ambiente nao configurado
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">{APP_NAME}</h1>
          <p className="mt-3 text-slate-600">
            Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
            em `.env.local` para rodar a aplicacao.
          </p>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="animated-orb absolute left-8 top-10 h-52 w-52 rounded-full bg-orange-300/30 blur-3xl" />
          <div className="animated-orb absolute bottom-12 right-10 h-60 w-60 rounded-full bg-cyan-300/25 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="fade-up flex min-h-[540px] flex-col justify-between gap-8 p-7 sm:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-600">
                <Sparkles className="h-3.5 w-3.5" />
                realtime inbox
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  {APP_NAME}
                </h1>
                <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
                  {APP_TAGLINE}. Chat com anexos, status lida/entregue, presenca
                  online/offline e painel administrativo com metadados seguros.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/80 bg-white/85 p-4">
                  <p className="text-sm font-medium text-slate-500">Admin</p>
                  <p className="mt-2 text-sm text-slate-700">`admin / admin123`</p>
                </div>
                <div className="rounded-3xl border border-white/80 bg-white/85 p-4">
                  <p className="text-sm font-medium text-slate-500">Demo</p>
                  <p className="mt-2 text-sm text-slate-700">{demoUsers.length} usuarios seed</p>
                </div>
                <div className="rounded-3xl border border-white/80 bg-white/85 p-4">
                  <p className="text-sm font-medium text-slate-500">Supabase</p>
                  <p className="mt-2 text-sm text-slate-700">{bootMessage ?? "Bootstrapando conta admin"}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="fade-up p-7 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Acesso</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {authMode === "login" ? "Entrar" : "Criar conta"}
                </h2>
              </div>
              <div className="inline-flex rounded-full bg-slate-950/5 p-1">
                {(["login", "register"] as const).map((mode) => (
                  <button
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition",
                      authMode === mode
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:text-slate-950",
                    )}
                    key={mode}
                    onClick={() => setAuthMode(mode)}
                    type="button"
                  >
                    {mode === "login" ? "Login" : "Cadastro"}
                  </button>
                ))}
              </div>
            </div>

            <form className="space-y-4" onSubmit={submitAuth}>
              {authMode === "login" ? (
                <label className="block text-sm font-medium text-slate-700">
                  E-mail ou alias admin
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, identifier: event.target.value }))
                    }
                    placeholder="voce@empresa.com ou admin"
                    required
                    value={authForm.identifier}
                  />
                </label>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-700">
                    E-mail
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
                      onChange={(event) =>
                        setAuthForm((current) => ({ ...current, email: event.target.value }))
                      }
                      required
                      type="email"
                      value={authForm.email}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    @username
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
                      onChange={(event) =>
                        setAuthForm((current) => ({ ...current, username: event.target.value }))
                      }
                      required
                      value={authForm.username}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Nome
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
                      onChange={(event) =>
                        setAuthForm((current) => ({ ...current, fullName: event.target.value }))
                      }
                      value={authForm.fullName}
                    />
                  </label>
                </>
              )}

              <label className="block text-sm font-medium text-slate-700">
                Senha
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-cyan-400"
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, password: event.target.value }))
                  }
                  required
                  type="password"
                  value={authForm.password}
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-sm text-slate-700">Permanecer conectado</span>
                <input
                  checked={sessionMode === "local"}
                  className="h-4 w-4 accent-slate-950"
                  onChange={(event) => setSessionMode(event.target.checked ? "local" : "session")}
                  type="checkbox"
                />
              </label>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                disabled={busyAuth}
                type="submit"
              >
                {busyAuth ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {authMode === "login" ? "Entrar no painel" : "Criar conta"}
              </button>
            </form>

            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              O alias `admin` faz login com a conta VIP criada automaticamente. Se
              o Supabase exigir confirmacao, desative o fluxo de e-mail para os
              testes locais.
            </div>
            {feedback ? <p className="mt-4 text-sm text-slate-600">{feedback}</p> : null}
          </Card>
        </div>
      </main>
    );
  }

  // Full admin dashboard
  if (session && activeSection === "admin" && profile?.is_admin) {
    const totalUsers = engagement.length || directory.length;
    const onlineUsers = directory.filter((u) => u.is_online).length;
    const totalMsgs = engagement.reduce((s, e) => s + (e.messages_sent ?? 0), 0);
    const totalNotifs = engagement.reduce((s, e) => s + (e.notifications_received ?? 0), 0);

    return (
      <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
        {/* Admin Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500 rounded-xl"><Shield className="w-4 h-4 text-white" /></div>
              <div>
                <div className="font-bold">{APP_NAME}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">Admin</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-0.5">
            {([
              { id: "overview", label: "Visão Geral",    icon: <BarChartBig className="w-4 h-4" /> },
              { id: "users",    label: "Usuários",        icon: <Users className="w-4 h-4" /> },
              { id: "messages", label: "Log Mensagens",   icon: <MessageCircle className="w-4 h-4" /> },
              { id: "webhook",  label: "Webhook",         icon: <Zap className="w-4 h-4" /> },
            ] as { id: AdminTab; label: string; icon: ReactNode }[]).map((item) => (
              <button
                key={item.id}
                onClick={() => setAdminTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left",
                  adminTab === item.id ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {item.icon}{item.label}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-white/10 space-y-0.5">
            <button onClick={() => setActiveSection("inbox")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition">
              <MessageCircle className="w-4 h-4" /> Voltar ao Chat
            </button>
            <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                { { overview: "Visão Geral", users: "Usuários", messages: "Log de Mensagens", webhook: "Webhooks" }[adminTab] }
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">@{profile.username} · Admin</p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
              <Dot online={true} />{onlineUsers} online
            </div>
          </header>

          <div className="p-8">
            {adminTab === "overview" && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                  {([
                    { label: "Usuários",     value: totalUsers,  color: "text-cyan-600 bg-cyan-50 border-cyan-100" },
                    { label: "Online",       value: onlineUsers, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                    { label: "Mensagens",    value: totalMsgs,   color: "text-violet-600 bg-violet-50 border-violet-100" },
                    { label: "Notificações", value: totalNotifs, color: "text-amber-600 bg-amber-50 border-amber-100" },
                  ] as {label:string;value:number;color:string}[]).map((stat) => (
                    <div key={stat.label} className={cn("rounded-2xl border p-5 bg-white shadow-sm", stat.color)}>
                      <div className="text-3xl font-bold text-slate-800">{stat.value}</div>
                      <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800">Engajamento</div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-3 text-left">Usuário</th>
                        <th className="px-6 py-3 text-center">Status</th>
                        <th className="px-6 py-3 text-center">Msgs</th>
                        <th className="px-6 py-3 text-center">Notif. Lidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {engagement.length === 0
                        ? <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400">Nenhum dado ainda</td></tr>
                        : engagement.map((eng) => (
                        <tr key={eng.user_id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar label={eng.username} src={avatarUrl(eng.avatar_path)} size={32} />
                              <div>
                                <div className="font-semibold text-slate-800">{eng.full_name || eng.username}</div>
                                <div className="text-[11px] text-slate-400">@{eng.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold", eng.is_online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                              <Dot online={eng.is_online} />{eng.is_online ? "Online" : "Offline"}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-center font-semibold">{eng.messages_sent}</td>
                          <td className="px-6 py-3.5 text-center font-semibold">{eng.notifications_read}/{eng.notifications_received}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminTab === "users" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800">Todos os Usuários ({directory.length})</div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3 text-left">Usuário</th>
                      <th className="px-6 py-3 text-center">Role</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-left">Último Acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {directory.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar label={u.username} src={avatarUrl(u.avatar_path)} size={34} />
                            <div>
                              <div className="font-semibold text-slate-800">{u.full_name || u.username}</div>
                              <div className="text-[11px] text-slate-400">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {u.is_admin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
                              <Shield className="w-3 h-3" />Admin
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Usuário</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold", u.is_online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                            <Dot online={u.is_online} />{u.is_online ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 text-[12px]">{u.last_seen ? formatStatusTime(u.last_seen) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {adminTab === "messages" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800">Log de Entrega</div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3 text-left">De</th>
                      <th className="px-6 py-3 text-left">Para</th>
                      <th className="px-6 py-3 text-center">Entregue</th>
                      <th className="px-6 py-3 text-center">Lida</th>
                      <th className="px-6 py-3 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveryLogs.length === 0
                      ? <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Nenhuma mensagem ainda</td></tr>
                      : deliveryLogs.map((log) => (
                      <tr key={log.message_id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3.5 font-medium">@{log.sender_username}</td>
                        <td className="px-6 py-3.5 font-medium">@{log.receiver_username}</td>
                        <td className="px-6 py-3.5 text-center">{log.delivered_at ? <CheckCheck className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-6 py-3.5 text-center">{log.read_at ? <CheckCheck className="w-4 h-4 text-cyan-500 mx-auto" /> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-6 py-3.5 text-slate-500 text-[12px]">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {adminTab === "webhook" && (
              <div className="space-y-6 max-w-xl">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Disparar Notificação Global</h2>
                  <p className="text-sm text-slate-500 mb-4">Envia notificação para todos os usuários do sistema.</p>
                  <textarea
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition resize-none h-24 mb-3"
                    placeholder="Ex: Manutenção programada para hoje às 22h..."
                    value={webhookMsg}
                    onChange={(e) => setWebhookMsg(e.target.value)}
                  />
                  <button
                    onClick={sendWebhook}
                    disabled={webhookBusy || !webhookMsg.trim()}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    {webhookBusy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {webhookBusy ? "Enviando..." : "Disparar para todos"}
                  </button>
                  {webhookResult && (
                    <p className={cn("text-sm font-medium px-4 py-3 rounded-xl mt-3", webhookResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                      {webhookResult.msg}
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="font-semibold text-slate-800 mb-3">Endpoint Externo</h2>
                  <div className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-x-auto whitespace-pre">
{`POST /api/webhook\n\n${JSON.stringify({ action: "notify_all", content: "Sua mensagem aqui" }, null, 2)}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white text-slate-900 overflow-hidden font-sans">
      <aside className="w-80 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
        <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-10">
          <div className="font-semibold text-xl tracking-tight text-slate-800">{APP_NAME}</div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setActiveSection("inbox")} className={cn("p-2 rounded-full transition", activeSection === "inbox" ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100")}><MessageCircle className="w-5 h-5"/></button>
            <button onClick={() => setActiveSection("profile")} className={cn("p-1 rounded-full transition", activeSection === "profile" ? "ring-2 ring-cyan-500" : "hover:ring-2 hover:ring-slate-300")}><Avatar size={28} label={profile?.username || "U"} src={avatarUrl(profile?.avatar_path)}/></button>
            {profile?.is_admin && <button onClick={() => setActiveSection("admin")} className={cn("p-2 rounded-full transition", activeSection === "admin" ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100")}><Shield className="w-5 h-5"/></button>}
          </div>
        </header>
        
        {activeSection === "inbox" && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4 sticky top-0 bg-slate-50 z-10 pb-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input 
                  placeholder="Pesquisar mensagens..." 
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition shadow-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="px-2 pb-4 space-y-0.5">
              {visibleConversations.map(({ user, unread, lastMessage }) => (
                <button 
                  key={user.id} 
                  onClick={() => setSelectedUserId(user.id)}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-2xl transition text-left group", selectedUserId === user.id ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-slate-200/50")}
                >
                  <div className="relative shrink-0">
                    <Avatar label={user.username} src={avatarUrl(user.avatar_path)} size={44} />
                    <div className="absolute -bottom-0.5 -right-0.5 rounded-full border-[2.5px] border-slate-50 group-hover:border-slate-100 transition-colors">
                      <Dot online={user.is_online} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <div className="font-semibold text-[15px] truncate text-slate-800">{user.full_name || `@${user.username}`}</div>
                      {lastMessage && <div className="text-[11px] font-medium text-slate-400 shrink-0 ml-2">{formatRelativeTime(lastMessage.created_at)}</div>}
                    </div>
                    <div className="text-[13px] text-slate-500 truncate flex items-center gap-1.5">
                      {lastMessage?.sender_id === currentUserId && (
                         lastMessage.read_at ? <CheckCheck className="w-[14px] h-[14px] text-cyan-500" /> : 
                         lastMessage.delivered_at ? <CheckCheck className="w-[14px] h-[14px] text-slate-400" /> : 
                         <Check className="w-[14px] h-[14px] text-slate-400" />
                      )}
                      <span className="truncate">{lastMessage?.content || (lastMessage?.file_name ? "Anexo enviado" : "Nova conversa")}</span>
                    </div>
                  </div>
                  {unread > 0 && <span className="bg-cyan-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0 shadow-sm">{unread > 9 ? '9+' : unread}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {activeSection === "profile" && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Seu Perfil</h2>
              <p className="text-sm text-slate-500 mt-1">Atualize suas informações pessoais</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveProfile(); }} className="space-y-4">
               <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                 <Avatar label={profileForm.username} src={avatarUrl(profile?.avatar_path)} size={64} />
                 <div className="flex-1 min-w-0">
                   <label className="text-sm font-medium mb-1 block text-slate-700">Alterar foto</label>
                   <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} className="text-xs w-full text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition cursor-pointer" />
                 </div>
               </div>
               
               <div className="space-y-3 p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                 <label className="block"><span className="text-sm font-medium block mb-1.5 text-slate-700">Nome completo</span><input value={profileForm.fullName} onChange={e => setProfileForm(c => ({...c, fullName: e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition shadow-sm" placeholder="Seu nome" /></label>
                 <label className="block"><span className="text-sm font-medium block mb-1.5 text-slate-700">Username</span><input value={profileForm.username} onChange={e => setProfileForm(c => ({...c, username: e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition shadow-sm bg-slate-50" placeholder="@username" /></label>
                 <label className="block"><span className="text-sm font-medium block mb-1.5 text-slate-700">Endereço</span><input value={profileForm.address} onChange={e => setProfileForm(c => ({...c, address: e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition shadow-sm" placeholder="Sua rua, número..." /></label>
                 <label className="block"><span className="text-sm font-medium block mb-1.5 text-slate-700">Telefone</span><input value={profileForm.phone} onChange={e => setProfileForm(c => ({...c, phone: e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition shadow-sm" placeholder="(11) 90000-0000" /></label>
                 <label className="block"><span className="text-sm font-medium block mb-1.5 text-slate-700">E-mail Alternativo</span><input value={profileForm.altEmail} onChange={e => setProfileForm(c => ({...c, altEmail: e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition shadow-sm" placeholder="email@exemplo.com" /></label>
               </div>
               
               <button type="submit" disabled={busyProfile} className="w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-semibold flex justify-center items-center gap-2 shadow-md shadow-slate-900/10 hover:bg-slate-800 transition disabled:opacity-70">{busyProfile ? <LoaderCircle className="w-4 h-4 animate-spin"/> : "Salvar Alterações"}</button>
            </form>
            
            <div className="mt- auto border-t border-slate-200 pt-5">
               <button type="button" onClick={signOut} className="text-red-600 flex items-center justify-center gap-2 text-sm font-semibold hover:bg-red-50 p-3 rounded-xl w-full transition border border-transparent hover:border-red-100"><LogOut className="w-4 h-4" /> Sair da conta</button>
            </div>
            {feedback && <p className="text-[13px] font-medium text-center text-slate-600 mt-2 bg-slate-200 py-2 rounded-lg">{feedback}</p>}
          </div>
        )}

        {activeSection === "admin" && profile?.is_admin && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Painel Admin</h2>
              <p className="text-sm text-slate-500 mt-1">Supervisão de métricas e status</p>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Engajamento de Usuários</h3>
              <div className="grid gap-2">
                {engagement.map(eng => (
                  <div key={eng.username} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{eng.full_name || eng.username}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">@{eng.username}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-xs bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-md font-medium">Msgs enviadas: {eng.messages_sent}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-medium">Notifs lid.: {eng.notifications_read}/{eng.notifications_received}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Atividade Recente</h3>
              <div className="grid gap-2">
                {deliveryLogs.map(log => (
                  <div key={log.message_id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 font-medium text-[13px] text-slate-700 shrink-0">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md">@{log.sender_username}</span>
                      <span className="text-slate-400">→</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md">@{log.receiver_username}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 min-w-0 truncate text-right">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col bg-slate-50 relative">
        {selectedUser ? (
          <>
            <header className="h-[73px] border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0 z-10">
              <div className="flex items-center gap-3.5">
                 <div className="relative">
                   <Avatar label={selectedUser.username} src={avatarUrl(selectedUser.avatar_path)} size={42} />
                   <div className="absolute -bottom-0.5 -right-0.5 rounded-full border-[2.5px] border-white">
                      <Dot online={selectedUser.is_online} />
                   </div>
                 </div>
                 <div className="flex flex-col">
                   <h2 className="font-semibold text-[15px] text-slate-800 leading-tight">{selectedUser.full_name || selectedUser.username}</h2>
                   <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedUser.is_online ? "Online agora" : selectedUser.last_seen ? `Visto ${formatStatusTime(selectedUser.last_seen)}` : "Offline"}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="relative p-2.5 rounded-full hover:bg-slate-100 transition text-slate-500 hover:text-slate-800">
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />}
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pattern-dots bg-center custom-scrollbar" style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              {thread.length === 0 ? (
                <div className="m-auto flex flex-col items-center bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-slate-200 shadow-sm max-w-sm">
                  <div className="w-16 h-16 bg-cyan-50 rounded-full flex justify-center items-center mb-5 ring-8 ring-cyan-50/50"><MessageCircle className="w-8 h-8 text-cyan-500"/></div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Inicie a conversa</h3>
                  <p className="text-[15px] text-slate-500 text-center leading-relaxed">Mande um "oi" para {selectedUser.full_name || `@${selectedUser.username}`} ou envie um anexo para começar.</p>
                </div>
              ) : (
                thread.map((msg, idx) => {
                  const isMine = msg.sender_id === currentUserId;
                  const showAvatar = !isMine && (idx === 0 || thread[idx - 1].sender_id !== msg.sender_id);
                  const showTime = idx === 0 || new Date(msg.created_at).getTime() - new Date(thread[idx - 1].created_at).getTime() > 1000 * 60 * 60;
                  
                  return (
                    <div key={msg.id} className="flex flex-col">
                      {showTime && (
                        <div className="flex justify-center mb-6 mt-2">
                           <span className="text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm">
                              {new Date(msg.created_at).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')}
                           </span>
                        </div>
                      )}
                      <div className={cn("flex gap-3 max-w-[75%]", isMine ? "self-end flex-row-reverse" : "self-start")}>
                        {showAvatar ? (
                          <div className="mt-auto">
                            <Avatar label={selectedUser.username} src={avatarUrl(selectedUser.avatar_path)} size={28} />
                          </div>
                        ) : !isMine ? <div className="w-7" /> : null}
                        <div className={cn("group flex flex-col gap-1.5", isMine ? "items-end" : "items-start")}>
                          {msg.file_path && (
                             <div className={cn("rounded-2xl p-1 overflow-hidden shadow-sm", isMine ? "bg-cyan-500" : "bg-white border border-slate-200")}>
                               {isImageMimeType(msg.file_type) && messageUrls[msg.id] ? (
                                 <Image src={messageUrls[msg.id]} alt="Anexo" width={320} height={240} className="rounded-xl object-cover max-h-72 cursor-pointer hover:opacity-95 transition" unoptimized />
                               ) : (
                                 <a href={messageUrls[msg.id]} target="_blank" rel="noreferrer" className={cn("flex items-center gap-3 py-2 px-3 rounded-xl transition hover:opacity-90", isMine ? "bg-cyan-600/30 text-white" : "bg-slate-50 text-slate-800")}>
                                   <div className={cn("p-2 rounded-lg", isMine ? "bg-white/20" : "bg-white shadow-sm")}><Paperclip className="w-4 h-4"/></div>
                                   <div className="flex flex-col min-w-0 pr-2">
                                     <span className="text-sm font-medium truncate w-40">{msg.file_name}</span>
                                     <span className={cn("text-[11px] font-medium", isMine ? "text-cyan-100" : "text-slate-400")}>{humanFileSize(msg.file_size || 0)}</span>
                                   </div>
                                 </a>
                               )}
                             </div>
                          )}
                          {msg.content && (
                             <div className={cn("px-4 py-2.5 rounded-[20px] text-[15px] leading-relaxed shadow-sm break-words relative", isMine ? "bg-cyan-500 text-white rounded-br-sm shadow-cyan-500/10" : "bg-white border border-slate-200 rounded-bl-sm text-slate-800")}>
                               {msg.content}
                             </div>
                          )}
                          <div className={cn("flex items-center gap-1.5 text-[11px] font-medium px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300", isMine ? "text-slate-400 justify-end" : "text-slate-400")}>
                            <span>{formatChatTime(msg.created_at)}</span>
                            {isMine && (
                              <div className="flex items-center">
                                {msg.read_at ? <CheckCheck className="w-[14px] h-[14px] text-cyan-500" /> :
                                 msg.delivered_at ? <CheckCheck className="w-[14px] h-[14px] text-slate-400" /> :
                                 <Check className="w-[14px] h-[14px] text-slate-400" />}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <footer className="p-4 bg-white border-t border-slate-200 z-10 shrink-0">
              {mentionSuggestions.length > 0 && (
                <div className="absolute bottom-24 left-8 bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden py-1.5 z-20 min-w-56 mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Mencionar usuário</div>
                  {mentionSuggestions.map(u => (
                     <button key={u.id} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-[14px] transition" onClick={() => {
                        setComposer(c => c.replace(/@[a-z0-9._-]*$/i, `@${u.username} `));
                     }}>
                       <Avatar label={u.username} src={avatarUrl(u.avatar_path)} size={24} />
                       <span className="font-semibold text-slate-700">{u.username}</span>
                       <span className="text-[11px] text-slate-400 ml-auto">{u.full_name?.split(' ')[0]}</span>
                     </button>
                  ))}
                </div>
              )}
              {attachment && (
                 <div className="mb-3 flex items-center gap-3 bg-white px-3 py-2.5 rounded-xl w-max border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2 fade-in">
                   <div className="p-2 bg-slate-100 rounded-lg"><Paperclip className="w-4 h-4 text-slate-600"/></div>
                   <div className="flex flex-col">
                     <span className="text-sm font-medium text-slate-700 max-w-xs truncate">{attachment.name}</span>
                     <span className="text-[11px] font-medium text-slate-400">{humanFileSize(attachment.size)}</span>
                   </div>
                   <button className="text-slate-400 hover:text-red-500 ml-3 p-1 rounded-md hover:bg-red-50 transition" onClick={() => setAttachment(null)}>✕</button>
                 </div>
              )}
              <div className="flex items-end gap-2 rounded-[24px] border border-slate-200 bg-white p-1.5 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/10 transition-all shadow-sm pr-2">
                <label className="p-3 text-slate-400 hover:text-cyan-600 cursor-pointer rounded-[18px] hover:bg-cyan-50 transition-colors self-end mb-0.5">
                  <input type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] || null)} />
                  <Paperclip className="w-[22px] h-[22px]" />
                </label>
                <textarea 
                  className="flex-1 bg-transparent py-3.5 max-h-32 min-h-[52px] resize-none outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 placeholder:font-normal custom-scrollbar"
                  placeholder="Escreva sua mensagem..."
                  value={composer}
                  onChange={e => setComposer(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button 
                  onClick={sendMessage} 
                  disabled={busySend || (!composer.trim() && !attachment)}
                  className="p-3.5 bg-cyan-500 text-white rounded-[18px] mb-0.5 hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:hover:bg-cyan-500 flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20 disabled:shadow-none self-end"
                >
                  {busySend ? <LoaderCircle className="w-[22px] h-[22px] animate-spin"/> : <Send className="w-[22px] h-[22px] ml-0.5" />}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center pattern-dots bg-center" style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
             <div className="w-32 h-32 mb-8 relative">
                 <div className="absolute inset-0 bg-cyan-100 rounded-full animate-ping opacity-50" />
                 <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center border-4 border-cyan-50 shadow-xl shadow-cyan-900/5">
                   <div className="bg-cyan-500 p-3 rounded-full text-white shadow-inner">
                     <MessageCircle className="w-8 h-8" />
                   </div>
                 </div>
                 <div className="absolute -right-2 top-2 bg-white rounded-full p-2 py-1 shadow-md border border-slate-100 flex items-center gap-1 animate-bounce" style={{ animationDuration: '3s' }}>
                   <Dot online={true} /><span className="text-[10px] font-bold text-slate-600">Online</span>
                 </div>
             </div>
             <h2 className="text-3xl font-extrabold text-slate-800 mb-3 tracking-tight">Pronto para conversar</h2>
             <p className="max-w-xs text-[15px] text-slate-500 leading-relaxed font-medium">Selecione uma conversa ao lado ou busque por um contato no diretório.</p>
          </div>
        )}
      </main>
    </div>
  );
}
