"use client";
import ReportsWorkspace from "@/components/workspaces/reports-workspace";
import { usePos } from "@/components/pos-provider";
export default function ReportsPageContent() {
  const { data, clockNow, role, storageReady, downloadBackup, restoreBackup } =
    usePos();
  return (
    <ReportsWorkspace
      data={data}
      clockNow={clockNow}
      canBackup={role === "Manager" && storageReady}
      downloadBackup={downloadBackup}
      restoreBackup={restoreBackup}
    />
  );
}
