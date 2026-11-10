import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateCents,
  calculateBill,
  customReportPeriodBounds,
  isWithinCustomReportPeriod,
  isWithinReportPeriod,
  lineTotal,
  lineUnitPrice,
  nextOrderId,
  reportPeriodBounds,
  splitOrderLines,
} from "../.test-build/lib/pos-domain.js";

test("line pricing includes selected variant and modifier prices", () => {
  const items = [
    {
      id: "soup",
      name: "Soup",
      category: "Soups",
      description: "Soup",
      price: 150,
      emoji: "🥣",
      color: "peach",
    },
  ];
  const line = {
    id: "line-1",
    menuItemId: "soup",
    quantity: 2,
    variant: { id: "large", label: "Large", price: 210 },
    modifiers: [{ id: "cream", label: "Extra cream", price: 25 }],
  };
  assert.equal(lineUnitPrice(line, items), 235);
  assert.equal(lineTotal([line], items), 470);
});

test("bill discount is applied before tax", () => {
  assert.deepEqual(calculateBill(1000, 10), {
    subtotal: 1000,
    discount: 100,
    tax: 72,
    total: 972,
  });
  assert.deepEqual(calculateBill(1000), {
    subtotal: 1000,
    discount: 0,
    tax: 80,
    total: 1080,
  });
});

test("bill components and recorded total round consistently to paise", () => {
  assert.deepEqual(calculateBill(101, 5), {
    subtotal: 101,
    discount: 5.05,
    tax: 7.68,
    total: 103.63,
  });
  assert.deepEqual(calculateBill(99.999), {
    subtotal: 100,
    discount: 0,
    tax: 8,
    total: 108,
  });
});

test("new ticket numbers follow the highest existing numeric ID without collisions", () => {
  assert.equal(
    nextOrderId([{ id: "#1054" }, { id: "#1100" }, { id: "web-order" }]),
    "#1101",
  );
  assert.equal(nextOrderId([{ id: "#1051" }, { id: "#1053" }]), "#1054");
  assert.equal(nextOrderId([]), "#1054");
});

test("report periods include their local start boundary and exclude prior periods and future times", () => {
  const now = new Date(2026, 10, 5, 15, 30);
  const stamp = (year, month, day, hour = 0, minute = 0) =>
    new Date(year, month, day, hour, minute).toISOString();

  assert.equal(isWithinReportPeriod(stamp(2026, 10, 5), "Today", now), true);
  assert.equal(
    isWithinReportPeriod(stamp(2026, 10, 4, 23, 59), "Today", now),
    false,
  );
  assert.equal(
    isWithinReportPeriod(stamp(2026, 10, 5, 15, 31), "Today", now),
    false,
  );
  assert.equal(isWithinReportPeriod("not a date", "Today", now), false);
  assert.equal(
    isWithinReportPeriod(stamp(2026, 10, 1), "This week", now),
    true,
  );
  assert.equal(
    isWithinReportPeriod(stamp(2026, 9, 31, 23, 59), "This week", now),
    false,
  );
  assert.equal(
    isWithinReportPeriod(stamp(2026, 10, 1), "This month", now),
    true,
  );
  assert.equal(
    isWithinReportPeriod(stamp(2026, 9, 31, 23, 59), "This month", now),
    false,
  );
  assert.deepEqual(reportPeriodBounds("This week", now), {
    start: new Date(2026, 10, 1),
    end: now,
  });
});

test("custom report dates include both complete local days and reject invalid ranges", () => {
  const first = new Date(2026, 10, 3, 0, 0).toISOString();
  const last = new Date(2026, 10, 5, 23, 59, 59, 999).toISOString();
  const before = new Date(2026, 10, 2, 23, 59, 59, 999).toISOString();
  const after = new Date(2026, 10, 6, 0, 0).toISOString();

  assert.equal(
    isWithinCustomReportPeriod(first, "2026-11-03", "2026-11-05"),
    true,
  );
  assert.equal(
    isWithinCustomReportPeriod(last, "2026-11-03", "2026-11-05"),
    true,
  );
  assert.equal(
    isWithinCustomReportPeriod(before, "2026-11-03", "2026-11-05"),
    false,
  );
  assert.equal(
    isWithinCustomReportPeriod(after, "2026-11-03", "2026-11-05"),
    false,
  );
  assert.equal(customReportPeriodBounds("2026-11-06", "2026-11-05"), null);
  assert.equal(customReportPeriodBounds("not-a-date", "2026-11-05"), null);
  assert.equal(customReportPeriodBounds("2026-02-30", "2026-03-01"), null);
  assert.equal(customReportPeriodBounds("2025-01-01", "2026-01-02"), null);
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
    id: "#1051",
    tableId: "t2",
    type: "Dine in",
    status: "preparing",
    createdAt: "2026-11-05T10:00:00.000Z",
    lastFiredAt: "2026-11-05T10:00:00.000Z",
    items: [first, second],
    rounds: [[first], [second]],
    stockConsumedItems: [first, second],
  };
  const result = splitOrderLines(
    order,
    ["line-2"],
    "#1052",
    "2026-11-05T10:10:00.000Z",
  );
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
  const order = {
    id: "#1051",
    tableId: null,
    type: "Takeaway",
    status: "new",
    createdAt: "2026-11-05T10:00:00.000Z",
    items: [{ id: "line-1", menuItemId: "soup", quantity: 1 }],
  };
  assert.equal(
    splitOrderLines(order, [], "#1052", "2026-11-05T10:10:00.000Z"),
    null,
  );
  assert.equal(
    splitOrderLines(order, ["line-1"], "#1052", "2026-11-05T10:10:00.000Z"),
    null,
  );
});
