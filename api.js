/* api.js — PHP backend implementation of the API object that app.js already uses.
   Same method names and return shapes as the old Supabase version, so app.js needs no changes.
   Load BEFORE app.js (the supabase-js script tag is no longer needed). */
"use strict";

/* Relative on purpose: the site and the API live on the same domain (localhost, then InfinityFree),
   so there is no CORS to configure. */
const API_URL = "api/index.php";
const AUTH_KEY = "jb.auth.v1";

const Auth = {
  get() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; }
  },
  set(session) {
    try {
      if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      else localStorage.removeItem(AUTH_KEY);
    } catch (e) {}
  },
  token() {
    const s = this.get();
    return s && s.access_token ? s.access_token : null;
  }
};

/* One door to the server. Server errors carry a readable message; anything else is hidden. */
async function call(fn, body) {
  const headers = { "Content-Type": "application/json" };
  const t = Auth.token();
  if (t) headers["X-Auth-Token"] = t;

  let res;
  try {
    res = await fetch(API_URL + "?fn=" + encodeURIComponent(fn), {
      method: "POST",
      headers,
      body: JSON.stringify(body || {})
    });
  } catch (e) {
    console.error(fn, e);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    console.error(fn, "non-JSON response", res.status);
    throw new Error("The server sent an unexpected response. Please try again.");
  }

  if (json.error) {
    throw new Error(json.error);
  }
  return json.data;
}

/* Send only what the server needs; it recomputes every price itself. */
const slimCart = cart => (cart || []).map(c => ({
  sku: c.sku,
  variantId: c.variantId,
  qty: c.qty,
  note: c.note || "",
  options: (c.options || []).map(o => ({
    groupId: o.groupId,
    choiceId: o.choiceId
  }))
}));

const slimCtx = c => ({
  mode: c.mode,
  storeId: c.storeId || null,
  address: c.address || null
});

/* Tracking tokens for orders placed in this browser. Needed to read an order's status. */
const TOKEN_KEY = "jb.orderTokens.v1";

const tokens = {
  all() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}"); } catch (e) { return {}; }
  },
  set(id, t) {
    try {
      const m = this.all();
      m[id] = t;
      localStorage.setItem(TOKEN_KEY, JSON.stringify(m));
    } catch (e) {}
  },
  get(id) {
    return this.all()[id];
  }
};

const API = {

  /* ================= CUSTOMER AUTH ================= */

  async signUpCustomer(email, password) {
    const r = await call("auth_signup", {
      email: String(email || "").trim(),
      password: String(password || "")
    });
    Auth.set(r.session);
    return r.session;
  },

  async signInCustomer(email, password) {
    const r = await call("auth_signin", {
      email: String(email || "").trim(),
      password: String(password || "")
    });
    Auth.set(r.session);
    return r.session;
  },

  async signOutCustomer() {
    try { await call("auth_signout", {}); } catch (e) { /* token may already be gone */ }
    Auth.set(null);
  },

  /* ================= CUSTOMER API ================= */

  getMenu() {
    return call("get_menu", {});
  },

  getStores(query = "") {
    return call("get_stores", { p_query: query });
  },

  getVouchers() {
    return call("get_vouchers", {});
  },

  validateVoucher(code, cartTotal, cart = []) {
    return call("validate_voucher", { p_code: code, p_cart: slimCart(cart) });
  },

  calculateQuote(cart, orderCtx, vouchers = []) {
    return call("calculate_quote", {
      p_cart: slimCart(cart),
      p_ctx: slimCtx(orderCtx),
      p_vouchers: vouchers
    });
  },

  async createOrder(p) {
    /* Guests can order: no sign-in needed. If a customer is signed in, the order is linked to them. */
    const r = await call("create_order", {
      p_payload: {
        items: slimCart(p.items),
        orderCtx: slimCtx(p.orderCtx),
        vouchers: p.vouchers || [],
        contact: p.contact || {},
        paymentMethod: p.paymentMethod || "cod"
      }
    });

    tokens.set(r.orderId, r.trackingToken);
    delete r.trackingToken;
    return r;
  },

  getOrderStatus(orderId) {
    const t = tokens.get(orderId);
    if (!t) {
      return Promise.reject(new Error("Order not found"));
    }
    return call("get_order_status", { p_code: orderId, p_token: t });
  },

  /* ================= STAFF / ADMIN API ================= */

  async signInStaff(email, password) {
    const r = await call("auth_signin", {
      email: String(email || "").trim(),
      password: String(password || ""),
      staffOnly: true
    });
    Auth.set(r.session);
    return r.session;
  },

  async signOut() {
    try { await call("auth_signout", {}); } catch (e) {}
    Auth.set(null);
  },

  async getSession() {
    if (!Auth.token()) return null;
    try {
      const r = await call("auth_session", {});
      if (!r.session) {
        Auth.set(null);
        return null;
      }
      return r.session;
    } catch (e) {
      return null;
    }
  },

  adminListOrders(view = "active") {
    return call("admin_list_orders", { p_view: view });
  },

  adminSetOrderStatus(code, status) {
    return call("admin_set_order_status", { p_code: code, p_status: status });
  },

  /* No websockets on free PHP hosting: poll every 5 seconds instead.
     Same contract as before: returns a handle you pass to removeRealtimeChannel(). */
  subscribeToOrders(onChange) {
    const id = setInterval(() => {
      try { onChange(); } catch (e) { console.error(e); }
    }, 5000);
    return { id };
  },

  removeRealtimeChannel(channel) {
    if (channel && channel.id) clearInterval(channel.id);
    return Promise.resolve();
  }

};
