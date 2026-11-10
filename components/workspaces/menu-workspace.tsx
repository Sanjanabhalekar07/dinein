import { useState } from "react";
import { defaultCategories, type MenuItem, type PosData } from "@/lib/pos-data";

type Props = {
  data: PosData;
  menuItems: MenuItem[];
  openMenuEditor: (item?: MenuItem) => void;
  openCategoryEditor: (name?: string | null) => void;
  deleteCategory: (name: string) => void;
  toggleMenuAvailability: (menuItemId: string) => void;
  restockMenuItem: (menuItemId: string, quantity: number) => void;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

export default function MenuWorkspace({
  data,
  menuItems,
  openMenuEditor,
  openCategoryEditor,
  deleteCategory,
  toggleMenuAvailability,
  restockMenuItem,
}: Props) {
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>(
    {},
  );
  const lowStockItems = menuItems.filter(
    (item) =>
      item.stockCount !== undefined &&
      item.stockCount > 0 &&
      item.stockCount <= (item.lowStockThreshold ?? 5),
  );

  return (
    <div className="workflow-view">
      <div className="workflow-head">
        <div>
          <h2>Menu management</h2>
          <p>Add dishes, manage stock, and see low-stock alerts.</p>
        </div>
        <div className="menu-admin-actions">
          <span className="menu-count">
            {menuItems.length} items ·{" "}
            {
              menuItems.filter(
                (item) =>
                  !(data.unavailableMenuIds ?? []).includes(item.id) &&
                  item.stockCount !== 0,
              ).length
            }{" "}
            available
          </span>
          <button className="primary-button" onClick={() => openMenuEditor()}>
            ＋ Add menu item
          </button>
        </div>
      </div>
      <section className="workflow-card category-manager">
        <div className="category-manager-head">
          <div>
            <h3>Menu categories</h3>
            <p>Organize dishes into the sections guests see while ordering.</p>
          </div>
          <button
            className="primary-button"
            onClick={() => openCategoryEditor()}
          >
            ＋ Add category
          </button>
        </div>
        <div className="category-manager-list">
          {(data.categories?.length ? data.categories : defaultCategories).map(
            (name) => {
              const count = menuItems.filter(
                (item) => item.category === name,
              ).length;
              return (
                <div className="category-manager-row" key={name}>
                  <span className="category-manager-name">
                    {name}
                    <small>
                      {count} {count === 1 ? "dish" : "dishes"}
                    </small>
                  </span>
                  <button
                    className="menu-edit-button"
                    aria-label={`Rename category ${name}`}
                    onClick={() => openCategoryEditor(name)}
                  >
                    Rename
                  </button>
                  <button
                    className="category-delete-button"
                    aria-label={`Delete category ${name}`}
                    title={
                      count
                        ? "Move or delete its menu items before deleting this category"
                        : "Delete category"
                    }
                    disabled={count > 0}
                    onClick={() => deleteCategory(name)}
                  >
                    Delete
                  </button>
                </div>
              );
            },
          )}
        </div>
      </section>
      <div className="stock-summary">
        <span>
          <b>
            {menuItems.filter((item) => item.stockCount !== undefined).length}
          </b>{" "}
          tracked items
        </span>
        <span className={lowStockItems.length ? "stock-alert" : ""}>
          <b>{lowStockItems.length}</b> low stock
        </span>
        <span
          className={
            menuItems.some((item) => item.stockCount === 0) ? "stock-alert" : ""
          }
        >
          <b>{menuItems.filter((item) => item.stockCount === 0).length}</b> out
          of stock
        </span>
        <small>Stock is deducted when a ticket is sent to the kitchen.</small>
      </div>
      <div className="availability-grid">
        {menuItems.map((item) => {
          const manuallyUnavailable = (data.unavailableMenuIds ?? []).includes(
            item.id,
          );
          const outOfStock = item.stockCount === 0;
          const lowStock =
            item.stockCount !== undefined &&
            item.stockCount > 0 &&
            item.stockCount <= (item.lowStockThreshold ?? 5);
          const unavailable = manuallyUnavailable || outOfStock;
          const restockAmount = restockAmounts[item.id] ?? "10";
          return (
            <article
              className={`workflow-card availability-card ${unavailable ? "is-unavailable" : ""}`}
              key={item.id}
            >
              <span className={`food-art ${item.color}`}>
                <span>{item.emoji}</span>
              </span>
              <div className="availability-copy">
                <span className="ticket-kicker">
                  {item.category.toUpperCase()}
                </span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <b>{money(item.price)}</b>
                {item.stockCount !== undefined && (
                  <small
                    className={`stock-badge ${outOfStock ? "stock-empty" : lowStock ? "stock-low" : ""}`}
                  >
                    {outOfStock
                      ? "Out of stock"
                      : lowStock
                        ? `Low stock · ${item.stockCount} left`
                        : `${item.stockCount} in stock`}
                  </small>
                )}
              </div>
              <div className="availability-actions">
                <button
                  className="menu-edit-button"
                  onClick={() => openMenuEditor(item)}
                >
                  Edit
                </button>
                <button
                  disabled={outOfStock}
                  className={`availability-toggle ${manuallyUnavailable || outOfStock ? "off" : ""}`}
                  aria-pressed={!unavailable}
                  onClick={() => toggleMenuAvailability(item.id)}
                >
                  {outOfStock
                    ? "Restock to enable"
                    : manuallyUnavailable
                      ? "Unavailable"
                      : "Available"}
                  <i />
                </button>
              </div>
              {item.stockCount !== undefined && (
                <div className="restock-controls">
                  <label>
                    <span>Received</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      step="1"
                      aria-label={`Received quantity for ${item.name}`}
                      value={restockAmount}
                      onChange={(event) =>
                        setRestockAmounts((previous) => ({
                          ...previous,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      restockMenuItem(item.id, Number(restockAmount))
                    }
                  >
                    Add stock
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <section className="workflow-card inventory-history">
        <div className="transaction-history-head">
          <div>
            <h3>Recent stock movements</h3>
            <p>Restocks, kitchen sends, and cancelled-order returns.</p>
          </div>
          <span>{data.inventoryMovements?.length ?? 0} movements</span>
        </div>
        {!data.inventoryMovements?.length ? (
          <div className="transaction-empty">
            No stock movements recorded yet.
          </div>
        ) : (
          <div className="inventory-movement-list">
            {[...data.inventoryMovements]
              .slice(-8)
              .reverse()
              .map((movement) => (
                <div className="inventory-movement" key={movement.id}>
                  <span
                    className={`movement-quantity ${movement.quantity < 0 ? "movement-out" : "movement-in"}`}
                  >
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity}
                  </span>
                  <span className="transaction-description">
                    <b>{movement.itemName}</b>
                    <small>
                      {movement.reason === "restock"
                        ? "Stock received"
                        : movement.reason === "sale"
                          ? `Sent to kitchen · ${movement.orderId ?? "Order"}`
                          : `Order cancelled · ${movement.orderId ?? "Order"}`}{" "}
                      ·{" "}
                      {new Date(movement.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
