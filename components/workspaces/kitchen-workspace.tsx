import { type MenuItem, type Order, type PosData } from "@/lib/pos-data";

type Props = {
  data: PosData;
  menuItems: MenuItem[];
  clockNow: number | null;
  setOrderStatus: (orderId: string, status: Order["status"]) => void;
  requestCancellation: (orderId: string) => void;
};

const itemById = (id: string, items: MenuItem[]) => items.find((item) => item.id === id);
const lineVariantLabel = (line: Order["items"][number]) => line.variant ? `${line.variant.label} · ` : "";

export default function KitchenWorkspace({ data, menuItems, clockNow, setOrderStatus, requestCancellation }: Props) {
  const openOrders = data.orders.filter((order) => order.status !== "paid" && order.status !== "cancelled");
  const tableLabel = (tableId: string | null) => tableId ? `Table ${data.tables.find((table) => table.id === tableId)?.name ?? "—"}` : "Takeaway";
  const minutesAgo = (date: string) => clockNow === null ? "—" : (() => { const minutes = Math.max(0, Math.floor((clockNow - new Date(date).getTime()) / 60000)); return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`; })();
  const statusText: Record<Order["status"], string> = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served", paid: "Paid", cancelled: "Cancelled" };

  return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Live kitchen queue</h2><p>Move each ticket through prep as the team works.</p></div><span className="live-pill"><i /> LIVE</span></div>
    <div className="kitchen-board">{openOrders.length === 0 && <div className="workflow-empty">No open tickets. New orders will appear here.</div>}
      {openOrders.map((order) => <article className="workflow-card kitchen-ticket" key={order.id}><div className="workflow-card-head"><div><span className="ticket-kicker">{tableLabel(order.tableId)} · {order.type.toUpperCase()}</span><h3>{order.id}</h3></div><span className={`status-pill status-${order.status}`}>{statusText[order.status]}</span></div><div className="kitchen-items">{(order.rounds?.[order.rounds.length - 1] ?? order.items).map((line) => <div key={line.id ?? line.menuItemId}><b>{line.quantity}×</b><span>{itemById(line.menuItemId, menuItems)?.name ?? "Removed menu item"}{(line.variant || line.modifiers?.length || line.note) && <small className="kitchen-item-note">{lineVariantLabel(line)}{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}</span></div>)}</div>{order.deliveryDetails && <div className="kitchen-delivery-details"><b>{order.deliveryDetails.recipientName}</b><span>{order.deliveryDetails.address}</span><small>{order.deliveryDetails.phone}</small></div>}<div className="kitchen-ticket-foot"><span className={( ["new", "preparing"].includes(order.status) && clockNow !== null && clockNow - new Date(order.lastFiredAt ?? order.createdAt).getTime() >= 15 * 60000) ? "ticket-age is-delayed" : "ticket-age"}>Received {minutesAgo(order.lastFiredAt ?? order.createdAt)}{["new", "preparing"].includes(order.status) && clockNow !== null && clockNow - new Date(order.lastFiredAt ?? order.createdAt).getTime() >= 15 * 60000 ? " - Delayed" : ""}</span><span className="ticket-actions">{order.status === "new" && <button onClick={() => setOrderStatus(order.id, "preparing")}>Start preparing →</button>}{order.status === "preparing" && <button onClick={() => setOrderStatus(order.id, "ready")}>Mark ready →</button>}{order.status === "ready" && <button onClick={() => setOrderStatus(order.id, "served")}>Mark served →</button>}{order.status === "served" && <span className="served-label">Waiting for checkout</span>}{(order.status === "new" || order.status === "preparing") && <button className="cancel-ticket" onClick={() => requestCancellation(order.id)}>Cancel</button>}</span></div></article>)}
    </div>
  </div>;
}
