import type { MenuItem, Order, OrderLine } from "./pos-data";

export type BillBreakdown = { subtotal: number; discount: number; tax: number; total: number };
export type ReportPeriod = "Today" | "This week" | "This month";

export function reportPeriodBounds(period: ReportPeriod, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "This week") start.setDate(start.getDate() - start.getDay());
  if (period === "This month") start.setDate(1);
  return { start, end: new Date(now) };
}

export function customReportPeriodBounds(startDate: string, endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || startDate > endDate) return null;
  return { start, end };
}

export function isWithinCustomReportPeriod(timestamp: string, startDate: string, endDate: string) {
  const date = new Date(timestamp);
  const bounds = customReportPeriodBounds(startDate, endDate);
  return !Number.isNaN(date.getTime()) && bounds !== null && date >= bounds.start && date <= bounds.end;
}

export function isWithinReportPeriod(timestamp: string, period: ReportPeriod, now: Date) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = reportPeriodBounds(period, now);
  return date >= start && date <= end;
}

export function lineUnitPrice(line: OrderLine, menuItems: MenuItem[]) {
  const basePrice = line.variant?.price ?? menuItems.find((item) => item.id === line.menuItemId)?.price ?? 0;
  return basePrice + (line.modifiers ?? []).reduce((sum, modifier) => sum + modifier.price, 0);
}

export function lineTotal(lines: OrderLine[], menuItems: MenuItem[]) {
  return lines.reduce((sum, line) => sum + lineUnitPrice(line, menuItems) * line.quantity, 0);
}

export function calculateBill(subtotal: number, discountPercent = 0, taxRate = 0.08): BillBreakdown {
  const discount = subtotal * discountPercent / 100;
  const taxable = subtotal - discount;
  const tax = taxable * taxRate;
  return { subtotal, discount, tax, total: taxable + tax };
}

export function allocateCents(total: number, weights: number[]) {
  const cents = Math.round(total * 100);
  const weightTotal = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (!weights.length || weightTotal === 0) return weights.map(() => 0);
  const raw = weights.map((weight) => cents * Math.max(0, weight) / weightTotal);
  const allocated = raw.map(Math.floor);
  const remainderOrder = raw.map((amount, index) => ({ index, fraction: amount - Math.floor(amount) })).sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let remainder = cents - allocated.reduce((sum, amount) => sum + amount, 0), index = 0; remainder > 0; remainder--, index++) allocated[remainderOrder[index % remainderOrder.length].index]++;
  return allocated.map((amount) => amount / 100);
}

function lineKey(line: OrderLine, index: number) {
  return line.id ?? `${line.menuItemId}-${index}`;
}

export function splitOrderLines(order: Order, selectedLineKeys: string[], newOrderId: string, createdAt: string) {
  const selectedKeys = new Set(selectedLineKeys);
  const selected = order.items.filter((line, index) => selectedKeys.has(lineKey(line, index)));
  if (selected.length === 0 || selected.length === order.items.length) return null;

  const movedKeys = new Set(order.items.flatMap((line, index) => selectedKeys.has(lineKey(line, index)) ? [lineKey(line, index)] : []));
  const partition = (lines: OrderLine[] | undefined, move: boolean) => lines?.filter((line, index) => movedKeys.has(lineKey(line, index)) === move);
  const remaining = partition(order.items, false) ?? [];
  const sourceRounds = (order.rounds ?? [order.items]).map((round) => partition(round, false) ?? []).filter((round) => round.length > 0);
  const movedStock = partition(order.stockConsumedItems ?? order.items, true);
  const remainingStock = partition(order.stockConsumedItems ?? order.items, false);

  return {
    source: { ...order, items: remaining, rounds: sourceRounds, stockConsumedItems: remainingStock },
    created: { ...order, id: newOrderId, items: selected, rounds: [selected], stockConsumedItems: movedStock, createdAt },
  } satisfies { source: Order; created: Order };
}
