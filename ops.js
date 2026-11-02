/* =========================================================
   ops.js — Jollibee Operations Information System
   Four business process cycles in one back-office app:
     Expenditure : purchase orders, receiving, supplier payments, inventory
     Revenue     : sales, customer payments
     Human Res.  : employees, attendance, payroll
     Accounting  : chart of accounts, journal, ledger / trial balance,
                   financial statements
   Every operational event posts a balanced journal entry, so the
   accounting cycle is always fed by the other three.
   ========================================================= */
"use strict";

/* ---------- Supabase config (same project as the storefront) ---------- */
const SUPABASE_URL = "https://oougwsdtbhpisflsociq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VilEjy5s_i2bMNx5v6VdtQ_AHIJgCv7";

let sb = null;
try {
  if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
} catch (_) { sb = null; }

/* If the Supabase library cannot load, the app runs on built-in sample data
   so every page can still be shown. Nothing is saved in this mode. */
const DEMO_MODE = !sb;

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = v => Number(v || 0);
const round2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const peso = n => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—";
const pad = n => String(n).padStart(2, "0");
const iso = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const todayISO = () => iso(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = d => {
  if (!d) return "—";
  const x = new Date(String(d).length === 10 ? d + "T00:00:00" : d);
  return x.toLocaleDateString("en-PH", { dateStyle: "medium" });
};
const fmtTime = t => {
  if (!t) return "—";
  const [h, m] = String(t).split(":");
  const hh = Number(h);
  return `${hh % 12 || 12}:${m} ${hh >= 12 ? "PM" : "AM"}`;
};

function code(prefix) {
  const t = new Date();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${String(t.getFullYear()).slice(2)}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${r}`;
}

function friendly(err) {
  const m = (err && err.message) || "Something went wrong.";
  if (/duplicate key|already exists/i.test(m)) return "That record already exists.";
  if (/row-level security|permission denied/i.test(m)) return "No permission. Sign in with a staff account.";
  return m;
}

function say(el, text, ok) {
  if (!el) return;
  el.className = "msg " + (ok === true ? "ok" : ok === false ? "bad" : "");
  el.textContent = text;
}

/* =========================================================
   DATA LAYER  (Supabase, or in-memory sample data)
   ========================================================= */
const DB = {
  ops_company_info: [{
    id: "c1",
    company_name: "Jollibee Foods Corporation (Jollibee)",
    profile: "Jollibee is a Filipino fast-food company known for serving affordable and convenient meals. It operates many branches in the Philippines and other countries.",
    nature: "Fast-food restaurant and food service business",
    products: "Chickenjoy, Jolly Spaghetti, Yumburger, fries, rice meals, beverages, desserts, dine-in, take-out, and delivery services"
  }],
  ops_suppliers: [], ops_menu_items: [], ops_inventory: [],
  ops_purchase_orders: [], ops_supplier_payments: [],
  ops_sales: [], ops_customer_payments: [],
  ops_employees: [], ops_attendance: [], ops_payroll: [],
  ops_accounts: [], ops_journal_entries: [], ops_journal_lines: []
};

const ASC_COLS = ["name", "item_name", "code", "full_name", "emp_code"];

async function apiList(table, order = "created_at", asc = null) {
  const ascending = asc === null ? ASC_COLS.includes(order) : asc;
  if (!sb) {
    const rows = DB[table] ? DB[table].map(r => ({ ...r })) : [];
    if (order) {
      rows.sort((a, b) => {
        const x = a[order] ?? "", y = b[order] ?? "";
        return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
      });
    }
    return rows;
  }
  let q = sb.from(table).select("*");
  if (order) q = q.order(order, { ascending });
  let { data, error } = await q;
  if (error && /column .* does not exist/i.test(error.message)) {
    const retry = await sb.from(table).select("*");
    if (retry.error) throw retry.error;
    return retry.data || [];
  }
  if (error) throw error;
  return data || [];
}

function demoInsert(table, row) {
  const r = { ...row };
  r.id = r.id || Math.random().toString(36).slice(2) + Date.now().toString(36);
  r.created_at = r.created_at || new Date().toISOString();
  if (table === "ops_purchase_orders" || table === "ops_sales") r.total = round2(n2(r.quantity) * n2(r.unit_cost ?? r.unit_price));
  const rows = DB[table];
  if (table === "ops_attendance" && rows.some(x => x.employee_id === r.employee_id && x.work_date === r.work_date))
    throw new Error("duplicate key value violates unique constraint");
  if (table === "ops_payroll" && rows.some(x => x.employee_id === r.employee_id && x.period_start === r.period_start && x.period_end === r.period_end))
    throw new Error("duplicate key value violates unique constraint");
  if (table === "ops_accounts" && rows.some(x => x.code === r.code))
    throw new Error("duplicate key value violates unique constraint");
  rows.unshift(r);
  return r;
}

async function apiInsert(table, row) {
  if (!sb) return demoInsert(table, row);
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function apiInsertMany(table, rows) {
  if (!rows.length) return [];
  if (!sb) return rows.map(r => demoInsert(table, r));
  const { data, error } = await sb.from(table).insert(rows).select();
  if (error) throw error;
  return data || [];
}

async function apiUpdate(table, id, patch) {
  if (!sb) {
    const i = DB[table].findIndex(x => x.id === id);
    if (i >= 0) DB[table][i] = { ...DB[table][i], ...patch };
    return;
  }
  const { error } = await sb.from(table).update(patch).eq("id", id);
  if (error) throw error;
}

/* =========================================================
   ACCOUNTING ENGINE — double-entry posting
   ========================================================= */
const VAT_RATE = 0.12;       // prices are VAT-inclusive
const COGS_RATE = 0.35;      // standard food cost used for estimated COGS

async function postJE({ source, ref, memo, date, lines }) {
  if (ref) {
    const existing = (await apiList("ops_journal_entries", null)).find(e => e.source === source && e.ref_code === ref);
    if (existing) return existing;        // never post the same event twice
  }
  const clean = lines
    .map(l => ({ acct: l.acct, debit: round2(l.debit || 0), credit: round2(l.credit || 0) }))
    .filter(l => l.debit || l.credit);
  const dr = round2(clean.reduce((a, l) => a + l.debit, 0));
  const cr = round2(clean.reduce((a, l) => a + l.credit, 0));
  if (!clean.length || Math.abs(dr - cr) > 0.005) {
    throw new Error(`Journal entry is not balanced (debits ${peso(dr)} vs credits ${peso(cr)}).`);
  }
  const e = await apiInsert("ops_journal_entries", {
    je_code: code("JE"),
    entry_date: date || todayISO(),
    memo,
    source,
    ref_code: ref || null
  });
  await apiInsertMany("ops_journal_lines", clean.map(l => ({
    entry_id: e.id, account_code: l.acct, debit: l.debit, credit: l.credit
  })));
  return e;
}

/* Revenue cycle -> accounting: cash in, sales + output VAT, estimated COGS */
function postSalePayment(sale, amount, date) {
  const net = round2(amount / (1 + VAT_RATE));
  const vat = round2(amount - net);
  const cogs = round2(net * COGS_RATE);
  return postJE({
    source: "SALE", ref: sale.sale_code, date,
    memo: `Sale ${sale.sale_code} collected`,
    lines: [
      { acct: "1000", debit: amount },
      { acct: "4000", credit: net },
      { acct: "2100", credit: vat },
      { acct: "5000", debit: cogs },
      { acct: "1200", credit: cogs }
    ]
  });
}

/* Expenditure cycle -> accounting: goods received on account */
function postReceipt(po, date) {
  const total = round2(n2(po.total) || n2(po.quantity) * n2(po.unit_cost));
  return postJE({
    source: "PURCHASE", ref: po.po_code, date,
    memo: `Received ${po.quantity} ${po.item_name} (${po.po_code})`,
    lines: [{ acct: "1200", debit: total }, { acct: "2000", credit: total }]
  });
}

function postSupplierPayment(inv, viaPO, date) {
  return postJE({
    source: "SUPPLIER_PAYMENT", ref: inv.invoice_code, date,
    memo: viaPO ? `Paid supplier invoice ${inv.invoice_code}` : `Direct purchase paid ${inv.invoice_code}`,
    lines: viaPO
      ? [{ acct: "2000", debit: n2(inv.amount) }, { acct: "1000", credit: n2(inv.amount) }]
      : [{ acct: "1200", debit: n2(inv.amount) }, { acct: "1000", credit: n2(inv.amount) }]
  });
}

/* HR cycle -> accounting: salaries expense, cash out, withheld contributions */
function postPayroll(p, empName, date) {
  const withheld = round2(n2(p.gross_pay) - n2(p.net_pay));
  return postJE({
    source: "PAYROLL", ref: p.payslip_code, date,
    memo: `Payroll ${p.payslip_code} - ${empName}`,
    lines: [
      { acct: "5100", debit: n2(p.gross_pay) },
      { acct: "1000", credit: n2(p.net_pay) },
      { acct: "2200", credit: withheld }
    ]
  });
}

async function loadLedger() {
  const [accounts, entries, lines] = await Promise.all([
    apiList("ops_accounts", "code", true),
    apiList("ops_journal_entries", null),
    apiList("ops_journal_lines", null)
  ]);
  const bal = {};
  accounts.forEach(a => { bal[a.code] = { ...a, debit: 0, credit: 0, net: 0 }; });
  lines.forEach(l => {
    const b = bal[l.account_code];
    if (b) { b.debit += n2(l.debit); b.credit += n2(l.credit); }
  });
  Object.values(bal).forEach(b => {
    b.debit = round2(b.debit); b.credit = round2(b.credit);
    b.net = round2(b.type === "Asset" || b.type === "Expense" ? b.debit - b.credit : b.credit - b.debit);
  });
  entries.sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || "") || (b.created_at || "").localeCompare(a.created_at || ""));
  return { accounts, entries, lines, bal };
}

function statements(L) {
  const list = Object.values(L.bal).sort((a, b) => a.code.localeCompare(b.code));
  const of = t => list.filter(a => a.type === t);
  const sum = arr => round2(arr.reduce((a, x) => a + x.net, 0));
  const revenue = of("Revenue");
  const cogs = of("Expense").filter(a => a.code === "5000");
  const opex = of("Expense").filter(a => a.code !== "5000");
  const totalRevenue = sum(revenue);
  const totalCogs = sum(cogs);
  const grossProfit = round2(totalRevenue - totalCogs);
  const totalOpex = sum(opex);
  const netIncome = round2(grossProfit - totalOpex);
  const assets = of("Asset"), liabilities = of("Liability"), equity = of("Equity");
  const totalAssets = sum(assets), totalLiab = sum(liabilities);
  const totalEquity = round2(sum(equity) + netIncome);
  return {
    revenue, cogs, opex, totalRevenue, totalCogs, grossProfit, totalOpex, netIncome,
    assets, liabilities, equity, totalAssets, totalLiab, totalEquity,
    balanced: Math.abs(totalAssets - (totalLiab + totalEquity)) < 0.01
  };
}

/* =========================================================
   PAYROLL ENGINE (simplified for academic purposes)
   ========================================================= */
function computePay(emp, atts, periodDays) {
  const paid = atts.filter(a => a.status === "Present" || a.status === "Late" || a.status === "Leave");
  const days = paid.length;
  const ot = round2(atts.reduce((a, x) => a + n2(x.ot_hours), 0));
  const basic = round2(days * n2(emp.daily_rate));
  const otPay = round2(ot * (n2(emp.daily_rate) / 8) * 1.25);
  const gross = round2(basic + otPay);
  const sss = round2(Math.min(gross * 0.045, 1350));
  const philhealth = round2(Math.min(gross * 0.025, 2500));
  const pagibig = round2(Math.min(gross * 0.02, 200));
  const taxable = gross - sss - philhealth - pagibig;
  const threshold = 20833 * (periodDays / 30);
  const tax = round2(Math.max(0, taxable - threshold) * 0.15);
  const net = round2(gross - sss - philhealth - pagibig - tax);
  return { days, ot, basic, otPay, gross, sss, philhealth, pagibig, tax, net };
}

function attendanceHours(tin, tout) {
  if (!tin || !tout) return { hours: 0, ot: 0 };
  const [h1, m1] = tin.split(":").map(Number);
  const [h2, m2] = tout.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1) - 60;   // 1-hour unpaid break
  if (mins < 0) mins = 0;
  const hours = round2(mins / 60);
  return { hours, ot: round2(Math.max(0, hours - 8)) };
}

/* =========================================================
   SAMPLE DATA (used only when Supabase is unavailable)
   ========================================================= */
async function seedDemo() {
  const T = new Date();
  const day = n => iso(addDays(T, -n));
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  DB.ops_suppliers = [
    { id: "s1", name: "Fresh Farm Produce Co.", contact: "0917-111-2222", email: "orders@freshfarm.ph", created_at: day(60) },
    { id: "s2", name: "Golden Oil Trading", contact: "0918-333-4444", email: "sales@goldenoil.ph", created_at: day(60) },
    { id: "s3", name: "Metro Packaging Inc.", contact: "0919-555-6666", email: "supply@metropack.ph", created_at: day(60) }
  ];
  DB.ops_menu_items = [
    ["m1", "Chickenjoy", 99], ["m2", "Jolly Spaghetti", 60], ["m3", "Yumburger", 45], ["m4", "Crispy Fries", 40],
    ["m5", "Burger Steak", 70], ["m6", "Peach Mango Pie", 30], ["m7", "Chocolate Sundae", 30], ["m8", "Iced Tea", 35]
  ].map(([id, name, unit_price]) => ({ id, name, unit_price, active: true }));
  DB.ops_inventory = [
    ["i1", "Chicken (raw)", 120, "kg", 40, 180], ["i2", "Spaghetti pasta", 18, "kg", 25, 55],
    ["i3", "Burger buns", 200, "pcs", 50, 8], ["i4", "Cooking oil", 12, "L", 15, 95],
    ["i5", "French fries (frozen)", 60, "kg", 20, 110], ["i6", "Soft drink syrup", 30, "L", 10, 120],
    ["i7", "Paper bags", 500, "pcs", 100, 2.5], ["i8", "Cups (16oz)", 400, "pcs", 80, 3]
  ].map(([id, item_name, quantity, unit, reorder_level, unit_cost]) => ({
    id, item_name, quantity, unit, reorder_level, unit_cost, created_at: day(60), updated_at: day(2)
  }));
  DB.ops_accounts = [
    ["1000", "Cash on Hand and in Bank", "Asset"], ["1200", "Inventory", "Asset"],
    ["2000", "Accounts Payable", "Liability"], ["2100", "Output VAT Payable", "Liability"],
    ["2200", "Payroll Contributions and Tax Payable", "Liability"], ["3000", "Owner's Capital", "Equity"],
    ["4000", "Sales Revenue", "Revenue"], ["5000", "Cost of Goods Sold", "Expense"],
    ["5100", "Salaries and Wages Expense", "Expense"], ["5200", "Utilities Expense", "Expense"],
    ["5300", "Rent Expense", "Expense"]
  ].map(([code, name, type], i) => ({ id: "a" + i, code, name, type, active: true }));

  DB.ops_employees = [
    ["e1", "EMP-001", "Maria Santos", "Store Manager", "Management", 1100, "0917-210-0001", "2023-02-01"],
    ["e2", "EMP-002", "Juan Dela Cruz", "Cashier", "Counter", 645, "0917-210-0002", "2024-06-10"],
    ["e3", "EMP-003", "Ana Reyes", "Crew - Kitchen", "Kitchen", 645, "0917-210-0003", "2024-08-15"],
    ["e4", "EMP-004", "Pedro Garcia", "Crew - Kitchen", "Kitchen", 645, "0917-210-0004", "2025-01-20"],
    ["e5", "EMP-005", "Liza Mendoza", "Accountant", "Back Office", 900, "0917-210-0005", "2023-09-05"],
    ["e6", "EMP-006", "Carlo Ramos", "Delivery Rider", "Delivery", 700, "0917-210-0006", "2025-03-03"]
  ].map(([id, emp_code, full_name, position, department, daily_rate, contact, hire_date]) => ({
    id, emp_code, full_name, position, department, daily_rate, contact, hire_date, status: "Active", created_at: day(90)
  }));

  /* attendance: last 30 days */
  for (let d = 30; d >= 0; d--) {
    DB.ops_employees.forEach((e, idx) => {
      if ((d + idx) % 7 === 0) return;                         // weekly rest day
      const lateRoll = rnd();
      const inMin = lateRoll > 0.88 ? 8 * 60 + 20 + Math.floor(rnd() * 15) : 7 * 60 + 50 + Math.floor(rnd() * 20);
      const outMin = 17 * 60 + Math.floor(rnd() * 100);
      const tin = `${pad(Math.floor(inMin / 60))}:${pad(inMin % 60)}`;
      const tout = `${pad(Math.floor(outMin / 60))}:${pad(outMin % 60)}`;
      const h = attendanceHours(tin, tout);
      DB.ops_attendance.push({
        id: `att${d}_${idx}`, employee_id: e.id, work_date: day(d), time_in: tin, time_out: tout,
        hours_worked: h.hours, ot_hours: h.ot, status: inMin > 8 * 60 + 15 ? "Late" : "Present", created_at: day(d)
      });
    });
  }

  /* opening balances */
  await postJE({
    source: "OPENING", ref: "OPEN-1", date: day(45), memo: "Opening balances",
    lines: [{ acct: "1000", debit: 500000 }, { acct: "1200", debit: 100000 }, { acct: "3000", credit: 600000 }]
  });

  /* expenditure cycle */
  const po = (id, sup, item, qty, cost, status, ago) => ({
    id, po_code: `PO-${id.toUpperCase()}`, supplier_id: sup, item_name: item, quantity: qty, unit_cost: cost,
    total: round2(qty * cost), status, notes: null, created_at: day(ago), updated_at: day(ago)
  });
  DB.ops_purchase_orders = [
    po("p4", "s1", "Spaghetti pasta", 50, 55, "Pending", 1),
    po("p3", "s3", "Paper bags", 1000, 2.5, "Sent", 3),
    po("p2", "s2", "Cooking oil", 30, 95, "Received", 9),
    po("p1", "s1", "Chicken (raw)", 100, 180, "Received", 14)
  ];
  await postReceipt(DB.ops_purchase_orders[3], day(13));
  await postReceipt(DB.ops_purchase_orders[2], day(8));
  DB.ops_supplier_payments = [
    { id: "sp2", invoice_code: "INV-P2", supplier_id: "s2", purchase_order_id: "p2", amount: 2850, method: "Check", status: "Unpaid", paid_at: null, notes: null, created_at: day(8) },
    { id: "sp1", invoice_code: "INV-P1", supplier_id: "s1", purchase_order_id: "p1", amount: 18000, method: "Bank Transfer", status: "Paid", paid_at: day(10), notes: "Net 3 days", created_at: day(13) }
  ];
  await postSupplierPayment(DB.ops_supplier_payments[1], true, day(10));

  /* revenue cycle */
  const menu = DB.ops_menu_items;
  const types = ["Dine-in", "Take-out", "Delivery"];
  let n = 1;
  for (let d = 29; d >= 0; d--) {
    const count = 3;   // one sales batch per shift
    for (let k = 0; k < count; k++) {
      const m = menu[Math.floor(rnd() * menu.length)];
      const qty = 25 + Math.floor(rnd() * 36);   // units sold in the shift
      const sale = {
        id: `sl${n}`, sale_code: `SO-${String(n).padStart(4, "0")}`, menu_item_id: m.id, quantity: qty,
        unit_price: m.unit_price, total: round2(qty * m.unit_price),
        order_type: types[Math.floor(rnd() * 3)], status: "Open", created_at: `${day(d)}T${10 + k * 4}:15:00`
      };
      const keepOpen = d === 0 && k === 2;
      if (!keepOpen) {
        sale.status = "Paid";
        DB.ops_customer_payments.unshift({
          id: `cp${n}`, payment_code: `PAY-${String(n).padStart(4, "0")}`, sale_id: sale.id, amount: sale.total,
          method: ["Cash", "Card", "QR"][Math.floor(rnd() * 3)], status: "Completed", created_at: sale.created_at
        });
        await postSalePayment(sale, sale.total, day(d));
      }
      DB.ops_sales.unshift(sale);
      n++;
    }
  }

  /* manual entries: utilities and rent */
  await postJE({ source: "MANUAL", ref: "UTIL-OCT", date: day(5), memo: "Electricity and water bill", lines: [{ acct: "5200", debit: 6500 }, { acct: "1000", credit: 6500 }] });
  await postJE({ source: "MANUAL", ref: "RENT-OCT", date: day(4), memo: "Monthly store rent", lines: [{ acct: "5300", debit: 25000 }, { acct: "1000", credit: 25000 }] });

  /* one earlier payroll period, already paid */
  const ps = day(29), pe = day(15);
  for (const e of DB.ops_employees) {
    const atts = DB.ops_attendance.filter(a => a.employee_id === e.id && a.work_date >= ps && a.work_date <= pe);
    const c = computePay(e, atts, 15);
    const row = {
      payslip_code: `PS-${e.emp_code.slice(-3)}A`, employee_id: e.id, period_start: ps, period_end: pe,
      days_present: c.days, ot_hours: c.ot, basic_pay: c.basic, ot_pay: c.otPay, gross_pay: c.gross,
      sss: c.sss, philhealth: c.philhealth, pagibig: c.pagibig, tax: c.tax, net_pay: c.net,
      status: "Paid", paid_at: day(14)
    };
    const saved = demoInsert("ops_payroll", row);
    await postPayroll(saved, e.full_name, day(14));
  }
}

/* =========================================================
   NAVIGATION
   ========================================================= */
const NAV = [
  { group: "Overview", cls: "g-ov", items: [["/", "Dashboard", "▣"]] },
  { group: "Expenditure cycle", cls: "g-ex", items: [
    ["/ordering", "Ordering to Supplier", "📦"],
    ["/supplier-payments", "Payment to Supplier", "💳"],
    ["/inventory", "Inventory", "📋"]
  ] },
  { group: "Revenue cycle", cls: "g-re", items: [
    ["/sales", "Sales from Customer", "🛒"],
    ["/customer-payments", "Payment from Customer", "💵"]
  ] },
  { group: "Human resource cycle", cls: "g-hr", items: [
    ["/employees", "Employees", "👥"],
    ["/attendance", "Attendance", "🕘"],
    ["/payroll", "Payroll", "🧾"]
  ] },
  { group: "Accounting cycle", cls: "g-ac", items: [
    ["/accounts", "Chart of Accounts", "🗂"],
    ["/journal", "Journal Entries", "📒"],
    ["/ledger", "Ledger & Trial Balance", "⚖"],
    ["/statements", "Financial Statements", "📊"]
  ] },
  { group: "Company", cls: "g-ov", items: [["/company", "Company Info", "🏢"]] }
];

const TITLES = {
  "/": ["Dashboard", "All four business process cycles at a glance"],
  "/ordering": ["Ordering to Supplier", "Expenditure cycle · purchase orders and receiving"],
  "/supplier-payments": ["Payment to Supplier", "Expenditure cycle · supplier invoices and disbursements"],
  "/inventory": ["Inventory", "Expenditure cycle · stock levels and reorder flags"],
  "/sales": ["Sales from Customer", "Revenue cycle · record menu sales and order type"],
  "/customer-payments": ["Payment from Customer", "Revenue cycle · cash, card, or QR against a sale"],
  "/employees": ["Employees", "Human resource cycle · employee master file"],
  "/attendance": ["Attendance", "Human resource cycle · daily time record"],
  "/payroll": ["Payroll", "Human resource cycle · compute, review and pay"],
  "/accounts": ["Chart of Accounts", "Accounting cycle · account list and balances"],
  "/journal": ["Journal Entries", "Accounting cycle · automatic and manual entries"],
  "/ledger": ["Ledger & Trial Balance", "Accounting cycle · account activity and balance check"],
  "/statements": ["Financial Statements", "Accounting cycle · income statement and balance sheet"],
  "/company": ["Company Information", "Jollibee Foods Corporation"]
};

function buildNav() {
  $("#nav").innerHTML = NAV.map(g => `
    <div class="nav-group ${g.cls}">${esc(g.group)}</div>
    ${g.items.map(([r, label, ico]) => `<a href="#/${r === "/" ? "" : r.slice(1)}" data-route="${r}"><span class="ico">${ico}</span> ${esc(label)}</a>`).join("")}
  `).join("");
}

/* =========================================================
   PAGES
   ========================================================= */
function banner() {
  return DEMO_MODE
    ? `<div class="cfg"><strong>Sample-data mode.</strong> The Supabase library could not be reached, so this page is running on built-in sample data. Nothing is saved.</div>`
    : "";
}

function statTile(label, value, cls = "") {
  return `<div class="stat ${cls}"><label>${esc(label)}</label><b>${value}</b></div>`;
}

/* ---------------- Dashboard ---------------- */
async function pageDashboard() {
  const [pos, pays, sales, inv, emps, atts, payroll, L] = await Promise.all([
    apiList("ops_purchase_orders"), apiList("ops_supplier_payments"), apiList("ops_sales"),
    apiList("ops_inventory", "updated_at"), apiList("ops_employees", "emp_code"),
    apiList("ops_attendance", "work_date"), apiList("ops_payroll"), loadLedger()
  ]);
  const S = statements(L);
  const today = todayISO();
  const openPO = pos.filter(p => p.status === "Pending" || p.status === "Sent").length;
  const owed = pays.filter(p => p.status === "Unpaid").reduce((a, p) => a + n2(p.amount), 0);
  const reorder = inv.filter(i => n2(i.quantity) <= n2(i.reorder_level));
  const invValue = inv.reduce((a, i) => a + n2(i.quantity) * n2(i.unit_cost), 0);
  const paidSales = sales.filter(s => s.status === "Paid");
  const total = s => n2(s.total) || n2(s.quantity) * n2(s.unit_price);
  const salesToday = paidSales.filter(s => String(s.created_at).slice(0, 10) === today).reduce((a, s) => a + total(s), 0);
  const openSales = sales.filter(s => s.status === "Open");
  const avgTicket = paidSales.length ? paidSales.reduce((a, s) => a + total(s), 0) / paidSales.length : 0;
  const active = emps.filter(e => e.status === "Active");
  const presentToday = atts.filter(a => a.work_date === today && (a.status === "Present" || a.status === "Late")).length;
  const draftNet = payroll.filter(p => p.status === "Draft").reduce((a, p) => a + n2(p.net_pay), 0);
  const paidPayroll = payroll.filter(p => p.status === "Paid").reduce((a, p) => a + n2(p.gross_pay), 0);
  const cash = (L.bal["1000"] || {}).net || 0;
  const tbOk = Math.abs(Object.values(L.bal).reduce((a, b) => a + b.debit - b.credit, 0)) < 0.01;

  const recent = L.entries.slice(0, 6).map(e => {
    const lines = L.lines.filter(l => l.entry_id === e.id);
    return { e, amt: lines.reduce((a, l) => a + n2(l.debit), 0) };
  });

  return banner() + `
    <div class="cycle-title ex">Expenditure cycle</div>
    <div class="grid">
      ${statTile("Open purchase orders", openPO)}
      ${statTile("Owed to suppliers", peso(owed), owed ? "warn" : "")}
      ${statTile("Items to reorder", reorder.length, reorder.length ? "bad" : "")}
      ${statTile("Inventory value", peso(invValue))}
    </div>
    <div class="cycle-title re">Revenue cycle</div>
    <div class="grid">
      ${statTile("Sales today (paid)", peso(salesToday), "ok")}
      ${statTile("Open sales awaiting payment", openSales.length, openSales.length ? "warn" : "")}
      ${statTile("Total paid sales", peso(paidSales.reduce((a, s) => a + total(s), 0)), "ok")}
      ${statTile("Average ticket", peso(avgTicket))}
    </div>
    <div class="cycle-title hr">Human resource cycle</div>
    <div class="grid">
      ${statTile("Active employees", active.length)}
      ${statTile("Present today", `${presentToday} / ${active.length}`)}
      ${statTile("Payroll awaiting payment", peso(draftNet), draftNet ? "warn" : "")}
      ${statTile("Salaries paid to date", peso(paidPayroll))}
    </div>
    <div class="cycle-title ac">Accounting cycle</div>
    <div class="grid">
      ${statTile("Cash balance", peso(cash), cash >= 0 ? "ok" : "bad")}
      ${statTile("Net income to date", peso(S.netIncome), S.netIncome >= 0 ? "ok" : "bad")}
      ${statTile("Journal entries posted", L.entries.length)}
      ${statTile("Trial balance", tbOk ? "Balanced" : "Out of balance", tbOk ? "ok" : "bad")}
    </div>

    <div class="split">
      <div class="panel">
        <div class="panel-h"><h2>Low stock</h2></div>
        <div class="panel-b">
          ${reorder.length ? `
            <table>
              <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Reorder at</th><th></th></tr></thead>
              <tbody>${reorder.map(i => `
                <tr><td>${esc(i.item_name)}</td><td class="num">${esc(i.quantity)} ${esc(i.unit)}</td>
                <td class="num">${esc(i.reorder_level)}</td><td><span class="badge Reorder static">Reorder</span></td></tr>`).join("")}
              </tbody>
            </table>` : `<p class="empty">All stock levels are healthy.</p>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Latest journal entries</h2></div>
        <div class="panel-b">
          ${recent.length ? `
            <table>
              <thead><tr><th>Date</th><th>Memo</th><th>Source</th><th class="num">Amount</th></tr></thead>
              <tbody>${recent.map(({ e, amt }) => `
                <tr><td>${fmtDay(e.entry_date)}</td><td>${esc(e.memo)}</td>
                <td><span class="badge src ${esc(e.source)} static">${esc(e.source.replace("_", " "))}</span></td>
                <td class="num">${peso(amt)}</td></tr>`).join("")}
              </tbody>
            </table>` : `<p class="empty">No journal entries yet.</p>`}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h"><h2>How the four cycles connect</h2></div>
      <div class="panel-b">
        <div class="note-grid four">
          <div class="note-card"><h3>Expenditure → Accounting</h3><p>Receiving a purchase order adds stock and posts <em>Dr Inventory / Cr Accounts Payable</em>. Paying the invoice posts <em>Dr Accounts Payable / Cr Cash</em>.</p></div>
          <div class="note-card"><h3>Revenue → Accounting</h3><p>Collecting a customer payment marks the sale Paid and posts cash, sales net of 12% VAT, output VAT, and estimated cost of goods sold.</p></div>
          <div class="note-card"><h3>HR → Accounting</h3><p>Attendance drives payroll. Paying a payslip posts <em>Dr Salaries Expense / Cr Cash and Payroll Payable</em>.</p></div>
          <div class="note-card"><h3>Accounting → Management</h3><p>The ledger feeds the trial balance, the income statement and the balance sheet shown on the Accounting pages.</p></div>
        </div>
      </div>
    </div>
  `;
}

/* ---------------- Ordering to Supplier (+ receiving) ---------------- */
async function receivePO(po) {
  const inv = await apiList("ops_inventory", "item_name");
  const match = inv.find(i => i.item_name.toLowerCase() === po.item_name.toLowerCase());
  const qty = n2(po.quantity);
  if (match) {
    await apiUpdate("ops_inventory", match.id, {
      quantity: round2(n2(match.quantity) + qty), unit_cost: n2(po.unit_cost), updated_at: new Date().toISOString()
    });
  } else {
    await apiInsert("ops_inventory", {
      item_name: po.item_name, quantity: qty, unit: "pcs", reorder_level: 10, unit_cost: n2(po.unit_cost),
      updated_at: new Date().toISOString()
    });
  }
  await postReceipt(po);
}

async function pageOrdering() {
  const [suppliers, rows] = await Promise.all([apiList("ops_suppliers", "name"), apiList("ops_purchase_orders")]);
  const supplierName = id => (suppliers.find(s => s.id === id) || {}).name || id;
  const options = suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");

  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>New purchase order</h2></div>
      <div class="panel-b">
        <form id="po-form">
          <div class="form-grid">
            <label class="field">Supplier <select id="po-supplier" required>${options}</select></label>
            <label class="field">Item <input id="po-item" required placeholder="e.g. Chicken (raw)"></label>
            <label class="field">Quantity <input id="po-qty" type="number" min="0.01" step="0.01" required value="10"></label>
            <label class="field">Unit cost (₱) <input id="po-cost" type="number" min="0" step="0.01" required value="100"></label>
            <label class="field span-2">Notes <input id="po-notes" placeholder="Optional"></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Create order</button><div class="msg" id="po-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Purchase orders</h2><span class="meta">Click status to advance: Pending → Sent → Received (receiving updates inventory and posts to the ledger)</span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${rows.length ? `
          <table>
            <thead><tr><th>Code</th><th>Supplier</th><th>Item</th><th class="num">Qty</th><th class="num">Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${rows.map(r => `
              <tr>
                <td><strong>${esc(r.po_code)}</strong></td><td>${esc(supplierName(r.supplier_id))}</td><td>${esc(r.item_name)}</td>
                <td class="num">${esc(r.quantity)}</td><td class="num">${peso(r.total ?? r.quantity * r.unit_cost)}</td>
                <td><span class="badge ${esc(r.status)} ${r.status === "Received" ? "static" : ""}" data-po-status="${esc(r.status)}" data-id="${esc(r.id)}">${esc(r.status)}</span></td>
                <td>${fmtDate(r.created_at)}</td>
              </tr>`).join("")}
            </tbody>
          </table>` : `<p class="empty">No purchase orders yet.</p>`}
      </div>
    </div>`,
    mount() {
      $("#po-form").onsubmit = async e => {
        e.preventDefault();
        const msg = $("#po-msg");
        try {
          await apiInsert("ops_purchase_orders", {
            po_code: code("PO"), supplier_id: $("#po-supplier").value, item_name: $("#po-item").value.trim(),
            quantity: Number($("#po-qty").value), unit_cost: Number($("#po-cost").value), status: "Pending",
            notes: $("#po-notes").value.trim() || null
          });
          await render(); say($("#po-msg"), "Purchase order created.", true);
        } catch (err) { say(msg, friendly(err), false); }
      };
      $$("[data-po-status]").forEach(btn => {
        btn.onclick = async () => {
          const cur = btn.dataset.poStatus;
          if (cur === "Received") return;
          const po = rows.find(r => r.id === btn.dataset.id);
          const next = cur === "Pending" ? "Sent" : "Received";
          try {
            await apiUpdate("ops_purchase_orders", po.id, { status: next, updated_at: new Date().toISOString() });
            if (next === "Received") await receivePO(po);
            await render();
            if (next === "Received") say($("#po-msg"), `${po.po_code} received. Inventory updated and journal entry posted.`, true);
          } catch (err) { alert(friendly(err)); }
        };
      });
    }
  };
}

/* ---------------- Payment to Supplier ---------------- */
async function pageSupplierPayments() {
  const [suppliers, rows, pos] = await Promise.all([
    apiList("ops_suppliers", "name"), apiList("ops_supplier_payments"), apiList("ops_purchase_orders")
  ]);
  const supplierName = id => (suppliers.find(s => s.id === id) || {}).name || id;
  const owed = rows.filter(r => r.status === "Unpaid").reduce((a, r) => a + n2(r.amount), 0);

  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>Record invoice</h2></div>
      <div class="panel-b">
        <form id="sp-form">
          <div class="form-grid">
            <label class="field"><span class="field-label">Supplier</span>
              <select id="sp-supplier" required>${suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></label>
            <label class="field"><span class="field-label">Amount (₱)</span><input id="sp-amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></label>
            <label class="field"><span class="field-label">Payment method</span>
              <select id="sp-method"><option>Bank Transfer</option><option>Check</option><option>Cash</option><option>Online</option></select></label>
            <label class="field"><span class="field-label">Linked PO</span>
              <select id="sp-po"><option value="">None (direct purchase)</option>${pos.map(p => `<option value="${esc(p.id)}">${esc(p.po_code)} · ${esc(p.item_name)} · ${p.status}</option>`).join("")}</select></label>
            <label class="field span-2"><span class="field-label">Notes</span><input id="sp-notes" placeholder="Optional note"></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Save invoice</button><div class="msg" id="sp-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Payment history</h2><span class="meta">Outstanding: <strong>${peso(owed)}</strong> · Click Unpaid to pay (posts to the ledger)</span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${rows.length ? `
          <table>
            <thead><tr><th>Invoice</th><th>Supplier</th><th>PO</th><th class="num">Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${rows.map(r => {
              const po = pos.find(p => p.id === r.purchase_order_id);
              return `<tr>
                <td><strong>${esc(r.invoice_code)}</strong></td><td>${esc(supplierName(r.supplier_id))}</td>
                <td>${po ? esc(po.po_code) : "—"}</td><td class="num">${peso(r.amount)}</td><td>${esc(r.method)}</td>
                <td><span class="badge ${esc(r.status)} ${r.status === "Paid" ? "static" : ""}" data-sp-pay="${esc(r.status)}" data-id="${esc(r.id)}">${esc(r.status)}</span></td>
                <td>${fmtDate(r.created_at)}</td></tr>`;
            }).join("")}</tbody>
          </table>` : `<div class="empty-box"><strong>No payments yet</strong><p>Record an invoice above to see it here.</p></div>`}
      </div>
    </div>`,
    mount() {
      $("#sp-form").onsubmit = async e => {
        e.preventDefault();
        const msg = $("#sp-msg");
        try {
          await apiInsert("ops_supplier_payments", {
            invoice_code: code("INV"), supplier_id: $("#sp-supplier").value, purchase_order_id: $("#sp-po").value || null,
            amount: Number($("#sp-amount").value), method: $("#sp-method").value, status: "Unpaid",
            notes: $("#sp-notes").value.trim() || null
          });
          await render(); say($("#sp-msg"), "Invoice recorded.", true);
        } catch (err) { say(msg, friendly(err), false); }
      };
      $$("[data-sp-pay]").forEach(btn => {
        btn.onclick = async () => {
          if (btn.dataset.spPay === "Paid") return;
          const inv = rows.find(r => r.id === btn.dataset.id);
          const po = pos.find(p => p.id === inv.purchase_order_id);
          if (po && po.status !== "Received") {
            say($("#sp-msg"), `Receive ${po.po_code} first, then pay its invoice.`, false);
            return;
          }
          try {
            await apiUpdate("ops_supplier_payments", inv.id, { status: "Paid", paid_at: new Date().toISOString() });
            await postSupplierPayment(inv, !!po);
            await render(); say($("#sp-msg"), `${inv.invoice_code} paid. Journal entry posted.`, true);
          } catch (err) { alert(friendly(err)); }
        };
      });
    }
  };
}

/* ---------------- Inventory ---------------- */
async function pageInventory() {
  const rows = await apiList("ops_inventory", "item_name");
  const value = rows.reduce((a, r) => a + n2(r.quantity) * n2(r.unit_cost), 0);
  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>Add inventory item</h2></div>
      <div class="panel-b">
        <form id="inv-form">
          <div class="form-grid">
            <label class="field">Item name <input id="inv-name" required placeholder="e.g. Chicken (raw)"></label>
            <label class="field">Quantity <input id="inv-qty" type="number" min="0" step="0.01" value="0" required></label>
            <label class="field">Unit <input id="inv-unit" value="pcs" required></label>
            <label class="field">Reorder level <input id="inv-reorder" type="number" min="0" step="0.01" value="10" required></label>
            <label class="field">Unit cost (₱) <input id="inv-cost" type="number" min="0" step="0.01" value="0" required></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Add item</button><div class="msg" id="inv-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Stock</h2><span class="meta">Stock value: <strong>${peso(value)}</strong></span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${rows.length ? `
          <table>
            <thead><tr><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Reorder at</th><th class="num">Unit cost</th><th class="num">Value</th><th>Flag</th></tr></thead>
            <tbody>${rows.map(r => {
              const low = n2(r.quantity) <= n2(r.reorder_level);
              return `<tr><td>${esc(r.item_name)}</td><td class="num">${esc(r.quantity)}</td><td>${esc(r.unit)}</td>
                <td class="num">${esc(r.reorder_level)}</td><td class="num">${peso(r.unit_cost)}</td>
                <td class="num">${peso(n2(r.quantity) * n2(r.unit_cost))}</td>
                <td>${low ? `<span class="badge Reorder static">Reorder</span>` : `<span class="badge ok">OK</span>`}</td></tr>`;
            }).join("")}</tbody>
          </table>` : `<p class="empty">No inventory items.</p>`}
      </div>
    </div>`,
    mount() {
      $("#inv-form").onsubmit = async e => {
        e.preventDefault();
        try {
          await apiInsert("ops_inventory", {
            item_name: $("#inv-name").value.trim(), quantity: Number($("#inv-qty").value),
            unit: $("#inv-unit").value.trim() || "pcs", reorder_level: Number($("#inv-reorder").value),
            unit_cost: Number($("#inv-cost").value), updated_at: new Date().toISOString()
          });
          await render(); say($("#inv-msg"), "Item added.", true);
        } catch (err) { say($("#inv-msg"), friendly(err), false); }
      };
    }
  };
}

/* ---------------- Sales from Customer ---------------- */
async function pageSales() {
  const [menu, rows] = await Promise.all([apiList("ops_menu_items", "name"), apiList("ops_sales")]);
  const itemName = id => (menu.find(m => m.id === id) || {}).name || id;
  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>New sale</h2></div>
      <div class="panel-b">
        <form id="sale-form">
          <div class="form-grid">
            <label class="field">Menu item
              <select id="sale-item" required>${menu.map(m => `<option value="${esc(m.id)}">${esc(m.name)} — ${peso(m.unit_price)}</option>`).join("")}</select></label>
            <label class="field">Quantity <input id="sale-qty" type="number" min="1" step="1" value="1" required></label>
            <label class="field">Unit price (₱, VAT-inclusive) <input id="sale-price" type="number" min="0" step="0.01" required></label>
            <label class="field">Order type <select id="sale-type"><option>Dine-in</option><option>Take-out</option><option>Delivery</option></select></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Record sale</button><div class="msg" id="sale-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Sales</h2><span class="meta">Latest 20 records</span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${rows.length ? `
          <table>
            <thead><tr><th>Code</th><th>Item</th><th class="num">Qty</th><th class="num">Total</th><th>Type</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${rows.slice(0, 20).map(r => `<tr>
              <td><strong>${esc(r.sale_code)}</strong></td><td>${esc(itemName(r.menu_item_id))}</td><td class="num">${esc(r.quantity)}</td>
              <td class="num">${peso(r.total ?? r.quantity * r.unit_price)}</td><td>${esc(r.order_type)}</td>
              <td><span class="badge ${esc(r.status)} static">${esc(r.status)}</span></td><td>${fmtDate(r.created_at)}</td></tr>`).join("")}
            </tbody>
          </table>` : `<p class="empty">No sales yet.</p>`}
      </div>
    </div>`,
    mount() {
      const sel = $("#sale-item"), price = $("#sale-price");
      const sync = () => { const m = menu.find(x => x.id === sel.value); if (m) price.value = m.unit_price; };
      sel.onchange = sync; sync();
      $("#sale-form").onsubmit = async e => {
        e.preventDefault();
        try {
          await apiInsert("ops_sales", {
            sale_code: code("SO"), menu_item_id: sel.value, quantity: Number($("#sale-qty").value),
            unit_price: Number(price.value), order_type: $("#sale-type").value, status: "Open"
          });
          await render(); say($("#sale-msg"), "Sale recorded. Collect payment on the Payment from Customer page.", true);
        } catch (err) { say($("#sale-msg"), friendly(err), false); }
      };
    }
  };
}

/* ---------------- Payment from Customer ---------------- */
async function pageCustomerPayments() {
  const [sales, rows] = await Promise.all([apiList("ops_sales"), apiList("ops_customer_payments")]);
  const openSales = sales.filter(s => s.status === "Open");
  const stotal = s => n2(s.total) || n2(s.quantity) * n2(s.unit_price);
  const collected = rows.filter(r => r.status === "Completed").reduce((a, r) => a + n2(r.amount), 0);
  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>Record customer payment</h2></div>
      <div class="panel-b">
        <form id="cp-form">
          <div class="form-grid">
            <label class="field">Open sale
              <select id="cp-sale" required>${openSales.length
                ? openSales.map(s => `<option value="${esc(s.id)}">${esc(s.sale_code)} — ${peso(stotal(s))}</option>`).join("")
                : `<option value="">No open sales</option>`}</select></label>
            <label class="field">Amount (₱) <input id="cp-amount" type="number" min="0.01" step="0.01" required></label>
            <label class="field">Method <select id="cp-method"><option>Cash</option><option>Card</option><option>QR</option></select></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit" ${openSales.length ? "" : "disabled"}>Save payment</button><div class="msg" id="cp-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Customer payments</h2><span class="meta">Latest 20 · Collected to date: <strong>${peso(collected)}</strong></span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${rows.length ? `
          <table>
            <thead><tr><th>Code</th><th>Sale</th><th class="num">Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${rows.slice(0, 20).map(r => `<tr>
              <td><strong>${esc(r.payment_code)}</strong></td>
              <td>${esc((sales.find(s => s.id === r.sale_id) || {}).sale_code || String(r.sale_id).slice(0, 8))}</td>
              <td class="num">${peso(r.amount)}</td><td>${esc(r.method)}</td>
              <td><span class="badge ${esc(r.status)} static">${esc(r.status)}</span></td><td>${fmtDate(r.created_at)}</td></tr>`).join("")}
            </tbody>
          </table>` : `<p class="empty">No customer payments yet.</p>`}
      </div>
    </div>`,
    mount() {
      const saleSel = $("#cp-sale");
      const fill = () => { const s = sales.find(x => x.id === saleSel.value); if (s) $("#cp-amount").value = stotal(s); };
      saleSel.onchange = fill; fill();
      $("#cp-form").onsubmit = async e => {
        e.preventDefault();
        const msg = $("#cp-msg");
        try {
          const sale = sales.find(s => s.id === saleSel.value);
          if (!sale) throw new Error("Choose an open sale.");
          const amount = Number($("#cp-amount").value);
          if (Math.abs(amount - stotal(sale)) > 0.005) throw new Error(`Amount must equal the sale total (${peso(stotal(sale))}).`);
          await apiInsert("ops_customer_payments", {
            payment_code: code("PAY"), sale_id: sale.id, amount, method: $("#cp-method").value, status: "Completed"
          });
          await apiUpdate("ops_sales", sale.id, { status: "Paid" });
          await postSalePayment(sale, amount);
          await render(); say($("#cp-msg"), "Payment recorded, sale marked Paid, and revenue posted to the ledger.", true);
        } catch (err) { say(msg, friendly(err), false); }
      };
    }
  };
}

/* ---------------- Employees ---------------- */
async function pageEmployees() {
  const rows = await apiList("ops_employees", "emp_code", true);
  const active = rows.filter(r => r.status === "Active");
  const payroll = active.reduce((a, r) => a + n2(r.daily_rate), 0);
  const nextCode = "EMP-" + String(rows.length + 1).padStart(3, "0");
  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>Add employee</h2></div>
      <div class="panel-b">
        <form id="emp-form">
          <div class="form-grid">
            <label class="field">Employee code <input id="emp-code" required value="${nextCode}"></label>
            <label class="field">Full name <input id="emp-name" required placeholder="e.g. Maria Santos"></label>
            <label class="field">Position <input id="emp-pos" required placeholder="e.g. Cashier"></label>
            <label class="field">Department
              <select id="emp-dept"><option>Counter</option><option>Kitchen</option><option>Delivery</option><option>Management</option><option>Back Office</option></select></label>
            <label class="field">Daily rate (₱) <input id="emp-rate" type="number" min="0" step="0.01" required value="645"></label>
            <label class="field">Contact <input id="emp-contact" placeholder="09xx-xxx-xxxx"></label>
            <label class="field">Hire date <input id="emp-hire" type="date" required value="${todayISO()}"></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Add employee</button><div class="msg" id="emp-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Employee master file</h2><span class="meta">${active.length} active · combined daily rate ${peso(payroll)} · click status to activate / deactivate</span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${rows.length ? `
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Position</th><th>Department</th><th class="num">Daily rate</th><th>Hired</th><th>Status</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
              <td><strong>${esc(r.emp_code)}</strong></td><td>${esc(r.full_name)}</td><td>${esc(r.position)}</td><td>${esc(r.department)}</td>
              <td class="num">${peso(r.daily_rate)}</td><td>${fmtDay(r.hire_date)}</td>
              <td><span class="badge ${esc(r.status)}" data-emp-toggle="${esc(r.status)}" data-id="${esc(r.id)}">${esc(r.status)}</span></td></tr>`).join("")}
            </tbody>
          </table>` : `<p class="empty">No employees yet.</p>`}
      </div>
    </div>`,
    mount() {
      $("#emp-form").onsubmit = async e => {
        e.preventDefault();
        try {
          await apiInsert("ops_employees", {
            emp_code: $("#emp-code").value.trim(), full_name: $("#emp-name").value.trim(), position: $("#emp-pos").value.trim(),
            department: $("#emp-dept").value, daily_rate: Number($("#emp-rate").value),
            contact: $("#emp-contact").value.trim() || null, hire_date: $("#emp-hire").value, status: "Active"
          });
          await render(); say($("#emp-msg"), "Employee added.", true);
        } catch (err) { say($("#emp-msg"), friendly(err), false); }
      };
      $$("[data-emp-toggle]").forEach(b => {
        b.onclick = async () => {
          try {
            await apiUpdate("ops_employees", b.dataset.id, { status: b.dataset.empToggle === "Active" ? "Inactive" : "Active" });
            await render();
          } catch (err) { alert(friendly(err)); }
        };
      });
    }
  };
}

/* ---------------- Attendance ---------------- */
async function pageAttendance() {
  const [emps, atts] = await Promise.all([apiList("ops_employees", "emp_code", true), apiList("ops_attendance", "work_date")]);
  const active = emps.filter(e => e.status === "Active");
  const name = id => (emps.find(e => e.id === id) || {}).full_name || id;
  const today = todayISO();
  const todays = atts.filter(a => a.work_date === today);
  const present = todays.filter(a => a.status === "Present" || a.status === "Late").length;
  const late = todays.filter(a => a.status === "Late").length;
  const week = atts.filter(a => a.work_date >= iso(addDays(new Date(), -6)) && a.work_date <= today);
  const weekHours = round2(week.reduce((a, x) => a + n2(x.hours_worked), 0));
  const weekOT = round2(week.reduce((a, x) => a + n2(x.ot_hours), 0));
  const recent = atts.slice(0, 25);

  return {
    html: banner() + `
    <div class="grid">
      ${statTile("Present today", `${present} / ${active.length}`, present ? "ok" : "")}
      ${statTile("Late today", late, late ? "warn" : "")}
      ${statTile("Hours worked (7 days)", weekHours)}
      ${statTile("Overtime hours (7 days)", weekOT, weekOT ? "warn" : "")}
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Log attendance</h2><span class="meta">Hours = time out − time in − 1 hour break · over 8 hours counts as overtime</span></div>
      <div class="panel-b">
        <form id="att-form">
          <div class="form-grid">
            <label class="field">Employee <select id="att-emp" required>${active.map(e => `<option value="${esc(e.id)}">${esc(e.emp_code)} · ${esc(e.full_name)}</option>`).join("")}</select></label>
            <label class="field">Date <input id="att-date" type="date" required value="${today}"></label>
            <label class="field">Status <select id="att-status"><option>Present</option><option>Late</option><option>Absent</option><option>Leave</option></select></label>
            <label class="field">Time in <input id="att-in" type="time" value="08:00"></label>
            <label class="field">Time out <input id="att-out" type="time" value="17:00"></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Save attendance</button><div class="msg" id="att-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Daily time record</h2><span class="meta">Latest 25 entries</span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${recent.length ? `
          <table>
            <thead><tr><th>Date</th><th>Employee</th><th>Time in</th><th>Time out</th><th class="num">Hours</th><th class="num">OT</th><th>Status</th></tr></thead>
            <tbody>${recent.map(a => `<tr>
              <td>${fmtDay(a.work_date)}</td><td>${esc(name(a.employee_id))}</td><td>${fmtTime(a.time_in)}</td><td>${fmtTime(a.time_out)}</td>
              <td class="num">${esc(a.hours_worked)}</td><td class="num">${esc(a.ot_hours)}</td>
              <td><span class="badge ${esc(a.status)} static">${esc(a.status)}</span></td></tr>`).join("")}
            </tbody>
          </table>` : `<p class="empty">No attendance records yet.</p>`}
      </div>
    </div>`,
    mount() {
      const st = $("#att-status");
      st.onchange = () => {
        const off = st.value === "Absent" || st.value === "Leave";
        $("#att-in").disabled = off; $("#att-out").disabled = off;
      };
      $("#att-form").onsubmit = async e => {
        e.preventDefault();
        const off = st.value === "Absent" || st.value === "Leave";
        const tin = off ? null : $("#att-in").value, tout = off ? null : $("#att-out").value;
        const h = off ? { hours: 0, ot: 0 } : attendanceHours(tin, tout);
        try {
          if (!off && (!tin || !tout)) throw new Error("Enter both time in and time out.");
          await apiInsert("ops_attendance", {
            employee_id: $("#att-emp").value, work_date: $("#att-date").value, time_in: tin, time_out: tout,
            hours_worked: h.hours, ot_hours: h.ot, status: st.value
          });
          await render(); say($("#att-msg"), "Attendance saved.", true);
        } catch (err) { say($("#att-msg"), /already exists/.test(friendly(err)) ? "Attendance for that employee and date already exists." : friendly(err), false); }
      };
    }
  };
}

/* ---------------- Payroll ---------------- */
let PAY_START = iso(addDays(new Date(), -14));
let PAY_END = iso(addDays(new Date(), -1));
let PAY_VIEW = null;

async function pagePayroll() {
  const [emps, rows] = await Promise.all([apiList("ops_employees", "emp_code", true), apiList("ops_payroll", "period_end")]);
  const ename = id => (emps.find(e => e.id === id) || {}).full_name || id;
  const draft = rows.filter(r => r.status === "Draft");
  const paid = rows.filter(r => r.status === "Paid");
  const sum = (arr, k) => round2(arr.reduce((a, r) => a + n2(r[k]), 0));
  const view = rows.find(r => r.id === PAY_VIEW);
  const emp = view ? emps.find(e => e.id === view.employee_id) : null;

  const payslip = view ? `
    <div class="panel payslip">
      <div class="panel-h"><h2>Payslip · ${esc(view.payslip_code)}</h2>
        <div><button class="btn ghost sm" type="button" id="ps-print">Print</button> <button class="btn ghost sm" type="button" id="ps-close">Close</button></div></div>
      <div class="panel-b">
        <div class="ps-head">
          <div><span class="lbl">Employee</span><strong>${esc(ename(view.employee_id))}</strong><small>${esc(emp ? emp.position : "")} · ${esc(emp ? emp.emp_code : "")}</small></div>
          <div><span class="lbl">Pay period</span><strong>${fmtDay(view.period_start)} – ${fmtDay(view.period_end)}</strong><small>${esc(view.days_present)} days · ${esc(view.ot_hours)} OT hrs</small></div>
          <div><span class="lbl">Status</span><span class="badge ${esc(view.status)} static">${esc(view.status)}</span></div>
        </div>
        <div class="ps-cols">
          <table>
            <thead><tr><th colspan="2">Earnings</th></tr></thead>
            <tbody>
              <tr><td>Basic pay (${esc(view.days_present)} days × ${peso(emp ? emp.daily_rate : 0)})</td><td class="num">${peso(view.basic_pay)}</td></tr>
              <tr><td>Overtime (${esc(view.ot_hours)} hrs × 125%)</td><td class="num">${peso(view.ot_pay)}</td></tr>
              <tr class="tot-row"><td>Gross pay</td><td class="num">${peso(view.gross_pay)}</td></tr>
            </tbody>
          </table>
          <table>
            <thead><tr><th colspan="2">Deductions</th></tr></thead>
            <tbody>
              <tr><td>SSS</td><td class="num">${peso(view.sss)}</td></tr>
              <tr><td>PhilHealth</td><td class="num">${peso(view.philhealth)}</td></tr>
              <tr><td>Pag-IBIG</td><td class="num">${peso(view.pagibig)}</td></tr>
              <tr><td>Withholding tax</td><td class="num">${peso(view.tax)}</td></tr>
              <tr class="tot-row"><td>Net pay</td><td class="num">${peso(view.net_pay)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>` : "";

  return {
    html: banner() + `
    <div class="grid">
      ${statTile("Payslips awaiting payment", draft.length, draft.length ? "warn" : "")}
      ${statTile("Net pay awaiting payment", peso(sum(draft, "net_pay")), draft.length ? "warn" : "")}
      ${statTile("Gross salaries paid", peso(sum(paid, "gross_pay")), "ok")}
      ${statTile("Contributions and tax withheld", peso(sum(paid, "gross_pay") - sum(paid, "net_pay")))}
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Generate payroll</h2><span class="meta">Reads attendance for the period and computes pay for every active employee</span></div>
      <div class="panel-b">
        <form id="pay-form">
          <div class="form-grid cols-3">
            <label class="field">Period start <input id="pay-start" type="date" required value="${PAY_START}"></label>
            <label class="field">Period end <input id="pay-end" type="date" required value="${PAY_END}"></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Generate payroll</button><div class="msg" id="pay-msg"></div></div>
          <p class="fine">Simplified for academic purposes: SSS 4.5% (max ₱1,350), PhilHealth 2.5% (max ₱2,500), Pag-IBIG 2% (max ₱200), 15% withholding tax on taxable pay above ₱20,833 per month (prorated), overtime at 125% of the hourly rate.</p>
        </form>
      </div>
    </div>
    ${payslip}
    <div class="panel">
      <div class="panel-h"><h2>Payslips</h2><span class="meta">Click a code to view the payslip · click Draft to pay (posts to the ledger)</span></div>
      <div class="panel-b" style="overflow-x:auto">
        ${rows.length ? `
          <table>
            <thead><tr><th>Payslip</th><th>Employee</th><th>Period</th><th class="num">Days</th><th class="num">OT hrs</th><th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th><th>Status</th></tr></thead>
            <tbody>${rows.map(r => `<tr>
              <td><a href="#/payroll" class="lnk" data-ps="${esc(r.id)}"><strong>${esc(r.payslip_code)}</strong></a></td>
              <td>${esc(ename(r.employee_id))}</td><td>${fmtDay(r.period_start)} – ${fmtDay(r.period_end)}</td>
              <td class="num">${esc(r.days_present)}</td><td class="num">${esc(r.ot_hours)}</td><td class="num">${peso(r.gross_pay)}</td>
              <td class="num">${peso(n2(r.gross_pay) - n2(r.net_pay))}</td><td class="num"><strong>${peso(r.net_pay)}</strong></td>
              <td><span class="badge ${esc(r.status)} ${r.status === "Paid" ? "static" : ""}" data-pay="${esc(r.status)}" data-id="${esc(r.id)}">${esc(r.status)}</span></td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="empty-box"><strong>No payslips yet</strong><p>Choose a period above and generate payroll.</p></div>`}
      </div>
    </div>`,
    mount() {
      $("#pay-form").onsubmit = async e => {
        e.preventDefault();
        PAY_START = $("#pay-start").value; PAY_END = $("#pay-end").value;
        try {
          if (PAY_END < PAY_START) throw new Error("Period end must be on or after period start.");
          const periodDays = Math.round((new Date(PAY_END) - new Date(PAY_START)) / 86400000) + 1;
          const atts = await apiList("ops_attendance", "work_date");
          let made = 0, skipped = 0;
          for (const emp of emps.filter(x => x.status === "Active")) {
            const mine = atts.filter(a => a.employee_id === emp.id && a.work_date >= PAY_START && a.work_date <= PAY_END);
            if (!mine.length) { skipped++; continue; }
            if (rows.some(r => r.employee_id === emp.id && r.period_start === PAY_START && r.period_end === PAY_END)) { skipped++; continue; }
            const c = computePay(emp, mine, periodDays);
            await apiInsert("ops_payroll", {
              payslip_code: code("PS"), employee_id: emp.id, period_start: PAY_START, period_end: PAY_END,
              days_present: c.days, ot_hours: c.ot, basic_pay: c.basic, ot_pay: c.otPay, gross_pay: c.gross,
              sss: c.sss, philhealth: c.philhealth, pagibig: c.pagibig, tax: c.tax, net_pay: c.net, status: "Draft"
            });
            made++;
          }
          await render();
          say($("#pay-msg"), `${made} payslip${made === 1 ? "" : "s"} generated${skipped ? `, ${skipped} skipped (no attendance or already generated)` : ""}.`, made > 0);
        } catch (err) { say($("#pay-msg"), friendly(err), false); }
      };
      $$("[data-ps]").forEach(a => { a.onclick = ev => { ev.preventDefault(); PAY_VIEW = a.dataset.ps; render(); }; });
      const close = $("#ps-close"); if (close) close.onclick = () => { PAY_VIEW = null; render(); };
      const pr = $("#ps-print"); if (pr) pr.onclick = () => window.print();
      $$("[data-pay]").forEach(b => {
        b.onclick = async () => {
          if (b.dataset.pay === "Paid") return;
          const p = rows.find(r => r.id === b.dataset.id);
          try {
            await apiUpdate("ops_payroll", p.id, { status: "Paid", paid_at: new Date().toISOString() });
            await postPayroll(p, ename(p.employee_id));
            await render(); say($("#pay-msg"), `${p.payslip_code} paid. Salaries expense posted to the ledger.`, true);
          } catch (err) { alert(friendly(err)); }
        };
      });
    }
  };
}

/* ---------------- Chart of Accounts ---------------- */
async function pageAccounts() {
  const L = await loadLedger();
  const list = Object.values(L.bal).sort((a, b) => a.code.localeCompare(b.code));
  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>Add account</h2></div>
      <div class="panel-b">
        <form id="acc-form">
          <div class="form-grid cols-3">
            <label class="field">Account code <input id="acc-code" required pattern="[0-9]{4}" placeholder="e.g. 5400"></label>
            <label class="field">Account name <input id="acc-name" required placeholder="e.g. Repairs and Maintenance"></label>
            <label class="field">Type <select id="acc-type"><option>Asset</option><option>Liability</option><option>Equity</option><option>Revenue</option><option selected>Expense</option></select></label>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Add account</button><div class="msg" id="acc-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Chart of accounts</h2><span class="meta">Assets and expenses increase with debits · liabilities, equity and revenue increase with credits</span></div>
      <div class="panel-b" style="overflow-x:auto">
        <table>
          <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Normal balance</th><th class="num">Balance</th></tr></thead>
          <tbody>${list.map(a => `<tr>
            <td><strong>${esc(a.code)}</strong></td><td>${esc(a.name)}</td>
            <td><span class="badge type ${esc(a.type)} static">${esc(a.type)}</span></td>
            <td>${a.type === "Asset" || a.type === "Expense" ? "Debit" : "Credit"}</td><td class="num">${peso(a.net)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`,
    mount() {
      $("#acc-form").onsubmit = async e => {
        e.preventDefault();
        try {
          await apiInsert("ops_accounts", { code: $("#acc-code").value.trim(), name: $("#acc-name").value.trim(), type: $("#acc-type").value, active: true });
          await render(); say($("#acc-msg"), "Account added.", true);
        } catch (err) { say($("#acc-msg"), friendly(err), false); }
      };
    }
  };
}

/* ---------------- Journal Entries ---------------- */
let JE_FILTER = "ALL";

async function pageJournal() {
  const L = await loadLedger();
  const accts = Object.values(L.bal).sort((a, b) => a.code.localeCompare(b.code));
  const opts = `<option value="">Select account</option>` + accts.map(a => `<option value="${esc(a.code)}">${esc(a.code)} · ${esc(a.name)}</option>`).join("");
  const shown = L.entries.filter(e => JE_FILTER === "ALL" || e.source === JE_FILTER).slice(0, 8);
  const lineRow = () => `<tr class="je-line">
      <td><select class="jl-acct">${opts}</select></td>
      <td><input class="jl-dr" type="number" min="0" step="0.01" placeholder="0.00"></td>
      <td><input class="jl-cr" type="number" min="0" step="0.01" placeholder="0.00"></td></tr>`;
  const sources = ["ALL", "SALE", "PURCHASE", "SUPPLIER_PAYMENT", "PAYROLL", "MANUAL", "OPENING"];

  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>Manual journal entry</h2><span class="meta">For items without a module, such as utilities or rent. Debits must equal credits.</span></div>
      <div class="panel-b">
        <form id="je-form">
          <div class="form-grid">
            <label class="field">Date <input id="je-date" type="date" required value="${todayISO()}"></label>
            <label class="field">Memo <input id="je-memo" required placeholder="e.g. Electricity bill"></label>
          </div>
          <table class="je-table">
            <thead><tr><th>Account</th><th>Debit (₱)</th><th>Credit (₱)</th></tr></thead>
            <tbody id="je-lines">${lineRow()}${lineRow()}</tbody>
            <tfoot><tr class="tot-row"><td>Totals <span id="je-diff" class="je-diff"></span></td><td class="num" id="je-dr">₱0.00</td><td class="num" id="je-cr">₱0.00</td></tr></tfoot>
          </table>
          <div class="form-actions"><button class="btn ghost" type="button" id="je-add">+ Add line</button><button class="btn" type="submit">Post entry</button><div class="msg" id="je-msg"></div></div>
        </form>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Journal</h2><span class="meta">Latest 8 entries</span>
        <label class="inline-filter">Source
          <select id="je-filter">${sources.map(s => `<option value="${s}" ${s === JE_FILTER ? "selected" : ""}>${s === "ALL" ? "All sources" : s.replace("_", " ")}</option>`).join("")}</select></label></div>
      <div class="panel-b">
        ${shown.length ? shown.map(e => {
          const ls = L.lines.filter(l => l.entry_id === e.id).sort((a, b) => n2(b.debit) - n2(a.debit));
          return `<div class="je-block">
            <div class="je-head"><div><strong>${esc(e.je_code)}</strong> · ${fmtDay(e.entry_date)}<div class="je-memo">${esc(e.memo)}</div></div>
              <span class="badge src ${esc(e.source)} static">${esc(e.source.replace("_", " "))}</span></div>
            <table><tbody>${ls.map(l => `<tr><td class="${n2(l.credit) ? "indent" : ""}">${esc(l.account_code)} · ${esc((L.bal[l.account_code] || {}).name || "")}</td>
              <td class="num">${n2(l.debit) ? peso(l.debit) : ""}</td><td class="num">${n2(l.credit) ? peso(l.credit) : ""}</td></tr>`).join("")}</tbody></table>
          </div>`;
        }).join("") : `<p class="empty">No journal entries for this filter.</p>`}
      </div>
    </div>`,
    mount() {
      const recalc = () => {
        let dr = 0, cr = 0;
        $$(".jl-dr").forEach(i => dr += n2(i.value)); $$(".jl-cr").forEach(i => cr += n2(i.value));
        $("#je-dr").textContent = peso(dr); $("#je-cr").textContent = peso(cr);
        const d = round2(dr - cr);
        const el = $("#je-diff");
        el.textContent = dr || cr ? (d === 0 ? "· balanced" : `· difference ${peso(Math.abs(d))}`) : "";
        el.className = "je-diff " + (d === 0 && (dr || cr) ? "okc" : "badc");
      };
      $("#je-form").addEventListener("input", recalc);
      $("#je-add").onclick = () => { $("#je-lines").insertAdjacentHTML("beforeend", lineRow()); };
      $("#je-filter").onchange = ev => { JE_FILTER = ev.target.value; render(); };
      $("#je-form").onsubmit = async e => {
        e.preventDefault();
        const lines = $$(".je-line").map(tr => ({
          acct: $(".jl-acct", tr).value, debit: n2($(".jl-dr", tr).value), credit: n2($(".jl-cr", tr).value)
        })).filter(l => l.acct && (l.debit || l.credit));
        try {
          if (lines.length < 2) throw new Error("Enter at least two lines.");
          if (lines.some(l => l.debit && l.credit)) throw new Error("A line cannot have both a debit and a credit.");
          await postJE({ source: "MANUAL", ref: null, memo: $("#je-memo").value.trim(), date: $("#je-date").value, lines });
          await render(); say($("#je-msg"), "Journal entry posted.", true);
        } catch (err) { say($("#je-msg"), friendly(err), false); }
      };
    }
  };
}

/* ---------------- Ledger & Trial Balance ---------------- */
let LEDGER_ACCT = "1000";

async function pageLedger() {
  const L = await loadLedger();
  const list = Object.values(L.bal).sort((a, b) => a.code.localeCompare(b.code));
  const totDr = round2(list.reduce((a, b) => a + b.debit, 0));
  const totCr = round2(list.reduce((a, b) => a + b.credit, 0));
  const ok = Math.abs(totDr - totCr) < 0.01;
  if (!L.bal[LEDGER_ACCT]) LEDGER_ACCT = list[0] ? list[0].code : "";
  const acct = L.bal[LEDGER_ACCT];
  const debitNormal = acct && (acct.type === "Asset" || acct.type === "Expense");
  const rows = L.lines.filter(l => l.account_code === LEDGER_ACCT)
    .map(l => ({ l, e: L.entries.find(x => x.id === l.entry_id) || {} }))
    .sort((a, b) => (a.e.entry_date || "").localeCompare(b.e.entry_date || "") || (a.e.created_at || "").localeCompare(b.e.created_at || ""));
  let run = 0;
  const withRun = rows.map(r => { run = round2(run + (debitNormal ? n2(r.l.debit) - n2(r.l.credit) : n2(r.l.credit) - n2(r.l.debit))); return { ...r, run }; });

  return {
    html: banner() + `
    <div class="panel">
      <div class="panel-h"><h2>Trial balance</h2><span class="badge ${ok ? "ok" : "Reorder"} static">${ok ? "Balanced" : "Out of balance"}</span></div>
      <div class="panel-b" style="overflow-x:auto">
        <table>
          <thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="num">Total debits</th><th class="num">Total credits</th><th class="num">Balance</th></tr></thead>
          <tbody>${list.map(a => `<tr><td><strong>${esc(a.code)}</strong></td><td>${esc(a.name)}</td><td>${esc(a.type)}</td>
            <td class="num">${peso(a.debit)}</td><td class="num">${peso(a.credit)}</td><td class="num">${peso(a.net)}</td></tr>`).join("")}</tbody>
          <tfoot><tr class="tot-row"><td colspan="3">Totals</td><td class="num">${peso(totDr)}</td><td class="num">${peso(totCr)}</td><td></td></tr></tfoot>
        </table>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>General ledger</h2><span class="meta">Latest 20 postings</span>
        <label class="inline-filter">Account <select id="lg-acct">${list.map(a => `<option value="${esc(a.code)}" ${a.code === LEDGER_ACCT ? "selected" : ""}>${esc(a.code)} · ${esc(a.name)}</option>`).join("")}</select></label></div>
      <div class="panel-b" style="overflow-x:auto">
        ${withRun.length ? `
          <table>
            <thead><tr><th>Date</th><th>Entry</th><th>Memo</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Running balance</th></tr></thead>
            <tbody>${withRun.slice(-20).map(({ l, e, run }) => `<tr><td>${fmtDay(e.entry_date)}</td><td>${esc(e.je_code || "")}</td><td>${esc(e.memo || "")}</td>
              <td class="num">${n2(l.debit) ? peso(l.debit) : ""}</td><td class="num">${n2(l.credit) ? peso(l.credit) : ""}</td><td class="num"><strong>${peso(run)}</strong></td></tr>`).join("")}</tbody>
          </table>` : `<p class="empty">No activity in this account yet.</p>`}
      </div>
    </div>`,
    mount() { $("#lg-acct").onchange = ev => { LEDGER_ACCT = ev.target.value; render(); }; }
  };
}

/* ---------------- Financial Statements ---------------- */
async function pageStatements() {
  const L = await loadLedger();
  const S = statements(L);
  const line = a => `<tr><td>${esc(a.code)} · ${esc(a.name)}</td><td class="num">${peso(a.net)}</td></tr>`;
  const section = (title, arr) => arr.length ? `<tr class="sec"><td colspan="2">${title}</td></tr>${arr.map(line).join("")}` : "";
  const margin = S.totalRevenue ? (S.netIncome / S.totalRevenue * 100).toFixed(1) : "0.0";
  return {
    html: banner() + `
    <div class="grid">
      ${statTile("Net sales", peso(S.totalRevenue), "ok")}
      ${statTile("Gross profit", peso(S.grossProfit))}
      ${statTile("Net income", peso(S.netIncome), S.netIncome >= 0 ? "ok" : "bad")}
      ${statTile("Net margin", margin + "%")}
    </div>
    <div class="split">
      <div class="panel">
        <div class="panel-h"><h2>Income statement</h2><span class="meta">Cumulative to ${fmtDay(todayISO())}</span></div>
        <div class="panel-b">
          <table class="fs">
            <tbody>
              ${section("Revenue", S.revenue)}
              <tr class="tot-row"><td>Total revenue</td><td class="num">${peso(S.totalRevenue)}</td></tr>
              ${section("Cost of goods sold", S.cogs)}
              <tr class="tot-row"><td>Gross profit</td><td class="num">${peso(S.grossProfit)}</td></tr>
              ${section("Operating expenses", S.opex)}
              <tr class="tot-row"><td>Total operating expenses</td><td class="num">${peso(S.totalOpex)}</td></tr>
              <tr class="grand ${S.netIncome >= 0 ? "pos" : "neg"}"><td>Net income</td><td class="num">${peso(S.netIncome)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Balance sheet</h2><span class="badge ${S.balanced ? "ok" : "Reorder"} static">${S.balanced ? "Assets = Liabilities + Equity" : "Out of balance"}</span></div>
        <div class="panel-b">
          <table class="fs">
            <tbody>
              ${section("Assets", S.assets)}
              <tr class="tot-row"><td>Total assets</td><td class="num">${peso(S.totalAssets)}</td></tr>
              ${section("Liabilities", S.liabilities)}
              <tr class="tot-row"><td>Total liabilities</td><td class="num">${peso(S.totalLiab)}</td></tr>
              ${section("Equity", S.equity)}
              <tr><td>Current period earnings</td><td class="num">${peso(S.netIncome)}</td></tr>
              <tr class="tot-row"><td>Total equity</td><td class="num">${peso(S.totalEquity)}</td></tr>
              <tr class="grand"><td>Liabilities + equity</td><td class="num">${peso(round2(S.totalLiab + S.totalEquity))}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <p class="fine">Cost of goods sold is estimated at ${Math.round(COGS_RATE * 100)}% of net sales (standard food cost). Prices are VAT-inclusive and output VAT of ${Math.round(VAT_RATE * 100)}% is recorded as a liability.</p>`
  };
}

/* ---------------- Company ---------------- */
async function pageCompany() {
  let co = DB.ops_company_info[0];
  try { const rows = await apiList("ops_company_info", "updated_at"); if (rows[0]) co = rows[0]; } catch (_) {}
  return {
    html: `
    <div class="company-hero">
      <span class="eyebrow">Company profile</span>
      <h2>${esc(co.company_name)}</h2>
      <p class="lead">${esc(co.profile)}</p>
      <div class="company-meta">
        <div class="meta-tile"><span>Nature of business</span><p>${esc(co.nature)}</p></div>
        <div class="meta-tile"><span>Products / services</span><p>${esc(co.products)}</p></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>System modules by business process cycle</h2></div>
      <div class="panel-b">
        <div class="note-grid four">
          <div class="note-card"><h3>Expenditure</h3><p>Ordering to Supplier · receiving · Payment to Supplier · Inventory</p></div>
          <div class="note-card"><h3>Revenue</h3><p>Customer website orders · Sales from Customer · Payment from Customer</p></div>
          <div class="note-card"><h3>Human resource</h3><p>Employees · Attendance · Payroll and payslips</p></div>
          <div class="note-card"><h3>Accounting</h3><p>Chart of accounts · Journal · Ledger and trial balance · Financial statements</p></div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>Platform notes</h2></div>
      <div class="panel-b">
        <div class="note-grid">
          <div class="note-card"><h3>Web platform</h3><p>Single site with a cycle-grouped sidebar and one page per operation using hash routes.</p></div>
          <div class="note-card"><h3>Cloud</h3><p>PHP and MySQL for data and sign-in · InfinityFree for static hosting and HTTPS.</p></div>
          <div class="note-card"><h3>Operating systems</h3><p>Windows 11 Pro · Windows 11 IoT (POS) · Android tablets · Ubuntu Server · embedded firmware.</p></div>
        </div>
      </div>
    </div>`
  };
}

/* =========================================================
   AUTH GATE + ROUTER
   ========================================================= */
const ROUTES = {
  "/": pageDashboard, "/ordering": pageOrdering, "/supplier-payments": pageSupplierPayments, "/inventory": pageInventory,
  "/sales": pageSales, "/customer-payments": pageCustomerPayments,
  "/employees": pageEmployees, "/attendance": pageAttendance, "/payroll": pagePayroll,
  "/accounts": pageAccounts, "/journal": pageJournal, "/ledger": pageLedger, "/statements": pageStatements,
  "/company": pageCompany
};

async function staffSession() {
  if (!sb) return true;
  try {
    const { data } = await sb.auth.getSession();
    return !!(data.session && !data.session.user.is_anonymous);
  } catch (_) { return false; }
}

function showLogin() {
  $("#app").innerHTML = `
    <div class="login-card">
      <h2>Staff sign-in</h2>
      <p>Payroll, attendance and ledger data are restricted. Sign in with your staff account to continue.</p>
      <form id="lg-form">
        <label class="field">Email <input id="lg-email" type="email" required autocomplete="username"></label>
        <label class="field">Password <input id="lg-pass" type="password" required autocomplete="current-password"></label>
        <div class="form-actions"><button class="btn" type="submit">Sign in</button><div class="msg" id="lg-msg"></div></div>
      </form>
    </div>`;
  $("#lg-form").onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $("#lg-email").value.trim(), password: $("#lg-pass").value });
    if (error) return say($("#lg-msg"), error.message, false);
    render();
  };
}

let renderSeq = 0;
async function render() {
  const my = ++renderSeq;
  const hash = (location.hash || "#/").replace(/^#/, "") || "/";
  const path = hash.split("?")[0] || "/";
  const known = Object.hasOwn(ROUTES, path);
  const key = known ? path : "/";
  const [title, meta] = TITLES[key];

  $("#page-title").textContent = title;
  $("#page-meta").textContent = meta;
  document.title = title + " · Jollibee Ops";
  $$("#nav a").forEach(a => a.classList.toggle("active", a.getAttribute("data-route") === key));

  const out = $("#signout");
  const authed = await staffSession();
  if (out) out.hidden = !sb || !authed;
  if (!authed) return showLogin();

  const app = $("#app");
  try {
    const result = await ROUTES[key]();
    if (my !== renderSeq) return;
    const page = typeof result === "string" ? { html: result } : result;
    app.innerHTML = page.html;
    if (page.mount) page.mount();
  } catch (e) {
    if (my !== renderSeq) return;
    app.innerHTML = banner() + `<p class="msg bad">${esc(friendly(e))}</p>`;
  }
}

async function boot() {
  buildNav();
  if (DEMO_MODE) await seedDemo();
  const so = $("#signout");
  if (so) so.onclick = async () => { await sb.auth.signOut(); render(); };
  addEventListener("hashchange", () => { PAY_VIEW = null; render(); });
  setInterval(() => {
    const el = $("#clock");
    if (el) el.textContent = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  }, 1000);
  const el = $("#clock");
  if (el) el.textContent = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  render();
}

boot();