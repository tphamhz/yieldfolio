import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Database,
  Download,
  KeyRound,
  LayoutDashboard,
  MoreHorizontal,
  Moon,
  Pencil,
  PieChart,
  Plus,
  Search,
  Settings,
  RefreshCw,
  Sun,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import "./styles.css";

const defaultHoldings = [
  { id: 1, ticker: "QQQI", name: "NEOS Nasdaq-100 High Income ETF", sector: "Technology", shares: 340, price: 54.69, avgCost: 54.69, dividend: 0.6572, frequency: 12, whtRate: 30, whtVersion: 2, exDate: "2026-07-22", payDate: "2026-07-24", color: "#315f50" },
  { id: 2, ticker: "SPYI", name: "NEOS S&P 500 High Income ETF", sector: "Other", shares: 300, price: 51.99, avgCost: 51.99, dividend: 0.531, frequency: 12, whtRate: 30, whtVersion: 2, exDate: "2026-07-22", payDate: "2026-07-24", color: "#9b624b" },
  { id: 3, ticker: "JEPQ", name: "JPMorgan Nasdaq Equity Premium Income Active UCITS ETF · LSE", sector: "Technology", shares: 1200, price: 27.11, avgCost: 27.11, dividend: 0.2517, frequency: 12, whtRate: 15, whtVersion: 2, exDate: "2026-06-11", payDate: "2026-07-08", color: "#486b82" },
  { id: 4, ticker: "JEPI", name: "JPMorgan US Equity Premium Income Active UCITS ETF · LSE", sector: "Other", shares: 600, price: 24.33, avgCost: 24.33, dividend: 0.1825, frequency: 12, whtRate: 15, whtVersion: 2, exDate: "2026-06-11", payDate: "2026-07-08", color: "#6f5a82" },
];

const STORAGE_KEY = "yieldfolio-holdings-v3";
const API_KEY_STORAGE = "yieldfolio-alpha-vantage-api-key";
const DIVIDEND_CACHE_KEY = "yieldfolio-dividend-cache";
const THEME_STORAGE_KEY = "yieldfolio-theme";
const DAY_MS = 24 * 60 * 60 * 1000;
const providerSymbols = { QQQI: "QQQI", SPYI: "SPYI", JEPQ: "JEPQ.LON", JEPI: "JEPI.LON" };
const distributionHistory = {
  QQQI: { "2026-05": 0.6589, "2026-06": 0.6572 },
  SPYI: { "2026-05": 0.5353, "2026-06": 0.5310 },
  JEPQ: { "2026-05": 0.2156, "2026-06": 0.3021 },
  JEPI: { "2026-05": 0.1424, "2026-06": 0.2150 },
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const preciseCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function addMonths(dateString, months) {
  const d = new Date(`${dateString}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d;
}

function buildEvents(holdings) {
  return holdings.flatMap((holding) => {
    const spacing = Math.round(12 / holding.frequency);
    return Array.from({ length: holding.frequency }, (_, index) => ({
      id: `${holding.id}-${index}`,
      holding,
      exDate: addMonths(holding.exDate, index * spacing),
      payDate: addMonths(holding.payDate, index * spacing),
      amount: holding.shares * holding.dividend,
    }));
  });
}

const grossIncome = (holding) => holding.shares * holding.dividend * holding.frequency;
const withholding = (amount, holding) => amount * (Number(holding.whtRate) || 0) / 100;
const netIncome = (amount, holding) => amount - withholding(amount, holding);
const applyWhtPolicy = (holdings) => holdings.map((holding) => ({
  ...holding,
  whtRate: holding.whtVersion === 2
    ? holding.whtRate
    : (holding.name?.includes("UCITS ETF · LSE") ? 15 : (holding.whtRate ?? (["QQQI", "SPYI"].includes(holding.ticker) ? 30 : 0))),
  whtVersion: 2,
}));

async function fetchDividendData(apiKey) {
  const entries = await Promise.all(Object.entries(providerSymbols).map(async ([ticker, symbol]) => {
    const response = await fetch(`https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`);
    if (!response.ok) throw new Error(`Alpha Vantage returned ${response.status} for ${ticker}`);
    const payload = await response.json();
    const rows = payload.data;
    if (!Array.isArray(rows)) throw new Error(payload?.["Error Message"] || payload?.Information || payload?.Note || `No dividend data returned for ${ticker}`);
    const events = rows.map((row) => ({
      exDate: row.ex_dividend_date || "",
      recordDate: row.record_date || "",
      paymentDate: row.payment_date || "",
      declarationDate: row.declaration_date || "",
      amount: Number(row.amount || 0),
    })).filter((event) => event.exDate && event.amount > 0);
    return [ticker, events];
  }));
  return Object.fromEntries(entries);
}

function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark"><span /><span /><span /></div>
      <span>yieldfolio</span>
    </div>
  );
}

function Avatar({ ticker, color, small = false }) {
  return <div className={`ticker-avatar ${small ? "small" : ""}`} style={{ background: color }}>{ticker.slice(0, 1)}</div>;
}

function StatCard({ label, value, detail, icon: Icon, accent = false, onClick, children }) {
  return (
    <section
      className={`stat-card ${accent ? "accent" : ""} ${onClick ? "interactive" : ""}`}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-label"><span>{label}</span><Icon size={17} /></div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
      {children}
    </section>
  );
}

function HoldingModal({ holding, onClose, onSave }) {
  const [form, setForm] = useState(holding || {
    ticker: "", name: "", sector: "Other", shares: 10, price: 100, avgCost: 90,
    dividend: 0.5, frequency: 4, whtRate: 0, exDate: "2026-07-15", payDate: "2026-08-01", color: "#447b62",
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.ticker.trim()) return;
    onSave({
      ...form,
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim() || form.ticker.trim().toUpperCase(),
      shares: Number(form.shares),
      price: Number(form.price),
      avgCost: Number(form.avgCost),
      dividend: Number(form.dividend),
      frequency: Number(form.frequency),
      whtRate: Number(form.whtRate),
      whtVersion: 2,
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="eyebrow">{holding ? "Update position" : "New position"}</div><h2>{holding ? `Edit ${holding.ticker}` : "Add a holding"}</h2></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="form-grid">
          <label>Ticker<input autoFocus value={form.ticker} onChange={(e) => update("ticker", e.target.value)} placeholder="e.g. SCHD" /></label>
          <label>Company name<input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Company name" /></label>
          <label>Shares<input type="number" min="0" step="0.01" value={form.shares} onChange={(e) => update("shares", e.target.value)} /></label>
          <label>Current price<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} /></label>
          <label>Average cost<input type="number" min="0" step="0.01" value={form.avgCost} onChange={(e) => update("avgCost", e.target.value)} /></label>
          <label>Dividend / share<input type="number" min="0" step="0.01" value={form.dividend} onChange={(e) => update("dividend", e.target.value)} /></label>
          <label>WHT rate (%)<input type="number" min="0" max="100" step="0.01" value={form.whtRate} onChange={(e) => update("whtRate", e.target.value)} /></label>
          <label>Payments / year<select value={form.frequency} onChange={(e) => update("frequency", e.target.value)}><option value="12">Monthly</option><option value="4">Quarterly</option><option value="2">Semiannual</option><option value="1">Annual</option></select></label>
          <label>Sector<select value={form.sector} onChange={(e) => update("sector", e.target.value)}><option>Technology</option><option>Healthcare</option><option>Consumer Staples</option><option>Communication</option><option>Financials</option><option>Energy</option><option>Other</option></select></label>
          <label>Next ex-dividend date<input type="date" value={form.exDate} onChange={(e) => update("exDate", e.target.value)} /></label>
          <label>Next payout date<input type="date" value={form.payDate} onChange={(e) => update("payDate", e.target.value)} /></label>
        </div>
        <div className="modal-summary">
          <div><span>Projected annual income after WHT</span><small>{preciseCurrency.format((Number(form.shares) || 0) * (Number(form.dividend) || 0) * (Number(form.frequency) || 0))} gross</small></div>
          <strong>{preciseCurrency.format((Number(form.shares) || 0) * (Number(form.dividend) || 0) * (Number(form.frequency) || 0) * (1 - (Number(form.whtRate) || 0) / 100))}</strong>
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary"><Check size={17} />Save holding</button></div>
      </form>
    </div>
  );
}

function Dashboard({ holdings, dividendEvents, setView, onEdit, onAdd }) {
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.price, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avgCost, 0);
  const annualGross = holdings.reduce((sum, h) => sum + grossIncome(h), 0);
  const annualWht = holdings.reduce((sum, h) => sum + withholding(grossIncome(h), h), 0);
  const annualNet = annualGross - annualWht;
  const yieldOnValue = totalValue ? annualNet / totalValue * 100 : 0;
  const returnAmount = totalValue - totalCost;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allUpcoming = buildEvents(holdings).filter((event) => event.payDate >= today).sort((a, b) => a.payDate - b.payDate);
  const upcoming = allUpcoming.slice(0, 4);
  const nextPayouts = allUpcoming.length
    ? allUpcoming.filter((event) => event.payDate.getTime() === allUpcoming[0].payDate.getTime())
    : [];
  const nextPayoutGross = nextPayouts.reduce((sum, event) => sum + event.amount, 0);
  const nextPayoutNet = nextPayouts.reduce((sum, event) => sum + netIncome(event.amount, event.holding), 0);
  const nextPayoutTickers = nextPayouts.map((event) => event.holding.ticker).join(" + ");
  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const actualMonthSummary = (date) => {
    const key = monthKey(date);
    const records = holdings.flatMap((holding) => {
      const apiEvent = dividendEvents?.[holding.ticker]?.find((event) => {
        const eventDate = event.paymentDate || event.exDate;
        return eventDate?.slice(0, 7) === key;
      });
      const dividend = apiEvent?.amount ?? distributionHistory[holding.ticker]?.[key];
      return dividend == null ? [] : [{ holding, gross: holding.shares * dividend }];
    });
    const gross = records.reduce((sum, record) => sum + record.gross, 0);
    const wht = records.reduce((sum, record) => sum + withholding(record.gross, record.holding), 0);
    return { gross, wht, net: gross - wht };
  };
  const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12);
  const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1, 12);
  const previousMonth = actualMonthSummary(previousMonthDate);
  const currentMonth = actualMonthSummary(currentMonthDate);
  const nextMonthEvents = buildEvents(holdings).filter((event) => event.payDate.getFullYear() === nextMonthDate.getFullYear() && event.payDate.getMonth() === nextMonthDate.getMonth());
  const nextMonthGross = nextMonthEvents.reduce((sum, event) => sum + event.amount, 0);
  const nextMonthWht = nextMonthEvents.reduce((sum, event) => sum + withholding(event.amount, event.holding), 0);
  const nextMonthNet = nextMonthGross - nextMonthWht;
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthData = months.map((month, index) => {
    const monthNumber = 6 + index;
    const events = buildEvents(holdings).filter((e) => e.payDate.getFullYear() === 2026 && e.payDate.getMonth() === monthNumber);
    return {
      gross: events.reduce((sum, e) => sum + e.amount, 0),
      net: events.reduce((sum, e) => sum + netIncome(e.amount, e.holding), 0),
    };
  });
  const max = Math.max(...monthData.map((month) => month.net), 1);

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow">Portfolio overview</div><h1>Good morning, Tracy.</h1><p>Here’s how your dividend engine is doing.</p></div>
        <button className="button primary" onClick={onAdd}><Plus size={18} />Add holding</button>
      </div>
      <div className="stats-grid">
        <StatCard label="Portfolio value" value={currency.format(totalValue)} detail={<><span className="positive"><ArrowUpRight size={14} /> {((returnAmount / totalCost) * 100 || 0).toFixed(1)}%</span> all time</>} icon={WalletCards} />
        <StatCard label="Projected annual net income" value={currency.format(annualNet)} detail={`Next 12 months · ${currency.format(annualGross)} gross · ${currency.format(annualWht)} WHT`} icon={CircleDollarSign} accent />
        <StatCard label="Net portfolio yield" value={`${yieldOnValue.toFixed(2)}%`} detail={`Gross yield ${totalValue ? (annualGross / totalValue * 100).toFixed(2) : "0.00"}%`} icon={PieChart} />
        <StatCard label="Next net payout" value={nextPayouts.length ? currency.format(nextPayoutNet) : "$0"} detail={nextPayouts.length ? `${currency.format(nextPayoutGross)} gross · ${nextPayoutTickers} · ${shortDate.format(nextPayouts[0].payDate)}` : "No payout scheduled"} icon={CalendarDays} onClick={() => setView("calendar")} />
      </div>
      <div className="monthly-stats-grid">
        <StatCard label={`${previousMonthDate.toLocaleString("en-US", { month: "long" })} net payout`} value={currency.format(previousMonth.net)} detail={`Actual · ${currency.format(previousMonth.gross)} gross · ${currency.format(previousMonth.wht)} WHT`} icon={ArrowDownRight} />
        <StatCard label={`${currentMonthDate.toLocaleString("en-US", { month: "long" })} net payout`} value={currency.format(currentMonth.net)} detail={`Actual · ${currency.format(currentMonth.gross)} gross · ${currency.format(currentMonth.wht)} WHT`} icon={CircleDollarSign} />
        <StatCard label={`${nextMonthDate.toLocaleString("en-US", { month: "long" })} net payout`} value={currency.format(nextMonthNet)} detail={`Projected · ${currency.format(nextMonthGross)} gross · ${currency.format(nextMonthWht)} WHT`} icon={ArrowUpRight} />
      </div>

      <div className="dashboard-grid">
        <section className="panel income-panel">
          <div className="panel-head"><div><div className="eyebrow">Income forecast</div><h2>Dividend income</h2></div><button className="text-button">Next 6 months <ChevronDown size={15} /></button></div>
          <div className="forecast-total"><strong>{currency.format(monthData.reduce((sum, month) => sum + month.net, 0))}</strong><span>net received · {currency.format(monthData.reduce((sum, month) => sum + month.gross, 0))} gross through Dec</span></div>
          <div className="bar-chart">
            {monthData.map((value, index) => <div className="bar-column" key={months[index]}><div className="bar-value">{value.net > 0 ? currency.format(value.net) : ""}</div><div className="bar-track"><div className="bar" style={{ height: `${Math.max(5, value.net / max * 100)}%` }} /></div><span>{months[index]}</span></div>)}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><div className="eyebrow">On the horizon</div><h2>Upcoming payouts</h2></div><button className="text-button" onClick={() => setView("calendar")}>View calendar <ChevronRight size={15} /></button></div>
          <div className="payout-list">
            {upcoming.map((event) => <div className="payout-row" key={event.id}><div className="date-box"><strong>{event.payDate.getDate()}</strong><span>{event.payDate.toLocaleString("en-US", { month: "short" })}</span></div><Avatar ticker={event.holding.ticker} color={event.holding.color} small /><div className="payout-company"><strong>{event.holding.ticker}</strong><span>{event.holding.whtRate}% WHT · {event.holding.shares} shares</span></div><div className="amount-stack"><strong>{preciseCurrency.format(netIncome(event.amount, event.holding))}</strong><span>{preciseCurrency.format(event.amount)} gross</span></div></div>)}
          </div>
        </section>
      </div>

      <section className="panel holdings-panel">
        <div className="panel-head"><div><div className="eyebrow">Your assets</div><h2>Top holdings</h2></div><button className="text-button" onClick={() => setView("portfolio")}>View portfolio <ChevronRight size={15} /></button></div>
        <div className="holding-table">
          <div className="table-row table-header"><span>Holding</span><span>Shares</span><span>Market value</span><span>Annual income</span><span>Yield</span><span /></div>
          {holdings.slice(0, 5).map((h) => {
            const annual = grossIncome(h);
            const net = netIncome(annual, h);
            return <div className="table-row" key={h.id}><div className="company-cell"><Avatar ticker={h.ticker} color={h.color} /><div><strong>{h.ticker}</strong><span>{h.name}</span></div></div><span>{h.shares}</span><strong>{currency.format(h.shares * h.price)}</strong><div className="amount-stack"><strong>{currency.format(net)}</strong><span>{currency.format(annual)} gross</span></div><span>{(net / (h.shares * h.price) * 100).toFixed(2)}%</span><button className="icon-button" onClick={() => onEdit(h)}><Pencil size={16} /></button></div>;
          })}
        </div>
      </section>
    </>
  );
}

function Portfolio({ holdings, onEdit, onAdd, onDelete }) {
  const [query, setQuery] = useState("");
  const filtered = holdings.filter((h) => `${h.ticker} ${h.name}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">Portfolio</div><h1>Your holdings</h1><p>Keep positions and dividend assumptions up to date.</p></div><button className="button primary" onClick={onAdd}><Plus size={18} />Add holding</button></div>
      <section className="panel portfolio-panel">
        <div className="toolbar"><div className="search"><Search size={17} /><input placeholder="Search holdings" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="button secondary"><Download size={17} />Export CSV</button></div>
        <div className="holding-table wide">
          <div className="table-row table-header"><span>Holding</span><span>Shares</span><span>Price</span><span>Market value</span><span>Avg. cost</span><span>Annual income</span><span>Yield</span><span /></div>
          {filtered.map((h) => {
            const annual = grossIncome(h);
            const net = netIncome(annual, h);
            const gain = (h.price - h.avgCost) * h.shares;
            return <div className="table-row" key={h.id}><div className="company-cell"><Avatar ticker={h.ticker} color={h.color} /><div><strong>{h.ticker}</strong><span>{h.name}</span></div></div><span>{h.shares}</span><span>{preciseCurrency.format(h.price)}</span><div><strong>{currency.format(h.shares * h.price)}</strong><small className={gain >= 0 ? "positive" : "negative"}>{gain >= 0 ? "+" : ""}{currency.format(gain)}</small></div><span>{preciseCurrency.format(h.avgCost)}</span><div className="amount-stack"><strong>{currency.format(net)} net</strong><span>{currency.format(annual)} gross · {h.whtRate}% WHT</span></div><span>{(net / (h.shares * h.price) * 100).toFixed(2)}%</span><div className="row-actions"><button className="icon-button" onClick={() => onEdit(h)}><Pencil size={16} /></button><button className="icon-button danger" onClick={() => onDelete(h.id)}><Trash2 size={16} /></button></div></div>;
          })}
        </div>
      </section>
    </>
  );
}

function Calendar({ holdings }) {
  const [cursor, setCursor] = useState(new Date("2026-09-01T12:00:00"));
  const events = buildEvents(holdings);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthlyEvents = events.filter((e) => (e.exDate.getMonth() === month && e.exDate.getFullYear() === year) || (e.payDate.getMonth() === month && e.payDate.getFullYear() === year));
  const payoutEvents = events.filter((e) => e.payDate.getMonth() === month && e.payDate.getFullYear() === year);
  const monthGross = payoutEvents.reduce((sum, e) => sum + e.amount, 0);
  const monthNet = payoutEvents.reduce((sum, e) => sum + netIncome(e.amount, e.holding), 0);
  const moveMonth = (direction) => setCursor(new Date(year, month + direction, 1, 12));

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">Income schedule</div><h1>Dividend calendar</h1><p>Track qualification dates and when cash lands.</p></div><div className="legend"><span><i className="dot ex" />Ex-dividend</span><span><i className="dot pay" />Payout</span></div></div>
      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-head"><button className="icon-button" onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></button><h2>{monthYear.format(cursor)}</h2><button className="icon-button" onClick={() => moveMonth(1)}><ChevronRight size={20} /></button></div>
          <div className="weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="calendar-grid">
            {cells.map((day, cellIndex) => {
              const dateEvents = day ? monthlyEvents.flatMap((event) => {
                const result = [];
                if (event.exDate.getDate() === day && event.exDate.getMonth() === month) result.push({ ...event, type: "ex" });
                if (event.payDate.getDate() === day && event.payDate.getMonth() === month) result.push({ ...event, type: "pay" });
                return result;
              }) : [];
              return <div className={`calendar-day ${!day ? "empty" : ""}`} key={cellIndex}>{day && <span className="day-number">{day}</span>}{dateEvents.map((event) => <div className={`calendar-event ${event.type}`} key={`${event.id}-${event.type}`}><Avatar ticker={event.holding.ticker} color={event.holding.color} small /><div><strong>{event.holding.ticker}</strong><span>{event.type === "pay" ? `${preciseCurrency.format(netIncome(event.amount, event.holding))} net` : "Ex-dividend"}</span></div></div>)}</div>;
            })}
          </div>
        </section>
        <aside className="panel month-summary">
          <div className="eyebrow">Monthly summary</div><h2>{monthYear.format(cursor)}</h2>
          <div className="month-income"><span>Projected net income</span><strong>{preciseCurrency.format(monthNet)}</strong><small>{preciseCurrency.format(monthGross)} gross</small></div>
          <div className="summary-divider" />
          <h3>Scheduled events</h3>
          <div className="summary-events">
            {monthlyEvents.sort((a, b) => a.payDate - b.payDate).map((event) => <div className="summary-event" key={event.id}><Avatar ticker={event.holding.ticker} color={event.holding.color} small /><div><strong>{event.holding.ticker}</strong><span>Ex {shortDate.format(event.exDate)} · Pay {shortDate.format(event.payDate)} · {event.holding.whtRate}% WHT</span></div><div className="amount-stack"><strong>{preciseCurrency.format(netIncome(event.amount, event.holding))}</strong><span>{preciseCurrency.format(event.amount)} gross</span></div></div>)}
            {!monthlyEvents.length && <p className="empty-message">No dividend events this month.</p>}
          </div>
          <div className="calendar-note"><CalendarDays size={18} /><span>Net amounts use your current share count, declared dividend per share, and editable WHT rate.</span></div>
        </aside>
      </div>
    </>
  );
}

function DataSettings({ apiKey, syncState, lastSync, onConnect, onSync }) {
  const [draftKey, setDraftKey] = useState(apiKey);
  const connected = Boolean(apiKey);
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">Settings</div><h1>Dividend data</h1><p>Keep declared amounts and calendar dates fresh automatically.</p></div></div>
      <section className="panel data-settings">
        <div className="provider-heading">
          <div className="provider-icon"><Database size={21} /></div>
          <div><h2>Alpha Vantage</h2><p>Free dividend history with ex, record, declaration, and payment dates.</p></div>
          <span className={`connection-badge ${connected ? "connected" : ""}`}><i />{connected ? "Connected" : "Not connected"}</span>
        </div>
        <div className="api-form">
          <label>Alpha Vantage API key<div className="api-input"><KeyRound size={17} /><input type="password" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="Paste your free API key" /></div></label>
          <button className="button primary" onClick={() => onConnect(draftKey.trim())} disabled={!draftKey.trim() || syncState.status === "syncing"}>{syncState.status === "syncing" ? <RefreshCw className="spinning" size={17} /> : <Check size={17} />}{connected ? "Save & sync" : "Connect & sync"}</button>
        </div>
        <div className="sync-row">
          <div><strong>Automatic refresh</strong><span>Once every 24 hours when the app is open. Cached data is used between refreshes.</span></div>
          <div className="sync-actions"><span>{lastSync ? `Last synced ${new Date(lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Never synced"}</span><button className="button secondary" onClick={() => onSync()} disabled={!connected || syncState.status === "syncing"}><RefreshCw className={syncState.status === "syncing" ? "spinning" : ""} size={16} />Refresh now</button></div>
        </div>
        {syncState.message && <div className={`sync-message ${syncState.status}`}>{syncState.message}</div>}
        <p className="data-note">Your API key stays in this browser’s local storage and is sent only to Alpha Vantage. Saved portfolio data remains available if the API is offline.</p>
      </section>
    </>
  );
}

function App() {
  const [view, setView] = useState("dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || "light");
  const [holdings, setHoldings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultHoldings;
      return applyWhtPolicy(saved);
    } catch { return defaultHoldings; }
  });
  const [modal, setModal] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || "");
  const [dividendCache, setDividendCache] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DIVIDEND_CACHE_KEY)) || { fetchedAt: 0, events: {} }; }
    catch { return { fetchedAt: 0, events: {} }; }
  });
  const [syncState, setSyncState] = useState({ status: "idle", message: "" });
  useEffect(() => setHoldings((current) => current.some((holding) => holding.whtVersion !== 2) ? applyWhtPolicy(current) : current), []);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)), [holdings]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);
  const syncDividendData = async (key = apiKey) => {
    if (!key) return;
    setSyncState({ status: "syncing", message: "Refreshing declared dividend data…" });
    try {
      const events = await fetchDividendData(key);
      const fetchedAt = Date.now();
      const cache = { fetchedAt, events };
      localStorage.setItem(DIVIDEND_CACHE_KEY, JSON.stringify(cache));
      setDividendCache(cache);
      setHoldings((current) => current.map((holding) => {
        const rows = events[holding.ticker] || [];
        const todayString = new Date().toISOString().slice(0, 10);
        const latest = [...rows].filter((event) => event.exDate <= todayString).sort((a, b) => b.exDate.localeCompare(a.exDate))[0];
        const next = [...rows].filter((event) => (event.paymentDate || event.exDate) >= todayString).sort((a, b) => (a.paymentDate || a.exDate).localeCompare(b.paymentDate || b.exDate))[0];
        return {
          ...holding,
          dividend: latest?.amount || holding.dividend,
          exDate: next?.exDate || holding.exDate,
          payDate: next?.paymentDate || holding.payDate,
        };
      }));
      setSyncState({ status: "success", message: "Dividend amounts and dates are up to date." });
    } catch (error) {
      setSyncState({ status: "error", message: `${error.message}. Using the last saved schedule.` });
    }
  };
  useEffect(() => {
    if (!apiKey) return undefined;
    if (Date.now() - dividendCache.fetchedAt >= DAY_MS) syncDividendData(apiKey);
    const interval = window.setInterval(() => {
      const cached = JSON.parse(localStorage.getItem(DIVIDEND_CACHE_KEY) || '{"fetchedAt":0}');
      if (Date.now() - (cached.fetchedAt || 0) >= DAY_MS) syncDividendData(apiKey);
    }, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [apiKey]);
  const connectApi = (key) => {
    localStorage.setItem(API_KEY_STORAGE, key);
    setApiKey(key);
    syncDividendData(key);
  };
  const totalValue = useMemo(() => holdings.reduce((sum, h) => sum + h.shares * h.price, 0), [holdings]);
  const saveHolding = (holding) => {
    setHoldings((current) => holding.id ? current.map((h) => h.id === holding.id ? holding : h) : [...current, { ...holding, id: Date.now() }]);
    setModal(null);
  };
  const nav = [
    ["dashboard", LayoutDashboard, "Overview"],
    ["portfolio", WalletCards, "Portfolio"],
    ["calendar", CalendarDays, "Calendar"],
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          {nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={19} /><span>{label}</span></button>)}
          <button className={`mobile-settings ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><Settings size={19} /><span>Settings</span></button>
        </nav>
        <div className="sidebar-bottom"><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings size={19} /><span>Settings</span></button><div className="user-card"><div className="user-avatar">TP</div><div><strong>Tracy Pham</strong><span>Personal portfolio</span></div><MoreHorizontal size={18} /></div></div>
      </aside>
      <div className="main-area">
        <header><div className="mobile-logo"><Logo /></div><div className="header-spacer" /><div className="market-status"><i /> Markets open</div><button className="icon-button theme-toggle" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</button><button className="icon-button notification"><Bell size={19} /><i /></button><div className="header-value"><span>Total balance</span><strong>{currency.format(totalValue)}</strong></div></header>
        <main>
          {view === "dashboard" && <Dashboard holdings={holdings} dividendEvents={dividendCache.events} setView={setView} onEdit={(h) => setModal(h)} onAdd={() => setModal("new")} />}
          {view === "portfolio" && <Portfolio holdings={holdings} onEdit={(h) => setModal(h)} onAdd={() => setModal("new")} onDelete={(id) => setHoldings((h) => h.filter((item) => item.id !== id))} />}
          {view === "calendar" && <Calendar holdings={holdings} />}
          {view === "settings" && <DataSettings apiKey={apiKey} syncState={syncState} lastSync={dividendCache.fetchedAt} onConnect={connectApi} onSync={() => syncDividendData()} />}
        </main>
      </div>
      {modal && <HoldingModal holding={modal === "new" ? null : modal} onClose={() => setModal(null)} onSave={saveHolding} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
