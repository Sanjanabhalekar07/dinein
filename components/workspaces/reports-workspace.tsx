"use client";

import { useState } from "react";
import { type PosData } from "@/lib/pos-data";
import {
  customReportPeriodBounds,
  isWithinCustomReportPeriod,
  isWithinReportPeriod,
  reportPeriodBounds,
  type ReportPeriod,
} from "@/lib/pos-domain";

type ReportRange = ReportPeriod | "Custom";
const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
const moneyRounded = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
const dateForInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

type Props = {
  data: PosData;
  clockNow: number | null;
  canBackup: boolean;
  downloadBackup: () => void;
  restoreBackup: (file: File) => void;
};

export default function ReportsWorkspace({
  data,
  clockNow,
  canBackup,
  downloadBackup,
  restoreBackup,
}: Props) {
  const [reportRange, setReportRange] = useState<ReportRange>("Today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const tableLabel = (tableId: string | null) =>
    tableId
      ? `Table ${data.tables.find((table) => table.id === tableId)?.name ?? "—"}`
      : "Takeaway";
  const reportNow = clockNow === null ? null : new Date(clockNow);
  const defaultCustomDate = clockNow === null ? "" : dateForInput(reportNow!);
  const reportStartDate = customStartDate || defaultCustomDate;
  const reportEndDate = customEndDate || defaultCustomDate;
  const customBounds =
    reportRange === "Custom"
      ? customReportPeriodBounds(reportStartDate, reportEndDate)
      : null;
  const customRangeInvalid = reportRange === "Custom" && customBounds === null;
  const rangeStart =
    reportNow === null
      ? null
      : reportRange === "Custom"
        ? (customBounds?.start ?? null)
        : reportPeriodBounds(reportRange, reportNow).start;
  const withinRange = (createdAt: string) =>
    reportRange === "Custom"
      ? isWithinCustomReportPeriod(createdAt, reportStartDate, reportEndDate)
      : reportNow !== null &&
        isWithinReportPeriod(createdAt, reportRange, reportNow);
  const reportOrders = data.orders.filter((order) =>
    withinRange(order.createdAt),
  );
  const reportTransactions = (data.transactions ?? []).filter((transaction) =>
    withinRange(transaction.createdAt),
  );
  function exportTransactions() {
    const rows = [
      [
        "Date",
        "Order",
        "Service type",
        "Table",
        "Payment method",
        "Split",
        "Amount (INR)",
      ],
      ...reportTransactions.map((transaction) => {
        const order = data.orders.find(
          (candidate) => candidate.id === transaction.orderId,
        );
        return [
          new Date(transaction.createdAt).toLocaleString("en-IN"),
          transaction.orderId,
          order?.type ?? "Unknown",
          order?.tableId ? tableLabel(order.tableId) : "—",
          transaction.method,
          transaction.splitLabel ?? "",
          transaction.amount.toFixed(2),
        ];
      }),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `dine-in-transactions-${reportRange.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const chartBuckets = (() => {
    const customDayCount = customBounds
      ? Math.ceil(
          (Date.UTC(
            customBounds.end.getFullYear(),
            customBounds.end.getMonth(),
            customBounds.end.getDate(),
          ) -
            Date.UTC(
              customBounds.start.getFullYear(),
              customBounds.start.getMonth(),
              customBounds.start.getDate(),
            )) /
            86400000,
        ) + 1
      : 0;
    const specs =
      reportRange === "Today"
        ? Array.from({ length: 8 }, (_, index) => ({
            key: String(index + 8),
            label: ["8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"][index],
          }))
        : reportRange === "This week"
          ? Array.from({ length: 7 }, (_, index) => {
              const date = new Date(rangeStart ?? new Date(2000, 0, 2));
              date.setDate(date.getDate() + index);
              return {
                key: String(date.getDay()),
                label: new Intl.DateTimeFormat("en-IN", {
                  weekday: "short",
                }).format(date),
              };
            })
          : reportRange === "Custom"
            ? Array.from(
                { length: Math.ceil(customDayCount / 7) },
                (_, index) => ({
                  key: String(index),
                  label: `D${index * 7 + 1}–${Math.min(customDayCount, (index + 1) * 7)}`,
                }),
              )
            : Array.from({ length: 5 }, (_, index) => ({
                key: String(index),
                label: `W${index + 1}`,
              }));
    return specs.map((bucket, index) => ({
      ...bucket,
      amount: reportTransactions
        .filter((transaction) => {
          const date = new Date(transaction.createdAt);
          if (reportRange === "Today")
            return Math.floor(date.getHours() / 2) === index + 4;
          if (reportRange === "This week")
            return String(date.getDay()) === bucket.key;
          if (reportRange === "Custom" && customBounds) {
            const transactionDay = Date.UTC(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
            );
            const startDay = Date.UTC(
              customBounds.start.getFullYear(),
              customBounds.start.getMonth(),
              customBounds.start.getDate(),
            );
            return (
              Math.floor((transactionDay - startDay) / (7 * 86400000)) === index
            );
          }
          return String(Math.floor((date.getDate() - 1) / 7)) === bucket.key;
        })
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }));
  })();
  const rangeLabel =
    reportRange === "Custom"
      ? `${reportStartDate} – ${reportEndDate}`
      : reportRange;
  const chartPeak = Math.max(1, ...chartBuckets.map((bucket) => bucket.amount));
  const methodTotals = (["Cash", "Card", "UPI"] as const).map((method) => ({
    method,
    count: reportTransactions.filter(
      (transaction) => transaction.method === method,
    ).length,
    amount: reportTransactions
      .filter((transaction) => transaction.method === method)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  }));
  const collectedInRange = reportTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const completedInRange = new Set(
    reportTransactions.map((transaction) => transaction.orderId),
  );
  const openInRange = reportOrders.filter(
    (order) => order.status !== "paid" && order.status !== "cancelled",
  ).length;
  const averageCheck = completedInRange.size
    ? collectedInRange / completedInRange.size
    : 0;
  const serviceTotals = (["Dine in", "Takeaway", "Delivery"] as const).map(
    (type) => {
      const transactions = reportTransactions.filter(
        (transaction) =>
          data.orders.find((order) => order.id === transaction.orderId)
            ?.type === type,
      );
      return {
        type,
        orders: new Set(transactions.map((transaction) => transaction.orderId))
          .size,
        amount: transactions.reduce(
          (sum, transaction) => sum + transaction.amount,
          0,
        ),
      };
    },
  );
  const cancelledInRange = reportOrders.filter(
    (order) => order.status === "cancelled",
  ).length;

  return (
    <div className="workflow-view">
      <div className="workflow-head">
        <div>
          <h2>Service reports</h2>
          <p>Review the activity recorded on this device.</p>
        </div>
        <div className="report-actions">
          {canBackup && (
            <>
              <button className="secondary-button" onClick={downloadBackup}>
                Download backup
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  document.getElementById("restore-pos-backup")?.click()
                }
              >
                Restore backup
              </button>
              <input
                id="restore-pos-backup"
                type="file"
                accept="application/json,.json"
                hidden
                aria-label="Choose a Dine In backup file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) restoreBackup(file);
                }}
              />
            </>
          )}
          <button className="secondary-button" onClick={() => window.print()}>
            Print summary
          </button>
          <button
            className="secondary-button"
            onClick={exportTransactions}
            disabled={reportTransactions.length === 0}
          >
            Export CSV
          </button>
          <select
            aria-label="Report period"
            className="report-select"
            value={reportRange}
            onChange={(event) =>
              setReportRange(event.target.value as ReportRange)
            }
          >
            <option>Today</option>
            <option>This week</option>
            <option>This month</option>
            <option value="Custom">Custom dates</option>
          </select>
          {reportRange === "Custom" && (
            <div className="report-custom-range">
              <label>
                <span>From</span>
                <input
                  aria-label="Report start date"
                  type="date"
                  value={reportStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  aria-label="Report end date"
                  type="date"
                  value={reportEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </div>
      {customRangeInvalid && (
        <p className="report-range-error" role="alert">
          Choose a valid date range no longer than 366 days.
        </p>
      )}
      <div className="report-metrics">
        <article className="workflow-card report-metric">
          <span>ORDERS IN PERIOD</span>
          <b>{reportOrders.length}</b>
          <small>
            {completedInRange.size} completed / {openInRange} open
          </small>
        </article>
        <article className="workflow-card report-metric">
          <span>COMPLETED SALES</span>
          <b>{money(collectedInRange)}</b>
          <small>From recorded payments in this period</small>
        </article>
        <article className="workflow-card report-metric">
          <span>TABLE OCCUPANCY</span>
          <b>
            {data.tables.filter((table) => table.status === "occupied").length}{" "}
            / {data.tables.length}
          </b>
          <small>
            {data.tables.filter((table) => table.status === "available").length}{" "}
            available right now
          </small>
        </article>
        <article className="workflow-card report-chart">
          <div className="report-chart-head">
            <div>
              <span>RECORDED SALES</span>
              <b>{rangeLabel}</b>
            </div>
            <span className="green-text">
              {reportTransactions.length} payments in this period
            </span>
          </div>
          <div className="chart-area">
            <div className="chart-y">
              <span>{moneyRounded(chartPeak)}</span>
              <span>{moneyRounded(chartPeak / 2)}</span>
              <span>INR 0</span>
            </div>
            <div className="chart-plot">
              <div className="chart-grid-lines">
                <i />
                <i />
                <i />
              </div>
              <div
                className="sales-bars"
                role="img"
                aria-label={`Recorded sales by ${rangeLabel.toLowerCase()} interval`}
              >
                {chartBuckets.map((bucket) => (
                  <div
                    className="sales-bar-column"
                    key={bucket.key}
                    title={`${bucket.label}: ${money(bucket.amount)}`}
                  >
                    <div className="sales-bar-track">
                      <i
                        style={{
                          height: `${Math.max(bucket.amount > 0 ? 5 : 0, (bucket.amount / chartPeak) * 100)}%`,
                        }}
                      />
                    </div>
                    <span>{bucket.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </div>
      <section className="workflow-card service-breakdown">
        <div className="transaction-history-head">
          <div>
            <h3>Sales by service</h3>
            <p>Collected payments grouped by order channel.</p>
          </div>
          <span>{reportRange}</span>
        </div>
        <div className="service-breakdown-grid">
          {serviceTotals.map(({ type, orders, amount }) => (
            <article key={type}>
              <span>{type.toUpperCase()}</span>
              <b>{money(amount)}</b>
              <small>
                {orders} paid {orders === 1 ? "order" : "orders"}
              </small>
            </article>
          ))}
        </div>
      </section>
      <section className="workflow-card shift-summary">
        <div className="shift-summary-head">
          <div>
            <h3>Shift closeout</h3>
            <p>Payment totals recorded for {rangeLabel.toLowerCase()}.</p>
          </div>
          <span className="shift-total">{money(collectedInRange)}</span>
        </div>
        <div className="shift-summary-grid">
          <div>
            <span>ORDERS</span>
            <b>{reportOrders.length}</b>
          </div>
          <div>
            <span>OPEN NOW</span>
            <b>{openInRange}</b>
          </div>
          <div>
            <span>CANCELLED</span>
            <b>{cancelledInRange}</b>
          </div>
          <div>
            <span>PAYMENTS</span>
            <b>{reportTransactions.length}</b>
          </div>
          <div>
            <span>COMPLETED ORDERS</span>
            <b>{completedInRange.size}</b>
          </div>
          <div>
            <span>AVERAGE CHECK</span>
            <b>{money(averageCheck)}</b>
          </div>
          {methodTotals.map(({ method, count, amount }) => (
            <div key={method}>
              <span>{method.toUpperCase()}</span>
              <b>{money(amount)}</b>
              <small>{count} payments</small>
            </div>
          ))}
        </div>
        <p className="shift-summary-note">
          Closeout is a report of recorded simulated payments; it does not lock
          or close the register.
        </p>
      </section>
      <section className="workflow-card transaction-history">
        <div className="transaction-history-head">
          <div>
            <h3>Transaction history</h3>
            <p>Completed simulated payments in this report period.</p>
          </div>
          <span>{reportTransactions.length} payments</span>
        </div>
        {reportTransactions.length === 0 ? (
          <div className="transaction-empty">
            No completed payments in this period.
          </div>
        ) : (
          <div className="transaction-list">
            {[...reportTransactions]
              .slice(-8)
              .reverse()
              .map((transaction) => (
                <div className="transaction-row" key={transaction.id}>
                  <span className="transaction-icon">
                    {transaction.method === "UPI"
                      ? "⌁"
                      : transaction.method === "Card"
                        ? "▣"
                        : "₹"}
                  </span>
                  <span className="transaction-description">
                    <b>{transaction.orderId}</b>
                    <small>
                      {transaction.splitLabel
                        ? transaction.splitLabel + " - "
                        : ""}
                      {transaction.method} ·{" "}
                      {new Date(transaction.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </span>
                  <strong>{money(transaction.amount)}</strong>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
