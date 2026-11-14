"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { usePos } from "@/components/pos-provider";
import PosOverlays from "@/components/pos-overlays";

const items = [
  { view: "Orders", href: "/orders", icon: "order" },
  { view: "Floor plan", href: "/floor-plan", icon: "floor" },
  { view: "Kitchen", href: "/kitchen", icon: "kitchen" },
  { view: "Menu", href: "/menu", icon: "menu" },
  { view: "Reports", href: "/reports", icon: "reports" },
] as const;

function NavIcon({ name }: { name: (typeof items)[number]["icon"] }) {
  const paths: Record<(typeof items)[number]["icon"], ReactNode> = {
    order: (
      <>
        <path d="M7 3.75h8l4 4v12.5a1.75 1.75 0 0 1-1.75 1.75h-10.5A1.75 1.75 0 0 1 5 20.25V5.5A1.75 1.75 0 0 1 6.75 3.75Z" />
        <path d="M14.5 4v4h4M8.5 12h7M8.5 15.5h7" />
      </>
    ),
    floor: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </>
    ),
    kitchen: (
      <>
        <path d="M6 13.5h12l1.5 5.5h-15L6 13.5Z" />
        <path d="M8 11a2 2 0 0 1 0-4 2 2 0 1 1 4 0 2 2 0 1 1 4 0 2 2 0 0 1 0 4" />
        <path d="M7 21h10" />
      </>
    ),
    menu: (
      <>
        <path d="M5 6h14M5 12h14M5 18h14" />
        <circle cx="3" cy="6" r=".6" />
        <circle cx="3" cy="12" r=".6" />
        <circle cx="3" cy="18" r=".6" />
      </>
    ),
    reports: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
  };
  return (
    <svg
      className="nav-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function PosShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const path = usePathname();
  const {
    allowedViews,
    activeOrders,
    paidToday,
    todayTransactions,
    role,
    roleMenuOpen,
    setRoleMenuOpen,
    changeRole,
    storageStatus,
    storageErrorAction,
    setStorageStatus,
    setLoadRetry,
    setSaveRetry,
    theme,
    setTheme,
    notice,
    setNotice,
    dateLabel,
  } = usePos();
  const view =
    path === "/orders/new"
      ? "Add order"
      : path.endsWith("/edit")
        ? "Edit order"
        : (items.find((item) => item.href === path)?.view ?? "Orders");

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${mobileNavOpen ? "mobile-sidebar-open" : ""}`}
      >
        <Link className="brand" href="/orders" aria-label="Dine In home">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="16" r="9.2" />
              <circle cx="16" cy="16" r="5.7" />
              <path d="M4.5 6.5v6m-2.1-6v4.1a2.1 2.1 0 0 0 4.2 0V6.5M4.5 12.6v12.9m23-19-3.2 8.2v10.8m0-10.8h3.2V6.5" />
            </svg>
          </span>
          <span>
            Dine In<small>RESTAURANT OS</small>
          </span>
        </Link>
        <button
          className="mobile-sidebar-toggle"
          aria-label={
            mobileNavOpen ? "Collapse navigation" : "Expand navigation"
          }
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d={mobileNavOpen ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"} />
          </svg>
        </button>
        <div className="side-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {items
            .filter((item) => allowedViews.includes(item.view))
            .map((item) => (
              <Link
                key={item.href}
                className={`nav-link ${path === item.href || (item.href === "/orders" && path.startsWith("/orders")) ? "active" : ""}`}
                href={item.href}
                onClick={(event) => {
                  if (
                    !mobileNavOpen &&
                    window.matchMedia("(max-width: 780px)").matches
                  ) {
                    event.preventDefault();
                    setMobileNavOpen(true);
                  } else if (window.matchMedia("(max-width: 780px)").matches) {
                    setMobileNavOpen(false);
                  }
                }}
              >
                <span className="nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                {item.view === "Kitchen" ? "Kitchen display" : item.view}
                {item.view === "Kitchen" && (
                  <span className="nav-badge">
                    {
                      activeOrders.filter(
                        (order) =>
                          order.status === "new" ||
                          order.status === "preparing",
                      ).length
                    }
                  </span>
                )}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-label">TODAY AT A GLANCE</div>
          <div className="mini-stats">
            <span>Paid orders today</span>
            <strong>{paidToday.size}</strong>
          </div>
          <div className="mini-stats">
            <span>Payments recorded</span>
            <strong>{todayTransactions.length}</strong>
          </div>
          <div className="side-divider" />
          <div className="staff-role-wrap">
            <button
              className="staff-card"
              aria-expanded={roleMenuOpen}
              onClick={() => setRoleMenuOpen((open) => !open)}
            >
              <span className="avatar">SB</span>
              <span>
                <b>Sanjana Bhalekar</b>
                <small>{role} | Demo role</small>
              </span>
            </button>
            {roleMenuOpen && (
              <div
                className="role-menu"
                role="menu"
                aria-label="Choose demo staff role"
              >
                {(["Manager", "Cashier", "Waiter", "Kitchen"] as const).map(
                  (nextRole) => (
                    <button
                      role="menuitemradio"
                      aria-checked={role === nextRole}
                      key={nextRole}
                      onClick={() => changeRole(nextRole)}
                    >
                      {nextRole}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          className="mobile-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <Link
            className="mobile-brand"
            href="/orders"
            aria-label="Dine In home"
          >
            Dine In
            <small>RESTAURANT OS</small>
          </Link>
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{view}</b>
          </div>
          <div className="top-actions">
            <span className="open-status">
              <i />
              POS ready
            </span>
            <button
              className={`storage-indicator storage-${storageStatus}`}
              onClick={
                storageStatus === "error"
                  ? () => {
                      if (storageErrorAction === "load") {
                        setStorageStatus("loading");
                        setLoadRetry((attempt) => attempt + 1);
                      } else {
                        setStorageStatus("saving");
                        setSaveRetry((attempt) => attempt + 1);
                      }
                    }
                  : undefined
              }
              disabled={storageStatus !== "error"}
            >
              {storageStatus === "saved"
                ? "Saved on this device"
                : storageStatus === "saving"
                  ? "Saving locally"
                  : storageStatus === "loading"
                    ? "Loading local data"
                    : "Storage issue · Retry"}
            </button>
            <span className="top-divider" />
            <span className="date-label">{dateLabel}</span>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {theme === "dark" ? (
                  <>
                    <circle cx="12" cy="12" r="3.5" />
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
                  </>
                ) : (
                  <path d="M20.5 15.4A8.5 8.5 0 0 1 8.6 3.5 8.5 8.5 0 1 0 20.5 15.4Z" />
                )}
              </svg>
            </button>
            <button
              className="avatar top-avatar mobile-profile-trigger"
              aria-label="Open profile and demo role settings for Sanjana Bhalekar"
              aria-expanded={roleMenuOpen}
              aria-controls="mobile-profile-menu"
              onClick={() => setRoleMenuOpen((open) => !open)}
            >
              SB
            </button>
            {roleMenuOpen && (
              <div
                className="mobile-profile-menu"
                id="mobile-profile-menu"
                aria-label="Staff profile and demo role"
              >
                <div className="mobile-profile-summary">
                  <span className="avatar">SB</span>
                  <span>
                    <b>Sanjana Bhalekar</b>
                    <small>{role} | Demo role</small>
                  </span>
                </div>
                <div
                  className="mobile-profile-roles"
                  role="menu"
                  aria-label="Choose demo staff role"
                >
                  <small>Switch demo role</small>
                  {(["Manager", "Cashier", "Waiter", "Kitchen"] as const).map(
                    (nextRole) => (
                      <button
                        role="menuitemradio"
                        aria-checked={role === nextRole}
                        className={role === nextRole ? "selected-role" : ""}
                        key={nextRole}
                        onClick={() => changeRole(nextRole)}
                      >
                        {nextRole}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </header>
        <section className="page-content">{children}</section>
        <footer className="app-footer">
          <span>© 2026 Dine In</span>
          <span>
            Made for good service <b>✳</b>
          </span>
          <div>
            <button onClick={() => setNotice("Help center is coming soon.")}>
              Help center
            </button>
            <i />
            <button onClick={() => setNotice("All systems are operational.")}>
              System status
            </button>
          </div>
        </footer>
      </main>
      {notice && (
        <div role="status" className="toast">
          <span>✓</span>
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      <PosOverlays />
    </div>
  );
}
