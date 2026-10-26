/* =========================================================
   motion.js — GSAP + ScrollTrigger + Lenis layer
   Loaded AFTER the CDN libraries and BEFORE app.js.
   - Does nothing if the libraries failed to load or the user
     prefers reduced motion (the old CSS reveal then stays active).
   - One animation loop: Lenis is driven by gsap.ticker.
   - Page animations live in a gsap.context() that is reverted on
     every route change, so nothing leaks between pages.
   React-Bits-style effects (split-text reveal, magnetic buttons,
   spotlight cards) are re-implemented here in vanilla JS.
   ========================================================= */
(function () {
  "use strict";

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ready = !reduce && !!window.gsap && !!window.ScrollTrigger;

  var M = (window.Motion = {
    active: ready,
    lenis: null,
    scrollTop: function () {
      if (M.lenis) M.lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    },
    page: function () {}
  });

  if (!ready) return;

  gsap.registerPlugin(ScrollTrigger);

  var main = document.getElementById("main");
  var fine = matchMedia("(hover:hover) and (pointer:fine)");
  var ctx = null;
  var mo = null;
  var raf = 0;

  /* ---------- Lenis (smooth scroll), driven by GSAP's ticker ---------- */
  if (window.Lenis) {
    var lenis = new Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    M.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    /* pause page scrolling while the cart sheet is open */
    var syncLock = function () {
      if (document.body.classList.contains("sheet-open")) lenis.stop();
      else lenis.start();
    };
    new MutationObserver(syncLock).observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
    syncLock();
  }

  /* ---------- helpers ---------- */

  /* Split text into word masks (React Bits "SplitText" style). */
  function splitWords(el) {
    if (!el || el._split) return [];
    var out = [];
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (s) {
            if (!s) return;
            if (/^\s+$/.test(s)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            var o = document.createElement("span");
            var i = document.createElement("span");
            o.className = "mw";
            o.setAttribute("aria-hidden", "true");
            i.className = "mwi";
            i.textContent = s;
            o.appendChild(i);
            frag.appendChild(o);
            out.push(i);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    })(el);
    el._split = 1;
    return out;
  }

  /* Magnetic button (React Bits "Magnet" style). */
  function magnet(el, strength) {
    if (el._mag || !fine.matches) return;
    el._mag = 1;
    el.setAttribute("data-mag", "");
    var xt = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
    var yt = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      xt((e.clientX - r.left - r.width / 2) * strength);
      yt((e.clientY - r.top - r.height / 2) * strength);
    });
    el.addEventListener("pointerleave", function () { xt(0); yt(0); });
  }

  /* Cursor spotlight on cards (React Bits "SpotlightCard" style). */
  function spotlight(root) {
    if (!fine.matches) return;
    root
      .querySelectorAll(".fact, .tk, .toycard, .dish:not(.skel):not(.detail)")
      .forEach(function (c) {
        if (c._sp) return;
        c._sp = 1;
        if (getComputedStyle(c).position === "static") c.style.position = "relative";
        var s = document.createElement("span");
        s.className = "spot";
        s.setAttribute("aria-hidden", "true");
        c.appendChild(s);
        c.addEventListener("pointermove", function (e) {
          var r = c.getBoundingClientRect();
          c.style.setProperty("--mx", e.clientX - r.left + "px");
          c.style.setProperty("--my", e.clientY - r.top + "px");
        });
      });
  }

  /* ---------- scroll reveals ---------- */
  var REVEAL = [
    ".dish:not(.detail):not(.skel)", ".fact", ".tk", ".toycard", ".store",
    ".cat-h", ".brandrow", ".chap", ".quote",
    "section .in > h2", "section .in > .lead", ".eyebrow"
  ].join(",");

  function reveal(els) {
    els = els.filter(function (el) { return !el._m; });
    if (!els.length) return;
    els.forEach(function (el) { el._m = 1; });
    gsap.set(els, { autoAlpha: 0, y: 28 });
    ScrollTrigger.batch(els, {
      start: "top 92%",
      once: true,
      interval: 0.1,
      batchMax: 6,
      onEnter: function (batch) {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: true,
          clearProps: "opacity,visibility,transform"
        });
      }
    });
  }

  function storyImages() {
    main.querySelectorAll(".chap .cimg").forEach(function (c) {
      if (c._m) return;
      c._m = 1;
      gsap.fromTo(
        c,
        { clipPath: "inset(0 0 100% 0)" },
        {
          clipPath: "inset(0 0 0% 0)",
          duration: 1,
          ease: "power3.inOut",
          clearProps: "clipPath",
          scrollTrigger: { trigger: c, start: "top 88%", once: true }
        }
      );
    });
  }

  function scan() {
    try {
      reveal(Array.prototype.slice.call(main.querySelectorAll(REVEAL)));
      storyImages();
      spotlight(main);
    } catch (e) {
      console.error("motion scan failed", e);
    }
  }

  /* ---------- home hero ---------- */
  function hero(first) {
    var h = main.querySelector(".hero");
    if (!h) return false;
    var h1 = h.querySelector("h1");
    var p = h.querySelector("p");
    var ctas = h.querySelectorAll(".cta");
    var plate = h.querySelector(".plate");
    var col = h.querySelector(".hero-in > div");
    var words = splitWords(h1);

    var tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: first ? 0.15 : 0 });
    if (words.length) {
      tl.from(words, {
        yPercent: 115, duration: 0.9, stagger: 0.09,
        onComplete: function () {
          h1.querySelectorAll(".mw").forEach(function (m) { m.classList.add("done"); });
        }
      }, 0);
    }
    if (p) tl.from(p, { autoAlpha: 0, y: 18, duration: 0.7, clearProps: "all" }, 0.35);
    if (ctas.length) {
      tl.from(ctas, { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.1, clearProps: "opacity,visibility,transform" }, 0.5);
    }
    if (plate) tl.from(plate, { autoAlpha: 0, scale: 0.92, duration: 1.1 }, 0.2);

    ctas.forEach(function (c) { magnet(c, 0.25); });

    /* subtle depth: text and mascot drift at different speeds (desktop only) */
    if (innerWidth > 768) {
      var st = { trigger: h, start: "top top", end: "bottom top", scrub: 0.6 };
      if (col) gsap.to(col, { y: 36, ease: "none", scrollTrigger: st });
      if (plate) gsap.to(plate, { y: -34, ease: "none", scrollTrigger: st });
    }
    return true;
  }

  /* ---------- other pages: headline reveal ---------- */
  function heading() {
    var h1 = main.querySelector("h1");
    if (!h1 || h1.textContent.length > 70) return;
    var words = splitWords(h1);
    if (!words.length) return;
    gsap.from(words, {
      yPercent: 110, duration: 0.8, stagger: 0.07, ease: "power3.out", delay: 0.05,
      onComplete: function () {
        h1.querySelectorAll(".mw").forEach(function (m) { m.classList.add("done"); });
      }
    });
  }

  /* ---------- router hook ---------- */
  function teardown() {
    if (mo) { mo.disconnect(); mo = null; }
    if (ctx) { ctx.revert(); ctx = null; }
    cancelAnimationFrame(raf);
  }

  M.page = function (name, target, first) {
    if (target !== main) return; /* cart sheet: leave the page underneath alone */
    teardown();
    try {
      ctx = gsap.context(function () {
        if (!hero(first)) {
          heading();
          gsap.fromTo(main, { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", clearProps: "opacity,visibility,transform" });
        }
        scan();
      }, main);

      /* content that arrives after render (menu grid, toys, stores…) */
      mo = new MutationObserver(function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { if (ctx) ctx.add(scan); });
      });
      mo.observe(main, { childList: true, subtree: true });

      requestAnimationFrame(function () { ScrollTrigger.refresh(); });
    } catch (e) {
      console.error("motion page failed", e);
      teardown();
      gsap.set(main.querySelectorAll("*"), { clearProps: "opacity,visibility,transform" });
    }
  };

  /* ---------- one-time chrome intro ---------- */
  gsap.from(".side-head, .side-company, .side-group, .side-nav a", {
    autoAlpha: 0, x: -14, duration: 0.5, stagger: 0.03, delay: 0.1,
    ease: "power2.out", clearProps: "opacity,visibility,transform"
  });
  gsap.from(".top nav > *", {
    autoAlpha: 0, y: -10, duration: 0.5, stagger: 0.04, delay: 0.1,
    ease: "power2.out", clearProps: "opacity,visibility,transform"
  });

  /* keep trigger positions right when images/fonts change page height */
  var rt = 0;
  function refreshSoon() {
    clearTimeout(rt);
    rt = setTimeout(function () { ScrollTrigger.refresh(); }, 200);
  }
  addEventListener("load", refreshSoon);
  if (window.ResizeObserver) new ResizeObserver(refreshSoon).observe(main);
})();