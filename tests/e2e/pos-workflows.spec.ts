import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
});

async function waitForLocalSave(page: import("@playwright/test").Page) {
  const status = page.locator(".storage-indicator");
  await expect(status).toHaveText("Saving locally");
  await expect(status).toHaveText("Saved on this device");
}

test("staff can customize, send, and pay a dine-in ticket", async ({ page }) => {
  await page.getByRole("button", { name: /Burrata & tomatoes/ }).click();
  await expect(page.getByRole("dialog", { name: /Burrata & tomatoes/ })).toBeVisible();
  await page.getByRole("checkbox", { name: /Extra sauce/ }).check();
  await page.getByRole("button", { name: /Add to ticket/ }).click();
  await page.getByRole("button", { name: /Send to kitchen/ }).click();

  await expect(page.getByRole("status")).toContainText("sent to the kitchen");
  await page.getByRole("button", { name: /Go to checkout/ }).click();
  await expect(page.getByRole("dialog", { name: "Complete checkout" })).toBeVisible();
  await page.getByRole("button", { name: /Complete simulated payment/ }).click();
  await expect(page.getByRole("status")).toContainText("paid");

  await waitForLocalSave(page);
  await page.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByText("Transaction history")).toBeVisible();
  await expect(page.getByText("#1054", { exact: true })).toBeVisible();
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

  await waitForLocalSave(page);
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
