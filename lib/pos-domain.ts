import type { MenuItem, Order, OrderLine } from "./pos-data";

export type BillBreakdown = { subtotal: number; discount: number; tax: number; total: number };

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
  for (let remainder = cents - allocated.reduce((sum, amount) => sum + amount, 0), index = 0; remainder > 0; remainder--, index++) allocated[index % allocated.length]++;
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
