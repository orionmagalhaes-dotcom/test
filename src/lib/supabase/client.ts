"use client";

import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { SESSION_STORAGE_MODE_KEY } from "@/lib/constants";
import type { Database, SessionMode } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

function resolveStorage(mode: SessionMode) {
  return mode === "session" ? window.sessionStorage : window.localStorage;
}

const authStorage: SupportedStorage = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    return resolveStorage(getPreferredSessionMode()).getItem(key);
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    resolveStorage(getPreferredSessionMode()).setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getPreferredSessionMode(): SessionMode {
  if (typeof window === "undefined") return "local";
  return window.localStorage.getItem(SESSION_STORAGE_MODE_KEY) === "session"
    ? "session"
    : "local";
}

export function setPreferredSessionMode(mode: SessionMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_MODE_KEY, mode);
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase não configurado.");
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
