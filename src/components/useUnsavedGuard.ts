"use client";
import { useEffect } from "react";

const MSG = "יש שינויים שלא נשמרו. לעזוב את הדף בלי לשמור?";

/**
 * Warns before leaving the page with unsaved changes: browser close/refresh (beforeunload)
 * and in-app navigation (any link click, captured before Next.js handles it).
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = MSG; return MSG; };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      if (!confirm(MSG)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty]);
}
