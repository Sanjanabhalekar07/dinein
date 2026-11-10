import {
  type Order,
  type PaymentTransaction,
  type Table,
} from "@/lib/pos-data";
import DashboardSalesChart from "@/components/dashboard-sales-chart";

type Props = {
  transactions: PaymentTransaction[];
  now: Date | null;
  todaySales: number;
  activeOrders: Order[];
  occupied: number;
  serviceTables: Table[];
  averageTicketTime: number | null;
  completedTicketCount: number;
};

const moneyRounded = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function OrderDashboardStats({
  transactions,
  now,
  todaySales,
  activeOrders,
  occupied,
  serviceTables,
  averageTicketTime,
  completedTicketCount,
}: Props) {
  return (
    <>
      <div className="metric-grid">
        <article className="metric-card">
          <div className="metric-top">
            <span>Today sales</span>
            <span className="metric-icon sales-icon">₹</span>
          </div>
          <div className="metric-value metric-currency">
            {moneyRounded(todaySales)}
          </div>
          <div className="metric-foot">
            {transactions.length} payments recorded today
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Open orders</span>
            <span className="metric-icon order-icon">☷</span>
          </div>
          <div className="metric-value">
            {activeOrders.length}
            <span className="metric-unit">orders</span>
          </div>
          <div className="metric-foot">
            <b className="green-text">
              {
                activeOrders.filter((order) => order.status === "preparing")
                  .length
              }{" "}
              preparing
            </b>
            <span className="foot-sep">·</span>
            {
              activeOrders.filter((order) => order.status === "ready").length
            }{" "}
            ready
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Tables occupied</span>
            <span className="metric-icon table-icon">⌑</span>
          </div>
          <div className="metric-value">
            {occupied}
            <span className="metric-unit">/ {serviceTables.length} tables</span>
          </div>
          <div className="metric-foot">
            {serviceTables.length - occupied} available ·{" "}
            {Math.round((occupied / Math.max(1, serviceTables.length)) * 100)}%
            capacity
          </div>
          <div className="metric-progress occupancy">
            <i
              style={{
                width: `${Math.min(100, (occupied / Math.max(1, serviceTables.length)) * 100)}%`,
              }}
            />
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Avg. ticket time</span>
            <span className="metric-icon time-icon">◷</span>
          </div>
          <div className="metric-value">
            {averageTicketTime ?? "—"}
            {averageTicketTime !== null && (
              <span className="metric-unit">min</span>
            )}
          </div>
          <div className="metric-foot">
            {completedTicketCount} completed tickets today
          </div>
        </article>
      </div>
      <DashboardSalesChart transactions={transactions} now={now} />
    </>
  );
}
