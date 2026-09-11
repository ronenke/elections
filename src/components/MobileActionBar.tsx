"use client";

/** Phone only: a bar pinned to the bottom of the screen so "שמירה" is always reachable while editing a long list. */
export function MobileActionBar({ children, show = true }: { children: React.ReactNode; show?: boolean }) {
  if (!show) return null;
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-3 py-2.5 flex items-center gap-2 [padding-bottom:max(0.625rem,env(safe-area-inset-bottom))]" data-testid="mobile-action-bar">
      {children}
    </div>
  );
}
