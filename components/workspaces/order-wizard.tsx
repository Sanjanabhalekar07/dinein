"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePos } from "@/components/pos-provider";
import { lineUnitPrice } from "@/lib/pos-domain";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const steps = ["Order details", "Choose items", "Review"];

export default function OrderWizard({ orderId }: { orderId?: string }) {
  const [step, setStep] = useState(0);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const {
    loaded,
    data,
    editingOrderId,
    orderType,
    setOrderType,
    selectedTable,
    setSelectedTable,
    deliveryName,
    setDeliveryName,
    deliveryPhone,
    setDeliveryPhone,
    deliveryAddress,
    setDeliveryAddress,
    menuItems,
    menuCategories,
    category,
    setCategory,
    search,
    setSearch,
    visibleMenu,
    cart,
    addToCart,
    changeQuantity,
    setCart,
    setNotice,
    subtotal,
    tax,
    total,
    placeOrder,
    startEditingOrder,
    resetOrderDraft,
  } = usePos();

  useEffect(() => {
    const currentKey = orderId ?? "new-order";
    if (!loaded || initializedFor === currentKey) return;
    const timer = window.setTimeout(() => {
      if (orderId) {
        if (!startEditingOrder(orderId)) {
          resetOrderDraft();
          setNotice("This order is not available to edit.");
        }
      } else {
        resetOrderDraft();
      }
      setInitializedFor(currentKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    initializedFor,
    loaded,
    orderId,
    resetOrderDraft,
    setNotice,
    startEditingOrder,
  ]);

  const editingOrder =
    orderId && editingOrderId === orderId
      ? data.orders.find((order) => order.id === orderId)
      : undefined;
  const validTables = data.tables.filter(
    (table) =>
      !table.mergedInto &&
      !["reserved", "cleaning", "merged"].includes(table.status),
  );
  const itemsInCart = cart.reduce((sum, line) => sum + line.quantity, 0);

  function continueFromDetails() {
    if (orderType === "Dine in" && !selectedTable) {
      setNotice("Choose a table before continuing.");
      return;
    }
    if (orderType === "Delivery") {
      if (deliveryName.trim().length < 2) {
        setNotice("Enter the delivery recipient's name.");
        return;
      }
      if (!/^\+?\d{10,15}$/.test(deliveryPhone.replace(/[\s()-]/g, ""))) {
        setNotice("Enter a valid delivery phone number.");
        return;
      }
      if (deliveryAddress.trim().length < 8) {
        setNotice("Enter a complete delivery address.");
        return;
      }
    }
    setStep(1);
  }

  function continueToReview() {
    if (cart.length === 0) {
      setNotice("Choose at least one menu item to continue.");
      return;
    }
    setStep(2);
  }

  function submitOrder() {
    placeOrder(true);
  }

  if (orderId && !editingOrder && loaded) {
    return (
      <div className="orders-empty wizard-missing-order">
        <h1>Order unavailable</h1>
        <p>This ticket may have been deleted or completed.</p>
        <Link className="secondary-button" href="/orders">
          Return to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="order-wizard">
      <div className="wizard-heading">
        <div>
          <Link className="wizard-back-link" href="/orders">
            ← Back to Orders
          </Link>
          <div className="eyebrow">
            {editingOrder
              ? `EDIT TICKET · ${editingOrder.id}`
              : "GUIDED ORDER ENTRY"}
          </div>
          <h1>{editingOrder ? "Edit order" : "Add order"}</h1>
          <p className="subtitle">
            {editingOrder
              ? "Update the ticket details and items before sending the changes to the kitchen."
              : "Create a ticket in three simple steps."}
          </p>
        </div>
      </div>

      <nav className="wizard-progress" aria-label="Order wizard steps">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`wizard-step ${step === index ? "current" : step > index ? "complete" : ""}`}
          >
            <span>{step > index ? "✓" : index + 1}</span>
            <b>{label}</b>
          </div>
        ))}
      </nav>

      <section className="wizard-panel">
        {step === 0 && (
          <div className="wizard-section">
            <div className="wizard-section-heading">
              <span>STEP 1</span>
              <h2>How is this order being served?</h2>
              <p>Select the service type and fill in the order details.</p>
            </div>
            <div className="wizard-type-grid">
              {(["Dine in", "Takeaway", "Delivery"] as const).map((type) => (
                <button
                  key={type}
                  className={`wizard-type-card ${orderType === type ? "selected" : ""}`}
                  aria-pressed={orderType === type}
                  onClick={() => setOrderType(type)}
                >
                  <span className="wizard-type-icon" aria-hidden="true">
                    {type === "Dine in" ? "⌂" : type === "Takeaway" ? "▣" : "↗"}
                  </span>
                  <b>{type}</b>
                  <small>
                    {type === "Dine in"
                      ? "Assign a dining table"
                      : type === "Takeaway"
                        ? "Guest will collect the order"
                        : "Deliver to a guest address"}
                  </small>
                </button>
              ))}
            </div>
            {orderType === "Dine in" && (
              <div className="wizard-field-group">
                <div className="wizard-label-row">
                  <label>Choose a table</label>
                  <Link href="/floor-plan">Manage floor plan</Link>
                </div>
                <div className="wizard-table-grid">
                  {validTables.map((table) => (
                    <button
                      key={table.id}
                      className={`wizard-table-choice ${selectedTable === table.id ? "selected" : ""}`}
                      aria-pressed={selectedTable === table.id}
                      onClick={() => setSelectedTable(table.id)}
                    >
                      <b>Table {table.name}</b>
                      <small>
                        {table.seats} seats · {table.status}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {orderType === "Delivery" && (
              <div className="wizard-delivery-fields">
                <label>
                  <span>Recipient name</span>
                  <input
                    value={deliveryName}
                    onChange={(event) => setDeliveryName(event.target.value)}
                    placeholder="Guest name"
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span>Phone number</span>
                  <input
                    value={deliveryPhone}
                    onChange={(event) => setDeliveryPhone(event.target.value)}
                    placeholder="10 digit number"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </label>
                <label className="delivery-address-field">
                  <span>Delivery address</span>
                  <textarea
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="Building, street, area, city"
                    autoComplete="street-address"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="wizard-section wizard-menu-section">
            <div className="wizard-section-heading">
              <span>STEP 2</span>
              <h2>Choose items</h2>
              <p>
                Add dishes to the ticket. Select an item to set its quantity and
                options.
              </p>
            </div>
            <div className="wizard-order-grid">
              <div className="wizard-menu-browser">
                <label className="search-box wizard-search">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search menu"
                    aria-label="Search menu"
                  />
                </label>
                <div
                  className="category-tabs wizard-category-tabs"
                  role="tablist"
                  aria-label="Menu categories"
                >
                  {menuCategories.map((entry) => (
                    <button
                      key={entry}
                      role="tab"
                      aria-selected={category === entry}
                      className={category === entry ? "chosen" : ""}
                      onClick={() => setCategory(entry)}
                    >
                      {entry}
                    </button>
                  ))}
                </div>
                <div className="wizard-menu-grid">
                  {visibleMenu.map((item) => (
                    <button
                      key={item.id}
                      className="wizard-menu-item"
                      disabled={
                        (data.unavailableMenuIds ?? []).includes(item.id) ||
                        item.stockCount === 0
                      }
                      onClick={() => addToCart(item)}
                    >
                      <span className={`food-art ${item.color}`}>
                        <span>{item.emoji}</span>
                      </span>
                      <span>
                        <b>{item.name}</b>
                        <small>{item.description}</small>
                        <strong>
                          {money(
                            item.variants?.length
                              ? Math.min(
                                  ...item.variants.map(
                                    (variant) => variant.price,
                                  ),
                                )
                              : item.price,
                          )}
                        </strong>
                      </span>
                      <i aria-hidden="true">＋</i>
                    </button>
                  ))}
                </div>
                {visibleMenu.length === 0 && (
                  <div className="wizard-no-menu">
                    No available items match this search.
                  </div>
                )}
              </div>
              <aside className="wizard-cart-panel">
                <div className="wizard-cart-heading">
                  <div>
                    <span>THIS TICKET</span>
                    <b>{itemsInCart} items</b>
                  </div>
                  <span>
                    {orderType}
                    {orderType === "Dine in" && selectedTable
                      ? ` · Table ${data.tables.find((table) => table.id === selectedTable)?.name ?? ""}`
                      : ""}
                  </span>
                </div>
                {cart.length === 0 ? (
                  <div className="wizard-cart-empty">
                    Select a menu item to begin your ticket.
                  </div>
                ) : (
                  <div className="wizard-cart-lines">
                    {cart.map((line, index) => {
                      const item = menuItems.find(
                        (entry) => entry.id === line.menuItemId,
                      );
                      const key = line.id ?? `${line.menuItemId}-${index}`;
                      return (
                        <div className="wizard-cart-line" key={key}>
                          <div>
                            <b>{item?.name ?? "Menu item"}</b>
                            <small>
                              {line.variant?.label}
                              {line.modifiers?.length
                                ? ` · ${line.modifiers.map((modifier) => modifier.label).join(", ")}`
                                : ""}
                              {line.note ? ` · ${line.note}` : ""}
                            </small>
                          </div>
                          <strong>
                            {money(
                              lineUnitPrice(line, menuItems) * line.quantity,
                            )}
                          </strong>
                          <div className="wizard-quantity">
                            <button
                              aria-label={`Remove one ${item?.name ?? "item"}`}
                              onClick={() =>
                                changeQuantity(line.id ?? line.menuItemId, -1)
                              }
                            >
                              −
                            </button>
                            <span>{line.quantity}</span>
                            <button
                              aria-label={`Add one ${item?.name ?? "item"}`}
                              onClick={() =>
                                setCart((current) =>
                                  current.map((entry, entryIndex) =>
                                    (entry.id ?? entry.menuItemId) === key &&
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          quantity: Math.min(
                                            99,
                                            entry.quantity + 1,
                                          ),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            >
                              ＋
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="wizard-cart-totals">
                  <div>
                    <span>Subtotal</span>
                    <b>{money(subtotal)}</b>
                  </div>
                  <div>
                    <span>Tax (8%)</span>
                    <b>{money(tax)}</b>
                  </div>
                  <div className="wizard-cart-total">
                    <span>Estimated total</span>
                    <b>{money(total)}</b>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-section">
            <div className="wizard-section-heading">
              <span>STEP 3</span>
              <h2>Review order</h2>
              <p>
                Check the service details and ticket before sending it to the
                kitchen.
              </p>
            </div>
            <div className="wizard-review-grid">
              <div className="wizard-review-card">
                <span className="wizard-review-kicker">SERVICE DETAILS</span>
                <h3>
                  {orderType}
                  {orderType === "Dine in" && selectedTable
                    ? ` · Table ${data.tables.find((table) => table.id === selectedTable)?.name ?? ""}`
                    : ""}
                </h3>
                {orderType === "Delivery" && (
                  <p>
                    {deliveryName}
                    <br />
                    {deliveryPhone}
                    <br />
                    {deliveryAddress}
                  </p>
                )}
                <button className="text-button" onClick={() => setStep(0)}>
                  Edit details
                </button>
              </div>
              <div className="wizard-review-card">
                <span className="wizard-review-kicker">
                  TICKET ITEMS · {itemsInCart}
                </span>
                {cart.map((line, index) => {
                  const item = menuItems.find(
                    (entry) => entry.id === line.menuItemId,
                  );
                  return (
                    <div
                      className="wizard-review-line"
                      key={line.id ?? `${line.menuItemId}-${index}`}
                    >
                      <span>
                        <b>
                          {line.quantity} × {item?.name ?? "Menu item"}
                        </b>
                        <small>
                          {line.variant?.label}
                          {line.modifiers?.length
                            ? ` · ${line.modifiers.map((modifier) => modifier.label).join(", ")}`
                            : ""}
                          {line.note ? ` · ${line.note}` : ""}
                        </small>
                      </span>
                      <strong>
                        {money(lineUnitPrice(line, menuItems) * line.quantity)}
                      </strong>
                    </div>
                  );
                })}
                <button className="text-button" onClick={() => setStep(1)}>
                  Edit items
                </button>
                <div className="wizard-review-totals">
                  <span>
                    Subtotal <b>{money(subtotal)}</b>
                  </span>
                  <span>
                    Tax (8%) <b>{money(tax)}</b>
                  </span>
                  <strong>
                    Estimated total <b>{money(total)}</b>
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="wizard-actions">
          <Link
            className="secondary-button"
            href="/orders"
            onClick={() => resetOrderDraft()}
          >
            Cancel
          </Link>
          <div>
            {step > 0 && (
              <button
                className="secondary-button"
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </button>
            )}
            {step === 0 && (
              <button className="primary-button" onClick={continueFromDetails}>
                Choose items <span>→</span>
              </button>
            )}
            {step === 1 && (
              <button className="primary-button" onClick={continueToReview}>
                Review ticket <span>→</span>
              </button>
            )}
            {step === 2 && (
              <button
                className="primary-button"
                disabled={!cart.length}
                onClick={submitOrder}
              >
                {editingOrderId ? "Save and send changes" : "Send to kitchen"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
