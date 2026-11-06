import type { ReactNode } from "react";
import { PosProvider } from "@/components/pos-provider";
import PosShell from "@/components/pos-shell";
export default function WorkspaceLayout({children}:{children:ReactNode}) { return <PosProvider><PosShell>{children}</PosShell></PosProvider>; }
