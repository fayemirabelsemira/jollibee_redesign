/* api.js — Supabase implementation of the same API object app.js already uses.
   Same method names and return shapes as the old mock, so app.js needs no changes.
   Load AFTER the supabase-js CDN script, BEFORE app.js. */
"use strict";

/* Project Settings → API in the Supabase dashboard. The anon key is PUBLIC by design;
   Row Level Security + the SQL functions are what protect your data. NEVER put the service_role key here. */
const SUPABASE_URL = "https://oougwsdtbhpisflsociq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VilEjy5s_i2bMNx5v6VdtQ_AHIJgCv7";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/* Placing an order needs a session.
   Prefer an existing signed-in user (customer or staff).
   Fall back to anonymous sign-in for guest checkout
   (enable it: Authentication → Providers → Anonymous). */
let sessionP = null;

function ensureSession() {
  return sessionP || (sessionP = (async () => {
    const { data } = await sb.auth.getSession();

    if (data.session) {
      return data.session;
    }

    const { data: d, error } = await sb.auth.signInAnonymously();

    if (error) {
      throw error;
    }

    return d.session;
  })().catch(e => {
    sessionP = null;
    throw e;
  }));
}

function clearSessionCache() {
  sessionP = null;
}

/* Our SQL functions raise readable messages (SQLSTATE P0001): show those, hide everything else. */
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);

  if (error) {
    console.error(fn, error);

    throw new Error(
      error.code === "P0001"
        ? error.message
        : "Something went wrong. Please try again."
    );
  }

  return data;
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

/* Tracking tokens for orders placed in this browser.
   Needed to read an order's status. */
const TOKEN_KEY = "jb.orderTokens.v1";

const tokens = {
  all() {
    try {
      return JSON.parse(
        localStorage.getItem(TOKEN_KEY) || "{}"
      );
    } catch (e) {
      return {};
    }
  },

  set(id, t) {
    try {
      const m = this.all();
      m[id] = t;
      localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify(m)
      );
    } catch (e) {}
  },

  get(id) {
    return this.all()[id];
  }
};

const API = {

  /* =========================================================
     CUSTOMER AUTH
     ========================================================= */

  async signUpCustomer(email, password) {
    const { data, error } = await sb.auth.signUp({
      email: String(email || "").trim(),
      password: String(password || "")
    });

    if (error) {
      throw new Error(error.message || "Sign-up failed.");
    }

    clearSessionCache();
    return data.session || data.user;
  },

  async signInCustomer(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });

    if (error) {
      throw new Error(error.message || "Sign-in failed.");
    }

    clearSessionCache();
    return data.session;
  },

  async signOutCustomer() {
    const { error } = await sb.auth.signOut();

    if (error) {
      throw new Error(error.message || "Sign-out failed.");
    }

    clearSessionCache();
  },

  /* =========================================================
     CUSTOMER API
     ========================================================= */

  getMenu() {
    return rpc("get_menu");
  },

  getStores(query = "") {
    return rpc("get_stores", {
      p_query: query
    });
  },

  getVouchers() {
    return rpc("get_vouchers");
  },

  validateVoucher(code, cartTotal, cart = []) {
    return rpc("validate_voucher", {
      p_code: code,
      p_cart: slimCart(cart)
    });
  },

  calculateQuote(cart, orderCtx, vouchers = []) {
    return rpc("calculate_quote", {
      p_cart: slimCart(cart),
      p_ctx: slimCtx(orderCtx),
      p_vouchers: vouchers
    });
  },

  async createOrder(p) {
    await ensureSession();

    const r = await rpc("create_order", {
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
      return Promise.reject(
        new Error("Order not found")
      );
    }

    return rpc("get_order_status", {
      p_code: orderId,
      p_token: t
    });
  },

  /* =========================================================
     STAFF / ADMIN API
     ========================================================= */

  async signInStaff(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });

    if (error) {
      throw new Error(
        error.message || "Sign-in failed."
      );
    }

    clearSessionCache();
    return data.session;
  },

  async signOut() {
    const { error } = await sb.auth.signOut();

    if (error) {
      throw new Error(
        error.message || "Sign-out failed."
      );
    }

    clearSessionCache();
  },

  async getSession() {
    const { data, error } = await sb.auth.getSession();

    if (error) {
      throw new Error(
        error.message || "Could not read your session."
      );
    }

    return data.session;
  },

  adminListOrders(view = "active") {
    return rpc("admin_list_orders", {
      p_view: view
    });
  },

  adminSetOrderStatus(code, status) {
    return rpc("admin_set_order_status", {
      p_code: code,
      p_status: status
    });
  },

  subscribeToOrders(onChange) {
    const channel = sb
      .channel("staff-order-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders"
        },
        onChange
      )
      .subscribe();

    return channel;
  },

  removeRealtimeChannel(channel) {
    return channel
      ? sb.removeChannel(channel)
      : Promise.resolve();
  }

};
