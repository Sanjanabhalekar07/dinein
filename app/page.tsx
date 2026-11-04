"use client";

import { useEffect, useMemo, useState } from "react";
import { initialData, loadPosData, menu, savePosData, type Category, type MenuItem, type MenuModifier, type Order, type OrderLine, type PaymentMethod, type PosData, type Table } from "@/lib/pos-data";

const categories: Category[] = ["All", "Starters", "Mains", "Pizza", "Drinks", "Desserts"];
const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);
const moneyRounded = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const itemById = (id: string) => menu.find((item) => item.id === id);
const modifiersByCategory: Record<MenuItem["category"], MenuModifier[]> = {
  Starters: [{ id: "extra-sauce", label: "Extra sauce", price: 30 }, { id: "no-garnish", label: "No garnish", price: 0 }],
  Mains: [{ id: "extra-protein", label: "Extra protein", price: 120 }, { id: "no-onion", label: "No onion", price: 0 }],
  Pizza: [{ id: "extra-cheese", label: "Extra mozzarella", price: 60 }, { id: "chili-oil", label: "Chili oil", price: 30 }],
  Drinks: [{ id: "extra-syrup", label: "Add flavor syrup", price: 30 }, { id: "less-ice", label: "Less ice", price: 0 }],
  Desserts: [{ id: "ice-cream", label: "Add ice cream", price: 80 }, { id: "extra-cream", label: "Extra cream", price: 40 }],
};
const lineUnitPrice = (line: OrderLine) => (itemById(line.menuItemId)?.price ?? 0) + (line.modifiers ?? []).reduce((sum, modifier) => sum + modifier.price, 0);

export default function Home() {
  const [data, setData] = useState<PosData>(initialData);
  const [selectedTable, setSelectedTable] = useState<string | null>("t2");
  const [category, setCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("New order");
  const [loaded, setLoaded] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [splitPayment, setSplitPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [guestCount, setGuestCount] = useState(2);
  const [guestMethods, setGuestMethods] = useState<PaymentMethod[]>(["UPI", "Cash"]);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customModifierIds, setCustomModifierIds] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");
  const [clockNow, setClockNow] = useState<number | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("Guest changed their mind");

  useEffect(() => {
    loadPosData().then((saved) => { if (saved) setData({ ...initialData, ...saved, unavailableMenuIds: saved.unavailableMenuIds ?? [], transactions: saved.transactions ?? [] }); }).catch(() => setNotice("Offline storage is unavailable; changes may not persist.")).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) savePosData(data).catch(() => setNotice("Could not save changes to this device."));
  }, [data, loaded]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let timer: number;
    const updateClock = () => {
      setClockNow(Date.now());
      timer = window.setTimeout(updateClock, 60000);
    };
    timer = window.setTimeout(updateClock, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleMenu = useMemo(() => menu.filter((item) => (category === "All" || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase())), [category, search]);
  const subtotal = cart.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const activeOrders = data.orders.filter((order) => order.status !== "paid" && order.status !== "cancelled");
  const serviceTables = data.tables.filter((table) => table.status !== "merged");
  const occupied = serviceTables.filter((table) => table.status === "occupied").length;
  const now = clockNow === null ? null : new Date(clockNow);
  const todayTransactions = now ? (data.transactions ?? []).filter((transaction) => new Date(transaction.createdAt).toDateString() === now.toDateString()) : [];
  const paidToday = new Set(todayTransactions.map((transaction) => transaction.orderId));
  const todaySales = todayTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const completedDurations = [...paidToday].map((orderId) => {
    const order = data.orders.find((candidate) => candidate.id === orderId);
    const paidAt = Math.max(...todayTransactions.filter((transaction) => transaction.orderId === orderId).map((transaction) => new Date(transaction.createdAt).getTime()));
    return order ? Math.max(0, (paidAt - new Date(order.createdAt).getTime()) / 60000) : null;
  }).filter((duration): duration is number => duration !== null);
  const averageTicketTime = completedDurations.length ? Math.round(completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length) : null;
  const minutesAgo = (date: string) => clockNow === null ? "—" : (() => { const minutes = Math.max(0, Math.floor((clockNow - new Date(date).getTime()) / 60000)); return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`; })();
  const dateLabel = now ? new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(now) : "";
  const servicePeriod = now ? (now.getHours() < 11 ? "BREAKFAST" : now.getHours() < 16 ? "LUNCH" : now.getHours() < 22 ? "DINNER" : "LATE NIGHT") : "SERVICE";
  const greeting = now ? (now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening") : "Welcome";
  const currentOrder = selectedTable ? activeOrders.find((order) => order.tableId === selectedTable) : undefined;
  const checkoutOrder = data.orders.find((order) => order.id === checkoutOrderId && order.status !== "paid" && order.status !== "cancelled");
  const orderPendingCancellation = data.orders.find((order) => order.id === cancelOrderId && order.status !== "paid" && order.status !== "cancelled");
  const checkoutSubtotal = checkoutOrder ? lineTotal(checkoutOrder.items) : 0;
  const checkoutDiscount = checkoutSubtotal * discountPercent / 100;
  const checkoutTax = (checkoutSubtotal - checkoutDiscount) * 0.08;
  const checkoutTotal = checkoutSubtotal - checkoutDiscount + checkoutTax;

  function addToCart(item: MenuItem) {
    setCustomizingItem(item);
    setCustomQuantity(1);
    setCustomModifierIds([]);
    setCustomNote("");
  }

  function confirmCustomizedItem() {
    if (!customizingItem) return;
    const line: OrderLine = {
      id: crypto.randomUUID(),
      menuItemId: customizingItem.id,
      quantity: customQuantity,
      modifiers: modifiersByCategory[customizingItem.category].filter((modifier) => customModifierIds.includes(modifier.id)),
      note: customNote.trim() || undefined,
    };
    setCart((lines) => [...lines, line]);
    setCustomizingItem(null);
  }

  function changeQuantity(id: string, change: number) {
    setCart((lines) => lines.map((line) => (line.id ?? line.menuItemId) === id ? { ...line, quantity: line.quantity + change } : line).filter((line) => line.quantity > 0));
  }

  function placeOrder() {
    if (cart.length === 0) return;
    if (view === "New order" && !selectedTable) { setNotice("Choose a table before sending this dine-in order."); return; }
    const order: Order = { id: `#${1051 + data.orders.length}`, tableId: view === "Takeaway" ? null : selectedTable, type: view === "Takeaway" ? "Takeaway" : "Dine in", status: "new", items: cart, createdAt: new Date().toISOString() };
    setData((previous) => ({
      ...previous,
      orders: [...previous.orders, order],
      tables: order.tableId ? previous.tables.map((table) => table.id === order.tableId ? { ...table, status: "occupied", guests: table.guests ?? 2 } : table) : previous.tables,
    }));
    setCart([]);
    setNotice(`${order.id} sent to the kitchen`);
  }

  function completePayment() {
    if (!checkoutOrder) return;
    const order = checkoutOrder;
    const createdAt = new Date().toISOString();
    const totalPaise = Math.round(checkoutTotal * 100);
    const sharePaise = splitPayment ? Math.floor(totalPaise / guestCount) : totalPaise;
    const remainderPaise = splitPayment ? totalPaise % guestCount : 0;
    const methods = Array.from({ length: splitPayment ? guestCount : 1 }, (_, index) => ({
      method: splitPayment ? guestMethods[index] ?? paymentMethod : paymentMethod,
      amount: (sharePaise + (index < remainderPaise ? 1 : 0)) / 100,
      splitLabel: splitPayment ? `Guest ${index + 1}` : undefined,
    }));
    const payments = methods.map((payment, index) => ({ id: `${order.id}-${createdAt}-${index}`, orderId: order.id, amount: payment.amount, method: payment.method, createdAt, splitLabel: payment.splitLabel }));
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((candidate) => candidate.id === order.id ? { ...candidate, status: "paid" } : candidate),
      tables: order.tableId ? previous.tables.map((table) => table.id === order.tableId ? { ...table, status: "cleaning", guests: undefined } : table) : previous.tables,
      transactions: [...(previous.transactions ?? []), ...payments],
    }));
    setCheckoutOrderId(null);
    setDiscountPercent(0);
    setSplitPayment(false);
    setNotice(`${order.id} paid · ${money(checkoutTotal)} received`);
  }

  function setOrderStatus(orderId: string, status: Order["status"]) {
    setData((previous) => ({ ...previous, orders: previous.orders.map((order) => order.id === orderId ? { ...order, status } : order) }));
    setNotice(`${orderId} marked ${status}`);
  }

  function cancelOrder(orderId: string, reason: string) {
    const order = data.orders.find((candidate) => candidate.id === orderId);
    if (!order || order.status === "paid" || order.status === "cancelled" || order.status === "served") return;
    setData((previous) => {
      const orders = previous.orders.map((candidate) => candidate.id === orderId ? { ...candidate, status: "cancelled" as const, cancellationReason: reason.trim() || "No reason provided" } : candidate);
      const otherOpenOrder = order.tableId && orders.some((candidate) => candidate.id !== orderId && candidate.tableId === order.tableId && candidate.status !== "paid" && candidate.status !== "cancelled");
      return { ...previous, orders, tables: order.tableId ? previous.tables.map((table) => table.id === order.tableId ? { ...table, status: otherOpenOrder ? "occupied" : "cleaning", guests: otherOpenOrder ? table.guests : undefined } : table) : previous.tables };
    });
    setCancelOrderId(null);
    setNotice(`${order.id} cancelled · ${reason.trim() || "No reason provided"}`);
  }

  function requestCancellation(orderId: string) {
    setCancelReason("Guest changed their mind");
    setCancelOrderId(orderId);
  }

  function setTableStatus(tableId: string, status: Table["status"]) {
    setData((previous) => ({ ...previous, tables: previous.tables.map((table) => table.id === tableId ? { ...table, status, guests: status === "occupied" ? table.guests ?? 2 : undefined } : table) }));
  }

  function transferOrder(orderId: string, targetId: string) {
    const sourceId = data.orders.find((order) => order.id === orderId)?.tableId;
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((order) => order.id === orderId && order.status !== "cancelled" ? { ...order, tableId: targetId } : order),
      tables: previous.tables.map((table) => table.id === targetId ? { ...table, status: "occupied", guests: table.guests ?? 2 } : table.id === sourceId && !previous.orders.some((order) => order.id !== orderId && order.tableId === sourceId && order.status !== "paid" && order.status !== "cancelled") ? { ...table, status: "cleaning", guests: undefined } : table),
    }));
    setNotice(`${orderId} transferred to table ${data.tables.find((table) => table.id === targetId)?.name}`);
  }

  function mergeTables(primaryId: string, secondaryId: string) {
    if (primaryId === secondaryId) return;
    const primary = data.tables.find((table) => table.id === primaryId);
    const secondary = data.tables.find((table) => table.id === secondaryId);
    if (!primary || !secondary || primary.mergedInto || secondary.mergedInto || primary.status === "merged" || secondary.status === "merged" || primary.status === "reserved" || primary.status === "cleaning" || secondary.status === "reserved" || secondary.status === "cleaning" || data.tables.some((table) => table.mergedInto === primaryId || table.mergedInto === secondaryId)) {
      setNotice("Choose two available or occupied tables. Each table can join one pair.");
      return;
    }
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((order) => order.tableId === secondaryId && order.status !== "paid" && order.status !== "cancelled" ? { ...order, tableId: primaryId } : order),
      tables: previous.tables.map((table) => table.id === primaryId ? { ...table, status: table.status === "occupied" || secondary.status === "occupied" ? "occupied" : "available", guests: (table.guests ?? 0) + (secondary.guests ?? 0) || undefined, mergedBaseStatus: table.status === "merged" ? "available" : table.status, mergedBaseGuests: table.guests } : table.id === secondaryId ? { ...table, status: "merged", mergedInto: primaryId, mergedOrderIds: data.orders.filter((order) => order.tableId === secondaryId && order.status !== "paid" && order.status !== "cancelled").map((order) => order.id), mergedOriginalStatus: table.status === "merged" ? "available" : table.status, mergedOriginalGuests: table.guests, guests: undefined } : table),
    }));
    setNotice(`Tables ${primary.name} and ${secondary.name} merged.`);
  }

  function unmergeTable(secondaryId: string) {
    const secondary = data.tables.find((table) => table.id === secondaryId);
    if (!secondary?.mergedInto) return;
    const primaryId = secondary.mergedInto;
    const mergedOrderIds = secondary.mergedOrderIds ?? [];
    const secondaryOrders = data.orders.filter((order) => mergedOrderIds.includes(order.id));
    const hasOpenSecondaryOrders = secondaryOrders.some((order) => order.status !== "paid" && order.status !== "cancelled");
    const hasCompletedSecondaryOrders = secondaryOrders.some((order) => order.status === "paid" || order.status === "cancelled");
    const hasRemainingPrimaryOrders = data.orders.some((order) => order.tableId === primaryId && !mergedOrderIds.includes(order.id) && order.status !== "paid" && order.status !== "cancelled");
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((order) => mergedOrderIds.includes(order.id) ? { ...order, tableId: secondaryId } : order),
      tables: previous.tables.map((table) => table.id === secondaryId ? { ...table, status: hasOpenSecondaryOrders ? "occupied" : hasCompletedSecondaryOrders ? "cleaning" : secondary.mergedOriginalStatus ?? "available", guests: hasOpenSecondaryOrders ? secondary.mergedOriginalGuests ?? secondary.seats : hasCompletedSecondaryOrders ? undefined : secondary.mergedOriginalGuests, mergedInto: undefined, mergedOrderIds: undefined, mergedOriginalStatus: undefined, mergedOriginalGuests: undefined } : table.id === primaryId ? { ...table, guests: hasRemainingPrimaryOrders ? table.mergedBaseGuests ?? table.seats : table.mergedBaseGuests, status: hasRemainingPrimaryOrders ? "occupied" : table.mergedBaseStatus ?? "available", mergedBaseGuests: undefined, mergedBaseStatus: undefined } : table),
    }));
    setNotice(`Table ${secondary.name} unmerged from table ${data.tables.find((table) => table.id === primaryId)?.name}.`);
  }

  function toggleMenuAvailability(menuItemId: string) {
    setData((previous) => {
      const unavailableMenuIds = previous.unavailableMenuIds ?? [];
      return { ...previous, unavailableMenuIds: unavailableMenuIds.includes(menuItemId) ? unavailableMenuIds.filter((id) => id !== menuItemId) : [...unavailableMenuIds, menuItemId] };
    });
  }

  function addTable() {
    setData((previous) => {
      const nextNumber = previous.tables.reduce((largest, table) => Math.max(largest, Number(table.name) || 0), 0) + 1;
      const name = String(nextNumber).padStart(2, "0");
      return { ...previous, tables: [...previous.tables, { id: `t${nextNumber}`, name, seats: 4, status: "available" }] };
    });
    setNotice("A new 4-seat table was added to the floor.");
  }

  function tableOrderLines(table: Table) {
    return activeOrders.filter((order) => order.tableId === table.id).flatMap((order) => order.items);
  }

  function lineTotal(lines: OrderLine[]) {
    return lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Dine In home"><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9.2"/><circle cx="16" cy="16" r="5.7"/><path d="M4.5 6.5v6m-2.1-6v4.1a2.1 2.1 0 0 0 4.2 0V6.5M4.5 12.6v12.9m23-19-3.2 8.2v10.8m0-10.8h3.2V6.5"/></svg></span><span>Dine In<small>RESTAURANT OS</small></span></a>
        <div className="side-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={`nav-link ${view === "New order" || view === "Takeaway" ? "active" : ""}`} onClick={() => setView("New order")}><span className="nav-icon">▦</span> New order <kbd>⌘ 1</kbd></button>
          <button className={`nav-link ${view === "Floor plan" ? "active" : ""}`} onClick={() => setView("Floor plan")}><span className="nav-icon">⌑</span> Floor plan</button>
          <button className={`nav-link ${view === "Kitchen" ? "active" : ""}`} onClick={() => setView("Kitchen")}><span className="nav-icon">♨</span> Kitchen display<span className="nav-badge">{activeOrders.filter((order) => order.status === "new" || order.status === "preparing").length}</span></button>
          <button className={`nav-link ${view === "Menu" ? "active" : ""}`} onClick={() => setView("Menu")}><span className="nav-icon">☷</span> Menu</button>
          <button className={`nav-link ${view === "Reports" ? "active" : ""}`} onClick={() => setView("Reports")}><span className="nav-icon">▤</span> Reports</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-label">TODAY AT A GLANCE</div>
          <div className="mini-stats"><span>Paid orders today</span><strong>{paidToday.size}</strong></div>
          <div className="mini-stats"><span>Payments recorded</span><strong>{todayTransactions.length}</strong></div>
          <div className="side-divider" />
          <button className="staff-card" onClick={() => setNotice("Signed in as Alex Morgan · Manager") }><span className="avatar">AM</span><span><b>Alex Morgan</b><small>Manager</small></span><span className="more">···</span></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <b>{view}</b></div>
          <div className="top-actions"><span className="open-status"><i /> POS ready</span><span className="top-divider" /><span className="date-label">{dateLabel}</span><button className="icon-button" aria-label="Notifications" onClick={() => setNotice("You’re all caught up.")}>♧<i className="notification-dot" /></button><span className="avatar top-avatar">AM</span></div>
        </header>

        <section className="page-content">
          <div className="welcome-row"><div><div className="eyebrow">{servicePeriod} SERVICE <span>·</span> LOCAL</div><h1>{view === "Floor plan" ? "Your floor, at a glance." : view === "Kitchen" ? "Kitchen display" : view === "Reports" ? "Service overview" : view === "Menu" ? "Explore the menu." : greeting + ", Alex"}</h1><p className="subtitle">{view === "New order" ? "Live service overview from this device." : "A live snapshot of your restaurant service."}</p></div><div className="welcome-actions"><button className="secondary-button" onClick={() => setView("Reports")}>◷ <span>Shift summary</span></button><button className="primary-button" onClick={() => { setView("New order"); setCart([]); }}>＋ <span>New order</span></button></div></div>

          {view === "New order" || view === "Takeaway" ? <>
          <div className="metric-grid">
            <article className="metric-card"><div className="metric-top"><span>Today sales</span><span className="metric-icon sales-icon">₹</span></div><div className="metric-value metric-currency">{moneyRounded(todaySales)}</div><div className="metric-foot">{todayTransactions.length} payments recorded today</div></article>
            <article className="metric-card"><div className="metric-top"><span>Open orders</span><span className="metric-icon order-icon">☷</span></div><div className="metric-value">{activeOrders.length}<span className="metric-unit">orders</span></div><div className="metric-foot"><b className="green-text">{activeOrders.filter((order) => order.status === "preparing").length} preparing</b><span className="foot-sep">·</span>{activeOrders.filter((order) => order.status === "ready").length} ready</div></article>
            <article className="metric-card"><div className="metric-top"><span>Tables occupied</span><span className="metric-icon table-icon">⌑</span></div><div className="metric-value">{occupied}<span className="metric-unit">/ {serviceTables.length} tables</span></div><div className="metric-foot">{serviceTables.length - occupied} available · {Math.round((occupied / Math.max(1, serviceTables.length)) * 100)}% capacity</div><div className="metric-progress occupancy"><i style={{ width: `${Math.min(100, (occupied / Math.max(1, serviceTables.length)) * 100)}%` }} /></div></article>
            <article className="metric-card"><div className="metric-top"><span>Avg. ticket time</span><span className="metric-icon time-icon">◷</span></div><div className="metric-value">{averageTicketTime ?? "—"}{averageTicketTime !== null && <span className="metric-unit">min</span>}</div><div className="metric-foot">{completedDurations.length} completed tickets today</div></article>
          </div>

          {view === "New order" || view === "Takeaway" ? <div className="workspace-heading"><div><h2>Start an order</h2><p>Choose a table, then add a few guest favorites.</p></div><button className="text-button" onClick={() => setView("Floor plan")}>View floor plan <span>↗</span></button></div> : null}

          <div className="work-grid">
            <section className="panel floor-panel">
              <div className="panel-header"><div><h3>Dining room</h3><p>Ground floor <span>·</span> {data.tables.length} tables</p></div><button className="more-button" aria-label="Dining room options">···</button></div>
              <div className="table-legend"><span><i className="legend-dot available" />Available</span><span><i className="legend-dot occupied" />Occupied</span><span><i className="legend-dot reserved" />Reserved</span><span><i className="legend-dot cleaning" />Cleaning</span><span><i className="legend-dot merged-dot" />Joined</span></div>
              <div className="floor-plan" aria-label="Dining room table selector">
                <div className="floor-wall wall-top" /><div className="window-line">WINDOWS</div><div className="floor-wall wall-right" /><div className="floor-wall wall-left" />
                <div className="table-map">
                  {data.tables.map((table, index) => {
                    const orderLines = tableOrderLines(table);
                    const totalAmount = lineTotal(orderLines);
                    const primaryTable = table.mergedInto ? data.tables.find((candidate) => candidate.id === table.mergedInto) : undefined;
                    const joinedSeats = table.seats + data.tables.filter((candidate) => candidate.mergedInto === table.id).reduce((sum, candidate) => sum + candidate.seats, 0);
                    const selectionId = table.mergedInto ?? table.id;
                    return <button key={table.id} onClick={() => { setSelectedTable(selectionId); setCart([]); setView("New order"); }} className={`table-node ${table.status} ${selectedTable === selectionId ? "selected" : ""} table-${index + 1}`} aria-label={`Table ${table.name}, ${table.status}${table.mergedInto ? ` joined with ${primaryTable?.name}` : ""}`}>
                      <span className="table-top"><b>{table.name}</b><small>· {table.mergedInto ? table.seats : joinedSeats} seats</small></span><span className="table-state">{table.mergedInto ? `Joined · ${primaryTable?.name ?? "—"}` : table.status === "available" ? "Available" : table.status === "occupied" ? `${table.guests ?? joinedSeats} guests` : table.status}</span>{table.status === "occupied" && <span className="table-total">{money(totalAmount)}</span>}
                    </button>;
                  })}
                </div>
                <div className="floor-note">✦ &nbsp; PATIO</div><div className="host-stand">HOST</div>
              </div>
              <div className="floor-footer"><span><b>{occupied}</b> tables in service</span><button onClick={addTable}>＋ Add table</button></div>
            </section>

            <section className="panel menu-panel">
              <div className="menu-head"><div className="menu-title"><div><h3>Menu</h3><p>Tap an item to add it to the order.</p></div><span className="menu-count">{visibleMenu.length} items</span></div>
                <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu..." aria-label="Search menu" /><kbd>⌘ K</kbd></label>
                <div className="category-tabs" role="tablist" aria-label="Menu categories">{categories.map((entry) => <button role="tab" aria-selected={category === entry} key={entry} className={category === entry ? "chosen" : ""} onClick={() => setCategory(entry)}>{entry}</button>)}</div>
              </div>
              <div className="menu-list">
                {visibleMenu.map((item) => <button className="menu-item" key={item.id} disabled={(data.unavailableMenuIds ?? []).includes(item.id)} onClick={() => addToCart(item)}>
                  <span className={`food-art ${item.color}`}><span>{item.emoji}</span></span><span className="food-details"><span className="food-name">{item.name}{item.popular && <i className="popular-dot" title="Popular" />}</span><span className="food-desc">{(data.unavailableMenuIds ?? []).includes(item.id) ? "Currently unavailable" : item.description}</span><b>{money(item.price)}</b></span><span className="add-item">{(data.unavailableMenuIds ?? []).includes(item.id) ? "–" : "＋"}</span>
                </button>)}
                {visibleMenu.length === 0 && <div className="empty-search">No menu items match “{search}”.</div>}
              </div>
              <div className="menu-footer"><span>Showing <b>{visibleMenu.length}</b> of {menu.length} items</span><button onClick={() => { setCategory("All"); setSearch(""); }}>Manage menu ↗</button></div>
            </section>

            <section className="panel ticket-panel">
              <div className="ticket-heading"><div><span className="ticket-kicker">CURRENT TICKET</span><h3>{view === "Takeaway" ? "Takeaway" : selectedTable ? `Table ${data.tables.find((table) => table.id === selectedTable)?.name}` : "Select a table"}</h3></div><button className="more-button" aria-label="Order options" onClick={() => setView(view === "Takeaway" ? "New order" : "Takeaway")}>···</button></div>
              <div className="ticket-type"><button onClick={() => { setView("New order"); setSelectedTable("t2"); }}>⌑ &nbsp; Dine in <span className="chevron">⌄</span></button><button onClick={() => setView("Takeaway")} className={view === "Takeaway" ? "selected-type" : ""}>↗ &nbsp; Takeaway</button></div>
              <div className="ticket-table-row"><span>Table</span><button onClick={() => setView("Floor plan")}>{selectedTable ? `Table ${data.tables.find((table) => table.id === selectedTable)?.name}` : "Choose table"} <span>⌄</span></button></div>
              <div className="order-list-heading"><span>ORDER ITEMS</span><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span></div>
              <div className="cart-lines">
                {cart.length === 0 && currentOrder && <div className="existing-order"><span className="existing-order-top">{currentOrder.id} <b>{currentOrder.status}</b></span>{currentOrder.items.map((line) => { const item = itemById(line.menuItemId); return <div className="cart-line" key={line.id ?? line.menuItemId}><div className="line-title"><span>{item?.name}</span><b>{money(lineUnitPrice(line) * line.quantity)}</b></div>{(line.modifiers?.length || line.note) && <small className="cart-extras">{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}<div className="line-controls"><span>{money(lineUnitPrice(line))} each</span><span className="quantity-controls"><button disabled aria-label="Decrease quantity">−</button><b>{line.quantity}</b><button disabled aria-label="Increase quantity">＋</button></span></div></div>; })}</div>}
                {cart.map((line) => { const item = itemById(line.menuItemId); const lineKey = line.id ?? line.menuItemId; return <div className="cart-line" key={lineKey}><div className="line-title"><span>{item?.name}</span><b>{money(lineUnitPrice(line) * line.quantity)}</b></div>{(line.modifiers?.length || line.note) && <small className="cart-extras">{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}<div className="line-controls"><span>{money(lineUnitPrice(line))} each</span><span className="quantity-controls"><button onClick={() => changeQuantity(lineKey, -1)} aria-label={`Decrease ${item?.name}`}>−</button><b>{line.quantity}</b><button onClick={() => changeQuantity(lineKey, 1)} aria-label={`Increase ${item?.name}`}>＋</button></span></div></div>; })}
                {cart.length === 0 && !currentOrder && <div className="cart-empty"><span>＋</span><b>Your ticket is looking fresh</b><small>Add menu items to get started</small></div>}
              </div>
              <button className="add-note" onClick={() => setNotice("Add item-specific instructions by customizing a menu item.")}>＋ &nbsp; Add a note or special request</button>
              <div className="totals"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Tax <small>(8%)</small></span><b>{money(tax)}</b></div><div className="total-line"><span>Total</span><b>{money(total)}</b></div></div>
              {currentOrder && cart.length === 0 ? <button className="send-button checkout-button" onClick={() => setCheckoutOrderId(currentOrder.id)}><span>Go to checkout</span><b>{money(lineTotal(currentOrder.items) * 1.08)} <i>→</i></b></button> : <button className="send-button" disabled={cart.length === 0} onClick={placeOrder}><span>Send to kitchen</span><b>{money(total)} <i>→</i></b></button>}
              <div className="ticket-help"><span>◉</span> You can split the bill at checkout</div>
            </section>
          </div>

          <div className="bottom-row"><section className="panel activity-panel"><div className="bottom-heading"><div><h3>Recent activity</h3><p>A little recap of what’s happening.</p></div><button onClick={() => setView("Reports")}>View all ↗</button></div><div className="activity-list">{data.orders.slice(-3).reverse().map((order, index) => <div className="activity-item" key={order.id}><span className={`activity-symbol symbol-${index} ${order.status === "cancelled" ? "activity-cancelled" : ""}`}>{order.status === "cancelled" ? "×" : order.status === "paid" ? "✓" : order.status === "ready" ? "♨" : "＋"}</span><span className="activity-copy"><b>{order.id} · {order.tableId ? `Table ${data.tables.find((table) => table.id === order.tableId)?.name}` : "Takeaway"}</b><small>{order.items.reduce((sum, line) => sum + line.quantity, 0)} items · {order.status}{order.cancellationReason ? ` · ${order.cancellationReason}` : ""}</small></span><span className="activity-time">{minutesAgo(order.createdAt)}</span></div>)}</div></section>
            <section className="panel kitchen-panel"><div className="bottom-heading"><div><h3>Kitchen queue <span className="live-pill"><i /> LIVE</span></h3><p>Keep every plate moving.</p></div><button onClick={() => setView("Kitchen")}>Open display ↗</button></div><div className="queue-summary"><div><span>IN PREP</span><b>{activeOrders.filter((order) => order.status === "preparing" || order.status === "new").length}</b></div><div><span>READY</span><b className="queue-ready">{activeOrders.filter((order) => order.status === "ready").length}</b></div><div><span>AVG TIME</span><b>{averageTicketTime ?? "—"} <small>{averageTicketTime === null ? "" : "min"}</small></b></div><div className="queue-art">♨</div></div></section></div>
          </> : <WorkflowPanel view={view} data={data} clockNow={clockNow} setView={setView} setTableStatus={setTableStatus} setOrderStatus={setOrderStatus} requestCancellation={requestCancellation} transferOrder={transferOrder} mergeTables={mergeTables} unmergeTable={unmergeTable} toggleMenuAvailability={toggleMenuAvailability} />}
        </section>
        <footer className="app-footer"><span>© 2026 Dine In</span><span>Made for good service <b>✳</b></span><div><button onClick={() => setNotice("Help center is coming soon.")}>Help center</button><i /> <button onClick={() => setNotice("All systems are operational.")}>System status <b className="system-dot" /></button></div></footer>
      </main>
      {notice && <div role="status" className="toast"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
      {customizingItem && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomizingItem(null); }}><section className="payment-dialog item-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-item-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">CUSTOMIZE ITEM</span><h2 id="custom-item-title">{customizingItem.name}</h2><p>{customizingItem.description}</p></div><button className="payment-close" aria-label="Close item options" onClick={() => setCustomizingItem(null)}>×</button></div>
        <div className="modifier-section"><div className="modifier-heading"><b>Add-ons &amp; preferences</b><small>Optional · choose any that apply</small></div>{modifiersByCategory[customizingItem.category].map((modifier) => <label className="modifier-option" key={modifier.id}><input type="checkbox" checked={customModifierIds.includes(modifier.id)} onChange={(event) => setCustomModifierIds((previous) => event.target.checked ? [...previous, modifier.id] : previous.filter((id) => id !== modifier.id))} /><span>{modifier.label}</span><b>{modifier.price > 0 ? `+${money(modifier.price)}` : "No charge"}</b></label>)}</div>
        <label className="instruction-field"><span>Kitchen instructions</span><textarea maxLength={120} value={customNote} onChange={(event) => setCustomNote(event.target.value)} placeholder="For example: sauce on the side, well done..."/><small>{customNote.length}/120</small></label>
        <div className="customize-footer"><div className="quantity-controls customize-quantity"><button aria-label="Decrease item quantity" disabled={customQuantity <= 1} onClick={() => setCustomQuantity((quantity) => Math.max(1, quantity - 1))}>−</button><b>{customQuantity}</b><button aria-label="Increase item quantity" onClick={() => setCustomQuantity((quantity) => quantity + 1)}>＋</button></div><button className="send-button payment-submit" onClick={confirmCustomizedItem}><span>Add to ticket</span><b>{money((customizingItem.price + modifiersByCategory[customizingItem.category].filter((modifier) => customModifierIds.includes(modifier.id)).reduce((sum, modifier) => sum + modifier.price, 0)) * customQuantity)} <i>→</i></b></button></div>
      </section></div>}
      {orderPendingCancellation && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelOrderId(null); }}><section className="payment-dialog cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">CANCEL TICKET · {orderPendingCancellation.id}</span><h2 id="cancel-title">Cancel this order?</h2><p>This removes the ticket from the kitchen queue. The reason will be kept in order history.</p></div><button className="payment-close" aria-label="Close cancellation" onClick={() => setCancelOrderId(null)}>×</button></div><label className="discount-row cancel-reason"><span>Reason</span><select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}><option>Guest changed their mind</option><option>Duplicate order</option><option>Item unavailable</option><option>Long wait time</option><option>Entered by mistake</option></select></label><div className="cancel-dialog-actions"><button onClick={() => setCancelOrderId(null)}>Keep order</button><button onClick={() => cancelOrder(orderPendingCancellation.id, cancelReason)}>Cancel ticket</button></div></section></div>}
      {checkoutOrder && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOrderId(null); }}><section className="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">PAYMENT · {checkoutOrder.id}</span><h2 id="payment-title">Complete checkout</h2><p>{checkoutOrder.tableId ? `Table ${data.tables.find((table) => table.id === checkoutOrder.tableId)?.name}` : "Takeaway order"} · {checkoutOrder.items.reduce((sum, line) => sum + line.quantity, 0)} items</p></div><button className="payment-close" aria-label="Close checkout" onClick={() => setCheckoutOrderId(null)}>×</button></div>
        <div className="payment-summary">{checkoutOrder.items.map((line) => { const item = itemById(line.menuItemId); return <div key={line.id ?? line.menuItemId}><span>{line.quantity} × {item?.name ?? "Menu item"}{(line.modifiers?.length || line.note) && <small className="payment-line-details">{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}</span><b>{money(lineUnitPrice(line) * line.quantity)}</b></div>; })}</div>
        <label className="discount-row"><span>Discount</span><select value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))}><option value={0}>No discount</option><option value={5}>5% off</option><option value={10}>10% off</option><option value={15}>15% off</option></select></label>
        <div className="payment-totals"><div><span>Subtotal</span><b>{money(checkoutSubtotal)}</b></div>{discountPercent > 0 && <div><span>Discount ({discountPercent}%)</span><b className="discount-value">−{money(checkoutDiscount)}</b></div>}<div><span>Tax <small>(8% after discount)</small></span><b>{money(checkoutTax)}</b></div><div className="payment-total"><span>Amount due</span><b>{money(checkoutTotal)}</b></div></div>
        {!splitPayment && <><div className="payment-method-heading"><b>Payment method</b><span>SIMULATED PAYMENT</span></div><div className="payment-methods">{(["UPI", "Card", "Cash"] as const).map((method) => <button key={method} className={paymentMethod === method ? "method-selected" : ""} aria-pressed={paymentMethod === method} onClick={() => setPaymentMethod(method)}><span>{method === "UPI" ? "⌁" : method === "Card" ? "▣" : "₹"}</span>{method}</button>)}</div></>}
        <label className="split-payment-option"><input type="checkbox" checked={splitPayment} onChange={(event) => setSplitPayment(event.target.checked)} /><span><b>Split bill between guests</b><small>Divide equally; choose a method per guest</small></span><i /></label>
        {splitPayment && <div className="split-methods"><label><span>Number of guests</span><select value={guestCount} onChange={(event) => { const count = Number(event.target.value); setGuestCount(count); setGuestMethods(Array.from({ length: count }, (_, index) => guestMethods[index] ?? paymentMethod)); }}>{Array.from({ length: 7 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} guests</option>)}</select></label>{Array.from({ length: guestCount }, (_, index) => <label key={index}><span>Guest {index + 1} - {money((Math.floor(Math.round(checkoutTotal * 100) / guestCount) + (index < Math.round(checkoutTotal * 100) % guestCount ? 1 : 0)) / 100)}</span><select value={guestMethods[index] ?? paymentMethod} onChange={(event) => setGuestMethods((previous) => previous.map((method, methodIndex) => methodIndex === index ? event.target.value as PaymentMethod : method))}><option>UPI</option><option>Card</option><option>Cash</option></select></label>)}</div>}
        <button className="send-button payment-submit" onClick={completePayment}><span>Complete simulated payment</span><b>{money(checkoutTotal)} <i>→</i></b></button><p className="payment-note">No real payment will be taken.</p>
      </section></div>}
    </div>
  );
}

type WorkflowProps = {
  view: string;
  data: PosData;
  clockNow: number | null;
  setView: (view: string) => void;
  setTableStatus: (tableId: string, status: Table["status"]) => void;
  setOrderStatus: (orderId: string, status: Order["status"]) => void;
  requestCancellation: (orderId: string) => void;
  transferOrder: (orderId: string, tableId: string) => void;
  mergeTables: (primaryId: string, secondaryId: string) => void;
  unmergeTable: (secondaryId: string) => void;
  toggleMenuAvailability: (menuItemId: string) => void;
};

function WorkflowPanel({ view, data, clockNow, setView, setTableStatus, setOrderStatus, requestCancellation, transferOrder, mergeTables, unmergeTable, toggleMenuAvailability }: WorkflowProps) {
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [reportRange, setReportRange] = useState("Today");
  const openOrders = data.orders.filter((order) => order.status !== "paid" && order.status !== "cancelled");
  const tableLabel = (tableId: string | null) => tableId ? `Table ${data.tables.find((table) => table.id === tableId)?.name ?? "—"}` : "Takeaway";
  const orderAmount = (order: Order) => order.items.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
  const minutesAgo = (date: string) => clockNow === null ? "—" : (() => { const minutes = Math.max(0, Math.floor((clockNow - new Date(date).getTime()) / 60000)); return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`; })();
  const rangeEnd = clockNow === null ? null : new Date(clockNow);
  const rangeStart = rangeEnd ? new Date(rangeEnd) : null;
  if (rangeStart) {
    rangeStart.setHours(0, 0, 0, 0);
    if (reportRange === "This week") rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
    if (reportRange === "This month") rangeStart.setDate(1);
  }
  const withinRange = (createdAt: string) => rangeStart !== null && rangeEnd !== null && new Date(createdAt) >= rangeStart && new Date(createdAt) <= rangeEnd;
  const reportOrders = data.orders.filter((order) => withinRange(order.createdAt));
  const reportTransactions = (data.transactions ?? []).filter((transaction) => withinRange(transaction.createdAt));
  const completedInRange = new Set(reportTransactions.map((transaction) => transaction.orderId));
  const openInRange = reportOrders.filter((order) => order.status !== "paid" && order.status !== "cancelled").length;
  const statusText: Record<Order["status"], string> = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served", paid: "Paid", cancelled: "Cancelled" };

  if (view === "Kitchen") return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Live kitchen queue</h2><p>Move each ticket through prep as the team works.</p></div><span className="live-pill"><i /> LIVE</span></div>
    <div className="kitchen-board">{openOrders.length === 0 && <div className="workflow-empty">No open tickets. New orders will appear here.</div>}
      {openOrders.map((order) => <article className="workflow-card kitchen-ticket" key={order.id}><div className="workflow-card-head"><div><span className="ticket-kicker">{tableLabel(order.tableId)} · {order.type.toUpperCase()}</span><h3>{order.id}</h3></div><span className={`status-pill status-${order.status}`}>{statusText[order.status]}</span></div><div className="kitchen-items">{order.items.map((line) => <div key={line.id ?? line.menuItemId}><b>{line.quantity}×</b><span>{itemById(line.menuItemId)?.name ?? "Removed menu item"}{(line.modifiers?.length || line.note) && <small className="kitchen-item-note">{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}</span></div>)}</div><div className="kitchen-ticket-foot"><span>Received {minutesAgo(order.createdAt)}</span><span className="ticket-actions">{order.status === "new" && <button onClick={() => setOrderStatus(order.id, "preparing")}>Start preparing →</button>}{order.status === "preparing" && <button onClick={() => setOrderStatus(order.id, "ready")}>Mark ready →</button>}{order.status === "ready" && <button onClick={() => setOrderStatus(order.id, "served")}>Mark served →</button>}{order.status === "served" && <span className="served-label">Waiting for checkout</span>}{(order.status === "new" || order.status === "preparing") && <button className="cancel-ticket" onClick={() => requestCancellation(order.id)}>Cancel</button>}</span></div></article>)}
    </div>
  </div>;

  if (view === "Floor plan") return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Table management</h2><p>Choose a table to update its state or move an open ticket.</p></div><button className="primary-button" onClick={() => setView("New order")}>＋ Start an order</button></div>
    <div className="floor-manager-grid">{data.tables.map((table) => {
      const orders = openOrders.filter((order) => order.tableId === table.id);
      const joinedSeats = table.seats + data.tables.filter((candidate) => candidate.mergedInto === table.id).reduce((sum, candidate) => sum + candidate.seats, 0);
      return <article className="workflow-card table-manager-card" key={table.id}><div className="workflow-card-head"><div><span className="ticket-kicker">{joinedSeats} SEATS</span><h3>Table {table.name}</h3></div><span className={`status-pill table-status-${table.status}`}>{table.status === "merged" ? "Joined" : table.status}</span></div>
        {orders.length ? <div className="table-open-orders">{orders.map((order) => <div key={order.id} className="transfer-row"><span><b>{order.id}</b><small>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items · {money(orderAmount(order))}</small></span><select aria-label={`Transfer order ${order.id}`} value={transferTargets[order.id] ?? ""} onChange={(event) => setTransferTargets((previous) => ({ ...previous, [order.id]: event.target.value }))}><option value="">Transfer to…</option>{data.tables.filter((target) => target.id !== table.id && !target.mergedInto && !data.tables.some((candidate) => candidate.mergedInto === target.id) && target.status !== "reserved" && target.status !== "cleaning").map((target) => <option key={target.id} value={target.id}>Table {target.name}</option>)}</select><button disabled={!transferTargets[order.id]} onClick={() => { const target = transferTargets[order.id]; if (target) transferOrder(order.id, target); }}>Move</button></div>)}</div> : <p className="table-no-order">No open ticket</p>}
        {table.mergedInto ? <div className="merged-table-control"><span>Joined with Table {data.tables.find((candidate) => candidate.id === table.mergedInto)?.name}</span><button onClick={() => unmergeTable(table.id)}>Unmerge tables</button></div> : <><div className="table-state-actions"><span>Set state</span>{(["available", "occupied", "reserved", "cleaning"] as const).map((status) => <button key={status} className={table.status === status ? "selected-state" : ""} onClick={() => setTableStatus(table.id, status)}>{status[0].toUpperCase() + status.slice(1)}</button>)}</div><div className="merge-control"><select aria-label={`Merge Table ${table.name} with`} value={mergeTargets[table.id] ?? ""} onChange={(event) => setMergeTargets((previous) => ({ ...previous, [table.id]: event.target.value }))}><option value="">Merge with another table…</option>{data.tables.filter((target) => target.id !== table.id && !target.mergedInto && !data.tables.some((candidate) => candidate.mergedInto === target.id) && target.status !== "reserved" && target.status !== "cleaning").map((target) => <option key={target.id} value={target.id}>Table {target.name}</option>)}</select><button disabled={!mergeTargets[table.id]} onClick={() => { const secondary = mergeTargets[table.id]; if (secondary) { mergeTables(table.id, secondary); setMergeTargets((previous) => ({ ...previous, [table.id]: "" })); } }}>Merge tables</button></div></>}
      </article>;
    })}</div>
  </div>;

  if (view === "Menu") return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Menu availability</h2><p>Toggle an item off the ordering screen when it sells out.</p></div><span className="menu-count">{menu.length} items · {menu.filter((item) => !(data.unavailableMenuIds ?? []).includes(item.id)).length} available</span></div>
    <div className="availability-grid">{menu.map((item) => { const unavailable = (data.unavailableMenuIds ?? []).includes(item.id); return <article className={`workflow-card availability-card ${unavailable ? "is-unavailable" : ""}`} key={item.id}><span className={`food-art ${item.color}`}><span>{item.emoji}</span></span><div className="availability-copy"><span className="ticket-kicker">{item.category.toUpperCase()}</span><h3>{item.name}</h3><p>{item.description}</p><b>{money(item.price)}</b></div><button className={`availability-toggle ${unavailable ? "off" : ""}`} aria-pressed={!unavailable} onClick={() => toggleMenuAvailability(item.id)}>{unavailable ? "Unavailable" : "Available"}<i /></button></article>; })}</div>
  </div>;

  return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Service reports</h2><p>Review the activity recorded on this device.</p></div><select className="report-select" value={reportRange} onChange={(event) => setReportRange(event.target.value)}><option>Today</option><option>This week</option><option>This month</option></select></div>
    <div className="report-metrics"><article className="workflow-card report-metric"><span>ORDERS IN PERIOD</span><b>{reportOrders.length}</b><small>{completedInRange.size} completed / {openInRange} open</small></article><article className="workflow-card report-metric"><span>COMPLETED SALES</span><b>{money(reportTransactions.reduce((sum, transaction) => sum + transaction.amount, 0))}</b><small>From recorded payments in this period</small></article><article className="workflow-card report-metric"><span>TABLE OCCUPANCY</span><b>{data.tables.filter((table) => table.status === "occupied").length} / {data.tables.length}</b><small>{data.tables.filter((table) => table.status === "available").length} available right now</small></article><article className="workflow-card report-chart"><div className="report-chart-head"><div><span>SAMPLE SALES PULSE</span><b>{reportRange}</b></div><span className="green-text">Illustrative sample data</span></div><div className="chart-area"><div className="chart-y"><span>INR 800</span><span>INR 600</span><span>INR 400</span><span>INR 200</span><span>INR 0</span></div><div className="chart-plot"><div className="chart-grid-lines"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 700 170" preserveAspectRatio="none" role="img" aria-label="Sample sales trend"><defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8dbb96" stopOpacity=".25"/><stop offset="1" stopColor="#8dbb96" stopOpacity="0"/></linearGradient></defs><path d="M0,132 C46,120 58,98 103,111 S157,145 205,90 S275,108 315,76 S365,88 412,63 S470,83 511,49 S575,67 610,30 S661,44 700,12 L700,170 L0,170Z" fill="url(#sales-fill)"/><path d="M0,132 C46,120 58,98 103,111 S157,145 205,90 S275,108 315,76 S365,88 412,63 S470,83 511,49 S575,67 610,30 S661,44 700,12" fill="none" stroke="#4c9066" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x"><span>10 AM</span><span>11 AM</span><span>12 PM</span><span>1 PM</span><span>2 PM</span><span>3 PM</span><span>4 PM</span></div></div></div></article></div>
    <section className="workflow-card transaction-history"><div className="transaction-history-head"><div><h3>Transaction history</h3><p>Completed simulated payments on this device.</p></div><span>{(data.transactions ?? []).length} payments</span></div>{(data.transactions ?? []).length === 0 ? <div className="transaction-empty">No completed payments yet.</div> : <div className="transaction-list">{[...(data.transactions ?? [])].slice(-8).reverse().map((transaction) => <div className="transaction-row" key={transaction.id}><span className="transaction-icon">{transaction.method === "UPI" ? "⌁" : transaction.method === "Card" ? "▣" : "₹"}</span><span className="transaction-description"><b>{transaction.orderId}</b><small>{transaction.splitLabel ? transaction.splitLabel + " - " : ""}{transaction.method} · {new Date(transaction.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></span><strong>{money(transaction.amount)}</strong></div>)}</div>}</section>
  </div>;
}
