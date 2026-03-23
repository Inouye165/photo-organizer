import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 rounded-2xl border border-black/10 bg-white px-3 text-sm text-ink shadow-sm outline-none transition focus:border-clay/60 focus:ring-2 focus:ring-clay/20",
        className,
      )}
      {...props}
    />
  );
}
