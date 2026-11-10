import type { ReactNode } from "react";
import { Suspense } from "react";
import { PosProvider } from "@/components/pos-provider";
import PosShell from "@/components/pos-shell";
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="app-shell" aria-busy="true">
          <main className="main-area">
            <section className="page-content">Loading workspace…</section>
          </main>
        </div>
      }
    >
      <PosProvider>
        <PosShell>{children}</PosShell>
      </PosProvider>
    </Suspense>
  );
}
