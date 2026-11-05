import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
});

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

  await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
  await page.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByText("Transaction history")).toBeVisible();
  await expect(page.getByText("#1054", { exact: true })).toBeVisible();
});

test("staff can split an open table ticket and select the new bill", async ({ page }) => {
  await page.getByRole("button", { name: "Floor plan" }).click();
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
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: /Add menu item/ }).click();
  await page.getByLabel("Item name").fill("Playwright test dish");
  await page.getByLabel("Description").fill("Automated workflow sample");
  await page.getByLabel("Base price (₹)").fill("275");
  await page.getByLabel("Add-ons & modifiers (one per line: Name | Price in ₹; zero is allowed)").fill("Extra chutney | 15");
  await page.getByRole("button", { name: "Add to menu" }).click();
  await expect(page.getByRole("status")).toContainText("added to the menu");

  await expect(page.getByRole("button", { name: "Saved on this device" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByText("Playwright test dish", { exact: true })).toBeVisible();
});
