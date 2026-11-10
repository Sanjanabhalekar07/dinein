"use client";
import FloorPlanWorkspace from "@/components/workspaces/floor-plan-workspace";
import { usePos } from "@/components/pos-provider";
export default function FloorPlanPageContent() {
  const {
    data,
    setView,
    setTableStatus,
    requestReservation,
    openTableEditor,
    transferOrder,
    mergeTables,
    unmergeTable,
  } = usePos();
  return (
    <FloorPlanWorkspace
      data={data}
      setView={setView}
      setTableStatus={setTableStatus}
      requestReservation={requestReservation}
      openTableEditor={openTableEditor}
      transferOrder={transferOrder}
      mergeTables={mergeTables}
      unmergeTable={unmergeTable}
    />
  );
}
