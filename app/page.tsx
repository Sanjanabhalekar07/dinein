"use client";

import { useEffect, useMemo, useState } from "react";
import { initialData, menu, type Category, type DeliveryDetails, type MenuItem, type MenuModifier, type MenuVariant, type Order, type OrderLine, type PaymentMethod, type PosData, type ReservationDetails, type Table } from "@/lib/pos-data";
import { fetchPosSnapshot, persistPosSnapshot } from "@/lib/pos-service";

const categories: Category[] = ["All", "Starters", "Soups", "Mains", "Breads & Sides", "Pizza", "Drinks", "Desserts"];
type StaffRole = "Manager" | "Cashier" | "Waiter" | "Kitchen";
type Theme = "light" | "dark";
const navigationItems: { view: string; label: string; icon: string }[] = [
  { view: "New order", label: "New order", icon: "▦" },
  { view: "Floor plan", label: "Floor plan", icon: "⌑" },
  { view: "Kitchen", label: "Kitchen display", icon: "♨" },
  { view: "Menu", label: "Menu", icon: "☷" },
  { view: "Reports", label: "Reports", icon: "▤" },
];
const roleViews: Record<StaffRole, string[]> = {
  Manager: ["New order", "Floor plan", "Kitchen", "Menu", "Reports"],
  Cashier: ["New order", "Floor plan", "Reports"],
  Waiter: ["New order", "Floor plan", "Kitchen"],
  Kitchen: ["Kitchen"],
};
const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);
const moneyRounded = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const itemById = (id: string, items: MenuItem[] = menu) => items.find((item) => item.id === id);
const modifiersByCategory: Record<MenuItem["category"], MenuModifier[]> = {
  Starters: [{ id: "extra-sauce", label: "Extra sauce", price: 30 }, { id: "no-garnish", label: "No garnish", price: 0 }],
  Mains: [{ id: "extra-protein", label: "Extra protein", price: 120 }, { id: "no-onion", label: "No onion", price: 0 }],
  Pizza: [{ id: "extra-cheese", label: "Extra mozzarella", price: 60 }, { id: "chili-oil", label: "Chili oil", price: 30 }],
  Soups: [{ id: "soup-cream", label: "Add cream", price: 25 }, { id: "soup-croutons", label: "Extra croutons", price: 30 }],
  "Breads & Sides": [{ id: "extra-butter", label: "Extra butter", price: 20 }, { id: "roasted-garlic", label: "Roasted garlic", price: 25 }],
  Drinks: [{ id: "extra-syrup", label: "Add flavor syrup", price: 30 }, { id: "less-ice", label: "Less ice", price: 0 }],
  Desserts: [{ id: "ice-cream", label: "Add ice cream", price: 80 }, { id: "extra-cream", label: "Extra cream", price: 40 }],
};
const lineUnitPrice = (line: OrderLine, items: MenuItem[] = menu) => (line.variant?.price ?? itemById(line.menuItemId, items)?.price ?? 0) + (line.modifiers ?? []).reduce((sum, modifier) => sum + modifier.price, 0);
const lineVariantLabel = (line: OrderLine) => line.variant ? `${line.variant.label} · ` : "";
const startingPrice = (item: MenuItem) => item.variants?.length ? Math.min(...item.variants.map((variant) => variant.price)) : item.price;
const dateTimeForInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const formatReservationTime = (date: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(date));
const defaultFloorPosition = (index: number) => index < 4
  ? { column: index + 1, row: 1 }
  : index < 7
    ? { column: index - 2, row: 2 }
    : { column: (index - 7) % 4 + 1, row: 3 + Math.floor((index - 7) / 4) };
const allocateCents = (total: number, weights: number[]) => {
  const cents = Math.round(total * 100);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (!weightTotal) return weights.map(() => 0);
  const raw = weights.map((weight) => cents * weight / weightTotal);
  const allocated = raw.map(Math.floor);
  for (let remainder = cents - allocated.reduce((sum, amount) => sum + amount, 0), index = 0; remainder > 0; remainder--, index++) allocated[index % allocated.length]++;
  return allocated.map((amount) => amount / 100);
};

export default function Home() {
  const [data, setData] = useState<PosData>(initialData);
  const [selectedTable, setSelectedTable] = useState<string | null>("t2");
  const [category, setCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("New order");
  const [orderType, setOrderType] = useState<Order["type"]>("Dine in");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [storageErrorAction, setStorageErrorAction] = useState<"load" | "save">("load");
  const [loadRetry, setLoadRetry] = useState(0);
  const [saveRetry, setSaveRetry] = useState(0);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [splitPayment, setSplitPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [guestCount, setGuestCount] = useState(2);
  const [guestMethods, setGuestMethods] = useState<PaymentMethod[]>(["UPI", "Cash"]);
  const [splitMode, setSplitMode] = useState<"equal" | "items">("equal");
  const [itemGuests, setItemGuests] = useState<Record<number, number>>({});
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customModifierIds, setCustomModifierIds] = useState<string[]>([]);
  const [customVariantId, setCustomVariantId] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [clockNow, setClockNow] = useState<number | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("Guest changed their mind");
  const [reservationTableId, setReservationTableId] = useState<string | null>(null);
  const [reservationGuestName, setReservationGuestName] = useState("");
  const [reservationGuests, setReservationGuests] = useState(2);
  const [reservationTime, setReservationTime] = useState("");
  const [menuEditorId, setMenuEditorId] = useState<string | null>(null);
  const [menuFormName, setMenuFormName] = useState("");
  const [menuFormDescription, setMenuFormDescription] = useState("");
  const [menuFormCategory, setMenuFormCategory] = useState<MenuItem["category"]>("Starters");
  const [menuFormPrice, setMenuFormPrice] = useState("");
  const [menuFormEmoji, setMenuFormEmoji] = useState("\u{1F37D}");
  const [menuFormVariants, setMenuFormVariants] = useState("");
  const [menuFormAvailable, setMenuFormAvailable] = useState(true);
  const [menuEditorOpen, setMenuEditorOpen] = useState(false);
  const [role, setRole] = useState<StaffRole>("Manager");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPosSnapshot().then((saved) => {
      if (cancelled) return;
      if (saved) setData({ ...initialData, ...saved, unavailableMenuIds: saved.unavailableMenuIds ?? [], transactions: saved.transactions ?? [], menuItems: saved.menuItems ?? menu });
      setStorageReady(true);
      setStorageStatus("saved");
    }).catch(() => {
      if (cancelled) return;
      setStorageReady(false);
      setStorageErrorAction("load");
      setStorageStatus("error");
    }).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [loadRetry]);

  useEffect(() => {
    if (!loaded || !storageReady) return;
    const timer = window.setTimeout(() => {
      setStorageStatus("saving");
      persistPosSnapshot(data).then(() => setStorageStatus("saved")).catch(() => {
        setStorageErrorAction("save");
        setStorageStatus("error");
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [data, loaded, storageReady, saveRetry]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let savedTheme: Theme = "light";
      try {
        const stored = window.localStorage.getItem("dinein-theme");
        if (stored === "dark" || stored === "light") savedTheme = stored;
      } catch { /* Use light theme when storage is unavailable. */ }
      document.documentElement.dataset.theme = savedTheme;
      setTheme(savedTheme);
      setThemeLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem("dinein-theme", theme); } catch { /* Theme preference remains in memory when storage is unavailable. */ }
  }, [theme, themeLoaded]);
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

  const menuItems = data.menuItems ?? menu;
  const visibleMenu = useMemo(() => menuItems.filter((item) => (category === "All" || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase())), [category, search, menuItems]);
  const subtotal = cart.reduce((sum, line) => sum + lineUnitPrice(line, menuItems) * line.quantity, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const activeOrders = data.orders.filter((order) => order.status !== "paid" && order.status !== "cancelled");
  const serviceOrders = activeOrders.filter((order) => order.type === orderType && order.type !== "Dine in");
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
  const allowedViews = roleViews[role];
  const canTakePayment = role === "Manager" || role === "Cashier";
  const canManageMenu = role === "Manager";
  const currentOrder = orderType === "Dine in" ? selectedTable ? activeOrders.find((order) => order.tableId === selectedTable) : undefined : serviceOrders.find((order) => order.id === selectedServiceOrderId) ?? serviceOrders[serviceOrders.length - 1];
  const checkoutOrder = data.orders.find((order) => order.id === checkoutOrderId && order.status !== "paid" && order.status !== "cancelled");
  const orderPendingCancellation = data.orders.find((order) => order.id === cancelOrderId && order.status !== "paid" && order.status !== "cancelled");
  const reservationTable = data.tables.find((table) => table.id === reservationTableId);
  const checkoutSubtotal = checkoutOrder ? lineTotal(checkoutOrder.items) : 0;
  const checkoutDiscount = checkoutSubtotal * discountPercent / 100;
  const checkoutTax = (checkoutSubtotal - checkoutDiscount) * 0.08;
  const checkoutTotal = checkoutSubtotal - checkoutDiscount + checkoutTax;

  function addToCart(item: MenuItem) {
    setCustomizingItem(item);
    setCustomQuantity(1);
    setCustomModifierIds([]);
    setCustomVariantId(item.variants?.[0]?.id ?? "");
    setCustomNote("");
  }

  function confirmCustomizedItem() {
    if (!customizingItem) return;
    const line: OrderLine = {
      id: crypto.randomUUID(),
      menuItemId: customizingItem.id,
      quantity: customQuantity,
      variant: customizingItem.variants?.find((variant) => variant.id === customVariantId),
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
    if (orderType === "Dine in" && !selectedTable) { setNotice("Choose a table before sending this dine-in order."); return; }
    let deliveryDetails: DeliveryDetails | undefined;
    if (orderType === "Delivery") {
      const normalizedPhone = deliveryPhone.replace(/[\s()-]/g, "");
      if (deliveryName.trim().length < 2) { setNotice("Enter the delivery recipient's name."); return; }
      if (!/^\+?\d{10,15}$/.test(normalizedPhone)) { setNotice("Enter a valid delivery phone number."); return; }
      if (deliveryAddress.trim().length < 8) { setNotice("Enter a complete delivery address."); return; }
      deliveryDetails = { recipientName: deliveryName.trim(), phone: normalizedPhone, address: deliveryAddress.trim() };
    }
    const orderId = `#${1051 + data.orders.length}`;
    const order: Order = { id: orderId, tableId: orderType === "Dine in" ? selectedTable : null, type: orderType, deliveryDetails, status: "new", items: cart, createdAt: new Date().toISOString() };
    setData((previous) => ({
      ...previous,
      orders: [...previous.orders, order],
      tables: order.tableId ? previous.tables.map((table) => table.id === order.tableId ? { ...table, status: "occupied", guests: table.guests ?? 2 } : table) : previous.tables,
    }));
    setCart([]);
    if (orderType !== "Dine in") setSelectedServiceOrderId(order.id);
    setNotice(`${order.id} sent to the kitchen`);
  }

  function printBill() {
    const clearPrintTarget = () => { delete document.documentElement.dataset.printTarget; };
    document.documentElement.dataset.printTarget = "bill";
    window.addEventListener("afterprint", clearPrintTarget, { once: true });
    window.setTimeout(clearPrintTarget, 15000);
    window.print();
  }

  function completePayment() {
    if (!checkoutOrder) return;
    const order = checkoutOrder;
    const createdAt = new Date().toISOString();
    const itemWeights = Array.from({ length: guestCount }, (_, guestIndex) => order.items.reduce((sum, line, lineIndex) => (itemGuests[lineIndex] ?? 0) === guestIndex ? sum + lineUnitPrice(line, menuItems) * line.quantity : sum, 0));
    if (splitPayment && splitMode === "items" && itemWeights.some((weight) => weight === 0)) {
      setNotice("Assign at least one order line to every guest before checkout.");
      return;
    }
    const amounts = splitPayment ? splitMode === "items" ? allocateCents(checkoutTotal, itemWeights) : allocateCents(checkoutTotal, Array.from({ length: guestCount }, () => 1)) : [checkoutTotal];
    const methods = Array.from({ length: splitPayment ? guestCount : 1 }, (_, index) => ({
      method: splitPayment ? guestMethods[index] ?? paymentMethod : paymentMethod,
      amount: amounts[index] ?? 0,
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
    setData((previous) => ({ ...previous, tables: previous.tables.map((table) => table.id === tableId ? { ...table, status, guests: status === "occupied" ? table.guests ?? 2 : undefined, reservation: status === "reserved" ? table.reservation : undefined } : table) }));
  }

  function requestReservation(tableId: string) {
    const table = data.tables.find((candidate) => candidate.id === tableId);
    if (!table || table.mergedInto) return;
    const defaultTime = new Date(Date.now() + 30 * 60000);
    setReservationTableId(tableId);
    setReservationGuestName(table.reservation?.guestName ?? "");
    setReservationGuests(table.reservation?.guests ?? 2);
    setReservationTime(dateTimeForInput(table.reservation ? new Date(table.reservation.time) : defaultTime));
  }

  function saveReservation() {
    const table = data.tables.find((candidate) => candidate.id === reservationTableId);
    if (!table) return;
    const capacity = table.seats + data.tables.filter((candidate) => candidate.mergedInto === table.id).reduce((sum, candidate) => sum + candidate.seats, 0);
    if (!reservationGuestName.trim()) { setNotice("Enter a guest name for this reservation."); return; }
    if (reservationGuests < 1 || reservationGuests > capacity) { setNotice(`This table can seat up to ${capacity} guests.`); return; }
    const time = new Date(reservationTime);
    if (!reservationTime || Number.isNaN(time.getTime()) || time.getTime() < Date.now()) { setNotice("Choose a future reservation time."); return; }
    const reservation: ReservationDetails = { guestName: reservationGuestName.trim(), guests: reservationGuests, time: time.toISOString() };
    setData((previous) => ({ ...previous, tables: previous.tables.map((candidate) => candidate.id === table.id ? { ...candidate, status: "reserved", guests: undefined, reservation } : candidate) }));
    setReservationTableId(null);
    setNotice(`Reservation saved for ${reservation.guestName}.`);
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

  function openMenuEditor(item?: MenuItem) {
    setMenuEditorId(item?.id ?? null);
    setMenuFormName(item?.name ?? "");
    setMenuFormDescription(item?.description ?? "");
    setMenuFormCategory(item?.category ?? "Starters");
    setMenuFormPrice(item ? String(item.price) : "");
    setMenuFormEmoji(item?.emoji ?? "\u{1F37D}");
    setMenuFormVariants((item?.variants ?? []).map((variant) => `${variant.label} | ${variant.price}`).join("\n"));
    setMenuFormAvailable(item ? !(data.unavailableMenuIds ?? []).includes(item.id) : true);
    setMenuEditorOpen(true);
  }

  function saveMenuItem() {
    const name = menuFormName.trim();
    const price = Number(menuFormPrice);
    if (!name || !menuFormDescription.trim() || !Number.isFinite(price) || price <= 0 || !menuFormEmoji.trim()) {
      setNotice("Enter a name, description, icon, and price greater than zero.");
      return;
    }
    const variants: MenuVariant[] = [];
    for (const [index, row] of menuFormVariants.split("\n").map((entry) => entry.trim()).filter(Boolean).entries()) {
      const [labelText, priceText, ...extra] = row.split("|");
      const label = labelText.trim();
      const variantPrice = Number(priceText?.trim());
      if (!label || !priceText || extra.length || !Number.isFinite(variantPrice) || variantPrice <= 0) {
        setNotice(`Variant ${index + 1} needs a name and a price greater than zero, separated by |.`);
        return;
      }
      const existingId = menuEditorId ? menuItems.find((candidate) => candidate.id === menuEditorId)?.variants?.find((variant) => variant.label.toLowerCase() === label.toLowerCase())?.id : undefined;
      variants.push({ id: existingId ?? `variant-${Date.now()}-${index}`, label, price: variantPrice });
    }
    const existing = menuEditorId ? menuItems.find((item) => item.id === menuEditorId) : undefined;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `item-${Date.now()}`;
    const id = existing?.id ?? (menuItems.some((item) => item.id === slug) ? `${slug}-${Date.now()}` : slug);
    const colors = ["peach", "yellow", "green", "rose", "blue"];
    const item: MenuItem = { id, name, description: menuFormDescription.trim(), category: menuFormCategory, price, emoji: menuFormEmoji.trim(), color: existing?.color ?? colors[menuItems.length % colors.length], ...(variants.length ? { variants } : {}) };
    setData((previous) => ({
      ...previous,
      menuItems: existing ? (previous.menuItems ?? menu).map((candidate) => candidate.id === id ? item : candidate) : [...(previous.menuItems ?? menu), item],
      unavailableMenuIds: menuFormAvailable ? (previous.unavailableMenuIds ?? []).filter((itemId) => itemId !== id) : (previous.unavailableMenuIds ?? []).includes(id) ? previous.unavailableMenuIds : [...(previous.unavailableMenuIds ?? []), id],
    }));
    setMenuEditorOpen(false);
    setNotice(existing ? `${name} updated.` : `${name} added to the menu.`);
  }

  function addTable() {
    setData((previous) => {
      const nextNumber = previous.tables.reduce((largest, table) => Math.max(largest, Number(table.name) || 0), 0) + 1;
      const name = String(nextNumber).padStart(2, "0");
      return { ...previous, tables: [...previous.tables, { id: `t${nextNumber}`, name, seats: 4, status: "available", floorPosition: defaultFloorPosition(previous.tables.length) }] };
    });
    setNotice("A new 4-seat table was added to the floor.");
  }

  function moveFloorTable(tableId: string, deltaColumn: number, deltaRow: number) {
    setData((previous) => {
      const positioned = previous.tables.map((table, index) => ({ ...table, floorPosition: table.floorPosition ?? defaultFloorPosition(index) }));
      const source = positioned.find((table) => table.id === tableId);
      if (!source || source.status === "merged") return previous;
      const from = source.floorPosition!;
      const to = { column: Math.max(1, Math.min(4, from.column + deltaColumn)), row: Math.max(1, Math.min(6, from.row + deltaRow)) };
      if (to.column === from.column && to.row === from.row) return previous;
      const occupant = positioned.find((table) => table.id !== tableId && table.floorPosition?.column === to.column && table.floorPosition?.row === to.row);
      return { ...previous, tables: positioned.map((table) => table.id === tableId ? { ...table, floorPosition: to } : table.id === occupant?.id ? { ...table, floorPosition: from } : table) };
    });
  }

  function changeRole(nextRole: StaffRole) {
    setRole(nextRole);
    setView(roleViews[nextRole][0]);
    setCart([]);
    setRoleMenuOpen(false);
  }

  function tableOrderLines(table: Table) {
    return activeOrders.filter((order) => order.tableId === table.id).flatMap((order) => order.items);
  }

  function lineTotal(lines: OrderLine[]) {
    return lines.reduce((sum, line) => sum + lineUnitPrice(line, menuItems) * line.quantity, 0);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Dine In home"><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9.2"/><circle cx="16" cy="16" r="5.7"/><path d="M4.5 6.5v6m-2.1-6v4.1a2.1 2.1 0 0 0 4.2 0V6.5M4.5 12.6v12.9m23-19-3.2 8.2v10.8m0-10.8h3.2V6.5"/></svg></span><span>Dine In<small>RESTAURANT OS</small></span></a>
        <div className="side-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigationItems.filter((item) => allowedViews.includes(item.view)).map((item) => <button key={item.view} className={`nav-link ${view === item.view || (item.view === "New order" && view === "Takeaway") ? "active" : ""}`} onClick={() => setView(item.view)}><span className="nav-icon">{item.icon}</span> {item.label}{item.view === "Kitchen" && <span className="nav-badge">{activeOrders.filter((order) => order.status === "new" || order.status === "preparing").length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-label">TODAY AT A GLANCE</div>
          <div className="mini-stats"><span>Paid orders today</span><strong>{paidToday.size}</strong></div>
          <div className="mini-stats"><span>Payments recorded</span><strong>{todayTransactions.length}</strong></div>
          <div className="side-divider" />
          <div className="staff-role-wrap"><button className="staff-card" aria-expanded={roleMenuOpen} aria-haspopup="menu" onClick={() => setRoleMenuOpen((open) => !open)}><span className="avatar">AM</span><span><b>Sanjana Bhalekar</b><small>{role} | Demo role</small></span><span className="more">...</span></button>{roleMenuOpen && <div className="role-menu" role="menu" aria-label="Choose demo staff role">{(["Manager", "Cashier", "Waiter", "Kitchen"] as const).map((nextRole) => <button role="menuitemradio" aria-checked={role === nextRole} className={role === nextRole ? "selected-role" : ""} key={nextRole} onClick={() => changeRole(nextRole)}><span>{nextRole}</span><small>{role === nextRole ? "Current role" : nextRole === "Manager" ? "Full workspace access" : nextRole === "Cashier" ? "Orders and payments" : nextRole === "Waiter" ? "Floor and kitchen" : "Kitchen display"}</small></button>)}</div>}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <b>{view}</b></div>
          <div className="top-actions"><span className="open-status"><i /> POS ready</span><button className={`storage-indicator storage-${storageStatus}`} aria-live="polite" onClick={storageStatus === "error" ? () => { if (storageErrorAction === "load") { setStorageStatus("loading"); setLoadRetry((attempt) => attempt + 1); } else { setStorageStatus("saving"); setSaveRetry((attempt) => attempt + 1); } } : undefined} disabled={storageStatus !== "error"} title={storageStatus === "error" ? "Retry local storage" : "Local POS data status"}><i />{storageStatus === "loading" ? "Loading local data" : storageStatus === "saving" ? "Saving locally" : storageStatus === "error" ? "Storage issue · Retry" : "Saved on this device"}</button><span className="top-divider" /><span className="date-label">{dateLabel}</span><button className="icon-button theme-toggle" aria-pressed={theme === "dark"} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>{theme === "dark" ? "\u263c" : "\u263e"}</button><button className="icon-button" aria-label="Notifications" onClick={() => setNotice("You’re all caught up.")}>♧<i className="notification-dot" /></button><span className="avatar top-avatar">AM</span></div>
        </header>

        <section className="page-content">
          <div className="welcome-row"><div><div className="eyebrow">{servicePeriod} SERVICE <span>·</span> LOCAL</div><h1>{view === "Floor plan" ? "Your floor, at a glance." : view === "Kitchen" ? "Kitchen display" : view === "Reports" ? "Service overview" : view === "Menu" ? "Explore the menu." : greeting + ", Sanjana"}</h1><p className="subtitle">{view === "New order" ? "Live service overview from this device." : "A live snapshot of your restaurant service."}</p></div><div className="welcome-actions">{allowedViews.includes("Reports") && <button className="secondary-button" onClick={() => setView("Reports")}>◷ <span>Shift summary</span></button>}{role !== "Kitchen" && <button className="primary-button" onClick={() => { setView("New order"); setCart([]); }}>＋ <span>New order</span></button>}</div></div>

          {view === "New order" ? <>
          <div className="metric-grid">
            <article className="metric-card"><div className="metric-top"><span>Today sales</span><span className="metric-icon sales-icon">₹</span></div><div className="metric-value metric-currency">{moneyRounded(todaySales)}</div><div className="metric-foot">{todayTransactions.length} payments recorded today</div></article>
            <article className="metric-card"><div className="metric-top"><span>Open orders</span><span className="metric-icon order-icon">☷</span></div><div className="metric-value">{activeOrders.length}<span className="metric-unit">orders</span></div><div className="metric-foot"><b className="green-text">{activeOrders.filter((order) => order.status === "preparing").length} preparing</b><span className="foot-sep">·</span>{activeOrders.filter((order) => order.status === "ready").length} ready</div></article>
            <article className="metric-card"><div className="metric-top"><span>Tables occupied</span><span className="metric-icon table-icon">⌑</span></div><div className="metric-value">{occupied}<span className="metric-unit">/ {serviceTables.length} tables</span></div><div className="metric-foot">{serviceTables.length - occupied} available · {Math.round((occupied / Math.max(1, serviceTables.length)) * 100)}% capacity</div><div className="metric-progress occupancy"><i style={{ width: `${Math.min(100, (occupied / Math.max(1, serviceTables.length)) * 100)}%` }} /></div></article>
            <article className="metric-card"><div className="metric-top"><span>Avg. ticket time</span><span className="metric-icon time-icon">◷</span></div><div className="metric-value">{averageTicketTime ?? "—"}{averageTicketTime !== null && <span className="metric-unit">min</span>}</div><div className="metric-foot">{completedDurations.length} completed tickets today</div></article>
          </div>

          {view === "New order" ? <div className="workspace-heading"><div><h2>Start an order</h2><p>Choose a table, then add a few guest favorites.</p></div><button className="text-button" onClick={() => setView("Floor plan")}>View floor plan <span>↗</span></button></div> : null}

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
                    const position = table.floorPosition ?? defaultFloorPosition(index);
                    return <button key={table.id} onClick={() => { setSelectedTable(selectionId); setCart([]); setView("New order"); }} onKeyDown={(event) => { const delta = event.key === "ArrowLeft" ? [-1, 0] : event.key === "ArrowRight" ? [1, 0] : event.key === "ArrowUp" ? [0, -1] : event.key === "ArrowDown" ? [0, 1] : null; if (delta) { event.preventDefault(); moveFloorTable(table.id, delta[0], delta[1]); } }} draggable={table.status !== "merged"} onDragStart={(event) => { event.dataTransfer.setData("text/plain", table.id); setDraggingTableId(table.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const movingId = event.dataTransfer.getData("text/plain") || draggingTableId; const moving = data.tables.find((candidate) => candidate.id === movingId); const movingPosition = moving?.floorPosition ?? (moving ? defaultFloorPosition(data.tables.indexOf(moving)) : null); if (movingId && movingPosition && movingId !== table.id) moveFloorTable(movingId, position.column - movingPosition.column, position.row - movingPosition.row); setDraggingTableId(null); }} onDragEnd={() => setDraggingTableId(null)} style={{ gridColumn: position.column, gridRow: position.row }} title="Drag to arrange, or focus and use arrow keys" className={`table-node ${table.status} ${selectedTable === selectionId ? "selected" : ""} ${draggingTableId === table.id ? "is-dragging" : ""}`} aria-label={`Table ${table.name}, ${table.status}${table.mergedInto ? ` joined with ${primaryTable?.name}` : ""}. Drag to arrange or use arrow keys.`}>
                      <span className="table-top"><b>{table.name}</b><small>· {table.mergedInto ? table.seats : joinedSeats} seats</small></span><span className="table-state" title={table.reservation ? `Reserved for ${table.reservation.guestName}` : undefined}>{table.mergedInto ? `Joined · ${primaryTable?.name ?? "—"}` : table.status === "available" ? "Available" : table.status === "occupied" ? `${table.guests ?? joinedSeats} guests` : table.status === "reserved" ? table.reservation ? `Reserved · ${formatReservationTime(table.reservation.time)}` : "Reserved" : table.status}</span>{table.status === "occupied" && <span className="table-total">{money(totalAmount)}</span>}
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
                  <span className={`food-art ${item.color}`}><span>{item.emoji}</span></span><span className="food-details"><span className="food-name">{item.name}{item.popular && <i className="popular-dot" title="Popular" />}</span><span className="food-desc">{(data.unavailableMenuIds ?? []).includes(item.id) ? "Currently unavailable" : item.description}</span><b>{item.variants?.length ? `From ${money(startingPrice(item))}` : money(item.price)}</b></span><span className="add-item">{(data.unavailableMenuIds ?? []).includes(item.id) ? "–" : "＋"}</span>
                </button>)}
                {visibleMenu.length === 0 && <div className="empty-search">No menu items match “{search}”.</div>}
              </div>
              <div className="menu-footer"><span>Showing <b>{visibleMenu.length}</b> of {menuItems.length} items</span>{canManageMenu && <button onClick={() => { setCategory("All"); setSearch(""); setView("Menu"); }}>Manage menu ↗</button>}</div>
            </section>

            <section className="panel ticket-panel">
              <div className="ticket-heading"><div><span className="ticket-kicker">CURRENT TICKET</span><h3>{orderType === "Dine in" ? selectedTable ? `Table ${data.tables.find((table) => table.id === selectedTable)?.name}` : "Select a table" : orderType}</h3></div><button className="more-button" aria-label="Cycle order type" onClick={() => { setOrderType((current) => current === "Dine in" ? "Takeaway" : current === "Takeaway" ? "Delivery" : "Dine in"); setCart([]); setSelectedServiceOrderId(null); }}>...</button></div>
              <div className="ticket-type"><button className={orderType === "Dine in" ? "selected-type" : ""} onClick={() => { setOrderType("Dine in"); setCart([]); setSelectedServiceOrderId(null); }}>Dine in</button><button className={orderType === "Takeaway" ? "selected-type" : ""} onClick={() => { setOrderType("Takeaway"); setCart([]); setSelectedServiceOrderId(null); }}>Takeaway</button><button className={orderType === "Delivery" ? "selected-type" : ""} onClick={() => { setOrderType("Delivery"); setCart([]); setSelectedServiceOrderId(null); }}>Delivery</button></div>
              {orderType === "Dine in" && <div className="ticket-table-row"><span>Table</span><button onClick={() => setView("Floor plan")}>{selectedTable ? `Table ${data.tables.find((table) => table.id === selectedTable)?.name}` : "Choose table"} <span>v</span></button></div>}
              {orderType === "Delivery" && (currentOrder && cart.length === 0 ? <div className="delivery-summary"><b>{currentOrder.deliveryDetails?.recipientName ?? "Delivery recipient"}</b><span>{currentOrder.deliveryDetails?.phone}</span><small>{currentOrder.deliveryDetails?.address}</small></div> : <div className="delivery-fields"><label><span>Recipient name</span><input value={deliveryName} onChange={(event) => setDeliveryName(event.target.value)} maxLength={60} placeholder="Customer name" /></label><label><span>Phone</span><input type="tel" value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value)} maxLength={18} placeholder="10-digit phone number" /></label><label><span>Delivery address</span><textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} maxLength={180} placeholder="Street, area, landmark" /></label></div>)}
              {orderType !== "Dine in" && serviceOrders.length > 0 && <label className="service-order-select"><span>Open {orderType.toLowerCase()} order</span><select value={currentOrder?.id ?? ""} onChange={(event) => setSelectedServiceOrderId(event.target.value || null)}>{serviceOrders.map((order) => <option key={order.id} value={order.id}>{order.id} - {order.items.reduce((sum, line) => sum + line.quantity, 0)} items</option>)}</select></label>}
              <div className="order-list-heading"><span>ORDER ITEMS</span><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span></div>
              <div className="cart-lines">
                {cart.length === 0 && currentOrder && <div className="existing-order"><span className="existing-order-top">{currentOrder.id} <b>{currentOrder.status}</b></span>{currentOrder.items.map((line) => { const item = itemById(line.menuItemId, menuItems); return <div className="cart-line" key={line.id ?? line.menuItemId}><div className="line-title"><span>{item?.name}</span><b>{money(lineUnitPrice(line, menuItems) * line.quantity)}</b></div>{(line.variant || line.modifiers?.length || line.note) && <small className="cart-extras">{lineVariantLabel(line)}{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}<div className="line-controls"><span>{money(lineUnitPrice(line, menuItems))} each</span><span className="quantity-controls"><button disabled aria-label="Decrease quantity">−</button><b>{line.quantity}</b><button disabled aria-label="Increase quantity">＋</button></span></div></div>; })}</div>}
                {cart.map((line) => { const item = itemById(line.menuItemId, menuItems); const lineKey = line.id ?? line.menuItemId; return <div className="cart-line" key={lineKey}><div className="line-title"><span>{item?.name}</span><b>{money(lineUnitPrice(line, menuItems) * line.quantity)}</b></div>{(line.variant || line.modifiers?.length || line.note) && <small className="cart-extras">{lineVariantLabel(line)}{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}<div className="line-controls"><span>{money(lineUnitPrice(line, menuItems))} each</span><span className="quantity-controls"><button onClick={() => changeQuantity(lineKey, -1)} aria-label={`Decrease ${item?.name}`}>−</button><b>{line.quantity}</b><button onClick={() => changeQuantity(lineKey, 1)} aria-label={`Increase ${item?.name}`}>＋</button></span></div></div>; })}
                {cart.length === 0 && !currentOrder && <div className="cart-empty"><span>＋</span><b>Your ticket is looking fresh</b><small>Add menu items to get started</small></div>}
              </div>
              <button className="add-note" onClick={() => setNotice("Add item-specific instructions by customizing a menu item.")}>＋ &nbsp; Add a note or special request</button>
              <div className="totals"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Tax <small>(8%)</small></span><b>{money(tax)}</b></div><div className="total-line"><span>Total</span><b>{money(total)}</b></div></div>
              {currentOrder && cart.length === 0 ? canTakePayment ? <button className="send-button checkout-button" onClick={() => setCheckoutOrderId(currentOrder.id)}><span>Go to checkout</span><b>{money(lineTotal(currentOrder.items) * 1.08)} <i>?</i></b></button> : <button className="send-button" disabled><span>Awaiting cashier checkout</span><b>{money(lineTotal(currentOrder.items) * 1.08)}</b></button> : <button className="send-button" disabled={cart.length === 0} onClick={placeOrder}><span>Send to kitchen</span><b>{money(total)} <i>?</i></b></button>}
              <div className="ticket-help"><span>◉</span> You can split the bill at checkout</div>
            </section>
          </div>

          <div className="bottom-row"><section className="panel activity-panel"><div className="bottom-heading"><div><h3>Recent activity</h3><p>A little recap of what’s happening.</p></div>{allowedViews.includes("Reports") && <button onClick={() => setView("Reports")}>View all ↗</button>}</div><div className="activity-list">{data.orders.slice(-3).reverse().map((order, index) => <div className="activity-item" key={order.id}><span className={`activity-symbol symbol-${index} ${order.status === "cancelled" ? "activity-cancelled" : ""}`}>{order.status === "cancelled" ? "×" : order.status === "paid" ? "✓" : order.status === "ready" ? "♨" : "＋"}</span><span className="activity-copy"><b>{order.id} · {order.tableId ? `Table ${data.tables.find((table) => table.id === order.tableId)?.name}` : order.type}</b><small>{order.items.reduce((sum, line) => sum + line.quantity, 0)} items · {order.status}{order.cancellationReason ? ` · ${order.cancellationReason}` : ""}</small></span><span className="activity-time">{minutesAgo(order.createdAt)}</span></div>)}</div></section>
            <section className="panel kitchen-panel"><div className="bottom-heading"><div><h3>Order tracking <span className="live-pill"><i /> LIVE</span></h3><p>Follow each ticket from kitchen to table.</p></div>{allowedViews.includes("Kitchen") && <button onClick={() => setView("Kitchen")}>Kitchen board</button>}</div><div className="tracking-list">{activeOrders.length === 0 ? <div className="tracking-empty">No active orders right now.</div> : activeOrders.slice(-3).reverse().map((order) => { const statusIndex = ["new", "preparing", "ready", "served"].indexOf(order.status); const steps = ["New", "Prep", "Ready", "Served"]; return <div className="tracking-order" key={order.id}><div className="tracking-order-meta"><b>{order.id}</b><span>{order.tableId ? `Table ${data.tables.find((table) => table.id === order.tableId)?.name ?? "--"}` : "Takeaway"}</span><small>{minutesAgo(order.createdAt)}</small></div><div className="tracking-steps" aria-label={`Order ${order.id} status: ${order.status}`}>{steps.map((step, index) => <span key={step} className={index < statusIndex ? "step-done" : index === statusIndex ? "step-current" : ""}><i />{step}</span>)}</div></div>; })}</div></section></div>
          </> : <WorkflowPanel view={view} data={data} menuItems={menuItems} clockNow={clockNow} setView={setView} setTableStatus={setTableStatus} requestReservation={requestReservation} setOrderStatus={setOrderStatus} requestCancellation={requestCancellation} openMenuEditor={openMenuEditor} transferOrder={transferOrder} mergeTables={mergeTables} unmergeTable={unmergeTable} toggleMenuAvailability={toggleMenuAvailability} />}
        </section>
        <footer className="app-footer"><span>© 2026 Dine In</span><span>Made for good service <b>✳</b></span><div><button onClick={() => setNotice("Help center is coming soon.")}>Help center</button><i /> <button onClick={() => setNotice("All systems are operational.")}>System status <b className="system-dot" /></button></div></footer>
      </main>
      {notice && <div role="status" className="toast"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
      {menuEditorOpen && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuEditorOpen(false); }}><section className="payment-dialog menu-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-editor-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">MENU MANAGER</span><h2 id="menu-editor-title">{menuEditorId ? "Edit menu item" : "Add a menu item"}</h2><p>Changes are saved to this device and appear in ordering.</p></div><button className="payment-close" aria-label="Close menu editor" onClick={() => setMenuEditorOpen(false)}>×</button></div><label className="menu-editor-field"><span>Item name</span><input maxLength={60} value={menuFormName} onChange={(event) => setMenuFormName(event.target.value)} placeholder="e.g. House special biryani"/></label><label className="menu-editor-field"><span>Description</span><textarea maxLength={120} value={menuFormDescription} onChange={(event) => setMenuFormDescription(event.target.value)} placeholder="Ingredients or a short description"/></label><div className="menu-editor-row"><label className="menu-editor-field"><span>Category</span><select value={menuFormCategory} onChange={(event) => setMenuFormCategory(event.target.value as MenuItem["category"])}>{categories.filter((entry) => entry !== "All").map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label><label className="menu-editor-field"><span>Base price (₹)</span><input type="number" min="1" step="1" value={menuFormPrice} onChange={(event) => setMenuFormPrice(event.target.value)} placeholder="350"/></label><label className="menu-editor-field icon-field"><span>Food icon</span><input maxLength={8} value={menuFormEmoji} onChange={(event) => setMenuFormEmoji(event.target.value)} aria-label="Food icon emoji"/></label></div><label className="menu-editor-field variant-editor-field"><span>Variants (optional, one per line: Name | Price in ₹)</span><textarea value={menuFormVariants} onChange={(event) => setMenuFormVariants(event.target.value)} placeholder={'Half | 240\nFull | 420'} /></label><label className="menu-availability-check"><input type="checkbox" checked={menuFormAvailable} onChange={(event) => setMenuFormAvailable(event.target.checked)}/><span>Available to order</span></label><div className="menu-editor-actions"><button onClick={() => setMenuEditorOpen(false)}>Cancel</button><button className="send-button" onClick={saveMenuItem}>{menuEditorId ? "Save changes" : "Add to menu"}</button></div></section></div>}
      {reservationTable && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReservationTableId(null); }}><section className="payment-dialog reservation-dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">TABLE {reservationTable.name} · RESERVATION</span><h2 id="reservation-title">{reservationTable.reservation ? "Edit reservation" : "Book this table"}</h2><p>Save the guest details and expected arrival time.</p></div><button className="payment-close" aria-label="Close reservation form" onClick={() => setReservationTableId(null)}>×</button></div><label className="reservation-field"><span>Guest name</span><input autoFocus required maxLength={60} value={reservationGuestName} onChange={(event) => setReservationGuestName(event.target.value)} placeholder="Name for the booking"/></label><div className="reservation-fields-row"><label className="reservation-field"><span>Party size</span><input type="number" min={1} max={reservationTable.seats + data.tables.filter((table) => table.mergedInto === reservationTable.id).reduce((sum, table) => sum + table.seats, 0)} value={reservationGuests} onChange={(event) => setReservationGuests(Number(event.target.value))}/></label><label className="reservation-field"><span>Arrival time</span><input type="datetime-local" required value={reservationTime} onChange={(event) => setReservationTime(event.target.value)}/></label></div><div className="reservation-form-actions">{reservationTable.reservation && <button className="remove-reservation" onClick={() => { setTableStatus(reservationTable.id, "available"); setReservationTableId(null); setNotice("Reservation cancelled."); }}>Cancel reservation</button>}<button className="send-button reservation-save" onClick={saveReservation}><span>Save reservation</span><b>Table {reservationTable.name} <i>→</i></b></button></div></section></div>}
      {customizingItem && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomizingItem(null); }}><section className="payment-dialog item-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-item-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">CUSTOMIZE ITEM</span><h2 id="custom-item-title">{customizingItem.name}</h2><p>{customizingItem.description}</p></div><button className="payment-close" aria-label="Close item options" onClick={() => setCustomizingItem(null)}>×</button></div>
        {customizingItem.variants?.length ? <label className="variant-picker"><span>Size / variant</span><select value={customVariantId} onChange={(event) => setCustomVariantId(event.target.value)}>{customizingItem.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label} · {money(variant.price)}</option>)}</select></label> : null}
        <div className="modifier-section"><div className="modifier-heading"><b>Add-ons &amp; preferences</b><small>Optional · choose any that apply</small></div>{modifiersByCategory[customizingItem.category].map((modifier) => <label className="modifier-option" key={modifier.id}><input type="checkbox" checked={customModifierIds.includes(modifier.id)} onChange={(event) => setCustomModifierIds((previous) => event.target.checked ? [...previous, modifier.id] : previous.filter((id) => id !== modifier.id))} /><span>{modifier.label}</span><b>{modifier.price > 0 ? `+${money(modifier.price)}` : "No charge"}</b></label>)}</div>
        <label className="instruction-field"><span>Kitchen instructions</span><textarea maxLength={120} value={customNote} onChange={(event) => setCustomNote(event.target.value)} placeholder="For example: sauce on the side, well done..."/><small>{customNote.length}/120</small></label>
        <div className="customize-footer"><div className="quantity-controls customize-quantity"><button aria-label="Decrease item quantity" disabled={customQuantity <= 1} onClick={() => setCustomQuantity((quantity) => Math.max(1, quantity - 1))}>−</button><b>{customQuantity}</b><button aria-label="Increase item quantity" onClick={() => setCustomQuantity((quantity) => quantity + 1)}>＋</button></div><button className="send-button payment-submit" onClick={confirmCustomizedItem}><span>Add to ticket</span><b>{money(((customizingItem.variants?.find((variant) => variant.id === customVariantId)?.price ?? customizingItem.price) + modifiersByCategory[customizingItem.category].filter((modifier) => customModifierIds.includes(modifier.id)).reduce((sum, modifier) => sum + modifier.price, 0)) * customQuantity)} <i>→</i></b></button></div>
      </section></div>}
      {orderPendingCancellation && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelOrderId(null); }}><section className="payment-dialog cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">CANCEL TICKET · {orderPendingCancellation.id}</span><h2 id="cancel-title">Cancel this order?</h2><p>This removes the ticket from the kitchen queue. The reason will be kept in order history.</p></div><button className="payment-close" aria-label="Close cancellation" onClick={() => setCancelOrderId(null)}>×</button></div><label className="discount-row cancel-reason"><span>Reason</span><select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}><option>Guest changed their mind</option><option>Duplicate order</option><option>Item unavailable</option><option>Long wait time</option><option>Entered by mistake</option></select></label><div className="cancel-dialog-actions"><button onClick={() => setCancelOrderId(null)}>Keep order</button><button onClick={() => cancelOrder(orderPendingCancellation.id, cancelReason)}>Cancel ticket</button></div></section></div>}
      {checkoutOrder && <div className="payment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOrderId(null); }}><section className="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div className="payment-dialog-head"><div><span className="ticket-kicker">PAYMENT · {checkoutOrder.id}</span><h2 id="payment-title">Complete checkout</h2><p>{checkoutOrder.tableId ? `Table ${data.tables.find((table) => table.id === checkoutOrder.tableId)?.name}` : `${checkoutOrder.type} order`} · {checkoutOrder.items.reduce((sum, line) => sum + line.quantity, 0)} items</p></div><button className="payment-close" aria-label="Close checkout" onClick={() => setCheckoutOrderId(null)}>×</button></div>
        <section className="invoice-print" aria-label="Printable guest bill"><header><span>DINE IN</span><h1>Guest bill</h1><p>Restaurant order summary</p></header><div className="invoice-meta"><span>Order <b>{checkoutOrder.id}</b></span><span>{new Date(checkoutOrder.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span><span>{checkoutOrder.tableId ? `Table ${data.tables.find((table) => table.id === checkoutOrder.tableId)?.name}` : checkoutOrder.type}</span>{checkoutOrder.deliveryDetails && <><span>{checkoutOrder.deliveryDetails.recipientName} | {checkoutOrder.deliveryDetails.phone}</span><span>{checkoutOrder.deliveryDetails.address}</span></>}</div><div className="invoice-lines">{checkoutOrder.items.map((line) => { const item = itemById(line.menuItemId, menuItems); return <div key={line.id ?? line.menuItemId}><span>{line.quantity} x {item?.name ?? "Menu item"}{(line.variant || line.modifiers?.length || line.note) && <small>{lineVariantLabel(line)}{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` | ${line.note}` : ""}</small>}</span><b>{money(lineUnitPrice(line, menuItems) * line.quantity)}</b></div>; })}</div><div className="invoice-totals"><div><span>Subtotal</span><b>{money(checkoutSubtotal)}</b></div>{discountPercent > 0 && <div><span>Discount ({discountPercent}%)</span><b>-{money(checkoutDiscount)}</b></div>}<div><span>Tax (8%)</span><b>{money(checkoutTax)}</b></div><div className="invoice-grand-total"><span>Amount due</span><b>{money(checkoutTotal)}</b></div></div><footer>Payment pending | Payment method: {splitPayment ? "Split payment" : paymentMethod}<br/>Payment is simulated in this demonstration.</footer></section>
        <div className="payment-summary">{checkoutOrder.items.map((line) => { const item = itemById(line.menuItemId, menuItems); return <div key={line.id ?? line.menuItemId}><span>{line.quantity} × {item?.name ?? "Menu item"}{(line.variant || line.modifiers?.length || line.note) && <small className="payment-line-details">{lineVariantLabel(line)}{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}</span><b>{money(lineUnitPrice(line, menuItems) * line.quantity)}</b></div>; })}</div>
        <label className="discount-row"><span>Discount</span><select value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))}><option value={0}>No discount</option><option value={5}>5% off</option><option value={10}>10% off</option><option value={15}>15% off</option></select></label>
        <div className="payment-totals"><div><span>Subtotal</span><b>{money(checkoutSubtotal)}</b></div>{discountPercent > 0 && <div><span>Discount ({discountPercent}%)</span><b className="discount-value">−{money(checkoutDiscount)}</b></div>}<div><span>Tax <small>(8% after discount)</small></span><b>{money(checkoutTax)}</b></div><div className="payment-total"><span>Amount due</span><b>{money(checkoutTotal)}</b></div></div>
        {!splitPayment && <><div className="payment-method-heading"><b>Payment method</b><span>SIMULATED PAYMENT</span></div><div className="payment-methods">{(["UPI", "Card", "Cash"] as const).map((method) => <button key={method} className={paymentMethod === method ? "method-selected" : ""} aria-pressed={paymentMethod === method} onClick={() => setPaymentMethod(method)}><span>{method === "UPI" ? "⌁" : method === "Card" ? "▣" : "₹"}</span>{method}</button>)}</div></>}
        <label className="split-payment-option"><input type="checkbox" checked={splitPayment} onChange={(event) => setSplitPayment(event.target.checked)} /><span><b>Split bill between guests</b><small>Divide equally; choose a method per guest</small></span><i /></label>
        {splitPayment && <div className="split-methods"><label><span>Split style</span><select value={splitMode} onChange={(event) => setSplitMode(event.target.value as "equal" | "items")}><option value="equal">Equal shares</option><option value="items">Assign items to guests</option></select></label><label><span>Number of guests</span><select value={guestCount} onChange={(event) => { const count = Number(event.target.value); setGuestCount(count); setGuestMethods(Array.from({ length: count }, (_, index) => guestMethods[index] ?? paymentMethod)); }}>{Array.from({ length: 7 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} guests</option>)}</select></label>{splitMode === "items" && <div className="split-item-assignments">{checkoutOrder.items.map((line, lineIndex) => { const item = itemById(line.menuItemId, menuItems); return <label key={line.id ?? `${line.menuItemId}-${lineIndex}`}><span>{line.quantity} × {item?.name ?? "Menu item"}</span><select value={itemGuests[lineIndex] ?? 0} onChange={(event) => setItemGuests((previous) => ({ ...previous, [lineIndex]: Number(event.target.value) }))}>{Array.from({ length: guestCount }, (_, index) => <option key={index} value={index}>Guest {index + 1}</option>)}</select></label>; })}</div>}{Array.from({ length: guestCount }, (_, index) => { const equalAmounts = allocateCents(checkoutTotal, Array.from({ length: guestCount }, () => 1)); const itemAmounts = allocateCents(checkoutTotal, Array.from({ length: guestCount }, (_, guestIndex) => checkoutOrder.items.reduce((sum, line, lineIndex) => (itemGuests[lineIndex] ?? 0) === guestIndex ? sum + lineUnitPrice(line, menuItems) * line.quantity : sum, 0))); const amount = splitMode === "items" ? itemAmounts[index] : equalAmounts[index]; return <label key={index}><span>Guest {index + 1} - {money(amount)}</span><select value={guestMethods[index] ?? paymentMethod} onChange={(event) => setGuestMethods((previous) => previous.map((method, methodIndex) => methodIndex === index ? event.target.value as PaymentMethod : method))}><option>UPI</option><option>Card</option><option>Cash</option></select></label>; })}</div>}
        <button className="secondary-button payment-print-button" onClick={printBill}>Print guest bill</button><button className="send-button payment-submit" onClick={completePayment}><span>Complete simulated payment</span><b>{money(checkoutTotal)} <i>→</i></b></button><p className="payment-note">No real payment will be taken.</p>
      </section></div>}
    </div>
  );
}

type WorkflowProps = {
  view: string;
  data: PosData;
  menuItems: MenuItem[];
  clockNow: number | null;
  setView: (view: string) => void;
  setTableStatus: (tableId: string, status: Table["status"]) => void;
  requestReservation: (tableId: string) => void;
  setOrderStatus: (orderId: string, status: Order["status"]) => void;
  requestCancellation: (orderId: string) => void;
  openMenuEditor: (item?: MenuItem) => void;
  transferOrder: (orderId: string, tableId: string) => void;
  mergeTables: (primaryId: string, secondaryId: string) => void;
  unmergeTable: (secondaryId: string) => void;
  toggleMenuAvailability: (menuItemId: string) => void;
};

function WorkflowPanel({ view, data, menuItems, clockNow, setView, setTableStatus, requestReservation, setOrderStatus, requestCancellation, openMenuEditor, transferOrder, mergeTables, unmergeTable, toggleMenuAvailability }: WorkflowProps) {
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [reportRange, setReportRange] = useState("Today");
  const openOrders = data.orders.filter((order) => order.status !== "paid" && order.status !== "cancelled");
  const tableLabel = (tableId: string | null) => tableId ? `Table ${data.tables.find((table) => table.id === tableId)?.name ?? "—"}` : "Takeaway";
  const orderAmount = (order: Order) => order.items.reduce((sum, line) => sum + lineUnitPrice(line, menuItems) * line.quantity, 0);
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
  function exportTransactions() {
    const rows = [["Date", "Order", "Table", "Payment method", "Split", "Amount (INR)"], ...reportTransactions.map((transaction) => [new Date(transaction.createdAt).toLocaleString("en-IN"), transaction.orderId, transaction.orderId ? (() => { const paidOrder = data.orders.find((order) => order.id === transaction.orderId); return paidOrder?.tableId ? tableLabel(paidOrder.tableId) : paidOrder?.type ?? "Unknown"; })() : "Unknown", transaction.method, transaction.splitLabel ?? "", transaction.amount.toFixed(2)])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `dine-in-transactions-${reportRange.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const chartBuckets = (() => {
    const specs = reportRange === "Today"
      ? Array.from({ length: 7 }, (_, index) => ({ key: String(index + 10), label: ["10a", "12p", "2p", "4p", "6p", "8p", "10p"][index] }))
      : reportRange === "This week"
        ? Array.from({ length: 7 }, (_, index) => { const date = new Date(rangeStart ?? new Date(2000, 0, 2)); date.setDate(date.getDate() + index); return { key: String(date.getDay()), label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date) }; })
        : Array.from({ length: 5 }, (_, index) => ({ key: String(index), label: `W${index + 1}` }));
    return specs.map((bucket, index) => ({ ...bucket, amount: reportTransactions.filter((transaction) => { const date = new Date(transaction.createdAt); return reportRange === "Today" ? Math.floor(date.getHours() / 2) === index + 5 : reportRange === "This week" ? String(date.getDay()) === bucket.key : String(Math.floor((date.getDate() - 1) / 7)) === bucket.key; }).reduce((sum, transaction) => sum + transaction.amount, 0) }));
  })();
  const chartPeak = Math.max(1, ...chartBuckets.map((bucket) => bucket.amount));
  const methodTotals = (["Cash", "Card", "UPI"] as const).map((method) => ({ method, count: reportTransactions.filter((transaction) => transaction.method === method).length, amount: reportTransactions.filter((transaction) => transaction.method === method).reduce((sum, transaction) => sum + transaction.amount, 0) }));
  const collectedInRange = reportTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const completedInRange = new Set(reportTransactions.map((transaction) => transaction.orderId));
  const openInRange = reportOrders.filter((order) => order.status !== "paid" && order.status !== "cancelled").length;
  const statusText: Record<Order["status"], string> = { new: "New", preparing: "Preparing", ready: "Ready", served: "Served", paid: "Paid", cancelled: "Cancelled" };

  if (view === "Kitchen") return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Live kitchen queue</h2><p>Move each ticket through prep as the team works.</p></div><span className="live-pill"><i /> LIVE</span></div>
    <div className="kitchen-board">{openOrders.length === 0 && <div className="workflow-empty">No open tickets. New orders will appear here.</div>}
      {openOrders.map((order) => <article className="workflow-card kitchen-ticket" key={order.id}><div className="workflow-card-head"><div><span className="ticket-kicker">{tableLabel(order.tableId)} · {order.type.toUpperCase()}</span><h3>{order.id}</h3></div><span className={`status-pill status-${order.status}`}>{statusText[order.status]}</span></div><div className="kitchen-items">{order.items.map((line) => <div key={line.id ?? line.menuItemId}><b>{line.quantity}×</b><span>{itemById(line.menuItemId, menuItems)?.name ?? "Removed menu item"}{(line.variant || line.modifiers?.length || line.note) && <small className="kitchen-item-note">{lineVariantLabel(line)}{line.modifiers?.map((modifier) => modifier.label).join(", ")}{line.note ? ` · ${line.note}` : ""}</small>}</span></div>)}</div>{order.deliveryDetails && <div className="kitchen-delivery-details"><b>{order.deliveryDetails.recipientName}</b><span>{order.deliveryDetails.address}</span><small>{order.deliveryDetails.phone}</small></div>}<div className="kitchen-ticket-foot"><span className={(["new", "preparing"].includes(order.status) && clockNow !== null && clockNow - new Date(order.createdAt).getTime() >= 15 * 60000) ? "ticket-age is-delayed" : "ticket-age"}>Received {minutesAgo(order.createdAt)}{["new", "preparing"].includes(order.status) && clockNow !== null && clockNow - new Date(order.createdAt).getTime() >= 15 * 60000 ? " - Delayed" : ""}</span><span className="ticket-actions">{order.status === "new" && <button onClick={() => setOrderStatus(order.id, "preparing")}>Start preparing →</button>}{order.status === "preparing" && <button onClick={() => setOrderStatus(order.id, "ready")}>Mark ready →</button>}{order.status === "ready" && <button onClick={() => setOrderStatus(order.id, "served")}>Mark served →</button>}{order.status === "served" && <span className="served-label">Waiting for checkout</span>}{(order.status === "new" || order.status === "preparing") && <button className="cancel-ticket" onClick={() => requestCancellation(order.id)}>Cancel</button>}</span></div></article>)}
    </div>
  </div>;

  if (view === "Floor plan") return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Table management</h2><p>Choose a table to update its state or move an open ticket.</p></div><button className="primary-button" onClick={() => setView("New order")}>＋ Start an order</button></div>
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

  if (view === "Menu") return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Menu management</h2><p>Add dishes, update details, and toggle sold-out items.</p></div><div className="menu-admin-actions"><span className="menu-count">{menuItems.length} items · {menuItems.filter((item) => !(data.unavailableMenuIds ?? []).includes(item.id)).length} available</span><button className="primary-button" onClick={() => openMenuEditor()}>＋ Add menu item</button></div></div>
    <div className="availability-grid">{menuItems.map((item) => { const unavailable = (data.unavailableMenuIds ?? []).includes(item.id); return <article className={`workflow-card availability-card ${unavailable ? "is-unavailable" : ""}`} key={item.id}><span className={`food-art ${item.color}`}><span>{item.emoji}</span></span><div className="availability-copy"><span className="ticket-kicker">{item.category.toUpperCase()}</span><h3>{item.name}</h3><p>{item.description}</p><b>{money(item.price)}</b></div><div className="availability-actions"><button className="menu-edit-button" onClick={() => openMenuEditor(item)}>Edit</button><button className={`availability-toggle ${unavailable ? "off" : ""}`} aria-pressed={!unavailable} onClick={() => toggleMenuAvailability(item.id)}>{unavailable ? "Unavailable" : "Available"}<i /></button></div></article>; })}</div>
  </div>;

  return <div className="workflow-view">
    <div className="workflow-head"><div><h2>Service reports</h2><p>Review the activity recorded on this device.</p></div><div className="report-actions"><button className="secondary-button" onClick={() => window.print()}>Print summary</button><button className="secondary-button" onClick={exportTransactions} disabled={reportTransactions.length === 0}>Export CSV</button><select className="report-select" value={reportRange} onChange={(event) => setReportRange(event.target.value)}><option>Today</option><option>This week</option><option>This month</option></select></div></div>
    <div className="report-metrics"><article className="workflow-card report-metric"><span>ORDERS IN PERIOD</span><b>{reportOrders.length}</b><small>{completedInRange.size} completed / {openInRange} open</small></article><article className="workflow-card report-metric"><span>COMPLETED SALES</span><b>{money(collectedInRange)}</b><small>From recorded payments in this period</small></article><article className="workflow-card report-metric"><span>TABLE OCCUPANCY</span><b>{data.tables.filter((table) => table.status === "occupied").length} / {data.tables.length}</b><small>{data.tables.filter((table) => table.status === "available").length} available right now</small></article><article className="workflow-card report-chart"><div className="report-chart-head"><div><span>RECORDED SALES</span><b>{reportRange}</b></div><span className="green-text">{reportTransactions.length} payments in this period</span></div><div className="chart-area"><div className="chart-y"><span>{moneyRounded(chartPeak)}</span><span>{moneyRounded(chartPeak / 2)}</span><span>INR 0</span></div><div className="chart-plot"><div className="chart-grid-lines"><i/><i/><i/></div><div className="sales-bars" role="img" aria-label={`Recorded sales by ${reportRange.toLowerCase()} interval`}>{chartBuckets.map((bucket) => <div className="sales-bar-column" key={bucket.key} title={`${bucket.label}: ${money(bucket.amount)}`}><div className="sales-bar-track"><i style={{ height: `${Math.max(bucket.amount > 0 ? 5 : 0, bucket.amount / chartPeak * 100)}%` }}/></div><span>{bucket.label}</span></div>)}</div></div></div></article></div>
    <section className="workflow-card shift-summary"><div className="shift-summary-head"><div><h3>Shift closeout</h3><p>Payment totals recorded for {reportRange.toLowerCase()}.</p></div><span className="shift-total">{money(collectedInRange)}</span></div><div className="shift-summary-grid"><div><span>ORDERS</span><b>{reportOrders.length}</b></div><div><span>PAYMENTS</span><b>{reportTransactions.length}</b></div><div><span>COMPLETED ORDERS</span><b>{completedInRange.size}</b></div>{methodTotals.map(({ method, count, amount }) => <div key={method}><span>{method.toUpperCase()}</span><b>{money(amount)}</b><small>{count} payments</small></div>)}</div><p className="shift-summary-note">Closeout is a report of recorded simulated payments; it does not lock or close the register.</p></section>
    <section className="workflow-card transaction-history"><div className="transaction-history-head"><div><h3>Transaction history</h3><p>Completed simulated payments on this device.</p></div><span>{(data.transactions ?? []).length} payments</span></div>{(data.transactions ?? []).length === 0 ? <div className="transaction-empty">No completed payments yet.</div> : <div className="transaction-list">{[...(data.transactions ?? [])].slice(-8).reverse().map((transaction) => <div className="transaction-row" key={transaction.id}><span className="transaction-icon">{transaction.method === "UPI" ? "⌁" : transaction.method === "Card" ? "▣" : "₹"}</span><span className="transaction-description"><b>{transaction.orderId}</b><small>{transaction.splitLabel ? transaction.splitLabel + " - " : ""}{transaction.method} · {new Date(transaction.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></span><strong>{money(transaction.amount)}</strong></div>)}</div>}</section>
  </div>;
}
