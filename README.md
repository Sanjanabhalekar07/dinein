# Dine In Restaurant POS

A touch-friendly restaurant POS prototype built with the Next.js App Router, React, TypeScript, and Tailwind CSS. Operations are simulated in the browser; no production backend or payment provider is connected.

## Run locally

```bash
npm install
npx playwright install chromium
npm run dev
```

Open `http://localhost:3000`. Use `npm run lint` to run ESLint, `npm run test` for business-rule tests, `npm run test:e2e` for browser workflows, and `npm run build` to create a production build.

## Current demo features

- Restaurant service dashboard with sample sales, order, table, and ticket-time metrics.
- Visual dining-room table selector with Available, Occupied, Reserved, and Cleaning states. Managers can rearrange tables by dragging or using arrow keys; positions persist locally.
- Searchable, category-filtered menu of 54 sample dishes across starters, soups, mains, breads and sides, pizza, drinks, and desserts, each with an icon and INR price. Menu photography is not bundled yet.
- Dine-in, takeaway, and delivery tickets with quantity controls (1–99), subtotal/tax/total calculation, and send-to-kitchen action. Open tickets can accept additional kitchen rounds while keeping one consolidated bill.
- Delivery recipient, phone, and address capture with validation, persistence, kitchen visibility, and checkout access for open takeaway or delivery tickets.
- Item customization with named size or price variants, configurable per-item add-ons and modifiers, per-item quantities, and kitchen instructions. Legacy items without saved modifiers continue using their category defaults.
- Simulated checkout that records a paid status, moves the table to Cleaning, and offers a printable guest bill.
- Kitchen queue with new → preparing → ready → served ticket transitions.
- Ticket cancellation for new or preparing orders, with a saved reason and table cleanup.
- Checkout with 0%, 5%, 10%, or 15% discounts, Cash/Card/UPI selection, and equal or item-assigned bill splits for 2–8 guests with individual payment methods.
- Persisted transaction history with each payment method and amount.
- Open orders can be split into separate kitchen tickets and bills by moving complete item lines; table ticket selection stays available and inventory is not deducted again.
- Floor management for changing table states, transferring open orders, and merging/unmerging table pairs. Drag-and-drop or keyboard movement changes the persisted floor plan layout.
- Table reservations with guest name, party size, and arrival time; staff can edit or cancel a booking.
- Manual menu availability toggles plus optional per-item stock counts, low-stock warnings, quick restocking, and a recent inventory movement log for receipts, kitchen sends, and cancelled-order returns.
- Menu manager for adding and editing item names, descriptions, categories, INR prices, icons, availability, named price variants, add-on labels and prices, stock counts, and low-stock thresholds.
- Service report view with date filters, sales by payment method and service type, average check, cancellation and open-order counts, transaction history, CSV export, and a printable payment closeout summary.
- Demo staff roles for Manager, Cashier, Waiter, and Kitchen with role-specific navigation and checkout controls.
- Persistent dark/light appearance preference and responsive layouts.
- Local IndexedDB persistence for orders and table state across refreshes and browser restarts.

## Architecture and state

`lib/pos-data.ts` defines the TypeScript domain types, demo menu and table data, and IndexedDB read/write helpers. `lib/pos-domain.ts` contains pure pricing, tax, cent-allocation, report-period, and order-splitting rules; `tests/pos-domain.test.mjs` exercises those rules with Node's built-in test runner. `tests/e2e/pos-workflows.spec.ts` covers ticket creation and payment, order splitting, menu persistence, kitchen status transitions, reservations, role-based navigation, delivery, stock movements and cancellation returns, table transfer/merge, report periods, and phone/tablet layout widths through the UI. `lib/pos-service.ts` adds realistic asynchronous loading and saving around the local store. `app/page.tsx` is the interactive client screen and owns the current POS state. The root layout remains a server component and sets app metadata. State writes are persisted to the browser database after the initial load.

The demo seeds the first visit with sample tables and orders. Existing browser data wins on later visits. Clearing site data resets the demo to the sample state.

## Business rules in this slice

- Menu prices are stored in Indian rupees and quantity is a positive integer.
- Tax is currently simulated as 8% after any discount.
- Split-payment amounts are allocated in whole paise using the largest-remainder method so shares add up exactly to the bill total.
- Sending a dine-in ticket marks its table Occupied and creates a new kitchen order.
- Completing checkout marks the order Paid and moves its table to Cleaning.
- Reservations require a guest name, future arrival time, and party size within the table’s seating capacity.
- Takeaway and delivery orders have no table assignment. Delivery orders require a recipient name, valid phone number, and a complete address.

## Assumptions and limitations

- Dashboard sales, order, occupancy, and ticket-time metrics are calculated from this device’s records. The service report sales chart groups recorded payment transactions by time interval.
- Payment is simulated. Role selection is a client-side demo aid and does not provide authentication or server-enforced permissions. Item-based splitting assigns each order line to one guest; quantities on the same line stay together. Table state changes, order transfer, and table pair merging are available in the floor management view.
- Persistence is local to one browser profile and device. It does not synchronize between staff devices and does not provide server backups.
- IndexedDB availability is required for durable persistence.
- A persistent dark/light theme toggle is available. Automated coverage includes six core billing, splitting, and report-window rule tests plus thirteen browser workflows. Further coverage can exercise cross-time-zone report behavior, report date ranges beyond the current day/week/month presets, and additional small-screen layouts.
