"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  defaultCategories,
  initialData,
  menu,
  migrateMenuItems,
  type Category,
  type DeliveryDetails,
  type InventoryMovement,
  type MenuItem,
  type MenuModifier,
  type MenuVariant,
  type Order,
  type OrderLine,
  type PaymentMethod,
  type PosData,
  type ReservationDetails,
  type Table,
} from "@/lib/pos-data";
import {
  allocateCents,
  calculateBill,
  lineTotal,
  lineUnitPrice,
  nextOrderId,
  splitOrderLines,
} from "@/lib/pos-domain";
import { parsePosBackup } from "@/lib/pos-backup";
import { fetchPosSnapshot, persistPosSnapshot } from "@/lib/pos-service";

type StaffRole = "Manager" | "Cashier" | "Waiter" | "Kitchen";
type Theme = "light" | "dark";
const viewPaths: Record<string, string> = {
  Orders: "/orders",
  "New order": "/orders/new",
  "Floor plan": "/floor-plan",
  Kitchen: "/kitchen",
  Menu: "/menu",
  Reports: "/reports",
};
const roleViews: Record<StaffRole, string[]> = {
  Manager: ["Orders", "Floor plan", "Kitchen", "Menu", "Reports"],
  Cashier: ["Orders", "Floor plan", "Reports"],
  Waiter: ["Orders", "Floor plan", "Kitchen"],
  Kitchen: ["Kitchen"],
};
const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
const itemById = (id: string, items: MenuItem[] = menu) =>
  items.find((item) => item.id === id);
const modifiersByCategory: Record<MenuItem["category"], MenuModifier[]> = {
  Starters: [
    { id: "extra-sauce", label: "Extra sauce", price: 30 },
    { id: "no-garnish", label: "No garnish", price: 0 },
  ],
  Mains: [
    { id: "extra-protein", label: "Extra protein", price: 120 },
    { id: "no-onion", label: "No onion", price: 0 },
  ],
  "Street Food": [
    { id: "extra-chutney", label: "Extra chutney", price: 25 },
    { id: "extra-pav", label: "Extra pav", price: 20 },
  ],
  Soups: [
    { id: "soup-cream", label: "Add cream", price: 25 },
    { id: "soup-croutons", label: "Extra croutons", price: 30 },
  ],
  "Breads & Sides": [
    { id: "extra-butter", label: "Extra butter", price: 20 },
    { id: "roasted-garlic", label: "Roasted garlic", price: 25 },
  ],
  Drinks: [
    { id: "extra-syrup", label: "Add flavor syrup", price: 30 },
    { id: "less-ice", label: "Less ice", price: 0 },
  ],
  Desserts: [
    { id: "ice-cream", label: "Add ice cream", price: 80 },
    { id: "extra-cream", label: "Extra cream", price: 40 },
  ],
};
const dateTimeForInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const dateForInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const defaultFloorPosition = (index: number) =>
  index < 4
    ? { column: index + 1, row: 1 }
    : index < 7
      ? { column: index - 2, row: 2 }
      : { column: ((index - 7) % 4) + 1, row: 3 + Math.floor((index - 7) / 4) };
function usePosController() {
  const router = useRouter();
  const pathname = usePathname();
  const view =
    Object.entries(viewPaths).find(([, path]) => path === pathname)?.[0] ??
    (pathname.startsWith("/orders/") ? "New order" : "Orders");
  const setView = (nextView: string) => {
    const nextPath = viewPaths[nextView] ?? viewPaths["New order"];
    if (pathname !== nextPath) router.push(nextPath);
  };
  const [data, setData] = useState<PosData>(initialData);
  const [selectedTable, setSelectedTable] = useState<string | null>("t2");
  const [category, setCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [orderType, setOrderType] = useState<Order["type"]>("Dine in");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<
    string | null
  >(null);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<
    "loading" | "saved" | "saving" | "error"
  >("loading");
  const [storageErrorAction, setStorageErrorAction] = useState<"load" | "save">(
    "load",
  );
  const [loadRetry, setLoadRetry] = useState(0);
  const [saveRetry, setSaveRetry] = useState(0);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [splitOrderId, setSplitOrderId] = useState<string | null>(null);
  const [splitLineKeys, setSplitLineKeys] = useState<string[]>([]);
  const [selectedTableOrderId, setSelectedTableOrderId] = useState<
    string | null
  >(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [splitPayment, setSplitPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [guestCount, setGuestCount] = useState(2);
  const [guestMethods, setGuestMethods] = useState<PaymentMethod[]>([
    "UPI",
    "Cash",
  ]);
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
  const [reservationTableId, setReservationTableId] = useState<string | null>(
    null,
  );
  const [reservationGuestName, setReservationGuestName] = useState("");
  const [reservationGuests, setReservationGuests] = useState(2);
  const [reservationTime, setReservationTime] = useState("");
  const [menuEditorId, setMenuEditorId] = useState<string | null>(null);
  const [menuFormName, setMenuFormName] = useState("");
  const [menuFormDescription, setMenuFormDescription] = useState("");
  const [menuFormCategory, setMenuFormCategory] =
    useState<MenuItem["category"]>("Starters");
  const [menuFormPrice, setMenuFormPrice] = useState("");
  const [menuFormStock, setMenuFormStock] = useState("");
  const [menuFormLowStockThreshold, setMenuFormLowStockThreshold] =
    useState("5");
  const [menuFormEmoji, setMenuFormEmoji] = useState("\u{1F37D}");
  const [menuFormVariants, setMenuFormVariants] = useState("");
  const [menuFormModifiers, setMenuFormModifiers] = useState("");
  const [menuFormAvailable, setMenuFormAvailable] = useState(true);
  const [menuEditorOpen, setMenuEditorOpen] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<string | null | false>(
    false,
  );
  const [categoryFormName, setCategoryFormName] = useState("");
  const [role, setRole] = useState<StaffRole>("Manager");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [tableFormName, setTableFormName] = useState("");
  const [tableFormSeats, setTableFormSeats] = useState("4");
  const dialogReturnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let savedRole: string | null = null;
    try {
      savedRole = window.localStorage.getItem("dinein-demo-role");
    } catch {
      /* Keep the default demo role when storage is unavailable. */
    }
    if (
      !savedRole ||
      !["Manager", "Cashier", "Waiter", "Kitchen"].includes(savedRole)
    )
      return;
    const timer = window.setTimeout(() => setRole(savedRole as StaffRole), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPosSnapshot()
      .then((saved) => {
        if (cancelled) return;
        if (saved)
          setData({
            ...initialData,
            ...saved,
            categories: saved.categories?.length
              ? saved.categories.map((category) =>
                  category === "Pizza" ? "Street Food" : category,
                )
              : defaultCategories,
            unavailableMenuIds: saved.unavailableMenuIds ?? [],
            transactions: saved.transactions ?? [],
            menuItems: migrateMenuItems(saved.menuItems ?? menu),
          });
        setStorageReady(true);
        setStorageStatus("saved");
      })
      .catch(() => {
        if (cancelled) return;
        setStorageReady(false);
        setStorageErrorAction("load");
        setStorageStatus("error");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRetry]);

  useEffect(() => {
    if (!loaded || !storageReady) return;
    const timer = window.setTimeout(() => {
      setStorageStatus("saving");
      persistPosSnapshot(data)
        .then(() => setStorageStatus("saved"))
        .catch(() => {
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
      } catch {
        /* Use light theme when storage is unavailable. */
      }
      document.documentElement.dataset.theme = savedTheme;
      setTheme(savedTheme);
      setThemeLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("dinein-theme", theme);
    } catch {
      /* Theme preference remains in memory when storage is unavailable. */
    }
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
  const menuCategories: Category[] = [
    "All",
    ...(data.categories?.length ? data.categories : defaultCategories),
  ];
  const visibleMenu = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          (category === "All" || item.category === category) &&
          `${item.name} ${item.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [category, search, menuItems],
  );
  const subtotal = cart.reduce(
    (sum, line) => sum + lineUnitPrice(line, menuItems) * line.quantity,
    0,
  );
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const activeOrders = data.orders.filter(
    (order) => order.status !== "paid" && order.status !== "cancelled",
  );
  const serviceOrders = activeOrders.filter(
    (order) => order.type === orderType && order.type !== "Dine in",
  );
  const serviceTables = data.tables.filter(
    (table) => table.status !== "merged",
  );
  const occupied = serviceTables.filter(
    (table) => table.status === "occupied",
  ).length;
  const now = clockNow === null ? null : new Date(clockNow);
  const todayTransactions = now
    ? (data.transactions ?? []).filter(
        (transaction) =>
          new Date(transaction.createdAt).toDateString() === now.toDateString(),
      )
    : [];
  const paidToday = new Set(
    todayTransactions.map((transaction) => transaction.orderId),
  );
  const todaySales = todayTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const completedDurations = [...paidToday]
    .map((orderId) => {
      const order = data.orders.find((candidate) => candidate.id === orderId);
      const paidAt = Math.max(
        ...todayTransactions
          .filter((transaction) => transaction.orderId === orderId)
          .map((transaction) => new Date(transaction.createdAt).getTime()),
      );
      return order
        ? Math.max(0, (paidAt - new Date(order.createdAt).getTime()) / 60000)
        : null;
    })
    .filter((duration): duration is number => duration !== null);
  const averageTicketTime = completedDurations.length
    ? Math.round(
        completedDurations.reduce((sum, duration) => sum + duration, 0) /
          completedDurations.length,
      )
    : null;
  const minutesAgo = (date: string) =>
    clockNow === null
      ? "—"
      : (() => {
          const minutes = Math.max(
            0,
            Math.floor((clockNow - new Date(date).getTime()) / 60000),
          );
          return minutes < 1
            ? "just now"
            : minutes < 60
              ? `${minutes}m ago`
              : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
        })();
  const dateLabel = now
    ? new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(now)
    : "";
  const servicePeriod = now
    ? now.getHours() < 11
      ? "BREAKFAST"
      : now.getHours() < 16
        ? "LUNCH"
        : now.getHours() < 22
          ? "DINNER"
          : "LATE NIGHT"
    : "SERVICE";
  const greeting = now
    ? now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening"
    : "Welcome";
  const allowedViews = roleViews[role];
  const canTakePayment = role === "Manager" || role === "Cashier";
  const canManageMenu = role === "Manager";
  const tableOrders =
    orderType === "Dine in" && selectedTable
      ? activeOrders.filter((order) => order.tableId === selectedTable)
      : [];
  const currentTableOrder =
    tableOrders.find((order) => order.id === selectedTableOrderId) ??
    tableOrders[0];
  const currentOrder =
    orderType === "Dine in"
      ? currentTableOrder
      : (serviceOrders.find((order) => order.id === selectedServiceOrderId) ??
        serviceOrders[serviceOrders.length - 1]);
  const splitOrder = data.orders.find(
    (order) =>
      order.id === splitOrderId &&
      order.status !== "paid" &&
      order.status !== "cancelled",
  );
  const checkoutOrder = data.orders.find(
    (order) =>
      order.id === checkoutOrderId &&
      order.status !== "paid" &&
      order.status !== "cancelled",
  );
  const orderPendingCancellation = data.orders.find(
    (order) =>
      order.id === cancelOrderId &&
      order.status !== "paid" &&
      order.status !== "cancelled",
  );
  const reservationTable = data.tables.find(
    (table) => table.id === reservationTableId,
  );
  const checkoutSubtotal = checkoutOrder
    ? lineTotal(checkoutOrder.items, menuItems)
    : 0;
  const checkoutBill = calculateBill(checkoutSubtotal, discountPercent);
  const checkoutDiscount = checkoutBill.discount;
  const checkoutTax = checkoutBill.tax;
  const checkoutTotal = checkoutBill.total;
  const dialogOpen = Boolean(
    menuEditorOpen ||
    categoryEditor !== false ||
    tableEditorOpen ||
    reservationTableId ||
    customizingItem ||
    splitOrder ||
    orderPendingCancellation ||
    checkoutOrder,
  );

  useEffect(() => {
    if (!dialogOpen) return;
    const active = document.activeElement;
    dialogReturnFocus.current = active instanceof HTMLElement ? active : null;
    const focusableSelector =
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const focusInitial = () => {
      const dialog = document.querySelector<HTMLElement>(
        '[role="dialog"][aria-modal="true"]',
      );
      const target =
        dialog?.querySelector<HTMLElement>("[autofocus]") ??
        dialog?.querySelector<HTMLElement>(focusableSelector) ??
        dialog;
      target?.focus();
    };
    const frame = window.requestAnimationFrame(focusInitial);
    const handleDialogKeys = (event: KeyboardEvent) => {
      const dialog = document.querySelector<HTMLElement>(
        '[role="dialog"][aria-modal="true"]',
      );
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.querySelector<HTMLButtonElement>(".payment-close")?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleDialogKeys);
      if (dialogReturnFocus.current?.isConnected)
        dialogReturnFocus.current.focus();
    };
  }, [dialogOpen]);

  function splitOpenOrder() {
    if (!splitOrder) return;
    const selected = splitOrder.items.filter((line, index) =>
      splitLineKeys.includes(line.id ?? `${line.menuItemId}-${index}`),
    );
    if (!selected.length) {
      setNotice("Choose at least one item to move to the new ticket.");
      return;
    }
    if (selected.length === splitOrder.items.length) {
      setNotice("Leave at least one item on the original ticket.");
      return;
    }
    const createdAt = new Date().toISOString();
    const newOrderId = nextOrderId(data.orders);
    const result = splitOrderLines(
      splitOrder,
      splitLineKeys,
      newOrderId,
      createdAt,
    );
    if (!result) return;
    setData((previous) => ({
      ...previous,
      orders: [
        ...previous.orders.filter((order) => order.id !== splitOrder.id),
        result.source,
        result.created,
      ],
    }));
    if (splitOrder.tableId) setSelectedTableOrderId(newOrderId);
    else setSelectedServiceOrderId(newOrderId);
    setSplitOrderId(null);
    setSplitLineKeys([]);
    setNotice(
      `${result.created.items.length} item${result.created.items.length === 1 ? "" : "s"} moved to ${newOrderId}.`,
    );
  }

  function addToCart(item: MenuItem) {
    setCustomizingItem(item);
    setCustomQuantity(1);
    setCustomModifierIds([]);
    setCustomVariantId(item.variants?.[0]?.id ?? "");
    setCustomNote("");
  }

  function confirmCustomizedItem() {
    if (!customizingItem) return;
    if (
      !Number.isInteger(customQuantity) ||
      customQuantity < 1 ||
      customQuantity > 99
    ) {
      setNotice("Item quantity must be between 1 and 99.");
      return;
    }
    const availableModifiers =
      customizingItem.modifiers ??
      modifiersByCategory[customizingItem.category] ??
      [];
    const line: OrderLine = {
      id: crypto.randomUUID(),
      menuItemId: customizingItem.id,
      quantity: customQuantity,
      variant: customizingItem.variants?.find(
        (variant) => variant.id === customVariantId,
      ),
      modifiers: availableModifiers.filter((modifier) =>
        customModifierIds.includes(modifier.id),
      ),
      note: customNote.trim() || undefined,
    };
    setCart((lines) => [...lines, line]);
    setCustomizingItem(null);
  }

  function changeQuantity(id: string, change: number) {
    setCart((lines) =>
      lines
        .map((line) =>
          (line.id ?? line.menuItemId) === id
            ? { ...line, quantity: Math.min(99, line.quantity + change) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function startEditingOrder(orderId: string) {
    const order = data.orders.find((candidate) => candidate.id === orderId);
    if (!order || ["paid", "cancelled", "served"].includes(order.status)) {
      setNotice("This order can no longer be edited.");
      return false;
    }
    setEditingOrderId(order.id);
    setOrderType(order.type);
    setSelectedTable(order.tableId);
    setDeliveryName(order.deliveryDetails?.recipientName ?? "");
    setDeliveryPhone(order.deliveryDetails?.phone ?? "");
    setDeliveryAddress(order.deliveryDetails?.address ?? "");
    setCart(order.items.map((line) => ({ ...line })));
    setCategory("All");
    setSearch("");
    setSelectedServiceOrderId(order.id);
    return true;
  }

  function resetOrderDraft() {
    setEditingOrderId(null);
    setCart([]);
    setOrderType("Dine in");
    setSelectedTable("t2");
    setDeliveryName("");
    setDeliveryPhone("");
    setDeliveryAddress("");
    setCategory("All");
    setSearch("");
  }

  function placeOrder(forceNew = false) {
    if (cart.length === 0) {
      setNotice("Add at least one menu item before saving this order.");
      return;
    }
    const editingOrder = editingOrderId
      ? data.orders.find((candidate) => candidate.id === editingOrderId)
      : undefined;
    if (editingOrderId && !editingOrder) {
      setNotice("This order could not be found. Return to the Orders list.");
      return;
    }
    const requestedStock = cart.reduce<Record<string, number>>(
      (counts, line) => ({
        ...counts,
        [line.menuItemId]: (counts[line.menuItemId] ?? 0) + line.quantity,
      }),
      {},
    );
    const previouslyConsumed = (editingOrder?.stockConsumedItems ?? []).reduce<
      Record<string, number>
    >(
      (counts, line) => ({
        ...counts,
        [line.menuItemId]: (counts[line.menuItemId] ?? 0) + line.quantity,
      }),
      {},
    );
    const stockDelta: Record<string, number> = {};
    for (const item of menuItems) {
      stockDelta[item.id] =
        (requestedStock[item.id] ?? 0) - (previouslyConsumed[item.id] ?? 0);
    }
    const unavailableStock = Object.entries(stockDelta).find(
      ([itemId, quantity]) => {
        const item = itemById(itemId, menuItems);
        return (
          quantity > 0 &&
          item?.stockCount !== undefined &&
          item.stockCount < quantity
        );
      },
    );
    if (unavailableStock) {
      const item = itemById(unavailableStock[0], menuItems);
      setNotice(
        `${item?.name ?? "This item"} has only ${item?.stockCount ?? 0} in stock.`,
      );
      return;
    }
    if (orderType === "Dine in" && !selectedTable) {
      setNotice("Choose a table before sending this dine-in order.");
      return;
    }
    let deliveryDetails: DeliveryDetails | undefined;
    if (orderType === "Delivery") {
      const recipientName = deliveryName.trim();
      const normalizedPhone = deliveryPhone.replace(/[\s()-]/g, "");
      const address = deliveryAddress.trim();
      if (recipientName.length < 2) {
        setNotice("Enter the delivery recipient's name.");
        return;
      }
      if (!/^\+?\d{10,15}$/.test(normalizedPhone)) {
        setNotice("Enter a valid delivery phone number.");
        return;
      }
      if (address.length < 8) {
        setNotice("Enter a complete delivery address.");
        return;
      }
      deliveryDetails = { recipientName, phone: normalizedPhone, address };
    }
    const appendToCurrent = !editingOrder && !forceNew && Boolean(currentOrder);
    const orderId =
      editingOrder?.id ??
      (appendToCurrent ? currentOrder!.id : nextOrderId(data.orders));
    const firedAt = new Date().toISOString();
    const tableId = orderType === "Dine in" ? selectedTable : null;
    const nextOrder: Order = {
      ...(editingOrder ?? ({} as Order)),
      id: orderId,
      tableId,
      type: orderType,
      deliveryDetails,
      status: "new",
      items: cart,
      rounds: editingOrder ? [cart] : [cart],
      stockConsumedItems: cart,
      lastFiredAt: firedAt,
      createdAt: editingOrder?.createdAt ?? firedAt,
    };
    const inventoryMovements: InventoryMovement[] = Object.entries(
      stockDelta,
    ).flatMap(([menuItemId, delta]) => {
      const item = itemById(menuItemId, menuItems);
      if (!item || item.stockCount === undefined || delta === 0) return [];
      return [
        {
          id: `${orderId}-edit-${menuItemId}-${firedAt}`,
          menuItemId,
          itemName: item.name,
          quantity: delta > 0 ? -delta : Math.abs(delta),
          reason: delta > 0 ? ("sale" as const) : ("restock" as const),
          orderId,
          createdAt: firedAt,
        },
      ];
    });

    setData((previous) => {
      let orders: Order[];
      if (editingOrder) {
        orders = previous.orders.map((candidate) =>
          candidate.id === orderId ? nextOrder : candidate,
        );
      } else if (appendToCurrent && currentOrder) {
        orders = previous.orders.map((candidate) =>
          candidate.id === currentOrder.id
            ? {
                ...candidate,
                items: [...candidate.items, ...cart],
                rounds: [...(candidate.rounds ?? [candidate.items]), cart],
                stockConsumedItems: [
                  ...(candidate.stockConsumedItems ?? []),
                  ...cart,
                ],
                status: "new",
                lastFiredAt: firedAt,
                deliveryDetails: deliveryDetails ?? candidate.deliveryDetails,
              }
            : candidate,
        );
      } else {
        orders = [...previous.orders, nextOrder];
      }
      const tables = previous.tables.map((table) => {
        if (
          editingOrder?.tableId &&
          editingOrder.tableId !== tableId &&
          table.id === editingOrder.tableId
        ) {
          const stillOccupied = orders.some(
            (order) =>
              order.id !== orderId &&
              order.tableId === table.id &&
              !["paid", "cancelled"].includes(order.status),
          );
          return {
            ...table,
            status: stillOccupied
              ? ("occupied" as const)
              : ("cleaning" as const),
            guests: stillOccupied ? table.guests : undefined,
          };
        }
        return table.id === tableId
          ? {
              ...table,
              status: "occupied" as const,
              guests: table.guests ?? 2,
              reservation: undefined,
            }
          : table;
      });
      return {
        ...previous,
        orders,
        menuItems: (previous.menuItems ?? menu).map((item) =>
          item.stockCount === undefined
            ? item
            : {
                ...item,
                stockCount: Math.max(
                  0,
                  item.stockCount -
                    (stockDelta[item.id] ??
                      (appendToCurrent ? (requestedStock[item.id] ?? 0) : 0)),
                ),
              },
        ),
        inventoryMovements: [
          ...(previous.inventoryMovements ?? []),
          ...inventoryMovements,
        ],
        tables,
      };
    });
    setCart([]);
    setEditingOrderId(null);
    if (orderType !== "Dine in") setSelectedServiceOrderId(orderId);
    setNotice(
      editingOrder
        ? `${orderId} updated and sent to the kitchen`
        : appendToCurrent
          ? `Additional items sent to ${orderId}`
          : `${orderId} sent to the kitchen`,
    );
    setView("Orders");
  }

  function deleteOrder(orderId: string) {
    const order = data.orders.find((candidate) => candidate.id === orderId);
    if (!order || ["paid", "served"].includes(order.status)) {
      setNotice("Paid or served orders cannot be deleted.");
      return false;
    }
    const wasCancelled = order.status === "cancelled";
    const returnedStock = wasCancelled
      ? {}
      : (order.stockConsumedItems ?? []).reduce<Record<string, number>>(
          (counts, line) => ({
            ...counts,
            [line.menuItemId]: (counts[line.menuItemId] ?? 0) + line.quantity,
          }),
          {},
        );
    const movements: InventoryMovement[] = Object.entries(
      returnedStock,
    ).flatMap(([menuItemId, quantity]) => {
      const item = itemById(menuItemId, menuItems);
      return item?.stockCount === undefined
        ? []
        : [
            {
              id: `${orderId}-delete-${menuItemId}-${Date.now()}`,
              menuItemId,
              itemName: item.name,
              quantity,
              reason: "cancellation" as const,
              orderId,
              createdAt: new Date().toISOString(),
            },
          ];
    });
    setData((previous) => {
      const orders = previous.orders.filter(
        (candidate) => candidate.id !== orderId,
      );
      return {
        ...previous,
        orders,
        transactions: (previous.transactions ?? []).filter(
          (transaction) => transaction.orderId !== orderId,
        ),
        menuItems: (previous.menuItems ?? menu).map((item) =>
          item.stockCount === undefined
            ? item
            : {
                ...item,
                stockCount: item.stockCount + (returnedStock[item.id] ?? 0),
              },
        ),
        inventoryMovements: [
          ...(previous.inventoryMovements ?? []),
          ...movements,
        ],
        tables: order.tableId
          ? previous.tables.map((table) => {
              if (table.id !== order.tableId) return table;
              const occupied = orders.some(
                (candidate) =>
                  candidate.tableId === table.id &&
                  !["paid", "cancelled"].includes(candidate.status),
              );
              return {
                ...table,
                status: occupied
                  ? ("occupied" as const)
                  : ("cleaning" as const),
                guests: occupied ? table.guests : undefined,
              };
            })
          : previous.tables,
      };
    });
    setNotice(`${orderId} deleted.`);
    return true;
  }

  function printBill() {
    const clearPrintTarget = () => {
      delete document.documentElement.dataset.printTarget;
    };
    document.documentElement.dataset.printTarget = "bill";
    window.addEventListener("afterprint", clearPrintTarget, { once: true });
    window.setTimeout(clearPrintTarget, 15000);
    window.print();
  }

  function downloadBackup() {
    const backup = {
      format: "dinein-pos-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `dinein-pos-backup-${dateForInput(new Date())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Local POS backup downloaded.");
  }

  async function restoreBackup(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setNotice("Backup file must be 10 MB or smaller.");
      return;
    }
    try {
      const backup = parsePosBackup(JSON.parse(await file.text()));
      if (!backup) {
        setNotice("This file is not a valid Dine In backup.");
        return;
      }
      if (
        !window.confirm(
          "Restoring this backup replaces the POS data currently stored in this browser. Continue?",
        )
      )
        return;
      const restored: PosData = {
        ...initialData,
        ...backup.data,
        unavailableMenuIds: backup.data.unavailableMenuIds ?? [],
        transactions: backup.data.transactions ?? [],
        menuItems: backup.data.menuItems ?? menu,
        inventoryMovements: backup.data.inventoryMovements ?? [],
      };
      setData(restored);
      setSelectedTable(
        restored.tables.find(
          (table) => !table.mergedInto && table.status === "available",
        )?.id ??
          restored.tables.find((table) => !table.mergedInto)?.id ??
          null,
      );
      setSelectedTableOrderId(null);
      setSelectedServiceOrderId(null);
      setCart([]);
      setStorageStatus("saving");
      setNotice(
        `Backup from ${new Date(backup.exportedAt).toLocaleDateString("en-IN")} restored. Saving on this device…`,
      );
    } catch {
      setNotice(
        "Could not read this backup file. Choose a valid Dine In JSON backup.",
      );
    }
  }

  function completePayment() {
    if (!checkoutOrder) return;
    const order = checkoutOrder;
    const createdAt = new Date().toISOString();
    const itemWeights = Array.from({ length: guestCount }, (_, guestIndex) =>
      order.items.reduce(
        (sum, line, lineIndex) =>
          (itemGuests[lineIndex] ?? 0) === guestIndex
            ? sum + lineUnitPrice(line, menuItems) * line.quantity
            : sum,
        0,
      ),
    );
    if (
      splitPayment &&
      splitMode === "items" &&
      itemWeights.some((weight) => weight === 0)
    ) {
      setNotice(
        "Assign at least one order line to every guest before checkout.",
      );
      return;
    }
    const amounts = splitPayment
      ? splitMode === "items"
        ? allocateCents(checkoutTotal, itemWeights)
        : allocateCents(
            checkoutTotal,
            Array.from({ length: guestCount }, () => 1),
          )
      : [checkoutTotal];
    const methods = Array.from(
      { length: splitPayment ? guestCount : 1 },
      (_, index) => ({
        method: splitPayment
          ? (guestMethods[index] ?? paymentMethod)
          : paymentMethod,
        amount: amounts[index] ?? 0,
        splitLabel: splitPayment ? `Guest ${index + 1}` : undefined,
      }),
    );
    const payments = methods.map((payment, index) => ({
      id: `${order.id}-${createdAt}-${index}`,
      orderId: order.id,
      amount: payment.amount,
      method: payment.method,
      createdAt,
      splitLabel: payment.splitLabel,
    }));
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((candidate) =>
        candidate.id === order.id
          ? { ...candidate, status: "paid" }
          : candidate,
      ),
      tables: order.tableId
        ? previous.tables.map((table) =>
            table.id === order.tableId
              ? { ...table, status: "cleaning", guests: undefined }
              : table,
          )
        : previous.tables,
      transactions: [...(previous.transactions ?? []), ...payments],
    }));
    setCheckoutOrderId(null);
    setDiscountPercent(0);
    setSplitPayment(false);
    setNotice(`${order.id} paid · ${money(checkoutTotal)} received`);
  }

  function setOrderStatus(orderId: string, status: Order["status"]) {
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((order) =>
        order.id === orderId ? { ...order, status } : order,
      ),
    }));
    setNotice(`${orderId} marked ${status}`);
  }

  function cancelOrder(orderId: string, reason: string) {
    const order = data.orders.find((candidate) => candidate.id === orderId);
    if (
      !order ||
      order.status === "paid" ||
      order.status === "cancelled" ||
      order.status === "served"
    )
      return;
    setData((previous) => {
      const orders = previous.orders.map((candidate) =>
        candidate.id === orderId
          ? {
              ...candidate,
              status: "cancelled" as const,
              cancellationReason: reason.trim() || "No reason provided",
            }
          : candidate,
      );
      const otherOpenOrder =
        order.tableId &&
        orders.some(
          (candidate) =>
            candidate.id !== orderId &&
            candidate.tableId === order.tableId &&
            candidate.status !== "paid" &&
            candidate.status !== "cancelled",
        );
      const returnedStock = (order.stockConsumedItems ?? []).reduce<
        Record<string, number>
      >(
        (counts, line) => ({
          ...counts,
          [line.menuItemId]: (counts[line.menuItemId] ?? 0) + line.quantity,
        }),
        {},
      );
      const menuItems = (previous.menuItems ?? menu).map((item) =>
        item.stockCount === undefined
          ? item
          : {
              ...item,
              stockCount: item.stockCount + (returnedStock[item.id] ?? 0),
            },
      );
      const returnedMovements: InventoryMovement[] = Object.entries(
        returnedStock,
      ).flatMap(([menuItemId, quantity]) => {
        const item = previous.menuItems.find(
          (candidate) => candidate.id === menuItemId,
        );
        return quantity && item?.stockCount !== undefined
          ? [
              {
                id: `${orderId}-return-${menuItemId}-${Date.now()}`,
                menuItemId,
                itemName: item.name,
                quantity,
                reason: "cancellation",
                orderId,
                createdAt: new Date().toISOString(),
              },
            ]
          : [];
      });
      return {
        ...previous,
        orders,
        menuItems,
        inventoryMovements: [
          ...(previous.inventoryMovements ?? []),
          ...returnedMovements,
        ],
        tables: order.tableId
          ? previous.tables.map((table) =>
              table.id === order.tableId
                ? {
                    ...table,
                    status: otherOpenOrder ? "occupied" : "cleaning",
                    guests: otherOpenOrder ? table.guests : undefined,
                  }
                : table,
            )
          : previous.tables,
      };
    });
    setCancelOrderId(null);
    setNotice(
      `${order.id} cancelled · ${reason.trim() || "No reason provided"}`,
    );
  }

  function requestCancellation(orderId: string) {
    setCancelReason("Guest changed their mind");
    setCancelOrderId(orderId);
  }

  function setTableStatus(tableId: string, status: Table["status"]) {
    setData((previous) => ({
      ...previous,
      tables: previous.tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              status,
              guests: status === "occupied" ? (table.guests ?? 2) : undefined,
              reservation:
                status === "reserved" ? table.reservation : undefined,
            }
          : table,
      ),
    }));
  }

  function requestReservation(tableId: string) {
    const table = data.tables.find((candidate) => candidate.id === tableId);
    if (!table || table.mergedInto) return;
    const defaultTime = new Date(Date.now() + 30 * 60000);
    setReservationTableId(tableId);
    setReservationGuestName(table.reservation?.guestName ?? "");
    setReservationGuests(table.reservation?.guests ?? 2);
    setReservationTime(
      dateTimeForInput(
        table.reservation ? new Date(table.reservation.time) : defaultTime,
      ),
    );
  }

  function saveReservation() {
    const table = data.tables.find(
      (candidate) => candidate.id === reservationTableId,
    );
    if (!table) return;
    const capacity =
      table.seats +
      data.tables
        .filter((candidate) => candidate.mergedInto === table.id)
        .reduce((sum, candidate) => sum + candidate.seats, 0);
    if (!reservationGuestName.trim()) {
      setNotice("Enter a guest name for this reservation.");
      return;
    }
    if (reservationGuests < 1 || reservationGuests > capacity) {
      setNotice(`This table can seat up to ${capacity} guests.`);
      return;
    }
    const time = new Date(reservationTime);
    if (
      !reservationTime ||
      Number.isNaN(time.getTime()) ||
      time.getTime() < Date.now()
    ) {
      setNotice("Choose a future reservation time.");
      return;
    }
    const reservation: ReservationDetails = {
      guestName: reservationGuestName.trim(),
      guests: reservationGuests,
      time: time.toISOString(),
    };
    setData((previous) => ({
      ...previous,
      tables: previous.tables.map((candidate) =>
        candidate.id === table.id
          ? { ...candidate, status: "reserved", guests: undefined, reservation }
          : candidate,
      ),
    }));
    setReservationTableId(null);
    setNotice(`Reservation saved for ${reservation.guestName}.`);
  }

  function transferOrder(orderId: string, targetId: string) {
    const sourceId = data.orders.find((order) => order.id === orderId)?.tableId;
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((order) =>
        order.id === orderId && order.status !== "cancelled"
          ? { ...order, tableId: targetId }
          : order,
      ),
      tables: previous.tables.map((table) =>
        table.id === targetId
          ? { ...table, status: "occupied", guests: table.guests ?? 2 }
          : table.id === sourceId &&
              !previous.orders.some(
                (order) =>
                  order.id !== orderId &&
                  order.tableId === sourceId &&
                  order.status !== "paid" &&
                  order.status !== "cancelled",
              )
            ? { ...table, status: "cleaning", guests: undefined }
            : table,
      ),
    }));
    setNotice(
      `${orderId} transferred to table ${data.tables.find((table) => table.id === targetId)?.name}`,
    );
  }

  function mergeTables(primaryId: string, secondaryId: string) {
    if (primaryId === secondaryId) return;
    const primary = data.tables.find((table) => table.id === primaryId);
    const secondary = data.tables.find((table) => table.id === secondaryId);
    if (
      !primary ||
      !secondary ||
      primary.mergedInto ||
      secondary.mergedInto ||
      primary.status === "merged" ||
      secondary.status === "merged" ||
      primary.status === "reserved" ||
      primary.status === "cleaning" ||
      secondary.status === "reserved" ||
      secondary.status === "cleaning" ||
      data.tables.some(
        (table) =>
          table.mergedInto === primaryId || table.mergedInto === secondaryId,
      )
    ) {
      setNotice(
        "Choose two available or occupied tables. Each table can join one pair.",
      );
      return;
    }
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((order) =>
        order.tableId === secondaryId &&
        order.status !== "paid" &&
        order.status !== "cancelled"
          ? { ...order, tableId: primaryId }
          : order,
      ),
      tables: previous.tables.map((table) =>
        table.id === primaryId
          ? {
              ...table,
              status:
                table.status === "occupied" || secondary.status === "occupied"
                  ? "occupied"
                  : "available",
              guests:
                (table.guests ?? 0) + (secondary.guests ?? 0) || undefined,
              mergedBaseStatus:
                table.status === "merged" ? "available" : table.status,
              mergedBaseGuests: table.guests,
            }
          : table.id === secondaryId
            ? {
                ...table,
                status: "merged",
                mergedInto: primaryId,
                mergedOrderIds: data.orders
                  .filter(
                    (order) =>
                      order.tableId === secondaryId &&
                      order.status !== "paid" &&
                      order.status !== "cancelled",
                  )
                  .map((order) => order.id),
                mergedOriginalStatus:
                  table.status === "merged" ? "available" : table.status,
                mergedOriginalGuests: table.guests,
                guests: undefined,
              }
            : table,
      ),
    }));
    setNotice(`Tables ${primary.name} and ${secondary.name} merged.`);
  }

  function unmergeTable(secondaryId: string) {
    const secondary = data.tables.find((table) => table.id === secondaryId);
    if (!secondary?.mergedInto) return;
    const primaryId = secondary.mergedInto;
    const mergedOrderIds = secondary.mergedOrderIds ?? [];
    const secondaryOrders = data.orders.filter((order) =>
      mergedOrderIds.includes(order.id),
    );
    const hasOpenSecondaryOrders = secondaryOrders.some(
      (order) => order.status !== "paid" && order.status !== "cancelled",
    );
    const hasCompletedSecondaryOrders = secondaryOrders.some(
      (order) => order.status === "paid" || order.status === "cancelled",
    );
    const hasRemainingPrimaryOrders = data.orders.some(
      (order) =>
        order.tableId === primaryId &&
        !mergedOrderIds.includes(order.id) &&
        order.status !== "paid" &&
        order.status !== "cancelled",
    );
    setData((previous) => ({
      ...previous,
      orders: previous.orders.map((order) =>
        mergedOrderIds.includes(order.id)
          ? { ...order, tableId: secondaryId }
          : order,
      ),
      tables: previous.tables.map((table) =>
        table.id === secondaryId
          ? {
              ...table,
              status: hasOpenSecondaryOrders
                ? "occupied"
                : hasCompletedSecondaryOrders
                  ? "cleaning"
                  : (secondary.mergedOriginalStatus ?? "available"),
              guests: hasOpenSecondaryOrders
                ? (secondary.mergedOriginalGuests ?? secondary.seats)
                : hasCompletedSecondaryOrders
                  ? undefined
                  : secondary.mergedOriginalGuests,
              mergedInto: undefined,
              mergedOrderIds: undefined,
              mergedOriginalStatus: undefined,
              mergedOriginalGuests: undefined,
            }
          : table.id === primaryId
            ? {
                ...table,
                guests: hasRemainingPrimaryOrders
                  ? (table.mergedBaseGuests ?? table.seats)
                  : table.mergedBaseGuests,
                status: hasRemainingPrimaryOrders
                  ? "occupied"
                  : (table.mergedBaseStatus ?? "available"),
                mergedBaseGuests: undefined,
                mergedBaseStatus: undefined,
              }
            : table,
      ),
    }));
    setNotice(
      `Table ${secondary.name} unmerged from table ${data.tables.find((table) => table.id === primaryId)?.name}.`,
    );
  }

  function toggleMenuAvailability(menuItemId: string) {
    setData((previous) => {
      const unavailableMenuIds = previous.unavailableMenuIds ?? [];
      return {
        ...previous,
        unavailableMenuIds: unavailableMenuIds.includes(menuItemId)
          ? unavailableMenuIds.filter((id) => id !== menuItemId)
          : [...unavailableMenuIds, menuItemId],
      };
    });
  }

  function restockMenuItem(menuItemId: string, quantity: number) {
    const item = menuItems.find((candidate) => candidate.id === menuItemId);
    if (!item || item.stockCount === undefined) {
      setNotice("Set a stock count in Edit before recording a restock.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      setNotice("Restock quantity must be a whole number from 1 to 10,000.");
      return;
    }
    const movement: InventoryMovement = {
      id: `restock-${menuItemId}-${Date.now()}`,
      menuItemId,
      itemName: item.name,
      quantity,
      reason: "restock",
      createdAt: new Date().toISOString(),
    };
    setData((previous) => ({
      ...previous,
      menuItems: (previous.menuItems ?? menu).map((candidate) =>
        candidate.id === menuItemId && candidate.stockCount !== undefined
          ? { ...candidate, stockCount: candidate.stockCount + quantity }
          : candidate,
      ),
      inventoryMovements: [...(previous.inventoryMovements ?? []), movement],
    }));
    setNotice(`${quantity} ${item.name} added to stock.`);
  }

  function openMenuEditor(item?: MenuItem) {
    setMenuEditorId(item?.id ?? null);
    setMenuFormName(item?.name ?? "");
    setMenuFormDescription(item?.description ?? "");
    setMenuFormCategory(item?.category ?? "Starters");
    setMenuFormPrice(item ? String(item.price) : "");
    setMenuFormStock(
      item?.stockCount !== undefined ? String(item.stockCount) : "",
    );
    setMenuFormLowStockThreshold(String(item?.lowStockThreshold ?? 5));
    setMenuFormEmoji(item?.emoji ?? "\u{1F37D}");
    setMenuFormVariants(
      (item?.variants ?? [])
        .map((variant) => `${variant.label} | ${variant.price}`)
        .join("\n"),
    );
    setMenuFormModifiers(
      (
        item?.modifiers ??
        (item ? (modifiersByCategory[item.category] ?? []) : [])
      )
        .map((modifier) => `${modifier.label} | ${modifier.price}`)
        .join("\n"),
    );
    setMenuFormAvailable(
      item ? !(data.unavailableMenuIds ?? []).includes(item.id) : true,
    );
    setMenuEditorOpen(true);
  }

  function openCategoryEditor(name: string | null = null) {
    setCategoryEditor(name);
    setCategoryFormName(name ?? "");
  }

  function saveCategory() {
    const name = categoryFormName.trim();
    const original = categoryEditor;
    if (!name || name.length > 30 || name.toLowerCase() === "all") {
      setNotice(
        "Enter a category name up to 30 characters; “All” is reserved.",
      );
      return;
    }
    if (
      (data.categories ?? defaultCategories).some(
        (entry) =>
          entry.toLowerCase() === name.toLowerCase() && entry !== original,
      )
    ) {
      setNotice("A category with that name already exists.");
      return;
    }
    setData((previous) => ({
      ...previous,
      categories: original
        ? (previous.categories ?? defaultCategories).map((entry) =>
            entry === original ? name : entry,
          )
        : [...(previous.categories ?? defaultCategories), name],
      ...(original
        ? {
            menuItems: (previous.menuItems ?? menu).map((item) =>
              item.category === original ? { ...item, category: name } : item,
            ),
          }
        : {}),
    }));
    if (original && category === original) setCategory(name);
    if (!original) setCategory(name);
    setCategoryEditor(false);
    setNotice(
      original ? `Category renamed to ${name}.` : `${name} category added.`,
    );
  }

  function deleteCategory(name: string) {
    if (menuItems.some((item) => item.category === name)) return;
    setData((previous) => ({
      ...previous,
      categories: (previous.categories ?? defaultCategories).filter(
        (entry) => entry !== name,
      ),
    }));
    if (category === name) setCategory("All");
    setNotice(`${name} category deleted.`);
  }

  function saveMenuItem() {
    const name = menuFormName.trim();
    const price = Number(menuFormPrice);
    const stockCount =
      menuFormStock.trim() === "" ? undefined : Number(menuFormStock);
    const lowStockThreshold = Number(menuFormLowStockThreshold);
    if (
      !name ||
      !menuFormDescription.trim() ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !menuFormEmoji.trim()
    ) {
      setNotice(
        "Enter a name, description, icon, and price greater than zero.",
      );
      return;
    }
    if (
      (stockCount !== undefined &&
        (!Number.isInteger(stockCount) || stockCount < 0)) ||
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setNotice(
        "Stock and low-stock alert values must be whole numbers of zero or more.",
      );
      return;
    }
    const variants: MenuVariant[] = [];
    for (const [index, row] of menuFormVariants
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .entries()) {
      const [labelText, priceText, ...extra] = row.split("|");
      const label = labelText.trim();
      const variantPrice = Number(priceText?.trim());
      if (
        !label ||
        !priceText ||
        extra.length ||
        !Number.isFinite(variantPrice) ||
        variantPrice <= 0
      ) {
        setNotice(
          `Variant ${index + 1} needs a name and a price greater than zero, separated by |.`,
        );
        return;
      }
      const existingId = menuEditorId
        ? menuItems
            .find((candidate) => candidate.id === menuEditorId)
            ?.variants?.find(
              (variant) => variant.label.toLowerCase() === label.toLowerCase(),
            )?.id
        : undefined;
      variants.push({
        id: existingId ?? `variant-${Date.now()}-${index}`,
        label,
        price: variantPrice,
      });
    }
    const existing = menuEditorId
      ? menuItems.find((item) => item.id === menuEditorId)
      : undefined;
    const modifiers: MenuModifier[] = [];
    for (const [index, row] of menuFormModifiers
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .entries()) {
      const [labelText, priceText, ...extra] = row.split("|");
      const label = labelText.trim();
      const modifierPrice = Number(priceText?.trim());
      if (
        !label ||
        !priceText ||
        extra.length ||
        !Number.isFinite(modifierPrice) ||
        modifierPrice < 0
      ) {
        setNotice(
          `Add-on ${index + 1} needs a name and a price of zero or more, separated by |.`,
        );
        return;
      }
      const existingId = existing?.modifiers?.find(
        (modifier) => modifier.label.toLowerCase() === label.toLowerCase(),
      )?.id;
      modifiers.push({
        id: existingId ?? `modifier-${Date.now()}-${index}`,
        label,
        price: modifierPrice,
      });
    }
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `item-${Date.now()}`;
    const id =
      existing?.id ??
      (menuItems.some((item) => item.id === slug)
        ? `${slug}-${Date.now()}`
        : slug);
    const colors = ["peach", "yellow", "green", "rose", "blue"];
    const item: MenuItem = {
      id,
      name,
      description: menuFormDescription.trim(),
      category: menuFormCategory,
      price,
      emoji: menuFormEmoji.trim(),
      color: existing?.color ?? colors[menuItems.length % colors.length],
      ...(variants.length ? { variants } : {}),
      modifiers,
      ...(stockCount !== undefined ? { stockCount, lowStockThreshold } : {}),
    };
    setData((previous) => ({
      ...previous,
      menuItems: existing
        ? (previous.menuItems ?? menu).map((candidate) =>
            candidate.id === id ? item : candidate,
          )
        : [...(previous.menuItems ?? menu), item],
      unavailableMenuIds: menuFormAvailable
        ? (previous.unavailableMenuIds ?? []).filter((itemId) => itemId !== id)
        : (previous.unavailableMenuIds ?? []).includes(id)
          ? previous.unavailableMenuIds
          : [...(previous.unavailableMenuIds ?? []), id],
    }));
    setMenuEditorOpen(false);
    setNotice(existing ? `${name} updated.` : `${name} added to the menu.`);
  }

  function openTableEditor() {
    const nextNumber =
      data.tables.reduce(
        (largest, table) => Math.max(largest, Number(table.name) || 0),
        0,
      ) + 1;
    setTableFormName(String(nextNumber).padStart(2, "0"));
    setTableFormSeats("4");
    setTableEditorOpen(true);
  }

  function addTable() {
    const name = tableFormName.trim();
    const seats = Number(tableFormSeats);
    if (!name || name.length > 12) {
      setNotice("Enter a table name up to 12 characters.");
      return;
    }
    if (
      data.tables.some(
        (table) => table.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setNotice("That table name is already in use.");
      return;
    }
    if (![2, 4, 6, 8, 10, 12].includes(seats)) {
      setNotice("Choose a valid table capacity.");
      return;
    }
    setData((previous) => {
      const nextId =
        previous.tables.reduce(
          (largest, table) =>
            Math.max(largest, Number(table.id.replace(/^t/, "")) || 0),
          0,
        ) + 1;
      return {
        ...previous,
        tables: [
          ...previous.tables,
          {
            id: `t${nextId}`,
            name,
            seats,
            status: "available",
            floorPosition: defaultFloorPosition(previous.tables.length),
          },
        ],
      };
    });
    setTableEditorOpen(false);
    setNotice(`Table ${name} added with ${seats} seats.`);
  }

  function moveFloorTable(
    tableId: string,
    deltaColumn: number,
    deltaRow: number,
  ) {
    setData((previous) => {
      const positioned = previous.tables.map((table, index) => ({
        ...table,
        floorPosition: table.floorPosition ?? defaultFloorPosition(index),
      }));
      const source = positioned.find((table) => table.id === tableId);
      if (!source || source.status === "merged") return previous;
      const from = source.floorPosition!;
      const to = {
        column: Math.max(1, Math.min(4, from.column + deltaColumn)),
        row: Math.max(1, Math.min(6, from.row + deltaRow)),
      };
      if (to.column === from.column && to.row === from.row) return previous;
      const occupant = positioned.find(
        (table) =>
          table.id !== tableId &&
          table.floorPosition?.column === to.column &&
          table.floorPosition?.row === to.row,
      );
      return {
        ...previous,
        tables: positioned.map((table) =>
          table.id === tableId
            ? { ...table, floorPosition: to }
            : table.id === occupant?.id
              ? { ...table, floorPosition: from }
              : table,
        ),
      };
    });
  }

  function changeRole(nextRole: StaffRole) {
    try {
      window.localStorage.setItem("dinein-demo-role", nextRole);
    } catch {
      /* Role preference stays in memory if storage is unavailable. */
    }
    setRole(nextRole);
    setView(roleViews[nextRole][0]);
    setCart([]);
    setRoleMenuOpen(false);
  }

  function tableOrderLines(table: Table) {
    return activeOrders
      .filter((order) => order.tableId === table.id)
      .flatMap((order) => order.items);
  }

  return {
    pathname,
    view,
    setView,
    data,
    setData,
    selectedTable,
    setSelectedTable,
    category,
    setCategory,
    search,
    setSearch,
    cart,
    setCart,
    editingOrderId,
    notice,
    setNotice,
    orderType,
    setOrderType,
    deliveryName,
    setDeliveryName,
    deliveryPhone,
    setDeliveryPhone,
    deliveryAddress,
    setDeliveryAddress,
    selectedServiceOrderId,
    setSelectedServiceOrderId,
    loaded,
    setLoaded,
    storageReady,
    setStorageReady,
    storageStatus,
    setStorageStatus,
    storageErrorAction,
    setStorageErrorAction,
    loadRetry,
    setLoadRetry,
    saveRetry,
    setSaveRetry,
    checkoutOrderId,
    setCheckoutOrderId,
    splitOrderId,
    setSplitOrderId,
    splitLineKeys,
    setSplitLineKeys,
    selectedTableOrderId,
    setSelectedTableOrderId,
    discountPercent,
    setDiscountPercent,
    splitPayment,
    setSplitPayment,
    paymentMethod,
    setPaymentMethod,
    guestCount,
    setGuestCount,
    guestMethods,
    setGuestMethods,
    splitMode,
    setSplitMode,
    itemGuests,
    setItemGuests,
    customizingItem,
    setCustomizingItem,
    customQuantity,
    setCustomQuantity,
    customModifierIds,
    setCustomModifierIds,
    customVariantId,
    setCustomVariantId,
    customNote,
    setCustomNote,
    clockNow,
    setClockNow,
    cancelOrderId,
    setCancelOrderId,
    cancelReason,
    setCancelReason,
    reservationTableId,
    setReservationTableId,
    reservationGuestName,
    setReservationGuestName,
    reservationGuests,
    setReservationGuests,
    reservationTime,
    setReservationTime,
    menuEditorId,
    setMenuEditorId,
    menuFormName,
    setMenuFormName,
    menuFormDescription,
    setMenuFormDescription,
    menuFormCategory,
    setMenuFormCategory,
    menuFormPrice,
    setMenuFormPrice,
    menuFormStock,
    setMenuFormStock,
    menuFormLowStockThreshold,
    setMenuFormLowStockThreshold,
    menuFormEmoji,
    setMenuFormEmoji,
    menuFormVariants,
    setMenuFormVariants,
    menuFormModifiers,
    setMenuFormModifiers,
    menuFormAvailable,
    setMenuFormAvailable,
    menuEditorOpen,
    setMenuEditorOpen,
    categoryEditor,
    setCategoryEditor,
    categoryFormName,
    setCategoryFormName,
    role,
    setRole,
    roleMenuOpen,
    setRoleMenuOpen,
    theme,
    setTheme,
    themeLoaded,
    setThemeLoaded,
    draggingTableId,
    setDraggingTableId,
    tableEditorOpen,
    setTableEditorOpen,
    tableFormName,
    setTableFormName,
    tableFormSeats,
    setTableFormSeats,
    menuItems,
    menuCategories,
    visibleMenu,
    subtotal,
    tax,
    total,
    activeOrders,
    serviceOrders,
    serviceTables,
    occupied,
    now,
    todayTransactions,
    paidToday,
    todaySales,
    completedDurations,
    averageTicketTime,
    minutesAgo,
    dateLabel,
    servicePeriod,
    greeting,
    allowedViews,
    canTakePayment,
    canManageMenu,
    tableOrders,
    currentTableOrder,
    currentOrder,
    splitOrder,
    checkoutOrder,
    orderPendingCancellation,
    reservationTable,
    checkoutSubtotal,
    checkoutBill,
    checkoutDiscount,
    checkoutTax,
    checkoutTotal,
    dialogOpen,
    splitOpenOrder,
    addToCart,
    confirmCustomizedItem,
    changeQuantity,
    startEditingOrder,
    resetOrderDraft,
    placeOrder,
    deleteOrder,
    printBill,
    downloadBackup,
    completePayment,
    restoreBackup,
    setOrderStatus,
    cancelOrder,
    requestCancellation,
    setTableStatus,
    requestReservation,
    saveReservation,
    transferOrder,
    mergeTables,
    unmergeTable,
    toggleMenuAvailability,
    restockMenuItem,
    openMenuEditor,
    openCategoryEditor,
    saveCategory,
    deleteCategory,
    saveMenuItem,
    openTableEditor,
    addTable,
    moveFloorTable,
    changeRole,
    tableOrderLines,
  };
}

type PosContextValue = ReturnType<typeof usePosController>;
const PosContext = createContext<PosContextValue | null>(null);

export function PosProvider({ children }: { children: ReactNode }) {
  const value = usePosController();
  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const value = useContext(PosContext);
  if (!value) throw new Error("usePos must be used inside PosProvider");
  return value;
}
