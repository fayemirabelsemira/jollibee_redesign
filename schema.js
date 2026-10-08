/* api.js — Supabase implementation of the same API object app.js already uses.
   Same method names and return shapes as the old mock, so app.js needs no changes.
   Load AFTER the supabase-js CDN script and schema.js, BEFORE app.js. */
"use strict";

/* Project Settings → API in the Supabase dashboard. The anon key is PUBLIC by design;
   Row Level Security + the SQL functions are what protect your data. NEVER put the service_role key here. */
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

/* Placing an order needs a session. Anonymous sign-in gives every visitor one without a login form
   (enable it: Authentication → Sign In / Providers → Allow anonymous sign-ins). */
let sessionP = null;
function ensureSession() {
  return sessionP || (sessionP = (async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session;
    const { data: d, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    return d.session;
  })().catch(e => { sessionP = null; throw e; }));
}

/* Our SQL functions raise readable messages (SQLSTATE P0001): show those, hide everything else. */
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    console.error(fn, error);
    throw new Error(error.code === "P0001" ? error.message : "Something went wrong. Please try again.");
  }
  return data;
}

/* send only what the server needs; it recomputes every price itself */
const slimCart = cart => (cart || []).map(c => ({
  sku: c.sku, variantId: c.variantId, qty: c.qty, note: c.note || "",
  options: (c.options || []).map(o => ({ groupId: o.groupId, choiceId: o.choiceId }))
}));
const slimCtx = c => ({ mode: c.mode, storeId: c.storeId || null, address: c.address || null });

/* tracking tokens for orders placed in this browser (needed to read an order's status) */
const TOKEN_KEY = "jb.orderTokens.v1";
const tokens = {
  all() { try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}"); } catch (e) { return {}; } },
  set(id, t) { try { const m = this.all(); m[id] = t; localStorage.setItem(TOKEN_KEY, JSON.stringify(m)); } catch (e) {} },
  get(id) { return this.all()[id]; }
};

const API = {
  getMenu()                          { return rpc("get_menu"); },
  getStores(query = "")              { return rpc("get_stores", { p_query: query }); },
  getVouchers()                      { return rpc("get_vouchers"); },
  /* cartTotal is ignored on purpose: the server totals the cart itself */
  validateVoucher(code, cartTotal, cart = []) {
    return rpc("validate_voucher", { p_code: code, p_cart: slimCart(cart) });
  },
  calculateQuote(cart, orderCtx, vouchers = []) {
    return rpc("calculate_quote", { p_cart: slimCart(cart), p_ctx: slimCtx(orderCtx), p_vouchers: vouchers });
  },
  async createOrder(p) {
    await ensureSession();
    const r = await rpc("create_order", {
      p_payload: { items: slimCart(p.items), orderCtx: slimCtx(p.orderCtx), vouchers: p.vouchers || [], contact: p.contact || {} }
    });
    tokens.set(r.orderId, r.trackingToken);
    delete r.trackingToken;           /* keep the secret out of the UI */
    return r;
  },
  getOrderStatus(orderId) {
    const t = tokens.get(orderId);
    if (!t) return Promise.reject(new Error("Order not found"));
    return rpc("get_order_status", { p_code: orderId, p_token: t });
  }
};