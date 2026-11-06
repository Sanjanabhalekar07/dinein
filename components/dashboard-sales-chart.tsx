"use client";

import type { PaymentTransaction } from "@/lib/pos-data";

const money = (amount: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
}).format(amount);

type DashboardSalesChartProps = {
  transactions: PaymentTransaction[];
  now: Date | null;
};

export default function DashboardSalesChart({ transactions, now }: DashboardSalesChartProps) {
  const weekSales = now ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
    const dailyPayments = transactions.filter((transaction) => {
      const paidAt = new Date(transaction.createdAt);
      return paidAt.getFullYear() === date.getFullYear()
        && paidAt.getMonth() === date.getMonth()
        && paidAt.getDate() === date.getDate();
    });
    return {
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
      date: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date),
      amount: dailyPayments.reduce((sum, payment) => sum + payment.amount, 0),
      payments: dailyPayments.length,
    };
  }) : [];

  const total = weekSales.reduce((sum, day) => sum + day.amount, 0);
  const peak = Math.max(...weekSales.map((day) => day.amount), 1);
  const paymentCount = weekSales.reduce((sum, day) => sum + day.payments, 0);

  return <section className="panel dashboard-sales-panel" aria-labelledby="dashboard-sales-title">
    <div className="report-chart-head">
      <div><span>PAID TRANSACTIONS</span><b id="dashboard-sales-title">Sales over the last 7 days</b></div>
      <div className="dashboard-sales-total"><strong>{money(total)}</strong><small>{paymentCount} payments</small></div>
    </div>
    {total === 0
      ? <div className="dashboard-chart-empty">Recorded payments will appear here as sales come in.</div>
      : <div className="dashboard-chart-area" role="img" aria-label={`Sales over the last seven days, ${money(total)} total`}>
        {weekSales.map((day) => <div className="dashboard-sales-day" key={day.date}>
          <div className="dashboard-sales-track" title={`${day.date}: ${money(day.amount)}`}><i style={{ height: `${day.amount > 0 ? Math.max(6, day.amount / peak * 100) : 0}%` }} /></div>
          <span>{day.label}</span><small>{day.date}</small>
        </div>)}
      </div>}
  </section>;
}
