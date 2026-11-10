"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { usePos } from "@/components/pos-provider";
import { calculateBill, lineTotal } from "@/lib/pos-domain";
import type { Order } from "@/lib/pos-data";

type Filter = "All" | "Open" | "Paid" | "Cancelled";
const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function getOrderLabel(order: Order, tableName?: string) {
  if (order.type === "Dine in")
    return tableName ? `Table ${tableName}` : "Dine in";
  if (order.type === "Delivery")
    return order.deliveryDetails?.recipientName || "Delivery";
  return "Takeaway";
}

export default function OrdersWorkspace() {
  const { data, menuItems, deleteOrder, canTakePayment, setCheckoutOrderId } =
    usePos();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const orders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...data.orders]
      .filter((order) => {
        if (filter === "Open" && ["paid", "cancelled"].includes(order.status))
          return false;
        if (filter === "Paid" && order.status !== "paid") return false;
        if (filter === "Cancelled" && order.status !== "cancelled")
          return false;
        if (!normalizedQuery) return true;
        const table = data.tables.find((entry) => entry.id === order.tableId);
        return [
          order.id,
          order.type,
          order.status,
          table?.name,
          order.deliveryDetails?.recipientName,
          ...order.items.map(
            (line) =>
              menuItems.find((item) => item.id === line.menuItemId)?.name,
          ),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.orders, data.tables, filter, menuItems, query]);

  const filterOptions: Filter[] = ["All", "Open", "Paid", "Cancelled"];
  const countFor = (option: Filter) =>
    option === "All"
      ? data.orders.length
      : option === "Open"
        ? data.orders.filter(
            (order) => !["paid", "cancelled"].includes(order.status),
          ).length
        : data.orders.filter((order) => order.status === option.toLowerCase())
            .length;

  function confirmDelete(order: Order) {
    if (["paid", "served"].includes(order.status)) return;
    if (
      !window.confirm(`Delete order ${order.id}? This action cannot be undone.`)
    )
      return;
    deleteOrder(order.id);
  }

  return (
    <div className="orders-page">
      <div className="orders-page-heading">
        <div>
          <div className="eyebrow">SERVICE MANAGEMENT</div>
          <h1>Orders</h1>
          <p className="subtitle">
            Review tickets, update an order, or start a new one.
          </p>
        </div>
        <Link className="primary-button orders-add-button" href="/orders/new">
          <span aria-hidden="true">＋</span> Add order
        </Link>
      </div>

      <section className="orders-list-panel" aria-label="Order management">
        <div className="orders-toolbar">
          <div
            className="orders-filters"
            role="tablist"
            aria-label="Filter orders"
          >
            {filterOptions.map((option) => (
              <button
                key={option}
                role="tab"
                aria-selected={filter === option}
                className={filter === option ? "selected" : ""}
                onClick={() => setFilter(option)}
              >
                {option}
                <span>{countFor(option)}</span>
              </button>
            ))}
          </div>
          <label className="orders-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search orders, tables, or items"
              aria-label="Search orders"
            />
          </label>
        </div>

        {orders.length === 0 ? (
          <div className="orders-empty">
            <span className="orders-empty-mark" aria-hidden="true">
              ▤
            </span>
            <h2>
              {data.orders.length === 0
                ? "No orders yet"
                : "No matching orders"}
            </h2>
            <p>
              {data.orders.length === 0
                ? "Start a ticket with the guided order wizard."
                : "Try another search or order status."}
            </p>
            {data.orders.length === 0 && (
              <Link className="primary-button" href="/orders/new">
                Add your first order
              </Link>
            )}
          </div>
        ) : (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Service</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const table = data.tables.find(
                    (entry) => entry.id === order.tableId,
                  );
                  const amount = calculateBill(
                    lineTotal(order.items, menuItems),
                  ).total;
                  const canEdit = !["paid", "cancelled", "served"].includes(
                    order.status,
                  );
                  const canDelete = !["paid", "served"].includes(order.status);
                  return (
                    <tr key={order.id}>
                      <td data-label="Ticket">
                        <strong className="orders-ticket-id">{order.id}</strong>
                        <small>{order.type}</small>
                      </td>
                      <td data-label="Service">
                        {getOrderLabel(order, table?.name)}
                      </td>
                      <td data-label="Items">
                        {order.items.reduce(
                          (sum, line) => sum + line.quantity,
                          0,
                        )}{" "}
                        items
                      </td>
                      <td data-label="Amount" className="orders-amount">
                        {money(amount)}
                      </td>
                      <td data-label="Status">
                        <span
                          className={`orders-status status-${order.status}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td data-label="Created" className="orders-date">
                        {hydrated
                          ? new Date(order.createdAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td data-label="Actions">
                        <div className="orders-row-actions">
                          {canTakePayment &&
                            !["paid", "cancelled"].includes(order.status) && (
                              <button
                                className="orders-pay-button"
                                onClick={() => setCheckoutOrderId(order.id)}
                              >
                                Pay
                              </button>
                            )}
                          {canEdit ? (
                            <Link
                              className="orders-edit-link"
                              href={`/orders/${encodeURIComponent(order.id)}/edit`}
                            >
                              Edit
                            </Link>
                          ) : (
                            <span
                              className="orders-locked"
                              title="Paid, served, or cancelled orders are locked"
                            >
                              Locked
                            </span>
                          )}
                          <button
                            className="orders-delete-button"
                            onClick={() => confirmDelete(order)}
                            disabled={!canDelete}
                            aria-label={`Delete order ${order.id}`}
                            title={
                              canDelete
                                ? "Delete order"
                                : "Paid or served orders are locked"
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="orders-footnote">
        Deleting an unpaid order returns its tracked stock. Paid and served
        tickets stay in the record.
      </p>
    </div>
  );
}
