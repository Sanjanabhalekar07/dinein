import type { InventoryMovement, MenuItem, MenuModifier, MenuVariant, Order, OrderLine, PaymentTransaction, PosData, Table } from "@/lib/pos-data";

export type PosBackup = { format: "dinein-pos-backup"; version: 1; exportedAt: string; data: PosData };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isIntegerAtLeast = (value: unknown, minimum: number) => Number.isInteger(value) && typeof value === "number" && value >= minimum;
const isDateString = (value: unknown) => isString(value) && !Number.isNaN(Date.parse(value));
const isUniqueBy = <T,>(values: T[], getKey: (value: T) => string) => new Set(values.map(getKey)).size === values.length;

function isModifier(value: unknown): value is MenuModifier {
  return isRecord(value) && isString(value.id) && isString(value.label) && isFiniteNumber(value.price) && value.price >= 0;
}

function isVariant(value: unknown): value is MenuVariant {
  return isRecord(value) && isString(value.id) && isString(value.label) && isFiniteNumber(value.price) && value.price > 0;
}

function isMenuItem(value: unknown): value is MenuItem {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name) || !isString(value.category) || !isString(value.description) || !isString(value.emoji) || !isString(value.color) || !isFiniteNumber(value.price) || value.price <= 0) return false;
  if (value.variants !== undefined && (!Array.isArray(value.variants) || !value.variants.every(isVariant))) return false;
  if (value.modifiers !== undefined && (!Array.isArray(value.modifiers) || !value.modifiers.every(isModifier))) return false;
  if (value.stockCount !== undefined && !isIntegerAtLeast(value.stockCount, 0)) return false;
  return value.lowStockThreshold === undefined || isIntegerAtLeast(value.lowStockThreshold, 0);
}

function isOrderLine(value: unknown): value is OrderLine {
  if (!isRecord(value) || !isString(value.menuItemId) || !isIntegerAtLeast(value.quantity, 1)) return false;
  if (value.id !== undefined && !isString(value.id)) return false;
  if (value.note !== undefined && !isString(value.note)) return false;
  if (value.variant !== undefined && !isVariant(value.variant)) return false;
  return value.modifiers === undefined || (Array.isArray(value.modifiers) && value.modifiers.every(isModifier));
}

function isOrder(value: unknown): value is Order {
  if (!isRecord(value) || !isString(value.id) || !(value.tableId === null || isString(value.tableId)) || !["Dine in", "Takeaway", "Delivery"].includes(String(value.type)) || !["new", "preparing", "ready", "served", "paid", "cancelled"].includes(String(value.status)) || !Array.isArray(value.items) || !value.items.every(isOrderLine) || !isDateString(value.createdAt)) return false;
  if (value.deliveryDetails !== undefined && (!isRecord(value.deliveryDetails) || !isString(value.deliveryDetails.recipientName) || !isString(value.deliveryDetails.phone) || !isString(value.deliveryDetails.address))) return false;
  if (value.rounds !== undefined && (!Array.isArray(value.rounds) || !value.rounds.every((round) => Array.isArray(round) && round.every(isOrderLine)))) return false;
  if (value.stockConsumedItems !== undefined && (!Array.isArray(value.stockConsumedItems) || !value.stockConsumedItems.every(isOrderLine))) return false;
  if (value.lastFiredAt !== undefined && !isDateString(value.lastFiredAt)) return false;
  return value.cancellationReason === undefined || isString(value.cancellationReason);
}

function isTable(value: unknown): value is Table {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name) || !isIntegerAtLeast(value.seats, 1) || !["available", "occupied", "reserved", "cleaning", "merged"].includes(String(value.status))) return false;
  if (value.floorPosition !== undefined && (!isRecord(value.floorPosition) || !isIntegerAtLeast(value.floorPosition.column, 1) || !isIntegerAtLeast(value.floorPosition.row, 1))) return false;
  if (value.reservation !== undefined && (!isRecord(value.reservation) || !isString(value.reservation.guestName) || !isIntegerAtLeast(value.reservation.guests, 1) || !isDateString(value.reservation.time))) return false;
  if (value.guests !== undefined && !isIntegerAtLeast(value.guests, 1)) return false;
  if (value.mergedInto !== undefined && !isString(value.mergedInto)) return false;
  if (value.mergedOrderIds !== undefined && (!Array.isArray(value.mergedOrderIds) || !value.mergedOrderIds.every(isString))) return false;
  return true;
}

function isTransaction(value: unknown): value is PaymentTransaction {
  return isRecord(value) && isString(value.id) && isString(value.orderId) && isFiniteNumber(value.amount) && value.amount >= 0 && ["Cash", "Card", "UPI"].includes(String(value.method)) && isDateString(value.createdAt) && (value.splitLabel === undefined || isString(value.splitLabel));
}

function isInventoryMovement(value: unknown): value is InventoryMovement {
  return isRecord(value) && isString(value.id) && isString(value.menuItemId) && isString(value.itemName) && isIntegerAtLeast(value.quantity, 1) && ["restock", "sale", "cancellation"].includes(String(value.reason)) && isDateString(value.createdAt) && (value.orderId === undefined || isString(value.orderId));
}

function isPosData(value: unknown): value is PosData {
  if (!isRecord(value) || !Array.isArray(value.tables) || !value.tables.every(isTable) || !Array.isArray(value.orders) || !value.orders.every(isOrder) || !Array.isArray(value.menuItems) || !value.menuItems.every(isMenuItem) || !Array.isArray(value.unavailableMenuIds) || !value.unavailableMenuIds.every(isString) || !Array.isArray(value.transactions) || !value.transactions.every(isTransaction)) return false;
  if (value.categories !== undefined && (!Array.isArray(value.categories) || !value.categories.every((category) => isString(category) && category.trim().length > 0 && category.length <= 30) || !isUniqueBy(value.categories as string[], (category) => category.toLowerCase()))) return false;
  if (value.inventoryMovements !== undefined && (!Array.isArray(value.inventoryMovements) || !value.inventoryMovements.every(isInventoryMovement))) return false;
  return isUniqueBy(value.tables, (table) => table.id) && isUniqueBy(value.menuItems, (item) => item.id) && isUniqueBy(value.orders, (order) => order.id) && isUniqueBy(value.transactions, (transaction) => transaction.id);
}

export function parsePosBackup(value: unknown): PosBackup | null {
  if (!isRecord(value) || value.format !== "dinein-pos-backup" || value.version !== 1 || !isDateString(value.exportedAt) || !isPosData(value.data)) return null;
  const tableIds = new Set(value.data.tables.map((table) => table.id));
  if (value.data.orders.some((order) => order.tableId !== null && !tableIds.has(order.tableId))) return null;
  return value as unknown as PosBackup;
}
