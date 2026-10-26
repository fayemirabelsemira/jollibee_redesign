/* app.js — Single-Page App.
   One document (index.html). A tiny hash router swaps the contents of <main id="main"> and nothing else reloads.
   Load order: art.js, api.js, app.js

   ROUTES (hash based, so it works from file:// and on any static host with no server config)
     #/                    home
     #/menu                full menu
     #/category/<name>     one menu category
     #/item/<sku>?v=<id>   item customizer
     #/kiddie?toy=toy-3    Kiddie Meal builder
     #/cart                cart
     #/deals              deals
     #/promos             promos
     #/toys                toys
     #/stores?q=Taguig      stores
     #/story              story
     #/track?order=JB-482913  customer order tracking
     #/account             customer login / sign up
*/
"use strict";

/* ---------- helpers ---------- */
const AppState = {
  cart: [],
  vouchers: [],
  orderCtx: { mode: "pickup", storeId: null, address: null },
  contact: { name: "", phone: "" },
  paymentMethod: "cod",
  quote: null,
  user: null
};

function formatCurrency(cents) {
  const n = Number(cents) || 0;
  return "₱" + (n / 100).toLocaleString("en-PH", {
    minimumFractionDigits: n % 100 ? 2 : 0,
    maximumFractionDigits: 2
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function raw(s) {
  return { __html: String(s) };
}

/** Safe HTML tagged template. Nested html`...` is NOT escaped. */
function html(strings, ...values) {
  let out = "";

  for (let i = 0; i < strings.length; i++) {
    out += strings[i];

    if (i < values.length) {
      const v = values[i];

      if (v == null || v === false) continue;

      if (Array.isArray(v)) {
        for (const x of v) {
          if (x == null || x === false) continue;

          out += (
            x &&
            typeof x === "object" &&
            "__html" in x
          )
            ? x.__html
            : String(x);
        }
      } else if (
        typeof v === "object" &&
        "__html" in v
      ) {
        out += v.__html;
      } else {
        out += esc(v);
      }
    }
  }

  const s = new String(out);
  s.__html = out;
  return s;
}

const $ = s => document.querySelector(s);
const slug = s => s.toLowerCase().replace(/\W+/g, "-");

const KEY = "jb.state.v1";
const OUT = $("#main");
const BAR = $("#bar");

let MENUD = [];
let GROUPS = {};
let VOUCHER_LIST = [];
let quoteSeq = 0;
let navSeq = 0;
let firstRender = true;
let DATA_OK = false;
let DATA_ERR = false;
let ready;

/* Tracking page state */
let TRACK_TIMER = null;
let TRACK_REQUEST = 0;

const setText = (el, t) => {
  if (el && el.textContent !== t) {
    el.textContent = t;
  }
};

const live = m => {
  const l = $("#live");
  if (!l) return;

  l.textContent = "";

  setTimeout(() => {
    l.textContent = m;
  }, 60);
};

const item = sku => MENUD.find(m => m.sku === sku);

const variant = (it, id) =>
  it.variants.find(v => v.id === id) || it.variants[0];

const count = () =>
  AppState.cart.reduce((a, c) => a + c.qty, 0);

const SHEET = $("#sheet");
const SCRIM = $("#scrim");
const INERT = [
  "header.top",
  "main",
  "footer",
  ".tabbar",
  "#bar"
];

let LAST = "#/menu";

function sheetOn() {
  SHEET.hidden = SCRIM.hidden = false;

  document.body.classList.add("sheet-open");

  INERT.forEach(q => {
    const e = $(q);
    if (e) e.inert = true;
  });

  return SHEET;
}

function sheetOff() {
  LAST = location.hash || "#/";

  SHEET.hidden = SCRIM.hidden = true;
  SHEET.innerHTML = "";

  document.body.classList.remove("sheet-open");

  INERT.forEach(q => {
    const e = $(q);
    if (e) e.inert = false;
  });

  return OUT;
}

/* ================= ROUTER ================= */
const href = (p, o = {}) =>
  "#" +
  p +
  (
    Object.keys(o).length
      ? "?" + new URLSearchParams(o)
      : ""
  );

const nav = h => {
  if (location.hash === h) {
    render();
  } else {
    location.hash = h;
  }
};

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const i = raw.indexOf("?");

  const path = i < 0
    ? raw
    : raw.slice(0, i);

  const qs = i < 0
    ? ""
    : raw.slice(i + 1);

  let seg;

  try {
    seg = path
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
  } catch (e) {
    seg = ["404"];
  }

  return {
    seg,
    q: new URLSearchParams(qs)
  };
}

const SKELETON =
  `<section>
    <div class="in">
      <div class="menu">
        ${'<div class="dish skel" aria-hidden="true"></div>'.repeat(6)}
      </div>
    </div>
  </section>`;

/* Stop tracking polling whenever the user leaves the tracking page. */
function stopTracking() {
  if (TRACK_TIMER) {
    clearInterval(TRACK_TIMER);
    TRACK_TIMER = null;
  }

  TRACK_REQUEST++;
}

/* ================= CUSTOMER TRACKING ================= */

/*
  The tracking page deliberately uses the existing API contract:

      API.getOrderStatus(orderId)

  api.js retrieves the tracking token saved when createOrder() succeeded.
  No new database query or tracking table is introduced here.
*/

function trackStatusClass(status, cancelled) {
  if (cancelled) return "cancelled";

  switch (status) {
    case "received":
      return "received";

    case "preparing":
      return "preparing";

    case "ready":
      return "ready";

    case "completed":
      return "completed";

    default:
      return "";
  }
}

function trackProgress(status, step, steps) {
  const labels = Array.isArray(steps)
    ? steps
    : [
        "Received",
        "Preparing",
        "Ready",
        "Completed"
      ];

  const safeStep = Math.max(
    0,
    Math.min(
      labels.length - 1,
      Number.isFinite(Number(step))
        ? Number(step)
        : 0
    )
  );

  return labels.map((label, index) => `
    <div class="track-step ${index < safeStep ? "done" : ""} ${index === safeStep ? "current" : ""}">
      <div class="track-dot" aria-hidden="true">
        ${index < safeStep ? "✓" : index + 1}
      </div>
      <div class="track-step-text">
        <strong>${esc(label)}</strong>
        ${
          index === safeStep
            ? `<small>Current step</small>`
            : ""
        }
      </div>
    </div>
  `).join("");
}

function renderTrackLoading() {
  const root = $("#track-root");

  if (!root) return;

  root.innerHTML = `
    <div class="track-card">
      <div class="track-loading">
        <div class="track-loader" aria-hidden="true"></div>
        <h2>Loading your order</h2>
        <p class="lead">
          We're checking the latest order status.
        </p>
      </div>
    </div>
  `;
}

function renderTrackError(message) {
  const root = $("#track-root");

  if (!root) return;

  root.innerHTML = `
    <div class="track-card">
      <div class="track-error">
        <div class="track-error-icon" aria-hidden="true">!</div>
        <h2>We couldn't load this order</h2>
        <p class="lead">${esc(
          message || "Order not found."
        )}</p>
        <div class="track-actions">
          <button
            class="cta"
            type="button"
            id="track-retry"
          >
            Try again
          </button>

          <a
            class="cta alt"
            href="#/menu"
          >
            Back to menu
          </a>
        </div>
      </div>
    </div>
  `;

  const retry = $("#track-retry");

  if (retry) {
    retry.onclick = () => {
      const { q } = parseHash();
      const orderId = q.get("order") || "";

      if (orderId) {
        loadTracking(orderId, true);
      }
    };
  }
}

function renderTrackOrder(data) {
  const root = $("#track-root");

  if (!root) return;

  if (!data) {
    renderTrackError("No order information was returned.");
    return;
  }

  const orderId = data.orderId || "";
  const step = Number(data.step) || 0;
  const steps = Array.isArray(data.steps)
    ? data.steps
    : [];

  const cancelled = !!data.cancelled;

  const mode =
    data.mode === "delivery"
      ? "Delivery"
      : "Pickup";

  const currentLabel =
    cancelled
      ? "Cancelled"
      : data.label || steps[step] || "Received";

  const statusClass =
    trackStatusClass(
      data.status,
      cancelled
    );

  const created = data.createdAt
    ? new Date(data.createdAt)
    : null;

  const createdText =
    created && !Number.isNaN(created.getTime())
      ? created.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short"
        })
      : "";

  const items = Array.isArray(data.items)
    ? data.items
    : [];

  const itemMarkup = items.length
    ? items.map(i => `
        <li class="track-item">
          <span>
            <strong>${esc(i.qty)} × ${esc(i.name)}</strong>
            ${
              i.variantLabel
                ? `<small>${esc(i.variantLabel)}</small>`
                : ""
            }
          </span>
        </li>
      `).join("")
    : `
        <li class="track-item">
          <span>
            <strong>No item details available</strong>
          </span>
        </li>
      `;

  const progressMarkup = cancelled
    ? `
      <div class="track-cancelled">
        <div class="track-cancelled-icon" aria-hidden="true">×</div>
        <div>
          <strong>Order cancelled</strong>
          <p>
            This order is no longer being processed.
          </p>
        </div>
      </div>
    `
    : `
      <div
        class="track-progress"
        aria-label="Order progress"
      >
        ${trackProgress(
          currentLabel === "Received" ? "received" :
          currentLabel === "Preparing" ? "preparing" :
          currentLabel === "Ready for pick-up" ? "ready" :
          currentLabel === "Out for delivery" ? "ready" :
          currentLabel === "Picked up" ? "completed" :
          currentLabel === "Delivered" ? "completed" :
          "",
          step,
          steps
        )}
      </div>
    `;

  root.innerHTML = `
    <div class="track-card">

      <div class="track-header">

        <div>
          <span class="track-eyebrow">
            ${esc(mode)}
          </span>

          <h2>
            Order ${esc(orderId)}
          </h2>

          ${
            data.storeName
              ? `<p class="track-store">${esc(data.storeName)}</p>`
              : ""
          }
        </div>

        <div class="track-status ${cancelled ? "cancelled" : statusClass}">
          ${esc(currentLabel)}
        </div>

      </div>

      ${
        createdText
          ? `
            <p class="track-created">
              Placed ${esc(createdText)}
            </p>
          `
          : ""
      }

      ${
        !cancelled && data.etaMinutes != null
          ? `
            <div class="track-eta">
              <div class="track-eta-icon" aria-hidden="true">
                ⏱
              </div>
              <div>
                <small>Estimated time</small>
                <strong>
                  ${esc(data.etaMinutes)} minutes
                </strong>
              </div>
            </div>
          `
          : ""
      }

      ${progressMarkup}

      <div class="track-section">

        <div class="track-section-head">
          <h3>Your order</h3>
          ${
            data.total != null
              ? `<strong>${formatCurrency(data.total)}</strong>`
              : ""
          }
        </div>

        <ul class="track-items">
          ${itemMarkup}
        </ul>

      </div>

      <div class="track-footer">

        <div>
          ${
            mode === "delivery"
              ? "<small>Delivery order</small>"
              : "<small>Pickup order</small>"
          }

          ${
            data.storeName
              ? `<strong>${esc(data.storeName)}</strong>`
              : ""
          }

          ${
            data.paymentMethod
              ? `<div><small>Payment: ${esc(
                  data.paymentMethod === "card" ? "Card" : "COD"
                )}</small></div>`
              : ""
          }
        </div>

        <a
          class="add ghost"
          href="#/menu"
        >
          Order again
        </a>

      </div>

      ${
        !cancelled
          ? `
            <p class="track-live-note" aria-live="polite">
              Status updates automatically.
            </p>
          `
          : ""
      }

    </div>
  `;

  document.title =
    `Order ${orderId} · Jollibee`;
}

async function loadTracking(orderId, showLoading = false) {
  const request = ++TRACK_REQUEST;

  if (!orderId) {
    stopTracking();
    renderTrackError(
      "No order number was provided."
    );
    return;
  }

  if (showLoading) {
    renderTrackLoading();
  }

  try {
    const data =
      await API.getOrderStatus(orderId);

    if (
      request !== TRACK_REQUEST ||
      document.body.dataset.page !== "track"
    ) {
      return;
    }

    renderTrackOrder(data);

    /*
      Completed/cancelled orders don't need continued polling.
      The API response exposes "cancelled". Completion is represented
      by the final tracking step.
    */
    if (
      data &&
      (
        data.cancelled ||
        Number(data.step) >=
          (Array.isArray(data.steps)
            ? data.steps.length - 1
            : 3)
      )
    ) {
      if (TRACK_TIMER) {
        clearInterval(TRACK_TIMER);
        TRACK_TIMER = null;
      }
    }

  } catch (e) {
    if (request !== TRACK_REQUEST) {
      return;
    }

    renderTrackError(
      e && e.message
        ? e.message
        : "Order not found."
    );
  }
}

function mountTracking(_, q) {
  stopTracking();

  const orderId =
    (q && q.get("order")) || "";

  loadTracking(
    orderId,
    true
  );

  /*
    Poll the existing Supabase tracking RPC so the customer
    sees staff status changes without refreshing the page.
  */
  TRACK_TIMER = setInterval(() => {
    if (
      document.body.dataset.page !== "track"
    ) {
      stopTracking();
      return;
    }

    loadTracking(
      orderId,
      false
    );
  }, 5000);
}

/* ================= ROUTER ================= */
async function render() {
  const my = ++navSeq;

  const {
    seg,
    q
  } = parseHash();

  const name =
    seg[0] || "home";

  const known =
    Object.hasOwn(VIEWS, name);

  const V =
    known
      ? VIEWS[name]
      : VIEWS.notfound;

  const args =
    seg.slice(1);

  /*
    Always stop the old tracking timer before rendering another page.
    The tracking mount will start a fresh one only for #/track.
  */
  if (name !== "track") {
    stopTracking();
  }

  document.body.dataset.page =
    known ? name : "notfound";

  if (V.data) {

    if (!DATA_OK) {
      OUT.setAttribute(
        "aria-busy",
        "true"
      );

      OUT.innerHTML =
        SKELETON;
    }

    await ready;

    if (my !== navSeq) {
      return;
    }

    if (DATA_ERR) {
      OUT.removeAttribute(
        "aria-busy"
      );

      OUT.innerHTML = `
        <section>
          <div class="in">
            <p class="lead">
              Sorry, this page could not load.
              <button
                class="add"
                type="button"
                data-retry
              >
                Try again
              </button>
            </p>
          </div>
        </section>
      `;

      return;
    }
  }

  const v =
    V.view(args, q);

  const T =
    name === "cart"
      ? sheetOn()
      : sheetOff();

  T.innerHTML =
    v.html;

  OUT.removeAttribute(
    "aria-busy"
  );

  applyImgs(T);

  document.title =
    v.title;

  if (v.mount) {
    v.mount(args, q);
  }

  document
    .querySelectorAll("[data-nav]")
    .forEach(a => {
      a.dataset.nav ===
      (
        known
          ? name
          : ""
      )
        ? a.setAttribute(
            "aria-current",
            "page"
          )
        : a.removeAttribute(
            "aria-current"
          );
    });

  if (!firstRender) {

    if (T === OUT) {
      if (window.Motion) {
        Motion.scrollTop();
      } else {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "instant"
        });
      }
    }

    const h =
      T.querySelector("h1,h2");

    if (h) {
      h.tabIndex = -1;
      h.focus({
        preventScroll: true
      });
    }

    live(
      v.title.replace(
        " · Jollibee",
        ""
      ) + " page"
    );
  }

  if (window.Motion) {
    Motion.page(name, T, firstRender);
  }

  firstRender = false;
}

addEventListener(
  "hashchange",
  render
);


/* ================= customer account ================= */
async function refreshUser() {
  try {
    const s = await API.getSession();
    const email = s && s.user && s.user.email;
    AppState.user = email ? { email } : null;
  } catch (_) {
    AppState.user = null;
  }
  updateAccountNav();
}

function updateAccountNav() {
  document.querySelectorAll('[data-nav="account"]').forEach(a => {
    a.textContent = AppState.user ? "Account" : "Sign in";
  });
}

function mountAccount() {
  const signed = $("#acct-signed-in");
  const forms = $("#acct-forms");
  const msg = $("#acct-msg");

  const show = () => {
    if (AppState.user) {
      signed.hidden = false;
      forms.hidden = true;
      $("#acct-email").textContent = AppState.user.email;
      setText(msg, "");
    } else {
      signed.hidden = true;
      forms.hidden = false;
    }
  };

  show();

  const outBtn = $("#acct-signout");
  if (outBtn) {
    outBtn.onclick = async () => {
      try {
        await API.signOutCustomer();
        AppState.user = null;
        updateAccountNav();
        show();
        live("Signed out.");
      } catch (e) {
        setText(msg, e.message);
        msg.className = "admin-msg bad";
      }
    };
  }

  const loginForm = $("#acct-login");
  if (loginForm) {
    loginForm.onsubmit = async e => {
      e.preventDefault();
      setText(msg, "");
      msg.className = "admin-msg";
      try {
        await API.signInCustomer(
          $("#login-email").value,
          $("#login-password").value
        );
        await refreshUser();
        show();
        live("Signed in.");
      } catch (err) {
        setText(msg, err.message);
        msg.className = "admin-msg bad";
      }
    };
  }

  const signupForm = $("#acct-signup");
  if (signupForm) {
    signupForm.onsubmit = async e => {
      e.preventDefault();
      setText(msg, "");
      msg.className = "admin-msg";
      try {
        await API.signUpCustomer(
          $("#signup-email").value,
          $("#signup-password").value
        );
        await refreshUser();
        if (AppState.user) {
          show();
          live("Account created.");
        } else {
          setText(msg, "Check your email to confirm, then sign in.");
          msg.className = "admin-msg ok";
        }
      } catch (err) {
        setText(msg, err.message);
        msg.className = "admin-msg bad";
      }
    };
  }
}

/* ================= VIEWS ================= */
const VIEWS = {

  /* ---------- home ---------- */
  home: {
    view: () => ({
      title:
        "Jollibee · Joy that tastes like home",

      html: `
        <div class="hero" id="top">
          <div class="hero-in">

            <div>
              <h1>
                Joy that tastes
                <span>like home.</span>
              </h1>

              <p>
                Crispy, juicy Chickenjoy, sweet-style spaghetti
                and a warm pie for dessert. Made fresh, shared
                with everyone you love.
              </p>

              <a
                class="cta"
                href="#/menu"
              >
                Order now
              </a>

              <a
                class="cta alt"
                href="#/deals"
              >
                See deals
              </a>
            </div>

            <div class="plate">
              <img
                class="mascot"
                data-img="m"
                width="420"
                height="420"
                alt="Jollibee mascot holding a bucket of Chickenjoy"
              >
            </div>

          </div>

          <svg
            class="wave"
            viewBox="0 0 1200 70"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 40 Q150 0 300 30 T600 30 T900 30 T1200 25 V70 H0Z"/>
          </svg>
        </div>

        <section>
          <div class="in">

            <h2>Explore</h2>

            <p class="lead">
              Jump to any part of the site.
              Your order stays with you wherever you go.
            </p>

            <div class="facts">

              <a
                class="fact tile"
                href="#/menu"
              >
                <img
                  class="ph"
                  src="${PAGE_IMG.exploreMenu}"
                  alt=""
                  width="600"
                  height="450"
                  loading="lazy"
                >
                <div class="tb">
                  <h3>Menu</h3>
                  <p>Pick your favorites.</p>
                </div>
              </a>

              <a
                class="fact tile"
                href="#/promos"
              >
                <img
                  class="ph"
                  src="${PAGE_IMG.explorePromos}"
                  alt=""
                  width="600"
                  height="450"
                  loading="lazy"
                >
                <div class="tb">
                  <h3>Promos</h3>
                  <p>Vouchers you can use today.</p>
                </div>
              </a>

              <a
                class="fact tile"
                href="#/toys"
              >
                <img
                  class="ph"
                  src="${PAGE_IMG.exploreToys}"
                  alt=""
                  width="600"
                  height="450"
                  loading="lazy"
                >
                <div class="tb">
                  <h3>Kiddie toys</h3>
                  <p>Collect all six.</p>
                </div>
              </a>

              <a
                class="fact tile"
                href="#/deals"
              >
                <img
                  class="ph"
                  src="${PAGE_IMG.exploreDeals}"
                  alt=""
                  width="600"
                  height="450"
                  loading="lazy"
                >
                <div class="tb">
                  <h3>Deals</h3>
                  <p>Today's big joy.</p>
                </div>
              </a>

              <a
                class="fact tile"
                href="#/story"
              >
                <img
                  class="ph"
                  src="${PAGE_IMG.exploreStory}"
                  alt=""
                  width="600"
                  height="450"
                  loading="lazy"
                >
                <div class="tb">
                  <h3>Our story</h3>
                  <p>Made for sharing.</p>
                </div>
              </a>

              <a
                class="fact tile"
                href="#/stores"
              >
                <img
                  class="ph"
                  src="${PAGE_IMG.exploreStores}"
                  alt=""
                  width="600"
                  height="450"
                  loading="lazy"
                >
                <div class="tb">
                  <h3>Stores</h3>
                  <p>Find a branch near you.</p>
                </div>
              </a>

            </div>
          </div>
        </section>

        <section
          id="find"
          style="padding-top:0"
        >
          <div class="in">

            <h2>Find a store near you</h2>

            <p class="lead">
              Enter your city or area to see your nearest branch.
            </p>

            <form class="find">
              <input
                id="q"
                placeholder="City or area"
                aria-label="City or area"
              >

              <button type="submit">
                Find stores
              </button>
            </form>

          </div>
        </section>
      `
    })
  },


  /* ---------- menu ---------- */
  menu: {
    data: 1,

    view: () => ({
      title:
        "Menu · Jollibee",

      html: `
        <section id="menu">
          <div class="in">

            <h1>Pick your favorites</h1>

            <p class="lead">
              Choose a category, or tap Add to order
              to customize an item.
            </p>

            <div class="mbar">

              <label
                for="q-menu"
                class="sr"
              >
                Search the menu
              </label>

              <input
                type="search"
                id="q-menu"
                class="fld"
                placeholder="Search the menu (e.g. chicken, spicy)"
              >

              <p
                id="menu-status"
                class="sr"
                aria-live="polite"
              ></p>

              <div
                class="tabs"
                id="tabs"
              ></div>

            </div>

            <div id="grid"></div>

            <p
              id="menu-empty"
              class="lead"
              hidden
            ></p>

          </div>
        </section>
      `,

      mount: () =>
        renderMenu(null)
    })
  },


  /* ---------- category ---------- */
  category: {
    data: 1,

    view: ([cat]) => ({
      title:
        (cat || "Menu") +
        " · Jollibee",

      html: `
        <section>
          <div class="in">

            <h1 id="cat-title">
              ${esc(cat || "Menu")}
            </h1>

            <p class="lead">
              Tap Add to order to customize an item.
            </p>

            <div class="mbar">
              <div
                class="tabs"
                id="tabs"
              ></div>
            </div>

            <div id="grid"></div>

          </div>
        </section>
      `,

      mount: () =>
        renderMenu(cat)
    })
  },


  /* ---------- item details ---------- */
  item: {
    data: 1,

    view: ([sku], q) => {

      const it = item(sku);

      if (!it) {
        return {
          title:
            "Item not found · Jollibee",

          html:
            html`
              <section>
                <div class="in">

                  <h1>Item not found</h1>

                  <p class="lead">
                    That item could not be found.
                    <a href="#/menu">
                      Back to the menu
                    </a>
                  </p>

                </div>
              </section>
            `.toString()
        };
      }

      return {
        title:
          it.name +
          " · Jollibee",

        html: `
          <section>

            <div class="in">

              <p class="lead">
                <a href="#/menu">
                  Back to the menu
                </a>
              </p>

              <div id="grid"></div>

            </div>

          </section>
        `,

        mount: () =>
          $("#grid").replaceChildren(
            itemView(it, {
              v: q.get("v"),
              toy: q.get("toy")
            })
          )
      };
    }
  },


  /* ---------- kiddie builder ---------- */
  kiddie: {
    data: 1,

    view: (_, q) => {

      const it =
        MENUD.find(
          m => m.groups.includes("toy")
        );

      if (!it) {
        return {
          title:
            "Kiddie Meal builder · Jollibee",

          html: `
            <section>

              <div class="in">

                <h1>
                  Build a Kiddie Meal
                </h1>

                <p class="lead">
                  The Kiddie Meal is not available right now.
                  <a href="#/menu">
                    Back to the menu
                  </a>
                </p>

              </div>

            </section>
          `
        };
      }

      return {
        title:
          "Kiddie Meal builder · Jollibee",

        html: `
          <section>

            <div class="in">

              <h1>
                Build a Kiddie Meal
              </h1>

              <p class="lead">
                Choose the meal and the Snoopy toy that goes with it.
                <a href="#/toys">
                  See all six toys
                </a>
              </p>

              <div id="grid"></div>

            </div>

          </section>
        `,

        mount: () => {

          const w =
            itemView(it, {
              v: q.get("v"),
              toy: q.get("toy")
            });

          const big =
            document.createElement("img");

          big.className =
            "toybig";

          const sync = () => {

            const c =
              w.querySelector(
                "[name=toy]:checked"
              );

            const t =
              c &&
              TOYS[
                +c.value.split("-")[1] - 1
              ];

            if (t) {
              big.src = t.s;
              big.alt = t.n;
            }
          };

          w.prepend(big);

          w.addEventListener(
            "change",
            sync
          );

          sync();

          $("#grid")
            .replaceChildren(w);
        }
      };
    }
  },


  /* ---------- cart ---------- */
  cart: {
    data: 1,

    view: () => ({
      title:
        "Your order · Jollibee",

      html: `
        <div class="sheet-head">

          <h1>
            Your order
          </h1>

          <button
            class="x"
            type="button"
            data-close
            aria-label="Close order"
          >
            ✕
          </button>

        </div>

        <div
          class="panel"
          id="panel"
        ></div>
      `,

      mount: () => {
        initPanel();
        renderCart();
        renderTotals();
        refreshQuote();
      }
    })
  },


  /* ---------- tracking ---------- */
  track: {
    view: (_, q) => ({
      title:
        "Track your order · Jollibee",

      html: `
        <section
          id="tracking"
          class="tracking-page"
        >
          <div class="in">

            <p class="lead">
              <a href="#/menu">
                ← Back to menu
              </a>
            </p>

            <div
              class="track-intro"
            >
              <span class="eyebrow">
                Order tracking
              </span>

              <h1>
                Where's your order?
              </h1>

              <p class="lead">
                We're showing the latest status from your Jollibee order.
              </p>
            </div>

            <div
              id="track-root"
            ></div>

          </div>
        </section>
      `,

      mount: mountTracking
    })
  },


  /* ---------- deals ---------- */
  deals: {
    view: () => ({
      title:
        "Today's big joy · Jollibee",

      html: `
        <section id="deal">
          <div class="in combo">

            <div>

              <h1>
                Today's big joy
              </h1>

              <p class="lead">
                Two pieces of Chickenjoy,
                a spaghetti and a drink.
                Perfect for a lunch for two.
              </p>

              <a
                class="cta"
                href="#/item/PRM-SHARE"
              >
                Build your meal
              </a>

              <p>
                <a href="#/category/Promos">
                  See all promo items
                </a>
              </p>

            </div>

            <div
              class="deal"
              role="link"
              tabindex="0"
              data-route="#/item/PRM-SHARE"
              aria-label="Sharing Combo, ₱299"
            >

              <img
                class="dealimg"
                src="prod-share.jpg"
                alt=""
                width="640"
                height="480"
              >

              <div class="dtxt">

                <span class="chip">
                  Featured
                </span>

                <h3>
                  Sharing Combo
                </h3>

                <div class="price">
                  ₱299
                </div>

                <p>
                  Tap to build your meal.
                </p>

              </div>

            </div>

          </div>
        </section>
      `
    })
  },


  /* ---------- promos ---------- */
  promos: {
    data: 1,

    view: () => ({
      title:
        "Promos & vouchers · Jollibee",

      html: `
        <section
          id="promos"
          style="background:var(--sun-l)"
        >
          <div class="in">

            <h1>
              Promos &amp; vouchers
            </h1>

            <p class="lead">
              Tap Use this code to save it,
              then review your order.
              The discount is applied before you pay.
            </p>

            <div
              class="tix"
              id="tix"
            ></div>

          </div>
        </section>
      `,

      mount: () =>
        renderTickets(VOUCHER_LIST)
    })
  },


  /* ---------- toys ---------- */
  toys: {
    view: () => ({
      title:
        "Kiddie toys · Jollibee",

      html: `
        <section id="toys">
          <div class="in">

            <h1>
              Collect all six Kiddie toys
            </h1>

            <p class="lead">
              Every Jolly Kiddie Meal comes with one toy.
              Tap a toy to open the Kiddie Meal builder
              with that toy ready.
            </p>

            <p>
              <a
                class="cta"
                href="#/kiddie"
              >
                Build Kiddie Meal
              </a>
            </p>

            <div
              class="toygrid"
              id="toygrid"
            ></div>

          </div>
        </section>
      `,

      mount: renderToys
    })
  },


  /* ---------- stores ---------- */
  stores: {
    view: () => ({
      title:
        "Find a store · Jollibee",

      html: `
        <section id="stores">

          <div class="in">

            <h1>
              Find a store near you
            </h1>

            <p class="lead">
              Enter your city or area to see your nearest branch.
            </p>

            <form class="find">

              <input
                id="q"
                placeholder="City or area"
                aria-label="City or area"
              >

              <button type="submit">
                Find stores
              </button>

            </form>

            <p
              id="found"
              aria-live="polite"
            ></p>

          </div>

        </section>
      `,

      mount: (_, q) => {
        const s =
          q.get("q") || "";

        $("#q").value = s;

        runSearch(s);
      }
    })
  },


  /* ---------- story ---------- */
  story: {
    view: () => ({
      title:
        "Our story · Jollibee",

      html: `
        <section
          class="story"
          id="story"
        >

          <div class="in">

            <span class="eyebrow">
              Our story
            </span>

            <h1>
              Made for <em>sharing</em>
            </h1>

            <p class="lead">
              From a small ice cream parlor to
              tables across the world, we've kept
              one idea: good food is better together.
            </p>

            <figure class="quote">

              <img
                data-img="l"
                alt="Jollibee logo"
                width="110"
                height="110"
              >

              <blockquote>

                <p class="big">
                  Bida ang saya.
                </p>

                <p>
                  Every branch carries the same bee,
                  the same red and yellow, and the same
                  promise of joy.
                </p>

              </blockquote>

            </figure>

          </div>

        </section>

        <div
          class="marq"
          aria-hidden="true"
        >
          <div>
            ${
              "<span>Bida ang saya</span><i>✦</i><span>Crispy</span><i>✦</i><span>Juicy</span><i>✦</i><span>Made for sharing</span><i>✦</i>".repeat(4)
            }
          </div>
        </div>

        <section class="chaps">

          <div class="in">

            <article class="chap">

              <div class="cimg">
                <img
                  src="${PAGE_IMG.storyChicken}"
                  alt="A bucket of crispy fried chicken"
                  width="900"
                  height="675"
                  loading="lazy"
                >
              </div>

              <div class="ct">

                <span
                  class="num"
                  aria-hidden="true"
                >
                  01
                </span>

                <h3>
                  Chicken, done right
                </h3>

                <p>
                  Marinated through, fried crispy outside,
                  juicy inside.
                </p>

              </div>

            </article>

            <article class="chap">

              <div class="cimg">
                <img
                  src="${PAGE_IMG.storyFamily}"
                  alt="Friends and family sharing Chickenjoy at the table"
                  width="900"
                  height="675"
                  loading="lazy"
                >
              </div>

              <div class="ct">

                <span
                  class="num"
                  aria-hidden="true"
                >
                  02
                </span>

                <h3>
                  Family first
                </h3>

                <p>
                  Big-batch meals and party trays
                  for every celebration.
                </p>

              </div>

            </article>

            <article class="chap">

              <div class="cimg">
                <img
                  src="${PAGE_IMG.storyReach}"
                  alt="Jollibee store locator poster"
                  width="900"
                  height="675"
                  loading="lazy"
                >
              </div>

              <div class="ct">

                <span
                  class="num"
                  aria-hidden="true"
                >
                  03
                </span>

                <h3>
                  Close to you
                </h3>

                <p>
                  Hundreds of stores, with delivery
                  and drive-thru options.
                </p>

              </div>

            </article>

          </div>

        </section>

        <section class="cta-band">

          <div class="in">

            <h2>
              Hungry yet?
            </h2>

            <p class="lead">
              Pick your favorites and make
              it a get-together.
            </p>

            <a
              class="cta"
              href="#/menu"
            >
              See the menu
            </a>

            <a
              class="cta alt"
              href="#/stores"
            >
              Find a store
            </a>

          </div>

        </section>
      `
    })
  },


  /* ---------- 404 ---------- */

  /* ---------- account ---------- */
  account: {
    view: () => ({
      title: "Account · Jollibee",
      html: `
        <section>
          <div class="in" style="max-width:480px">
            <h1>Your account</h1>
            <p class="lead" id="acct-lead">
              Sign in to keep orders under your email, or continue as guest at checkout.
            </p>

            <div id="acct-signed-in" hidden>
              <p>Signed in as <strong id="acct-email"></strong></p>
              <button class="cta" type="button" id="acct-signout">Sign out</button>
            </div>

            <div id="acct-forms">
              <div class="admin-panel" style="margin-bottom:20px">
                <h2 style="font-size:22px;margin-bottom:12px">Sign in</h2>
                <form id="acct-login" class="admin-form">
                  <label>Email
                    <input type="email" id="login-email" required autocomplete="username">
                  </label>
                  <label>Password
                    <input type="password" id="login-password" required autocomplete="current-password">
                  </label>
                  <button class="cta" type="submit">Sign in</button>
                </form>
              </div>

              <div class="admin-panel">
                <h2 style="font-size:22px;margin-bottom:12px">Create account</h2>
                <form id="acct-signup" class="admin-form">
                  <label>Email
                    <input type="email" id="signup-email" required autocomplete="username">
                  </label>
                  <label>Password (min 6)
                    <input type="password" id="signup-password" required minlength="6" autocomplete="new-password">
                  </label>
                  <button class="cta" type="submit">Sign up</button>
                </form>
              </div>

              <p id="acct-msg" class="admin-msg" role="status"></p>
            </div>
          </div>
        </section>
      `,
      mount: mountAccount
    })
  },

  notfound: {
    view: () => ({
      title:
        "Page not found · Jollibee",

      html: `
        <section>
          <div class="in">

            <h1>
              Page not found
            </h1>

            <p class="lead">
              We couldn't find that page.

              <a href="#/">
                Go to the home page
              </a>

              or

              <a href="#/menu">
                see the menu
              </a>.
            </p>

          </div>
        </section>
      `
    })
  }
};

/* ================= persistence ================= */
function load() {
  try {
    const s =
      JSON.parse(
        localStorage.getItem(KEY) || "null"
      );

    if (s) {
      Object.assign(
        AppState.orderCtx,
        s.orderCtx || {}
      );

      AppState.cart =
        Array.isArray(s.cart)
          ? s.cart
          : [];

      AppState.vouchers =
        s.vouchers || [];

      if (s.contact) {
        AppState.contact = {
          name: s.contact.name || "",
          phone: s.contact.phone || ""
        };
      }

      if (s.paymentMethod === "card" || s.paymentMethod === "cod") {
        AppState.paymentMethod = s.paymentMethod;
      }
    }

  } catch (e) {}
}

function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        orderCtx:
          AppState.orderCtx,

        cart:
          AppState.cart,

        vouchers:
          AppState.vouchers,

        contact:
          AppState.contact,

        paymentMethod:
          AppState.paymentMethod
      })
    );

  } catch (e) {}
}

/* ================= cart model ================= */
const defaultOptions = (
  it,
  over = {}
) =>
  (it.groups || []).flatMap(
    gid => {
      const g =
        GROUPS[gid];

      return g.type === "multi"
        ? []
        : [
            {
              groupId: gid,
              choiceId:
                over[gid] ||
                g.choices[0].id
            }
          ];
    }
  );

const sig = c =>
  [
    c.sku,
    c.variantId,
    c.options
      .map(
        o =>
          o.groupId +
          ":" +
          o.choiceId
      )
      .sort()
      .join(","),
    c.note || ""
  ].join("|");

function buildCartItem(
  sku,
  variantId,
  options,
  qty = 1,
  note = ""
) {
  const it = item(sku);
  const v = variant(
    it,
    variantId
  );

  const opts =
    options.map(o => {

      const g =
        GROUPS[o.groupId];

      const c =
        g.choices.find(
          x =>
            x.id ===
            o.choiceId
        );

      return {
        groupId: g.id,
        choiceId: c.id,
        label: c.label,
        price: c.price
      };
    });

  return {
    cartItemId: uid(),
    sku,
    variantId: v.id,
    options: opts,
    basePrice: v.price,
    unitPrice:
      v.price +
      opts.reduce(
        (a, o) =>
          a + o.price,
        0
      ),
    qty,
    note
  };
}

function addToCart(ci) {
  const s = sig(ci);

  const ex =
    AppState.cart.find(
      c =>
        sig(c) === s
    );

  ex
    ? ex.qty += ci.qty
    : AppState.cart.push(ci);

  commit();
}

function changeQty(
  id,
  d,
  li
) {
  const c =
    AppState.cart.find(
      x =>
        x.cartItemId === id
    );

  if (!c) return;

  c.qty += d;

  let focusTo = null;

  if (c.qty <= 0) {

    AppState.cart =
      AppState.cart.filter(
        x => x !== c
      );

    const n =
      li.nextElementSibling ||
      li.previousElementSibling;

    focusTo =
      n
        ? () =>
            n.querySelector(
              "[data-act=inc]"
            ).focus()
        : () =>
            [
              ...document.querySelectorAll(
                ".cartbtn"
              )
            ]
              .find(
                b =>
                  b.offsetParent
              )
              ?.focus();
  }

  commit();

  if (focusTo) {
    focusTo();
  }
}

function commit() {
  save();
  renderCart();
  renderBadge();
  refreshQuote();
}

async function refreshQuote() {
  const my =
    ++quoteSeq;

  try {
    const q =
      await API.calculateQuote(
        AppState.cart,
        AppState.orderCtx,
        AppState.vouchers
      );

    if (my === quoteSeq) {
      AppState.quote = q;
      renderTotals();
    }

  } catch (e) {
    console.error(e);
  }
}

/* ================= cart UI ================= */
function initPanel() {
  const PANEL = $("#panel");

  PANEL.setAttribute("role", "region");
  PANEL.setAttribute("aria-label", "Your order");

  const modePickup = AppState.orderCtx.mode !== "delivery";
  const payCod = AppState.paymentMethod !== "card";

  PANEL.innerHTML = `
    <div id="empty-msg" class="empty">
      <img data-img="l" alt="" width="96" height="96">
      <h3>Your order is empty</h3>
      <p>Add something crispy, juicy or sweet to get started.</p>
      <a class="cta" href="#/menu">Browse the menu</a>
    </div>

    <div id="cart-body" hidden>
      <ul class="lines" id="lines"></ul>

      <div class="line" id="r-sub">
        <span>Subtotal</span>
        <b id="t-sub"></b>
      </div>

      <div class="line" id="r-del">
        <span>Delivery fee</span>
        <b id="t-del"></b>
      </div>

      <div class="line" id="r-svc">
        <span>Service fee</span>
        <b id="t-svc"></b>
      </div>

      <div class="line" id="r-disc" hidden>
        <span>Discount</span>
        <b id="t-disc" style="color:#2f9e63"></b>
      </div>

      <div class="line">
        <small>VAT (12% included)</small>
        <small id="t-vat"></small>
      </div>

      <div class="line">
        <b>Total</b>
        <b id="t-total"></b>
      </div>
    </div>

    <div class="vrow">
      <input
        class="fld"
        style="margin:0"
        id="vin"
        placeholder="Voucher code"
        aria-label="Voucher code"
        autocomplete="off"
      >
      <button class="add" id="vbtn" type="button">Apply</button>
    </div>

    <div class="vmsg" id="vmsg" role="status"></div>

    <div id="checkout-opts" hidden style="margin-top:16px;display:grid;gap:12px">
      <fieldset class="og" style="margin:0">
        <legend>Order type</legend>
        <label class="opt">
          <input type="radio" name="omode" value="pickup" ${modePickup ? "checked" : ""}>
          Pickup
        </label>
        <label class="opt">
          <input type="radio" name="omode" value="delivery" ${modePickup ? "" : "checked"}>
          Delivery
        </label>
      </fieldset>

      <label>
        Store
        <select class="fld" id="ostore" style="border-radius:14px;min-height:48px"></select>
      </label>

      <label id="oaddr-wrap" ${modePickup ? "hidden" : ""}>
        Delivery address
        <input
          class="fld"
          id="oaddr"
          placeholder="Street, barangay, city"
          value="${esc(AppState.orderCtx.address || "")}"
        >
      </label>

      <label>
        Your name
        <input
          class="fld"
          id="oname"
          placeholder="Name"
          value="${esc(AppState.contact.name || "")}"
          autocomplete="name"
        >
      </label>

      <label>
        Mobile number
        <input
          class="fld"
          id="ophone"
          placeholder="09xxxxxxxxx"
          value="${esc(AppState.contact.phone || "")}"
          autocomplete="tel"
        >
      </label>

      <fieldset class="og" style="margin:0">
        <legend>Payment method</legend>
        <label class="opt">
          <input type="radio" name="opay" value="cod" ${payCod ? "checked" : ""}>
          Cash on delivery / pickup (COD)
        </label>
        <label class="opt">
          <input type="radio" name="opay" value="card" ${payCod ? "" : "checked"}>
          Card (pay at counter / on delivery)
        </label>
      </fieldset>
    </div>

    <button
      class="cta"
      id="place"
      type="button"
      style="width:100%;border:0;margin-top:12px;cursor:pointer"
      hidden
    >
      Place order
    </button>

    <p id="pmsg" role="status" style="font-weight:700"></p>
  `;

  applyImgs(PANEL);

  $("#lines").addEventListener("click", e => {
    const b = e.target.closest("button[data-act]");
    if (b) {
      const li = b.closest("li");
      changeQty(
        li.dataset.id,
        b.dataset.act === "inc" ? 1 : -1,
        li
      );
    }
  });

  $("#vbtn").onclick = applyVoucher;

  $("#vin").addEventListener("keydown", e => {
    if (e.key === "Enter") applyVoucher();
  });

  $("#place").onclick = place;

  if (AppState.vouchers[0]) {
    $("#vin").value = AppState.vouchers[0];
  }

  (async () => {
    try {
      const stores = await API.getStores("");
      const sel = $("#ostore");
      if (!sel) return;
      sel.innerHTML =
        `<option value="">Select a store</option>` +
        (stores || [])
          .map(
            s =>
              `<option value="${esc(s.id)}"${
                AppState.orderCtx.storeId === s.id ? " selected" : ""
              }>${esc(s.name)} — ${esc(s.area)}</option>`
          )
          .join("");
    } catch (_) {}
  })();

  const syncOpts = () => {
    const mode =
      (PANEL.querySelector("input[name=omode]:checked") || {}).value ||
      "pickup";
    AppState.orderCtx.mode = mode;
    AppState.orderCtx.storeId = $("#ostore")?.value || null;
    AppState.orderCtx.address = $("#oaddr")?.value.trim() || null;
    AppState.contact.name = $("#oname")?.value.trim() || "";
    AppState.contact.phone = $("#ophone")?.value.trim() || "";
    AppState.paymentMethod =
      (PANEL.querySelector("input[name=opay]:checked") || {}).value || "cod";
    const aw = $("#oaddr-wrap");
    if (aw) aw.hidden = mode !== "delivery";
    commit();
    refreshQuote();
  };

  PANEL.addEventListener("change", e => {
    if (
      e.target.matches(
        "input[name=omode], input[name=opay], #ostore, #oaddr, #oname, #ophone"
      )
    ) {
      syncOpts();
    }
  });

  PANEL.addEventListener("input", e => {
    if (e.target.matches("#oaddr, #oname, #ophone")) {
      syncOpts();
    }
  });
}

function lineEl(c) {
  const it =
    item(c.sku);

  const li =
    document.createElement("li");

  li.className =
    "line";

  li.dataset.id =
    c.cartItemId;

  li.innerHTML =
    html`
      <div>
        <b class="n"></b>
        <br>
        <small class="o"></small>
      </div>

      <div class="qty">

        <button
          type="button"
          data-act="dec"
        >
          −
        </button>

        <span class="q"></span>

        <button
          type="button"
          data-act="inc"
        >
          +
        </button>

      </div>

      <b class="lp"></b>
    `;

  li.querySelector(".n")
    .textContent =
    it.name;

  li.querySelector(
    "[data-act=dec]"
  ).setAttribute(
    "aria-label",
    "Remove one " +
      it.name
  );

  li.querySelector(
    "[data-act=inc]"
  ).setAttribute(
    "aria-label",
    "Add one " +
      it.name
  );

  return li;
}

function renderCart() {
  const list =
    $("#lines");

  if (
    !list ||
    !MENUD.length
  ) {
    return;
  }

  const ids =
    new Set(
      AppState.cart.map(
        c =>
          c.cartItemId
      )
    );

  [
    ...list.children
  ].forEach(li => {
    if (
      !ids.has(
        li.dataset.id
      )
    ) {
      li.remove();
    }
  });

  AppState.cart.forEach(
    (c, i) => {

      let li =
        list.querySelector(
          `[data-id="${c.cartItemId}"]`
        );

      if (!li) {
        li =
          lineEl(c);
      }

      setText(
        li.querySelector(".o"),
        [
          variant(
            item(c.sku),
            c.variantId
          ).label,
          ...c.options.map(
            o =>
              o.label
          )
        ].join(" · ")
      );

      setText(
        li.querySelector(".q"),
        String(c.qty)
      );

      setText(
        li.querySelector(".lp"),
        formatCurrency(
          c.unitPrice *
          c.qty
        )
      );

      if (
        list.children[i] !== li
      ) {
        list.insertBefore(
          li,
          list.children[i] ||
            null
        );
      }
    }
  );

  const has =
    AppState.cart.length > 0;

  $("#empty-msg").hidden =
    has;

  $("#cart-body").hidden =
    !has;

  $("#place").hidden =
    !has;

  const opts = $("#checkout-opts");
  if (opts) opts.hidden = !has;
}

function renderTotals() {
  const q =
    AppState.quote;

  if (!q) {
    return;
  }

  if ($("#t-sub")) {

    const f =
      formatCurrency;

    const del =
      AppState.orderCtx.mode ===
      "delivery";

    setText(
      $("#t-sub"),
      f(q.subtotal)
    );

    setText(
      $("#t-del"),
      q.deliveryFee
        ? f(q.deliveryFee)
        : "Free"
    );

    setText(
      $("#t-svc"),
      f(q.serviceFee)
    );

    $("#r-del").hidden =
      $("#r-svc").hidden =
        !del ||
        !AppState.cart.length;

    $("#r-disc").hidden =
      !q.discount;

    setText(
      $("#t-disc"),
      "−" +
        f(q.discount)
    );

    setText(
      $("#t-vat"),
      f(q.vat)
    );

    setText(
      $("#t-total"),
      f(q.total)
    );

    const vm =
      $("#vmsg");

    const v =
      q.voucher;

    if (
      !AppState.vouchers.length ||
      !v
    ) {

      vm.className =
        "vmsg";

      setText(
        vm,
        ""
      );

    } else if (v.ok) {

      vm.className =
        "vmsg ok";

      setText(
        vm,
        `${v.code} applied. You save ${f(v.amount)}.`
      );

    } else {

      vm.className =
        "vmsg bad";

      setText(
        vm,
        v.error
      );
    }
  }

  renderBadge();
}

function renderBadge() {
  const n =
    count();

  const q =
    AppState.quote;

  document
    .querySelectorAll(".cnt")
    .forEach(e => {

      setText(
        e,
        String(n)
      );

      if (
        e._n !== undefined &&
        e._n !== n
      ) {

        e.classList.remove(
          "pop"
        );

        void e.offsetWidth;

        e.classList.add(
          "pop"
        );

        BAR.classList.remove(
          "bump"
        );

        void BAR.offsetWidth;

        BAR.classList.add(
          "bump"
        );
      }

      e._n = n;
    });

  document
    .querySelectorAll(".cartbtn")
    .forEach(
      b =>
        b.setAttribute(
          "aria-label",
          `Cart, ${n} item${n === 1 ? "" : "s"}`
        )
    );

  setText(
    $("#sumn"),
    `${n} item${n === 1 ? "" : "s"}`
  );

  setText(
    $("#sumt"),
    formatCurrency(
      q
        ? q.total
        : AppState.cart.reduce(
            (a, c) =>
              a +
              c.unitPrice *
              c.qty,
            0
          )
    )
  );

  BAR.classList.toggle(
    "on",
    n > 0
  );
}

function clr() {
  AppState.cart = [];
  commit();
}

/* ================= vouchers ================= */
async function applyVoucher() {

  const code =
    $("#vin")
      .value
      .trim()
      .toUpperCase();

  if (!code) {
    AppState.vouchers = [];
    return commit();
  }

  const r =
    await API.validateVoucher(
      code,
      AppState.cart.reduce(
        (a, c) =>
          a +
          c.unitPrice *
          c.qty,
        0
      ),
      AppState.cart
    );

  if (!r.known) {

    const vm =
      $("#vmsg");

    vm.className =
      "vmsg bad";

    setText(
      vm,
      r.error
    );

    return;
  }

  AppState.vouchers = [
    r.code
  ];

  $("#vin").value =
    r.code;

  commit();
}

function useVoucher(
  code,
  btn
) {
  AppState.vouchers = [
    code
  ];

  commit();

  if (btn) {
    morph2(
      btn,
      "Saved ✓"
    );
  }

  live(
    code +
      " saved. It is applied when you review your order."
  );
}

/* ================= place order ================= */
async function place() {
  const b = $("#place");
  const pm = $("#pmsg");

  b.disabled = true;
  setText(b, "Placing order…");
  setText(pm, "");
  pm.className = "";

  const mode =
    (document.querySelector("input[name=omode]:checked") || {}).value ||
    "pickup";
  const storeId = $("#ostore")?.value || null;
  const address = $("#oaddr")?.value.trim() || null;
  const name = $("#oname")?.value.trim() || "";
  const phone = $("#ophone")?.value.trim() || "";
  const paymentMethod =
    (document.querySelector("input[name=opay]:checked") || {}).value ||
    "cod";

  AppState.orderCtx = { mode, storeId, address };
  AppState.contact = { name, phone };
  AppState.paymentMethod = paymentMethod;

  if (!storeId) {
    setText(pm, "Please select a store.");
    b.disabled = false;
    setText(b, "Place order");
    return;
  }

  if (mode === "delivery" && !address) {
    setText(pm, "Please enter a delivery address.");
    b.disabled = false;
    setText(b, "Place order");
    return;
  }

  if (!name || !phone) {
    setText(pm, "Please enter your name and mobile number.");
    b.disabled = false;
    setText(b, "Place order");
    return;
  }

  try {
    const r = await API.createOrder({
      orderCtx: AppState.orderCtx,
      vouchers: AppState.vouchers,
      contact: AppState.contact,
      paymentMethod: AppState.paymentMethod,
      items: AppState.cart.map(c => ({
        sku: c.sku,
        variantId: c.variantId,
        options: c.options.map(o => ({
          groupId: o.groupId,
          choiceId: o.choiceId
        })),
        qty: c.qty,
        note: c.note
      }))
    });

    AppState.cart = [];
    AppState.vouchers = [];
    if ($("#vin")) $("#vin").value = "";
    commit();

    const orderId = r && r.orderId;
    if (!orderId) {
      throw new Error(
        "The order was created, but no order number was returned."
      );
    }

    live(`Order ${orderId} received.`);
    nav(href("/track", { order: orderId }));
  } catch (e) {
    setText(
      pm,
      e && e.message ? e.message : "Could not place order."
    );
  } finally {
    b.disabled = false;
    setText(b, "Place order");
  }
}


/* ================= menu + category views ================= */
function cardEl(it) {

  const a =
    document.createElement(
      "article"
    );

  a.className =
    "dish";

  a.dataset.sku =
    it.sku;

  a.innerHTML =
    html`
      ${
        it.tag
          ? html`
              <span class="badge">
                ${it.tag}
              </span>
            `
          : ""
      }

      <div class="pic"></div>

      <h3>
        ${it.name}
      </h3>

      <p>
        ${it.desc}
      </p>

      ${
        it.variants.length > 1
          ? html`
              <select
                class="var"
                aria-label="Choose size for ${it.name}"
              >
                ${
                  it.variants.map(
                    v =>
                      html`
                        <option
                          value="${v.id}"
                        >
                          ${v.label}
                        </option>
                      `
                  )
                }
              </select>
            `
          : ""
      }

      <div class="row">

        <b class="price"></b>

        <button
          class="add"
          type="button"
        >
          Add to order
        </button>

      </div>
    `;

  const pic =
    a.querySelector(
      ".pic"
    );

  const pimg =
    typeof PRODUCT_IMG !==
    "undefined" &&
    PRODUCT_IMG[it.sku];

  const showSvg =
    () => {

      pic.style.background =
        it.bg;

      pic.innerHTML =
        SV(
          ART[
            it.variants[0].art ||
            it.art
          ]
        );
    };

  if (pimg) {

    pic.style.background =
      "#f7f0e6";

    pic.innerHTML =
      "";

    const im =
      document.createElement(
        "img"
      );

    im.src =
      pimg;

    im.alt =
      it.name;

    im.loading =
      "lazy";

    im.onerror =
      showSvg;

    pic.appendChild(
      im
    );

  } else {
    showSvg();
  }

  a.querySelector(
    ".price"
  ).textContent =
    formatCurrency(
      it.variants[0].price
    );

  a.querySelector(
    ".add"
  ).setAttribute(
    "aria-label",
    "Add " +
      it.name +
      " to order"
  );

  return a;
}

/* want = null -> every category with headings */
function renderMenu(want) {

  const GRID =
    $("#grid");

  const TABS =
    $("#tabs");

  const cats =
    [
      ...new Set(
        MENUD.map(
          m => m.cat
        )
      )
    ];

  const frag =
    document.createDocumentFragment();

  cats
    .filter(
      c =>
        !want ||
        c === want
    )
    .forEach(c => {

      const s =
        document.createElement(
          "section"
        );

      s.className =
        "cat";

      s.dataset.cat =
        c;

      s.id =
        "cat-" +
        slug(c);

      const h =
        document.createElement(
          "h2"
        );

      h.textContent =
        c;

      h.className =
        "cat-h";

      const g =
        document.createElement(
          "div"
        );

      g.className =
        "menu";

      MENUD
        .filter(
          m =>
            m.cat === c
        )
        .forEach(
          m =>
            g.appendChild(
              cardEl(m)
            )
        );

      if (!want) {
        s.append(h);
      }

      s.append(g);

      frag.appendChild(
        s
      );
    });

  GRID.className =
    "catwrap";

  GRID.replaceChildren(
    frag
  );

  if (
    want &&
    !cats.includes(want)
  ) {

    GRID.innerHTML =
      html`
        <p class="lead">
          Sorry, we couldn't find
          the category “${want}”.
          <a href="#/menu">
            See the full menu
          </a>
        </p>
      `.toString();
  }

  const tab =
    (
      label,
      route,
      cur
    ) => {

      const b =
        document.createElement(
          "button"
        );

      b.type =
        "button";

      b.textContent =
        label;

      b.dataset.route =
        route;

      if (cur) {
        b.setAttribute(
          "aria-current",
          "page"
        );
      }

      return b;
    };

  TABS.replaceChildren(
    tab(
      "All",
      href("/menu"),
      !want
    ),
    ...cats.map(
      c =>
        tab(
          c,
          href(
            "/category/" +
              encodeURIComponent(c)
          ),
          c === want
        )
    )
  );

  if (!want) {
    TABS
      .querySelectorAll(
        "button"
      )
      .forEach(
        (b, i) => {

          delete b.dataset.route;

          b.dataset.jump =
            i
              ? "cat-" +
                slug(
                  cats[i - 1]
                )
              : "top";
        }
      );
  }

  spy(want);
}

let SPY;

function spy(want) {

  SPY &&
    SPY.disconnect();

  if (
    want ||
    !("IntersectionObserver" in window)
  ) {
    return;
  }

  const tabs =
    [
      ...document.querySelectorAll(
        "#tabs button"
      )
    ];

  const calm =
    matchMedia(
      "(prefers-reduced-motion:reduce)"
    ).matches;

  SPY =
    new IntersectionObserver(
      es =>
        es.forEach(
          e => {

            if (!e.isIntersecting) {
              return;
            }

            const name =
              e.target.dataset.cat;

            tabs.forEach(
              b => {

                const on =
                  b.textContent ===
                  name;

                b.classList.toggle(
                  "spy",
                  on
                );

                if (on) {

                  const t =
                    b.parentElement;

                  t.scrollTo({
                    left:
                      b.offsetLeft -
                      t.clientWidth / 2 +
                      b.offsetWidth / 2,

                    behavior:
                      calm
                        ? "auto"
                        : "smooth"
                  });
                }
              }
            );
          }
        ),
      {
        rootMargin:
          "-30% 0px -60% 0px"
      }
    );

  document
    .querySelectorAll(
      "#grid .cat"
    )
    .forEach(
      x =>
        SPY.observe(x)
    );
}

function filterMenu() {

  const GRID =
    $("#grid");

  const TABS =
    $("#tabs");

  const q =
    $("#q-menu")
      .value
      .trim()
      .toLowerCase();

  let n = 0;

  GRID
    .querySelectorAll(
      ".dish"
    )
    .forEach(
      el => {

        const it =
          item(
            el.dataset.sku
          );

        const hit =
          !q ||
          [
            it.name,
            it.desc,
            it.cat,
            ...(it.tags || [])
          ]
            .join(" ")
            .toLowerCase()
            .includes(q);

        el.hidden =
          !hit;

        if (hit) {
          n++;
        }
      }
    );

  GRID
    .querySelectorAll(
      ".cat"
    )
    .forEach(
      s =>
        s.hidden =
          !s.querySelector(
            ".dish:not([hidden])"
          )
    );

  TABS.hidden =
    !!q;

  const em =
    $("#menu-empty");

  em.hidden =
    n > 0;

  if (!n) {
    em.innerHTML =
      html`
        No dishes match “${q}”.
        Try “chicken”, “spicy”
        or “sweet”.
      `.toString();
  }

  setText(
    $("#menu-status"),
    q
      ? `${n} result${n === 1 ? "" : "s"} for “${q}”`
      : ""
  );
}

function morph2(
  b,
  t
) {

  const o =
    b.dataset.label ||
    b.textContent;

  b.dataset.label =
    o;

  b.textContent =
    t;

  clearTimeout(
    b._t
  );

  b._t =
    setTimeout(
      () =>
        b.textContent =
          o,
      1500
    );
}

/* ================= toys + promos ================= */
function renderToys() {

  $("#toygrid").innerHTML =
    TOYS.map(
      (t, k) =>
        html`
          <div class="toycard">

            <img
              src="${t.s}"
              alt="${t.n}"
              loading="lazy"
            >

            <h3>
              ${t.n}
            </h3>

            <p>
              ${t.d}
            </p>

            <button
              class="add"
              type="button"
              data-k="${k}"
            >
              Build Kiddie Meal
            </button>

          </div>
        `
    ).join("");
}

function renderTickets(vs) {

  $("#tix").innerHTML =
    vs.map(
      v =>
        html`
          <div class="tk">

            <div class="big">
              ${v.big}
            </div>

            <p>
              ${v.desc}
            </p>

            <code>
              ${v.code}
            </code>

            <div
              class="row2"
              style="margin-top:0"
            >

              <button
                class="add"
                type="button"
                data-use="${v.code}"
              >
                Use this code
              </button>

              <button
                class="add ghost"
                type="button"
                data-copy="${v.code}"
              >
                Copy
              </button>

            </div>

          </div>
        `
    ).join("");
}

/* ================= store finder ================= */
async function runSearch(q) {

  const out =
    $("#found");

  out.textContent =
    "Searching…";

  try {

    const r =
      await API.getStores(q);

    if (
      out !==
      $("#found")
    ) {
      return;
    }

    out.innerHTML =
      r.length
        ? html`
            <ul class="stores">

              ${
                r.map(
                  s =>
                    html`
                      <li class="store">

                        <b>
                          ${s.name}
                        </b>

                        <span>
                          ${s.address}
                        </span>

                        <small>
                          ${s.hours}
                        </small>

                        <a
                          class="maplink"
                          href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " " + s.address)}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View on map

                          <span class="sr">
                            (opens in a new tab)
                          </span>
                        </a>

                      </li>
                    `
                )
              }

            </ul>
          `.toString()
        : html`
            No stores found for
            “${q}”.

            Try “Taguig”
            or “Makati”.
          `.toString();

  } catch (err) {

    if (
      out ===
      $("#found")
    ) {
      out.textContent =
        "Could not load stores. Please try again.";
    }
  }
}

/* ================= item customizer ================= */
function itemView(
  it,
  pre
) {

  const w =
    document.createElement(
      "article"
    );

  w.className =
    "dish detail";

  const chk =
    ok =>
      ok
        ? raw(" checked")
        : "";

  w.innerHTML =
    html`

      <div class="pic"></div>

      <h2>
        ${it.name}
      </h2>

      <p>
        ${it.desc}
      </p>

      ${
        it.variants.length > 1
          ? html`
              <fieldset class="og">

                <legend>
                  Choose one
                </legend>

                ${
                  it.variants.map(
                    (v, i) =>
                      html`
                        <label
                          class="opt"
                        >

                          <input
                            type="radio"
                            name="variant"
                            value="${v.id}"
                            ${chk(
                              pre.v
                                ? pre.v === v.id
                                : i === 0
                            )}
                          >

                          ${v.label}

                          <span class="op">
                            ${formatCurrency(
                              v.price
                            )}
                          </span>

                        </label>
                      `
                  )
                }

              </fieldset>
            `
          : ""
      }

      ${
        it.groups.map(
          gid => {

            const G =
              GROUPS[gid];

            const m =
              G.type === "multi";

            return html`
              <fieldset
                class="og"
                data-g="${gid}"
              >

                <legend>
                  ${G.label}
                </legend>

                ${
                  G.choices.map(
                    (c, i) =>
                      html`
                        <label
                          class="opt"
                        >

                          <input
                            type="${m ? "checkbox" : "radio"}"
                            name="${gid}"
                            value="${c.id}"
                            ${chk(
                              !m &&
                              (
                                gid === "toy" &&
                                pre.toy
                                  ? pre.toy === c.id
                                  : i === 0
                              )
                            )}
                          >

                          ${
                            c.img
                              ? html`
                                  <img
                                    src="${c.img}"
                                    alt=""
                                    width="44"
                                    height="44"
                                  >
                                `
                              : ""
                          }

                          ${c.label}

                          ${
                            c.price
                              ? html`
                                  <span class="op">
                                    +${formatCurrency(
                                      c.price
                                    )}
                                  </span>
                                `
                              : ""
                          }

                        </label>
                      `
                  )
                }

              </fieldset>
            `;
          }
        )
      }

      <label class="opt">

        Quantity

        <input
          class="fld"
          id="dq"
          type="number"
          min="1"
          max="20"
          value="1"
          style="width:84px;margin:0"
        >

      </label>

      <button
        class="cta"
        id="dadd"
        type="button"
        style="width:100%;border:0;margin-top:8px;cursor:pointer"
      ></button>

      <p
        id="dmsg"
        role="status"
        style="font-weight:700"
      ></p>
    `;

  const btn =
    w.querySelector(
      "#dadd"
    );

  const pic =
    w.querySelector(
      ".pic"
    );

  const pimg =
    typeof PRODUCT_IMG !==
    "undefined" &&
    PRODUCT_IMG[it.sku];

  const read =
    () => {

      const vid =
        w.querySelector(
          "[name=variant]:checked"
        )?.value ||
        it.variants[0].id;

      const opts =
        [];

      w
        .querySelectorAll(
          "fieldset[data-g]"
        )
        .forEach(
          f =>
            f
              .querySelectorAll(
                "input:checked"
              )
              .forEach(
                i =>
                  opts.push({
                    groupId:
                      f.dataset.g,

                    choiceId:
                      i.value
                  })
              )
        );

      return {
        vid,
        opts,
        qty:
          Math.max(
            1,
            Math.min(
              20,
              Math.floor(
                +w.querySelector(
                  "#dq"
                ).value
              ) || 1
            )
          )
      };
    };

  const upd =
    () => {

      const r =
        read();

      const ci =
        buildCartItem(
          it.sku,
          r.vid,
          r.opts,
          r.qty
        );

      const artKey =
        variant(
          it,
          r.vid
        ).art ||
        it.art;

      if (pimg) {

        pic.style.background =
          "#fff";

        pic.innerHTML =
          "";

        const im =
          document.createElement(
            "img"
          );

        im.src =
          pimg;

        im.alt =
          it.name;

        im.loading =
          "lazy";

        im.onerror =
          () => {
            pic.style.background =
              it.bg;

            pic.innerHTML =
              SV(
                ART[artKey]
              );
          };

        pic.appendChild(
          im
        );

      } else {

        pic.style.background =
          it.bg;

        pic.innerHTML =
          SV(
            ART[artKey]
          );
      }

      btn.textContent =
        `Add to order · ${formatCurrency(
          ci.unitPrice *
          ci.qty
        )}`;
    };

  w.addEventListener(
    "input",
    upd
  );

  upd();

  btn.onclick =
    () => {

      const r =
        read();

      addToCart(
        buildCartItem(
          it.sku,
          r.vid,
          r.opts,
          r.qty
        )
      );

      setText(
        w.querySelector(
          "#dmsg"
        ),
        `${it.name} added to your order.`
      );

      live(
        `${it.name} added.`
      );

      btn.textContent =
        "Added ✓";

      btn.classList.add(
        "ok"
      );

      setTimeout(
        () => {

          if (
            btn.isConnected
          ) {

            btn.classList.remove(
              "ok"
            );

            upd();
          }

        },
        1200
      );
    };

  return w;
}

/* ================= events ================= */
document.addEventListener(
  "click",
  e => {

    const a =
      e.target.closest(
        'a[href^="#/"]'
      );

    if (
      a &&
      a.getAttribute(
        "href"
      ) === location.hash
    ) {

      e.preventDefault();

      render();

      return;
    }

    const cl =
      e.target.closest(
        "[data-close]"
      );

    if (cl) {

      e.preventDefault();

      nav(
        LAST ||
        "#/menu"
      );

      return;
    }

    const j =
      e.target.closest(
        "[data-jump]"
      );

    if (j) {

      e.preventDefault();

      const calm =
        matchMedia(
          "(prefers-reduced-motion:reduce)"
        ).matches;

      const el =
        document.getElementById(
          j.dataset.jump
        );

      const b =
        calm
          ? "auto"
          : "smooth";

      if (el) {
        el.scrollIntoView({
          behavior: b
        });
      } else {
        scrollTo({
          top: 0,
          behavior: b
        });
      }

      return;
    }

    const r =
      e.target.closest(
        "[data-route]"
      );

    if (r) {

      e.preventDefault();

      nav(
        r.dataset.route
      );

      return;
    }

    const retry =
      e.target.closest(
        "[data-retry]"
      );

    if (retry) {
      loadData().then(
        render
      );

      return;
    }

    const add =
      e.target.closest(
        ".dish:not(.detail) .add"
      );

    if (add) {

      const el =
        add.closest(
          ".dish"
        );

      const it =
        item(
          el.dataset.sku
        );

      const sel =
        el.querySelector(
          "select.var"
        );

      nav(
        href(
          "/item/" +
            encodeURIComponent(
              it.sku
            ),
          sel
            ? {
                v:
                  sel.value
              }
            : {}
        )
      );

      return;
    }

    const kid =
      e.target.closest(
        "[data-k]"
      );

    if (kid) {

      nav(
        href(
          "/kiddie",
          {
            toy:
              "toy-" +
              (+kid.dataset.k + 1)
          }
        )
      );

      return;
    }

    const use =
      e.target.closest(
        "[data-use]"
      );

    if (use) {
      return useVoucher(
        use.dataset.use,
        use
      );
    }

    const cp =
      e.target.closest(
        "[data-copy]"
      );

    if (cp) {

      (
        navigator.clipboard
          ? navigator.clipboard.writeText(
              cp.dataset.copy
            )
          : Promise.reject()
      ).then(
        () =>
          morph2(
            cp,
            "Copied!"
          ),
        () =>
          morph2(
            cp,
            "Press Ctrl+C"
          )
      );
    }
  }
);

/* Keyboard */
document.addEventListener(
  "keydown",
  e => {

    if (
      e.key === "Escape" &&
      !SHEET.hidden
    ) {

      nav(
        LAST ||
        "#/menu"
      );

      return;
    }

    if (
      e.key === "Enter" ||
      e.key === " "
    ) {

      const d =
        e.target.closest(
          "[role=link][data-route]"
        );

      if (d) {

        e.preventDefault();

        nav(
          d.dataset.route
        );
      }
    }
  }
);

/* Store finder form */
document.addEventListener(
  "submit",
  e => {

    const f =
      e.target.closest(
        "form.find"
      );

    if (!f) {
      return;
    }

    e.preventDefault();

    const q =
      $("#q")
        .value
        .trim();

    const h =
      href(
        "/stores",
        q
          ? { q }
          : {}
      );

    if (
      document.body.dataset.page ===
      "stores"
    ) {

      history.replaceState(
        null,
        "",
        h
      );

      runSearch(q);

    } else {

      nav(h);
    }
  }
);

/* Menu search */
document.addEventListener(
  "input",
  e => {

    if (
      e.target.id ===
      "q-menu"
    ) {
      filterMenu();
    }
  }
);

/* Variant selector */
document.addEventListener(
  "change",
  e => {

    const s =
      e.target.closest(
        "select.var"
      );

    if (!s) {
      return;
    }

    const el =
      s.closest(
        ".dish"
      );

    const it =
      item(
        el.dataset.sku
      );

    const v =
      variant(
        it,
        s.value
      );

    setText(
      el.querySelector(
        ".price"
      ),
      formatCurrency(
        v.price
      )
    );

    if (v.art) {
      el.querySelector(
        ".pic"
      ).innerHTML =
        SV(
          ART[v.art]
        );
    }
  }
);

/* Another browser tab changed the cart */
addEventListener(
  "storage",
  e => {

    if (
      e.key !== KEY ||
      !e.newValue
    ) {
      return;
    }

    try {

      const s =
        JSON.parse(
          e.newValue
        );

      AppState.cart =
        Array.isArray(s.cart)
          ? s.cart
          : [];

      AppState.vouchers =
        s.vouchers || [];

      if (s.orderCtx) {
        Object.assign(AppState.orderCtx, s.orderCtx);
      }

      if (s.contact) {
        AppState.contact = {
          name: s.contact.name || "",
          phone: s.contact.phone || ""
        };
      }

      if (s.paymentMethod === "card" || s.paymentMethod === "cod") {
        AppState.paymentMethod = s.paymentMethod;
      }

      const v =
        $("#vin");

      if (v) {
        v.value =
          AppState.vouchers[0] ||
          "";
      }

      renderCart();
      renderBadge();
      refreshQuote();

    } catch (_) {}
  }
);

/* ================= init ================= */
function loadData() {

  DATA_ERR = false;

  ready =
    (async () => {

      try {

        const [
          m,
          vs
        ] =
          await Promise.all([
            API.getMenu(),
            API.getVouchers()
          ]);

        MENUD =
          m.items;

        GROUPS =
          m.groups;

        VOUCHER_LIST =
          vs;

        Object
          .values(GROUPS)
          .forEach(
            g =>
              (
                g.choices ||
                []
              ).forEach(
                c => {

                  if (
                    c.img &&
                    c.img.startsWith(
                      "images/"
                    )
                  ) {

                    c.img =
                      c.img.replace(
                        /^images\//,
                        ""
                      );
                  }
                }
              )
          );

        AppState.cart =
          AppState.cart.filter(
            c =>
              item(c.sku) &&
              variant(
                item(c.sku),
                c.variantId
              ).id ===
                c.variantId
          );

        DATA_OK =
          true;

        commit();

      } catch (e) {

        console.error(e);

        DATA_ERR =
          true;
      }
    })();

  return ready;
}

load();

renderBadge();

/*
  Start loading the existing catalogue.
*/
loadData();

/*
  Draw the current route.
*/
render();

/* Load customer session for Account nav */
refreshUser();

/* ================= scroll reveal ================= */
(function () {

  const SEL =
    ".dish:not(.detail):not(.skel)," +
    ".fact," +
    ".tk," +
    ".toycard," +
    ".store," +
    ".cat-h," +
    ".brandrow," +
    ".chap," +
    ".quote";

  const calm =
    matchMedia(
      "(prefers-reduced-motion:reduce)"
    ).matches;

  if (
    (window.Motion && window.Motion.active) ||
    calm ||
    !("IntersectionObserver" in window)
  ) {
    return;
  }

  const io =
    new IntersectionObserver(
      es =>
        es.forEach(
          e => {

            if (
              !e.isIntersecting
            ) {
              return;
            }

            const el =
              e.target;

            io.unobserve(el);

            el.classList.add(
              "in"
            );

            el.addEventListener(
              "animationend",
              () => {
                el.classList.remove(
                  "rv",
                  "in"
                );
              },
              {
                once: true
              }
            );
          }
        ),
      {
        rootMargin:
          "0px 0px -8% 0px"
      }
    );

  function scan() {

    document
      .querySelectorAll(
        SEL
      )
      .forEach(
        el => {

          if (el._rv) {
            return;
          }

          el._rv =
            1;

          el.style.setProperty(
            "--d",
            (
              [
                ...el.parentNode.children
              ].indexOf(el) % 4
            ) *
              80 +
              "ms"
          );

          el.classList.add(
            "rv"
          );

          io.observe(el);
        }
      );
  }

  new MutationObserver(
    scan
  ).observe(
    OUT,
    {
      childList: true,
      subtree: true
    }
  );

  scan();

})();