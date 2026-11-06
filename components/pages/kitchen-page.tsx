"use client";
import KitchenWorkspace from "@/components/workspaces/kitchen-workspace";
import { usePos } from "@/components/pos-provider";
export default function KitchenPageContent() {
  const { data, menuItems, clockNow, setOrderStatus, requestCancellation } = usePos();
  return <KitchenWorkspace data={data} menuItems={menuItems} clockNow={clockNow} setOrderStatus={setOrderStatus} requestCancellation={requestCancellation} />;
}
