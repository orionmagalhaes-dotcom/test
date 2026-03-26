import { clsx } from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function atUsername(username?: string | null) {
  return `@${username ?? "usuario"}`;
}

export function normaliseUsername(value: string) {
  return value
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
}

export function getInitials(value?: string | null) {
  if (!value) {
    return "PB";
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "PB";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "agora";
  }

  return formatDistanceToNowStrict(new Date(value), {
    addSuffix: true,
    locale: ptBR,
  });
}

export function formatChatTime(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  return format(new Date(value), "HH:mm", { locale: ptBR });
}

export function formatStatusTime(value?: string | null) {
  if (!value) {
    return "pendente";
  }

  return format(new Date(value), "dd/MM HH:mm", { locale: ptBR });
}

export function humanFileSize(value?: number | null) {
  if (!value) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue.toFixed(nextValue >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function isImageMimeType(value?: string | null) {
  return Boolean(value?.startsWith("image/"));
}

export function trimMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
