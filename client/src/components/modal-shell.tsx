import { type PropsWithChildren, type RefObject, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ModalShellProps = PropsWithChildren<{
  countLabel?: string;
  contentRef?: RefObject<HTMLDivElement | null>;
  description?: string;
  eyebrow?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}>;

export function ModalShell({
  children,
  countLabel,
  contentRef,
  description,
  eyebrow,
  isOpen,
  onClose,
  title,
}: ModalShellProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || dialogRef.current == null) {
        return;
      }

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements.item(0);
      const lastElement = focusableElements.item(focusableElements.length - 1);
      if (firstElement == null || lastElement == null) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-4">
      <button aria-label="Close dialog" className="absolute inset-0" onClick={onClose} type="button" />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] border border-white/70 bg-[#fcfaf6] shadow-2xl sm:h-[min(88vh,860px)] sm:rounded-[28px]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4 border-b border-black/8 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/45">{eyebrow}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-ink" id={titleId}>
                {title}
              </h2>
              {countLabel ? (
                <span className="rounded-full bg-black/5 px-3 py-1 text-sm text-black/55">{countLabel}</span>
              ) : null}
            </div>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">{description}</p> : null}
          </div>
          <Button aria-label="Close dialog" className="h-10 w-10 px-0" onClick={onClose} type="button" variant="ghost">
            <X size={18} />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5" ref={contentRef} style={{ willChange: 'transform' }}>{children}</div>
      </section>
    </div>
  );
}
