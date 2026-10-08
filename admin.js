"use strict";

const $ = s => document.querySelector(s);
const state = { view: "active", realtime: null, loading: false };

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(cents) {
  const n = Number(cents) || 0;
  return "₱" + (n / 100).toLocaleString("en-PH", { minimumFractionDigits: n % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

function time(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value || "") : d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function setMsg(text, kind = "") {
  const el = $("#dash-msg");
  if (!el) return;
  el.className = "admin-msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
}

function setLoginMsg(text, kind = "") {
  const el = $("#login-msg");
  if (!el) return;
  el.className = "admin-msg" + (kind ? " " + kind : "");
  el.textContent = text || "";
}

function statusLabel(status) {
  return ({ received: "Received", preparing: "Preparing", ready: "Ready", completed: "Completed", cancelled: "Cancelled" })[status] || status;
}

function orderCard(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const closed = ["completed", "cancelled"].includes(o.status);
  const actions = closed ? "" : `
    <div class="status-actions">
      <button type="button" data-status="preparing" data-code="${esc(o.code)}" ${o.status === "preparing" ? "disabled" : ""}>Preparing</button>
      <button type="button" data-status="ready" data-code="${esc(o.code)}" ${o.status === "ready" ? "disabled" : ""}>Ready</button>
      <button type="button" data-status="completed" data-code="${esc(o.code)}">Complete</button>
      <button type="button" data-status="cancelled" data-code="${esc(o.code)}">Cancel</button>
    </div>`;
  return `<article class="order-card" data-code="${esc(o.code)}">
    <div class="order-top">
      <div><div class="order-code">${esc(o.code)}</div><div class="order-time">${esc(time(o.createdAt))}</div></div>
      <span class="status status-${esc(o.status)}">${esc(statusLabel(o.status))}</span>
    </div>
    <div class="order-meta">
      <div><strong>${esc(o.mode === "delivery" ? "Delivery" : "Pickup")}</strong>${o.storeName ? ` · ${esc(o.storeName)}` : ""}</div>
      ${o.name ? `<div>Customer: <strong>${esc(o.name)}</strong>${o.phone ? ` · ${esc(o.phone)}` : ""}</div>` : ""}
      ${o.address ? `<div>Address: <strong>${esc(o.address)}</strong></div>` : ""}
      ${o.voucher ? `<div>Voucher: <strong>${esc(o.voucher)}</strong></div>` : ""}
    </div>
    <ul class="order-items">${items.map(i => `<li><span>${esc(i.qty)} × ${esc(i.name)}<small>${esc(i.variantLabel || "")}${i.note ? ` · ${esc(i.note)}` : ""}</small></span></li>`).join("")}</ul>
    <div class="order-total"><span>Total</span><strong>${money(o.total)}</strong></div>
    ${actions}
  </article>`;
}

function renderOrders(orders) {
  const root = $("#orders");
  if (!root) return;
  const list = Array.isArray(orders) ? orders : [];
  root.innerHTML = list.length ? list.map(orderCard).join("") : `<div class="empty-state">No ${state.view === "active" ? "active" : "recent closed"} orders are visible to this staff account.</div>`;
}

async function refresh(message = "") {
  if (state.loading) return;
  state.loading = true;
  if (message) setMsg(message);
  try {
    const orders = await API.adminListOrders(state.view);
    renderOrders(orders);
    if (message) setMsg("Orders refreshed.", "ok");
  } catch (e) {
    setMsg(e.message, "bad");
  } finally {
    state.loading = false;
  }
}

async function changeStatus(code, status, button) {
  if (!code || !status || button.disabled) return;
  button.disabled = true;
  setMsg(`Updating ${code}…`);
  try {
    await API.adminSetOrderStatus(code, status);
    await refresh();
    setMsg(`${code} is now ${statusLabel(status)}.`, "ok");
  } catch (e) {
    button.disabled = false;
    setMsg(e.message, "bad");
  }
}

function mountRealtime() {
  if (state.realtime) return;
  state.realtime = API.subscribeToOrders(() => {
    refresh();
  });
}

async function showDashboard(session) {
  $("#login-panel").hidden = true;
  $("#dashboard").hidden = false;
  $("#staff-email-label").textContent = session?.user?.email || "Staff account";
  mountRealtime();
  await refresh();
}

async function init() {
  try {
    const session = await API.getSession();
    if (session) await showDashboard(session);
  } catch (e) {
    setLoginMsg(e.message, "bad");
  }
}

document.addEventListener("submit", async e => {
  const form = e.target.closest("#login-form");
  if (!form) return;
  e.preventDefault();
  const btn = $("#login-btn");
  btn.disabled = true;
  setLoginMsg("");
  try {
    const session = await API.signInStaff($("#staff-email").value, $("#staff-password").value);
    /* The staff RPC is the actual authorization boundary. A valid Auth user alone is not enough. */
    await API.adminListOrders("active");
    await showDashboard(session);
  } catch (e) {
    setLoginMsg(e.message, "bad");
  } finally {
    btn.disabled = false;
  }
});

document.addEventListener("click", async e => {
  const btn = e.target.closest("button[data-status]");
  if (btn) return changeStatus(btn.dataset.code, btn.dataset.status, btn);
  if (e.target.closest("#refresh-btn")) return refresh("Refreshing…");
  if (e.target.closest("#signout-btn")) {
    try {
      if (state.realtime) await API.removeRealtimeChannel(state.realtime);
      state.realtime = null;
      await API.signOut();
      location.reload();
    } catch (err) {
      setMsg(err.message, "bad");
    }
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "view-select") {
    state.view = e.target.value;
    refresh();
  }
});

init();
