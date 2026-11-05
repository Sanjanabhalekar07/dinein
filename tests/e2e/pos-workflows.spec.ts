import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
});

async function readSavedSnapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => new Promise<{ menuItems: Array<{ name: string }>; transactions: unknown[]; tables: Array<{ id: string; floorPosition?: { column: number; row: number } }> } | null>((resolve, reject) => {
    const request = indexedDB.open("dinein-pos", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction("workspace", "readonly").objectStore("workspace").get("pos");
      get.onsuccess = () => { resolve(get.result ?? null); db.close(); };
      get.onerror = () => { reject(get.error); db.close(); };
    };
  }));
}

test("staff can customize, send, and pay a dine-in ticket", async ({ page }) => {
  await page.getByRole("button", { name: /Burrata & tomatoes/ }).click();
  await expect(page.getByRole("dialog", { name: /Burrata & tomatoes/ })).toBeVisible();
  await page.getByRole("checkbox", { name: /Extra sauce/ }).check();
  await page.getByRole("button", { name: /Add to ticket/ }).click();
  await page.getByRole("button", { name: /Send to kitchen/ }).click();

  await expect(page.getByRole("status")).toContainText("sent to the kitchen");
  const checkoutTrigger = page.getByRole("button", { name: /Go to checkout/ });
  await checkoutTrigger.click();
  await expect(page.getByRole("dialog", { name: "Complete checkout" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close checkout" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Complete checkout" })).toHaveCount(0);
  await expect(checkoutTrigger).toBeFocused();
  await checkoutTrigger.click();
  await expect(page.getByRole("dialog", { name: "Complete checkout" })).toBeVisible();
  const closeCheckout = page.getByRole("button", { name: "Close checkout" });
  await closeCheckout.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: /Complete simulated payment/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeCheckout).toBeFocused();
  await page.getByRole("button", { name: /Complete simulated payment/ }).click();
  await expect(page.getByRole("status")).toContainText("paid");

  await expect.poll(async () => (await readSavedSnapshot(page))?.transactions.length ?? 0).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByText("Transaction history")).toBeVisible();
  await expect(page.getByText("#1054", { exact: true })).toBeVisible();
  await page.getByLabel("Report period").selectOption("Custom");
  const { localToday, localYesterday } = await page.evaluate(() => {
    const toDateValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { localToday: toDateValue(new Date()), localYesterday: toDateValue(yesterday) };
  });
  await page.getByLabel("Report start date").fill(localToday);
  await page.getByLabel("Report end date").fill(localToday);
  await expect(page.getByText("#1054", { exact: true })).toBeVisible();
  await page.getByLabel("Report start date").fill(localYesterday);
  await page.getByLabel("Report end date").fill(localYesterday);
  await expect(page.getByText("#1054", { exact: true })).toHaveCount(0);
});

test("custom report dates follow the browser's local calendar in a non-UTC timezone", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:3000", timezoneId: "America/Los_Angeles" });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
    await page.getByRole("button", { name: /Burrata & tomatoes/ }).click();
    await page.getByRole("button", { name: /Add to ticket/ }).click();
    await page.getByRole("button", { name: /Send to kitchen/ }).click();
    await page.getByRole("button", { name: /Go to checkout/ }).click();
    await page.getByRole("button", { name: /Complete simulated payment/ }).click();
    await expect(page.getByRole("status")).toContainText("paid");
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.locator(".transaction-history")).toContainText("#1054");
    await page.getByLabel("Report period").selectOption("Custom");

    const { today, yesterday } = await page.evaluate(() => {
      const value = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
      const previous = new Date();
      previous.setDate(previous.getDate() - 1);
      return { today: value(new Date()), yesterday: value(previous) };
    });
    await page.getByLabel("Report start date").fill(today);
    await page.getByLabel("Report end date").fill(today);
    await expect(page.locator(".transaction-history")).toContainText("#1054");
    await page.getByLabel("Report start date").fill(yesterday);
    await page.getByLabel("Report end date").fill(yesterday);
    await expect(page.locator(".transaction-history")).toContainText("No completed payments in this period");
  } finally {
    await context.close();
  }
});

test("staff can split an open table ticket and select the new bill", async ({ page }) => {
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Floor plan/ }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /New order/ }).click();
  await page.getByRole("button", { name: /Table 01, occupied/ }).click();
  await page.getByRole("button", { name: /Split items into a new ticket/ }).click();
  await expect(page.getByRole("dialog", { name: "Move items to a new ticket" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Move Burrata & tomatoes to new ticket" }).check();
  await page.getByRole("button", { name: "Create separate ticket" }).click();

  await expect(page.getByLabel("Open table ticket")).toBeVisible();
  await expect(page.getByLabel("Open table ticket")).toHaveValue("#1051");
  await expect(page.getByRole("button", { name: /Go to checkout/ })).toBeVisible();
});

test("menu changes persist across reloads", async ({ page }) => {
  const menuNav = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Menu/ });
  await menuNav.click();
  await page.getByRole("button", { name: /Add menu item/ }).click();
  await page.getByLabel("Item name").fill("Playwright test dish");
  await page.getByLabel("Description").fill("Automated workflow sample");
  await page.getByLabel("Base price (₹)").fill("275");
  await page.getByLabel("Add-ons & modifiers (one per line: Name | Price in ₹; zero is allowed)").fill("Extra chutney | 15");
  await page.getByRole("button", { name: "Add to menu" }).click();
  await expect(page.getByRole("status")).toContainText("added to the menu");

  await expect.poll(async () => (await readSavedSnapshot(page))?.menuItems.some((item) => item.name === "Playwright test dish") ?? false).toBe(true);
  await page.reload();
  await expect(menuNav).toBeVisible();
  await menuNav.click();
  await expect(page.getByText("Playwright test dish", { exact: true })).toBeVisible();
});

test("kitchen staff can advance an order through ready and served", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: /Kitchen display/ }).click();
  const ticket = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "#1048" }) });
  await expect(ticket.locator(".status-pill")).toHaveText("Preparing");
  await ticket.getByRole("button", { name: /Mark ready/ }).click();
  await expect(ticket.locator(".status-pill")).toHaveText("Ready");
  await ticket.getByRole("button", { name: /Mark served/ }).click();
  await expect(ticket.locator(".status-pill")).toHaveText("Served");
  await expect(ticket.getByText("Waiting for checkout")).toBeVisible();
});

test("table reservation validates seating capacity and saves guest details", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: /Floor plan/ }).click();
  const table = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Table 02" }) });
  await table.getByRole("button", { name: "Reserve" }).click();

  await page.getByLabel("Guest name").fill("Asha Mehta");
  await page.getByLabel("Party size").fill("3");
  const arrival = new Date(Date.now() + 60 * 60 * 1000);
  const localArrival = new Date(arrival.getTime() - arrival.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel("Arrival time").fill(localArrival);
  await page.getByRole("button", { name: /Save reservation/ }).click();
  await expect(page.getByRole("status")).toContainText("up to 2 guests");

  await page.getByLabel("Party size").fill("2");
  await page.getByRole("button", { name: /Save reservation/ }).click();
  await expect(page.getByRole("status")).toContainText("Reservation saved for Asha Mehta");
  await expect(table.getByText("Asha Mehta")).toBeVisible();
});

test("kitchen role receives only kitchen workspace navigation", async ({ page }) => {
  await page.locator(".staff-card").click();
  await page.getByRole("menuitemradio", { name: /Kitchen/ }).click();
  await expect(page.locator(".staff-card")).toContainText("Kitchen");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("button", { name: /Kitchen display/ })).toBeVisible();
  await expect(navigation.getByRole("button", { name: /Menu/ })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: /Reports/ })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: /New order/ })).toHaveCount(0);
});

test("delivery checkout validates recipient details and sends them to the kitchen", async ({ page }) => {
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await page.getByRole("button", { name: /Burrata & tomatoes/ }).click();
  await page.getByRole("button", { name: /Add to ticket/ }).click();
  await page.getByRole("button", { name: /Send to kitchen/ }).click();
  await expect(page.getByRole("status")).toContainText("Enter the delivery recipient's name");

  await page.getByLabel("Recipient name").fill("Mira Shah");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Delivery address").fill("18 Lake Road, Pune");
  await page.getByRole("button", { name: /Send to kitchen/ }).click();
  await expect(page.getByRole("status")).toContainText("sent to the kitchen");

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: /Kitchen display/ }).click();
  const deliveryTicket = page.getByRole("article").filter({ has: page.getByText("Mira Shah") });
  await expect(deliveryTicket).toContainText("18 Lake Road, Pune");
  await expect(deliveryTicket).toContainText("9876543210");
});

test("inventory movements track restocks and cancellation after multiple kitchen rounds", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: /New order/ }).click();
  await page.getByRole("button", { name: /Table 02, available/ }).click();
  await navigation.getByRole("button", { name: /Menu/ }).click();
  await page.getByRole("button", { name: /Add menu item/ }).click();
  await page.getByLabel("Item name").fill("Limited batch tart");
  await page.getByLabel("Description").fill("Tracked inventory workflow sample");
  await page.getByLabel("Base price (₹)").fill("190");
  await page.getByLabel("Stock on hand (blank for untracked)").fill("2");
  await page.getByLabel("Low-stock alert at").fill("1");
  await page.getByRole("button", { name: "Add to menu" }).click();

  await navigation.getByRole("button", { name: /New order/ }).click();
  await page.getByRole("textbox", { name: "Search menu" }).fill("Limited batch tart");
  await page.getByRole("button", { name: /Limited batch tart/ }).click();
  await page.getByRole("button", { name: /Add to ticket/ }).click();
  await page.getByRole("button", { name: /Send to kitchen/ }).click();

  await navigation.getByRole("button", { name: /Menu/ }).click();
  const itemCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Limited batch tart" }) });
  await expect(itemCard.locator(".stock-badge")).toHaveText(/1 left/);
  await itemCard.getByLabel("Received quantity for Limited batch tart").fill("3");
  await itemCard.getByRole("button", { name: "Add stock" }).click();
  await expect(itemCard.locator(".stock-badge")).toHaveText("4 in stock");

  await navigation.getByRole("button", { name: /New order/ }).click();
  await page.getByRole("button", { name: /Table 02, occupied/ }).click();
  await page.getByRole("textbox", { name: "Search menu" }).fill("Limited batch tart");
  await page.getByRole("button", { name: /Limited batch tart/ }).click();
  await page.getByRole("button", { name: /Add to ticket/ }).click();
  await page.getByRole("button", { name: /Send additional items/ }).click();
  await expect(page.getByRole("status")).toContainText("Additional items sent");

  await navigation.getByRole("button", { name: /Kitchen display/ }).click();
  const stockedTicket = page.getByRole("article").filter({ has: page.getByText("Limited batch tart") });
  await stockedTicket.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Cancel ticket" }).click();
  await navigation.getByRole("button", { name: /Menu/ }).click();
  await expect(itemCard.locator(".stock-badge")).toHaveText("5 in stock");
  await expect(page.getByText("Order cancelled", { exact: false }).first()).toBeVisible();
});

test("open orders can transfer between tables and table pairs can be merged and unmerged", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: /Floor plan/ }).click();
  const sourceTable = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Table 01" }) });
  await sourceTable.getByLabel("Transfer order #1048").selectOption({ label: "Table 02" });
  await sourceTable.getByRole("button", { name: "Move" }).click();
  await expect(page.getByRole("status")).toContainText("transferred to table 02");

  const destinationTable = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Table 02" }) });
  await expect(destinationTable).toContainText("#1048");
  await destinationTable.getByLabel("Merge Table 02 with").selectOption({ label: "Table 04" });
  await destinationTable.getByRole("button", { name: "Merge tables" }).click();
  await expect(page.getByRole("status")).toContainText("Tables 02 and 04 merged");

  const joinedTable = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Table 04" }) });
  await expect(joinedTable.locator(".status-pill")).toHaveText("Joined");
  await joinedTable.getByRole("button", { name: "Unmerge tables" }).click();
  await expect(page.getByRole("status")).toContainText("Table 04 unmerged from table 02");
});

test("POS workspace fits a narrow touchscreen viewport without page overflow", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll("body *"))
        .map((element) => ({ element: element.tagName.toLowerCase(), className: typeof element.className === "string" ? element.className : "", right: Math.round(element.getBoundingClientRect().right), parent: element.parentElement?.className ?? "" }))
        .filter((entry) => entry.right > document.documentElement.clientWidth + 1)
        .slice(0, 8),
    }));
    expect(dimensions.content, `unexpected horizontal overflow at ${width}px: ${JSON.stringify(dimensions.overflow)}`).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.getByRole("button", { name: /Send to kitchen/ })).toBeVisible();
  }
});

test("phone touch controls provide at least 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
  const targetSizes = await page.locator(".nav-link, .category-tabs button, .ticket-type button, .search-box").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.className };
  }));
  expect(targetSizes.length).toBeGreaterThan(10);
  for (const target of targetSizes) {
    expect(target.width, `${target.name} is too narrow`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.name} is too short`).toBeGreaterThanOrEqual(44);
  }
});

test("cancelling a preparing ticket records its reason and removes it from kitchen work", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: /Kitchen display/ }).click();
  const ticket = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "#1048" }) });
  await ticket.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Cancel this order?" })).toBeVisible();
  await page.getByLabel("Reason").selectOption("Item unavailable");
  await page.getByRole("button", { name: "Cancel ticket" }).click();
  await expect(page.getByRole("status")).toContainText("#1048 cancelled · Item unavailable");
  await expect(page.getByRole("article").filter({ has: page.getByRole("heading", { name: "#1048" }) })).toHaveCount(0);

  await navigation.getByRole("button", { name: /Reports/ }).click();
  await expect(page.locator(".shift-summary-grid")).toContainText("1");
  await expect(page.locator(".shift-summary-grid")).toContainText("CANCELLED");
});

test("service report period selector updates its chart and closeout labels", async ({ page }) => {
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Reports/ }).click();
  const range = page.locator(".report-select");
  await expect(page.locator(".report-chart-head")).toContainText("Today");
  await range.selectOption("This week");
  await expect(page.locator(".report-chart-head")).toContainText("This week");
  await expect(page.locator(".shift-summary-head")).toContainText("this week");
  await range.selectOption("This month");
  await expect(page.locator(".report-chart-head")).toContainText("This month");
  await expect(page.locator(".shift-summary-head")).toContainText("this month");
  await range.selectOption("Custom");
  await page.getByLabel("Report start date").fill("2026-11-06");
  await page.getByLabel("Report end date").fill("2026-11-05");
  await expect(page.locator(".report-range-error")).toContainText("valid date range");
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
});

test("POS workspace remains usable at tablet touch widths", async ({ page }) => {
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll("body *"))
        .map((element) => ({ element: element.tagName.toLowerCase(), className: typeof element.className === "string" ? element.className : "", right: Math.round(element.getBoundingClientRect().right) }))
        .filter((entry) => entry.right > document.documentElement.clientWidth + 1)
        .slice(0, 8),
    }));
    expect(dimensions.content, `unexpected horizontal overflow at ${width}px: ${JSON.stringify(dimensions.overflow)}`).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.getByRole("button", { name: /Send to kitchen/ })).toBeVisible();
  }
});

test("staff can rearrange floor tables with arrow keys and keep the layout after reload", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("button", { name: /New order/ }).click();
  const tableOne = page.getByRole("button", { name: /^Table 01, occupied/ });
  const tableTwo = page.getByRole("button", { name: /^Table 02, available/ });
  await tableOne.focus();
  await tableOne.press("ArrowRight");
  await expect(tableOne).toHaveCSS("grid-column-start", "2");
  await expect(tableTwo).toHaveCSS("grid-column-start", "1");
  await expect.poll(async () => (await readSavedSnapshot(page))?.tables.find((table) => table.id === "t1")?.floorPosition?.column).toBe(2);

  await page.reload();
  await navigation.getByRole("button", { name: /New order/ }).click();
  await expect(page.getByRole("button", { name: /^Table 01, occupied/ })).toHaveCSS("grid-column-start", "2");
  await expect(page.getByRole("button", { name: /^Table 02, available/ })).toHaveCSS("grid-column-start", "1");
});
