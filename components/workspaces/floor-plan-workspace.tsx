import { useState } from "react";
import { type Order, type PosData, type Table } from "@/lib/pos-data";
import { lineUnitPrice } from "@/lib/pos-domain";

type Props = {
  data: PosData;
  setView: (view: string) => void;
  setTableStatus: (tableId: string, status: Table["status"]) => void;
  requestReservation: (tableId: string) => void;
  openTableEditor: () => void;
  transferOrder: (orderId: string, tableId: string) => void;
  mergeTables: (primaryId: string, secondaryId: string) => void;
  unmergeTable: (secondaryId: string) => void;
};

const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);
const formatReservationTime = (date: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(date));

export default function FloorPlanWorkspace({ data, setView, setTableStatus, requestReservation, openTableEditor, transferOrder, mergeTables, unmergeTable }: Props) {
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const openOrders = data.orders.filter((order) => order.status !== "paid" && order.status !== "cancelled");
  const orderAmount = (order: Order) => order.items.reduce((sum, line) => sum + lineUnitPrice(line, data.menuItems) * line.quantity, 0);

  return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Table management</h2><p>Choose a table to update its state or move an open ticket.</p></div><div className="workflow-head-actions"><button className="secondary-button" onClick={openTableEditor}>＋ Add table</button><button className="primary-button" onClick={() => setView("New order")}>＋ Start an order</button></div></div>
    <div className="floor-manager-grid">{data.tables.map((table) => {
      const orders = openOrders.filter((order) => order.tableId === table.id);
      const joinedSeats = table.seats + data.tables.filter((candidate) => candidate.mergedInto === table.id).reduce((sum, candidate) => sum + candidate.seats, 0);
      return <article className="workflow-card table-manager-card" key={table.id}><div className="workflow-card-head"><div><span className="ticket-kicker">{joinedSeats} SEATS</span><h3>Table {table.name}</h3></div><span className={`status-pill table-status-${table.status}`}>{table.status === "merged" ? "Joined" : table.status}</span></div>
        {table.reservation && <div className="reservation-details"><span><b>{table.reservation.guestName}</b><small>{table.reservation.guests} guests · {formatReservationTime(table.reservation.time)}</small></span><button onClick={() => requestReservation(table.id)}>Edit booking</button></div>}
        {orders.length ? <div className="table-open-orders">{orders.map((order) => <div key={order.id} className="transfer-row"><span><b>{order.id}</b><small>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items · {money(orderAmount(order))}</small></span><select aria-label={`Transfer order ${order.id}`} value={transferTargets[order.id] ?? ""} onChange={(event) => setTransferTargets((previous) => ({ ...previous, [order.id]: event.target.value }))}><option value="">Transfer to…</option>{data.tables.filter((target) => target.id !== table.id && !target.mergedInto && !data.tables.some((candidate) => candidate.mergedInto === target.id) && target.status !== "reserved" && target.status !== "cleaning").map((target) => <option key={target.id} value={target.id}>Table {target.name}</option>)}</select><button disabled={!transferTargets[order.id]} onClick={() => { const target = transferTargets[order.id]; if (target) transferOrder(order.id, target); }}>Move</button></div>)}</div> : <p className="table-no-order">No open ticket</p>}
        {table.mergedInto ? <div className="merged-table-control"><span>Joined with Table {data.tables.find((candidate) => candidate.id === table.mergedInto)?.name}</span><button onClick={() => unmergeTable(table.id)}>Unmerge tables</button></div> : <><div className="table-state-actions"><span>Set state</span>{(["available", "occupied", "reserved", "cleaning"] as const).map((status) => <button key={status} className={table.status === status ? "selected-state" : ""} onClick={() => status === "reserved" ? requestReservation(table.id) : setTableStatus(table.id, status)}>{status === "reserved" ? table.status === "reserved" ? "Edit booking" : "Reserve" : status[0].toUpperCase() + status.slice(1)}</button>)}</div><div className="merge-control"><select aria-label={`Merge Table ${table.name} with`} value={mergeTargets[table.id] ?? ""} onChange={(event) => setMergeTargets((previous) => ({ ...previous, [table.id]: event.target.value }))}><option value="">Merge with another table…</option>{data.tables.filter((target) => target.id !== table.id && !target.mergedInto && !data.tables.some((candidate) => candidate.mergedInto === target.id) && target.status !== "reserved" && target.status !== "cleaning").map((target) => <option key={target.id} value={target.id}>Table {target.name}</option>)}</select><button disabled={!mergeTargets[table.id]} onClick={() => { const secondary = mergeTargets[table.id]; if (secondary) { mergeTables(table.id, secondary); setMergeTargets((previous) => ({ ...previous, [table.id]: "" })); } }}>Merge tables</button></div></>}
      </article>;
    })}</div>
  </div>;
}
