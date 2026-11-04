# Dine In Restaurant POS

A touch-friendly restaurant POS prototype built with the Next.js App Router, React, TypeScript, and Tailwind CSS. Operations are simulated in the browser; no production backend or payment provider is connected.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Use `npm run lint` to run ESLint and `npm run build` to create a production build.

## Current demo features

- Restaurant service dashboard with sample sales, order, table, and ticket-time metrics.
- Visual dining-room table selector with Available, Occupied, Reserved, and Cleaning states.
- Searchable, category-filtered menu of 54 sample dishes across starters, soups, mains, breads and sides, pizza, drinks, and desserts, each with an icon and INR price.
- Dine-in and takeaway tickets, quantity controls, subtotal/tax/total calculation, and send-to-kitchen action.
- Item customization with category-specific add-ons, per-item quantities, and kitchen instructions.
- Simulated checkout that records a paid status and moves the table to Cleaning.
- Kitchen queue with new → preparing → ready → served ticket transitions.
- Ticket cancellation for new or preparing orders, with a saved reason and table cleanup.
- Checkout with 0%, 5%, 10%, or 15% discounts, Cash/Card/UPI selection, and equal bill splits for 2–8 guests with individual payment methods.
- Persisted transaction history with each payment method and amount.
- Floor management for changing table states, transferring open orders, and merging/unmerging table pairs.
- Table reservations with guest name, party size, and arrival time; staff can edit or cancel a booking.
- Menu availability toggles that immediately disable sold-out items in ordering.
- Menu manager for adding and editing item names, descriptions, categories, INR prices, icons, and availability.
- Service report view with date filters, live order counts, transaction history, and CSV export for recorded payments.
- Demo staff roles for Manager, Cashier, Waiter, and Kitchen with role-specific navigation and checkout controls.
- Local IndexedDB persistence for orders and table state across refreshes and browser restarts.

## Architecture and state

`lib/pos-data.ts` defines the TypeScript domain types, demo menu and table data, and IndexedDB read/write helpers. `app/page.tsx` is the interactive client screen and owns the current POS state. The root layout remains a server component and sets app metadata. State writes are persisted to the browser database after the initial load.

The demo seeds the first visit with sample tables and orders. Existing browser data wins on later visits. Clearing site data resets the demo to the sample state.

## Business rules in this slice

- Menu prices are stored in Indian rupees and quantity is a positive integer.
- Tax is currently simulated as 8% after any discount.
- Sending a dine-in ticket marks its table Occupied and creates a new kitchen order.
- Completing checkout marks the order Paid and moves its table to Cleaning.
- Reservations require a guest name, future arrival time, and party size within the table’s seating capacity.
- Takeaway orders have no table assignment.

## Assumptions and limitations

- Dashboard sales, order, occupancy, and ticket-time metrics are calculated from this device’s records. The sales pulse chart remains illustrative sample data.
- Payment is simulated. Role selection is a client-side demo aid and does not provide authentication or server-enforced permissions. Bill splitting is equal by guest; item-based splitting is not implemented. Table state changes, order transfer, and table pair merging are available in the floor management view.
- Persistence is local to one browser profile and device. It does not synchronize between staff devices and does not provide server backups.
- IndexedDB availability is required for durable persistence.
- The current visual theme is light mode; dark mode and automated workflow tests remain to be implemented.
