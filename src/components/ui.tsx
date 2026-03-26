import Image from "next/image";
import type { ReactNode } from "react";
import { cn, getInitials } from "@/lib/utils";

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "glass-panel glass-panel-strong rounded-[28px] border px-5 py-5 shadow-sm sm:px-6",
        className
      )}
    >
      {children}
    </section>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────
export function Avatar({
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

// ─── Online status dot ─────────────────────────────────────────────────────
export function Dot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-2.5 w-2.5 rounded-full",
        online ? "bg-emerald-500" : "bg-slate-300"
      )}
    />
  );
}
