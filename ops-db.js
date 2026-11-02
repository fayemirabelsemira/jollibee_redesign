/* ops-db.js — tiny stand-in for the Supabase client, used ONLY by ops.html.
   It implements exactly the calls ops.js makes (from/select/order/insert/update/eq, auth.*)
   and sends them to the PHP backend (api/index.php?fn=ops). ops.js itself is unchanged.
   Load BEFORE ops.js (replace the supabase-js <script> tag in ops.html with this file). */
(function () {
  "use strict";
  var API_URL = "api/index.php";
  var TOKEN_KEY = "jb.auth.v1";

  function stored() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); } catch (e) { return null; }
  }
  function store(s) {
    try { if (s) localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  async function call(fn, body) {
    var headers = { "Content-Type": "application/json" };
    var s = stored();
    if (s && s.access_token) headers["X-Auth-Token"] = s.access_token;
    var res;
    try {
      res = await fetch(API_URL + "?fn=" + encodeURIComponent(fn), { method: "POST", headers: headers, body: JSON.stringify(body || {}) });
    } catch (e) {
      throw new Error("Cannot reach the server. Check your connection.");
    }
    var json;
    try { json = await res.json(); } catch (e) { throw new Error("The server sent an unexpected response."); }
    if (json.error) throw new Error(json.error);
    return json.data;
  }

  function Query(table) { this.t = table; this.mode = "select"; this._single = false; }
  Query.prototype.select = function () { if (this.mode !== "insert") this.mode = "select"; return this; };
  Query.prototype.order = function (col, opt) { this._order = col; this._asc = !(opt && opt.ascending === false); return this; };
  Query.prototype.single = function () { this._single = true; return this; };
  Query.prototype.insert = function (rows) { this.mode = "insert"; this._rows = rows; return this; };
  Query.prototype.update = function (patch) { this.mode = "update"; this._patch = patch; return this; };
  Query.prototype.eq = function (col, val) { this._eq = [col, val]; return this; };
  Query.prototype.then = function (ok, bad) { return this.run().then(ok, bad); };
  Query.prototype.run = async function () {
    try {
      var data;
      if (this.mode === "select") {
        data = await call("ops", { action: "list", table: this.t, order: this._order || "", asc: !!this._asc });
      } else if (this.mode === "insert") {
        var arr = Array.isArray(this._rows) ? this._rows : [this._rows];
        data = await call("ops", { action: "insert", table: this.t, rows: arr });
        if (this._single) data = data[0] || null;
      } else {
        if (!this._eq || this._eq[0] !== "id") throw new Error("Only updates by id are supported.");
        await call("ops", { action: "update", table: this.t, id: this._eq[1], patch: this._patch });
        data = null;
      }
      return { data: data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  };

  var client = {
    from: function (t) { return new Query(t); },
    auth: {
      getSession: async function () {
        var s = stored();
        if (!s) return { data: { session: null }, error: null };
        try {
          var r = await call("auth_session", {});
          if (!r.session) { store(null); return { data: { session: null }, error: null }; }
          return { data: { session: r.session }, error: null };
        } catch (e) {
          return { data: { session: null }, error: null };
        }
      },
      signInWithPassword: async function (c) {
        try {
          var r = await call("auth_signin", { email: c.email, password: c.password, staffOnly: true });
          store(r.session);
          return { data: { session: r.session }, error: null };
        } catch (e) {
          return { data: { session: null }, error: { message: e.message } };
        }
      },
      signOut: async function () {
        try { await call("auth_signout", {}); } catch (e) {}
        store(null);
        return { error: null };
      }
    }
  };

  window.supabase = { createClient: function () { return client; } };
})();
