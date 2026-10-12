import type { ReactNode } from "react";

/** Centers one message on an empty screen (app start-up, crash, server unreachable). */
export function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt p-6">
      {children}
    </div>
  );
}
