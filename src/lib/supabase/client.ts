"use client";

import { createClient, type SupportedStorage } from "@supabase/supabase-js";

import {
  ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_PASSWORD,
  ADMIN_BOOTSTRAP_USERNAME,
  SESSION_STORAGE_MODE_KEY,
} from "@/lib/constants";
import type { Database, SessionMode } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

function resolveStorage(mode: SessionMode) {
  return mode === "session" ? window.sessionStorage : window.localStorage;
}

const authStorage: SupportedStorage = {
  getItem(key) {
    if (typeof window === "undefined") {
      return null;
    }

    const mode = getPreferredSessionMode();
    return resolveStorage(mode).getItem(key);
  },
  setItem(key, value) {
    if (typeof window === "undefined") {
      return;
    }

    const mode = getPreferredSessionMode();
    resolveStorage(mode).setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getPreferredSessionMode(): SessionMode {
  if (typeof window === "undefined") {
    return "local";
  }

  const storedValue = window.localStorage.getItem(SESSION_STORAGE_MODE_KEY);
  return storedValue === "session" ? "session" : "local";
}

export function setPreferredSessionMode(mode: SessionMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_MODE_KEY, mode);
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase nao configurado.");
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: authStorage,
      },
    });
  }

  return browserClient;
}

export async function ensureAdminAccount() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      status: "skipped" as const,
      message: "Supabase nao configurado.",
    };
  }

  const defaultHeaders = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    "Content-Type": "application/json",
  };

  const tokenResponse = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify({
        email: ADMIN_BOOTSTRAP_EMAIL,
        password: ADMIN_BOOTSTRAP_PASSWORD,
      }),
    },
  );

  if (tokenResponse.ok) {
    return {
      status: "ready" as const,
      message: "Conta admin pronta para uso.",
    };
  }

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as
    | { error_description?: string }
    | null;

  if (tokenPayload?.error_description?.toLowerCase().includes("confirmed")) {
    return {
      status: "blocked" as const,
      message:
        "A conta admin existe, mas depende de confirmacao de e-mail no Supabase Auth.",
    };
  }

  const signupResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({
      email: ADMIN_BOOTSTRAP_EMAIL,
      password: ADMIN_BOOTSTRAP_PASSWORD,
      data: {
        username: ADMIN_BOOTSTRAP_USERNAME,
        full_name: "Administrador VIP",
      },
    }),
  });

  if (signupResponse.ok) {
    return {
      status: "created" as const,
      message: "Conta admin criada automaticamente.",
    };
  }

  const signupPayload = (await signupResponse.json().catch(() => null)) as
    | { msg?: string; error_description?: string }
    | null;

  return {
    status: "error" as const,
    message:
      signupPayload?.msg ??
      signupPayload?.error_description ??
      "Nao foi possivel bootstrapar a conta admin.",
  };
}
