const test = require("node:test");
const assert = require("node:assert/strict");
const { allocateCents, calculateBill, lineTotal, lineUnitPrice, splitOrderLines } = require("../.test-build/lib/pos-domain.js");

test("line pricing includes selected variant and modifier prices", () => {
  const items = [{ id: "soup", name: "Soup", category: "Soups", description: "Soup", price: 150, emoji: "🥣", color: "peach" }];
  const line = { id: "line-1", menuItemId: "soup", quantity: 2, variant: { id: "large", label: "Large", price: 210 }, modifiers: [{ id: "cream", label: "Extra cream", price: 25 }] };
  assert.equal(lineUnitPrice(line, items), 235);
  assert.equal(lineTotal([line], items), 470);
});

test("bill discount is applied before tax", () => {
  assert.deepEqual(calculateBill(1000, 10), { subtotal: 1000, discount: 100, tax: 72, total: 972 });
  assert.deepEqual(calculateBill(1000), { subtotal: 1000, discount: 0, tax: 80, total: 1080 });
});

test("payment allocation rounds to cents and reconciles to the total", () => {
  assert.deepEqual(allocateCents(10, [1, 1, 1]), [3.34, 3.33, 3.33]);
  assert.deepEqual(allocateCents(10, [1, 2]), [3.33, 6.67]);
  assert.deepEqual(allocateCents(10, [0, 0]), [0, 0]);
  assert.deepEqual(allocateCents(10, []), []);
});

test("splitting moves selected lines and stock consumption without changing table or kitchen status", () => {
  const first = { id: "line-1", menuItemId: "soup", quantity: 2 };
  const second = { id: "line-2", menuItemId: "bread", quantity: 1 };
  const order = {
    id: "#1051", tableId: "t2", type: "Dine in", status: "preparing", createdAt: "2026-11-05T10:00:00.000Z",
    lastFiredAt: "2026-11-05T10:00:00.000Z", items: [first, second], rounds: [[first], [second]], stockConsumedItems: [first, second],
  };
  const result = splitOrderLines(order, ["line-2"], "#1052", "2026-11-05T10:10:00.000Z");
  assert.ok(result);
  assert.deepEqual(result.source.items, [first]);
  assert.deepEqual(result.created.items, [second]);
  assert.deepEqual(result.source.stockConsumedItems, [first]);
  assert.deepEqual(result.created.stockConsumedItems, [second]);
  assert.equal(result.created.tableId, "t2");
  assert.equal(result.created.status, "preparing");
  assert.deepEqual(result.source.rounds, [[first]]);
  assert.deepEqual(result.created.rounds, [[second]]);
});

test("splitting rejects empty selections and selections that would empty the source order", () => {
  const order = { id: "#1051", tableId: null, type: "Takeaway", status: "new", createdAt: "2026-11-05T10:00:00.000Z", items: [{ id: "line-1", menuItemId: "soup", quantity: 1 }] };
  assert.equal(splitOrderLines(order, [], "#1052", "2026-11-05T10:10:00.000Z"), null);
  assert.equal(splitOrderLines(order, ["line-1"], "#1052", "2026-11-05T10:10:00.000Z"), null);
});
