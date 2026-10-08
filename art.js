const IMG = {
  m: "mascot.jpg",
  l: "logo.jpg"
};

/* Product photos for menu cards (put these files next to index.html, or in images/) */
const PRODUCT_IMG = {
  "PRM-SHARE":  "prod-share.jpg",      /* Sharing Combo / Mix & Match */
  "PRM-BUCKET": "prod-bucket.jpg",     /* Bucket Barkada / Chickenjoy bucket */
  "PRM-DUO":    "prod-duo.jpg",        /* Burger Duo */
  "KID-MEAL":   "prod-kiddie.jpg",     /* Kiddie Meal / Fun Store toys */
  "CHK-JOY":    "prod-chickenjoy.jpg", /* Chickenjoy */
  "PST-SPAG":   "prod-spaghetti.jpg",  /* Jolly Spaghetti */
  "PST-PALA":   "prod-palabok.jpg",    /* Palabok */
  "BGR-YUM":    "prod-yumburger.jpg",  /* Yumburger */
  "BGR-STEAK":  "prod-steak.jpg",      /* Burger Steak */
  "SDE-FRIES":  "prod-fries.jpg",      /* Crispy Fries */
  "DST-PIE":    "prod-pie.jpg",        /* Peach Mango Pie */
  "DST-SUNDAE": "prod-sundae.jpg",     /* Chocolate Sundae */
  "DRK-TEA":    "prod-tea.jpg"         /* Iced Tea */
  
};

/* Re-runnable: the SPA router calls applyImgs(root) after every view swap */
function applyImgs(root = document) {
  root.querySelectorAll("[data-img]").forEach(e => {
    e.src = IMG[e.dataset.img];
  });
}

applyImgs();

const TOYS = [
  {
    n: "Birthday Snoopy",
    d: "Ready to party with a candle-topped cupcake.",
    s: "toy-1.jpg"
  },
  {
    n: "Detective Snoopy",
    d: "Magnifying glass in paw and always on the case.",
    s: "toy-2.jpg"
  },
  {
    n: "Joe Cool Rocker",
    d: "Shades up and guitar ready for the stage.",
    s: "toy-3.jpg"
  },
  {
    n: "Pirate Snoopy & Woodstock",
    d: "Sailing the seas with his spyglass buddy.",
    s: "toy-4.jpg"
  },
  {
    n: "Cupid Snoopy",
    d: "Bow, arrow and a heart to share.",
    s: "toy-5.jpg"
  },
  {
    n: "Doghouse Snoopy & Woodstock",
    d: "Napping on the red doghouse with his best friend.",
    s: "toy-6.jpg"
  }
];

const toy = {};

const SV = b =>
  `<svg viewBox="0 0 200 140" aria-hidden="true">${b}</svg>`;

const sh =
  '<ellipse cx="100" cy="122" rx="70" ry="9" fill="#000" opacity=".15"/>';

const pl =
  sh +
  '<ellipse cx="100" cy="98" rx="88" ry="30" fill="#fff"/>' +
  '<ellipse cx="100" cy="97" rx="68" ry="21" fill="#f0eadf"/>';

const rice =
  '<ellipse cx="54" cy="88" rx="26" ry="15" fill="#fffdf6" stroke="#e5dccb"/>' +
  '<g fill="#e5dccb">' +
  '<circle cx="46" cy="84" r="2"/>' +
  '<circle cx="58" cy="80" r="2"/>' +
  '<circle cx="62" cy="90" r="2"/>' +
  '<circle cx="48" cy="93" r="2"/>' +
  '</g>';

const ART = {

  kid1:
    '<g fill="#fff">' +
    '<path d="M22 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>' +
    '<path d="M178 20l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/>' +
    '<path d="M170 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>' +
    '</g>' +
    '<path d="M30 112c-7-7-16 2-7 9l7 6 7-6c9-7 0-16-7-9z" fill="#ff8fa3"/>' +
    '<ellipse cx="100" cy="126" rx="62" ry="8" fill="#000" opacity=".12"/>' +
    '<g fill="#f6c84a" stroke="#d99a1e">' +
    '<rect x="66" y="34" width="9" height="32" rx="3" transform="rotate(-12 70 50)"/>' +
    '<rect x="78" y="28" width="9" height="36" rx="3" transform="rotate(-3 82 46)"/>' +
    '<rect x="90" y="32" width="9" height="34" rx="3" transform="rotate(8 94 49)"/>' +
    '</g>' +
    '<g transform="rotate(12 122 44)">' +
    '<ellipse cx="118" cy="40" rx="15" ry="11" fill="#d9822b"/>' +
    '<rect x="129" y="37" width="16" height="6" rx="3" fill="#fff6e6"/>' +
    '<circle cx="146" cy="37" r="4" fill="#fff6e6"/>' +
    '<circle cx="146" cy="44" r="4" fill="#fff6e6"/>' +
    '</g>' +
    '<rect x="52" y="64" width="96" height="58" rx="16" fill="#e8283a"/>' +
    '<rect x="47" y="56" width="106" height="17" rx="8.5" fill="#ffc425"/>' +
    '<path d="M60 64h80" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="84" cy="95" rx="5" ry="6.5" fill="#2a1210"/>' +
    '<ellipse cx="116" cy="95" rx="5" ry="6.5" fill="#2a1210"/>' +
    '<circle cx="86" cy="92.5" r="2" fill="#fff"/>' +
    '<circle cx="118" cy="92.5" r="2" fill="#fff"/>' +
    '<ellipse cx="71" cy="105" rx="7.5" ry="4.2" fill="#ff9aa8"/>' +
    '<ellipse cx="129" cy="105" rx="7.5" ry="4.2" fill="#ff9aa8"/>' +
    '<path d="M93 103q7 9 14 0" stroke="#2a1210" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M96 105q4 5 8 0z" fill="#ff7d8c"/>' +
    '<g transform="translate(148 82)">' +
    '<ellipse cx="14" cy="28" rx="21" ry="15" fill="#ffd23f"/>' +
    '<circle cx="22" cy="8" r="13" fill="#ffd23f"/>' +
    '<path d="M33 8l11 3-11 4z" fill="#ff8a1f"/>' +
    '<circle cx="26" cy="5" r="2.2" fill="#2a1210"/>' +
    '<ellipse cx="18" cy="12" rx="3.5" ry="2" fill="#ff9aa8"/>' +
    '<path d="M-3 26q9 11 21 4" stroke="#e6a800" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '</g>' +
    '<ellipse cx="30" cy="62" rx="11" ry="14" fill="#6cc4ff"/>' +
    '<ellipse cx="26" cy="56" rx="3" ry="5" fill="#fff" opacity=".6"/>' +
    '<path d="M30 76q-5 12 3 24" stroke="#9aa" stroke-width="1.5" fill="none"/>',

  kid2:
    '<g fill="#fff">' +
    '<path d="M22 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>' +
    '<path d="M178 20l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/>' +
    '<path d="M170 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>' +
    '</g>' +
    '<path d="M30 112c-7-7-16 2-7 9l7 6 7-6c9-7 0-16-7-9z" fill="#ff8fa3"/>' +
    '<ellipse cx="100" cy="126" rx="62" ry="8" fill="#000" opacity=".12"/>' +
    '<ellipse cx="100" cy="50" rx="30" ry="14" fill="#e0561f"/>' +
    '<path d="M74 48q13-10 26 0t26 0" stroke="#f08a3c" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="100" cy="43" rx="19" ry="8" fill="#b3261e"/>' +
    '<circle cx="93" cy="41" r="4.5" fill="#d96a5a" stroke="#a8392d"/>' +
    '<circle cx="107" cy="43" r="4.5" fill="#d96a5a" stroke="#a8392d"/>' +
    '<g stroke="#c9c9c9" stroke-width="3" stroke-linecap="round">' +
    '<path d="M138 28v28M133 28v10M143 28v10"/>' +
    '</g>' +
    '<rect x="52" y="64" width="96" height="58" rx="16" fill="#e8283a"/>' +
    '<rect x="47" y="56" width="106" height="17" rx="8.5" fill="#ffc425"/>' +
    '<path d="M60 64h80" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="84" cy="95" rx="5" ry="6.5" fill="#2a1210"/>' +
    '<ellipse cx="116" cy="95" rx="5" ry="6.5" fill="#2a1210"/>' +
    '<circle cx="86" cy="92.5" r="2" fill="#fff"/>' +
    '<circle cx="118" cy="92.5" r="2" fill="#fff"/>' +
    '<ellipse cx="71" cy="105" rx="7.5" ry="4.2" fill="#ff9aa8"/>' +
    '<ellipse cx="129" cy="105" rx="7.5" ry="4.2" fill="#ff9aa8"/>' +
    '<path d="M93 103q7 9 14 0" stroke="#2a1210" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M96 105q4 5 8 0z" fill="#ff7d8c"/>' +
    '<g transform="translate(148 82)">' +
    '<ellipse cx="14" cy="28" rx="21" ry="15" fill="#ffd23f"/>' +
    '<circle cx="22" cy="8" r="13" fill="#ffd23f"/>' +
    '<path d="M33 8l11 3-11 4z" fill="#ff8a1f"/>' +
    '<circle cx="26" cy="5" r="2.2" fill="#2a1210"/>' +
    '<ellipse cx="18" cy="12" rx="3.5" ry="2" fill="#ff9aa8"/>' +
    '<path d="M-3 26q9 11 21 4" stroke="#e6a800" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '</g>' +
    '<ellipse cx="30" cy="62" rx="11" ry="14" fill="#6cc4ff"/>' +
    '<ellipse cx="26" cy="56" rx="3" ry="5" fill="#fff" opacity=".6"/>' +
    '<path d="M30 76q-5 12 3 24" stroke="#9aa" stroke-width="1.5" fill="none"/>',

  kid3:
    '<g fill="#fff">' +
    '<path d="M22 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>' +
    '<path d="M178 20l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/>' +
    '<path d="M170 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>' +
    '</g>' +
    '<path d="M30 112c-7-7-16 2-7 9l7 6 7-6c9-7 0-16-7-9z" fill="#ff8fa3"/>' +
    '<ellipse cx="100" cy="126" rx="62" ry="8" fill="#000" opacity=".12"/>' +
    '<g fill="#f6c84a" stroke="#d99a1e">' +
    '<rect x="130" y="34" width="9" height="30" rx="3" transform="rotate(8 134 50)"/>' +
    '<rect x="141" y="38" width="9" height="26" rx="3" transform="rotate(16 145 51)"/>' +
    '</g>' +
    '<rect x="68" y="50" width="50" height="8" rx="4" fill="#d9993f"/>' +
    '<rect x="66" y="45" width="54" height="7" rx="3.5" fill="#5a2e17"/>' +
    '<path d="M66 45q6 6 13.500 0t13.500 0 13.500 0 13.500 0v-3H66z" fill="#58a83a"/>' +
    '<path d="M68 42c0-15 11-21 25-21s25 6 25 21z" fill="#e0a24a"/>' +
    '<g fill="#fff3d6">' +
    '<ellipse cx="84" cy="32" rx="3.500" ry="1.800"/>' +
    '<ellipse cx="97" cy="28" rx="3.500" ry="1.800"/>' +
    '<ellipse cx="106" cy="36" rx="3.500" ry="1.800"/>' +
    '</g>' +
    '<rect x="52" y="64" width="96" height="58" rx="16" fill="#e8283a"/>' +
    '<rect x="47" y="56" width="106" height="17" rx="8.5" fill="#ffc425"/>' +
    '<path d="M60 64h80" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="84" cy="95" rx="5" ry="6.5" fill="#2a1210"/>' +
    '<ellipse cx="116" cy="95" rx="5" ry="6.5" fill="#2a1210"/>' +
    '<circle cx="86" cy="92.5" r="2" fill="#fff"/>' +
    '<circle cx="118" cy="92.5" r="2" fill="#fff"/>' +
    '<ellipse cx="71" cy="105" rx="7.5" ry="4.2" fill="#ff9aa8"/>' +
    '<ellipse cx="129" cy="105" rx="7.5" ry="4.2" fill="#ff9aa8"/>' +
    '<path d="M93 103q7 9 14 0" stroke="#2a1210" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M96 105q4 5 8 0z" fill="#ff7d8c"/>' +
    '<g transform="translate(148 82)">' +
    '<ellipse cx="14" cy="28" rx="21" ry="15" fill="#ffd23f"/>' +
    '<circle cx="22" cy="8" r="13" fill="#ffd23f"/>' +
    '<path d="M33 8l11 3-11 4z" fill="#ff8a1f"/>' +
    '<circle cx="26" cy="5" r="2.2" fill="#2a1210"/>' +
    '<ellipse cx="18" cy="12" rx="3.5" ry="2" fill="#ff9aa8"/>' +
    '<path d="M-3 26q9 11 21 4" stroke="#e6a800" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '</g>' +
    '<ellipse cx="30" cy="62" rx="11" ry="14" fill="#6cc4ff"/>' +
    '<ellipse cx="26" cy="56" rx="3" ry="5" fill="#fff" opacity=".6"/>' +
    '<path d="M30 76q-5 12 3 24" stroke="#9aa" stroke-width="1.5" fill="none"/>',

  kid:
    '<ellipse cx="100" cy="122" rx="70" ry="9" fill="#000" opacity=".15"/>' +
    '<g fill="#f6c84a" stroke="#d99a1e">' +
    '<rect x="72" y="30" width="10" height="44" rx="3" transform="rotate(-12 77 52)"/>' +
    '<rect x="88" y="24" width="10" height="48" rx="3" transform="rotate(-4 93 48)"/>' +
    '<rect x="104" y="26" width="10" height="46" rx="3" transform="rotate(6 109 49)"/>' +
    '<rect x="118" y="32" width="10" height="42" rx="3" transform="rotate(14 123 53)"/>' +
    '</g>' +
    '<path d="M56 68h88l-9 54H65z" fill="#d7192a"/>' +
    '<path d="M56 68h88l-1 10H57z" fill="#ffc425"/>' +
    '<circle cx="85" cy="92" r="4.5" fill="#fff"/>' +
    '<circle cx="115" cy="92" r="4.5" fill="#fff"/>' +
    '<path d="M82 104q18 14 36 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M164 34l6 14 15 1-12 10 4 15-13-8-13 8 4-15-12-10 15-1z" fill="#ffc425" stroke="#e89a00" stroke-width="2" transform="translate(-2 6)"/>',

  chicken:
    pl +
    rice +
    '<path d="M88 96c-4-28 24-44 50-35 22 8 24 32 5 40-18 8-51 8-55-5z" fill="#d9822b"/>' +
    '<path d="M98 84c8-15 28-19 42-10" stroke="#f4b957" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<g transform="rotate(-22 130 52)">' +
    '<ellipse cx="118" cy="52" rx="24" ry="15" fill="#cf7a22"/>' +
    '<rect x="138" y="48" width="26" height="8" rx="4" fill="#fff6e6"/>' +
    '<circle cx="165" cy="48" r="5" fill="#fff6e6"/>' +
    '<circle cx="165" cy="57" r="5" fill="#fff6e6"/>' +
    '</g>' +
    '<g fill="#8a4a12" opacity=".55">' +
    '<circle cx="106" cy="92" r="2"/>' +
    '<circle cx="122" cy="88" r="2.5"/>' +
    '<circle cx="136" cy="94" r="2"/>' +
    '<circle cx="112" cy="50" r="2"/>' +
    '<circle cx="126" cy="56" r="2"/>' +
    '</g>' +
    '<ellipse cx="36" cy="58" rx="17" ry="6" fill="#5b2b10"/>' +
    '<path d="M19 58v10c0 4 8 7 17 7s17-3 17-7V58z" fill="#fff" stroke="#e5dccb"/>',

  spaghetti:
    pl +
    '<ellipse cx="100" cy="86" rx="54" ry="26" fill="#e0561f"/>' +
    '<path d="M58 84q20-20 42-4t42-4M64 94q36-18 72 0" stroke="#f08a3c" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="100" cy="74" rx="40" ry="15" fill="#b3261e"/>' +
    '<g fill="#d96a5a" stroke="#a8392d">' +
    '<circle cx="84" cy="70" r="7"/>' +
    '<circle cx="106" cy="66" r="7"/>' +
    '<circle cx="124" cy="75" r="7"/>' +
    '</g>' +
    '<path d="M68 68l20-6M96 60l24-4M102 74l22 4M80 80l16 4" stroke="#ffd34d" stroke-width="3" stroke-linecap="round"/>',

  burger:
    sh +
    '<path d="M40 104h120v8c0 9-9 12-22 12H62c-13 0-22-3-22-12z" fill="#d9993f"/>' +
    '<rect x="36" y="90" width="128" height="17" rx="8" fill="#5a2e17"/>' +
    '<path d="M42 88h116l-14 13-14-8-14 10-14-10-14 8-14-8z" fill="#ffcf33"/>' +
    '<path d="M34 82q10 10 20 0t20 0 20 0 20 0 20 0 20 0 14 4v8H34z" fill="#58a83a"/>' +
    '<rect x="46" y="76" width="108" height="8" rx="4" fill="#d6372b"/>' +
    '<path d="M38 78c0-36 28-52 62-52s62 16 62 52z" fill="#e0a24a"/>' +
    '<path d="M52 60c6-18 24-26 44-28" stroke="#f3c777" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<g fill="#fff3d6">' +
    '<ellipse cx="84" cy="48" rx="4" ry="2" transform="rotate(-20 84 48)"/>' +
    '<ellipse cx="108" cy="42" rx="4" ry="2"/>' +
    '<ellipse cx="128" cy="54" rx="4" ry="2" transform="rotate(25 128 54)"/>' +
    '<ellipse cx="96" cy="62" rx="4" ry="2" transform="rotate(10 96 62)"/>' +
    '<ellipse cx="70" cy="64" rx="4" ry="2"/>' +
    '</g>',

  fries:
    sh +
    '<g fill="#f6c84a" stroke="#d99a1e">' +
    '<rect x="66" y="22" width="11" height="60" rx="3" transform="rotate(-14 71 52)"/>' +
    '<rect x="82" y="14" width="11" height="64" rx="3" transform="rotate(-6 87 46)"/>' +
    '<rect x="98" y="10" width="11" height="66" rx="3"/>' +
    '<rect x="114" y="16" width="11" height="62" rx="3" transform="rotate(8 119 47)"/>' +
    '<rect x="128" y="24" width="11" height="58" rx="3" transform="rotate(16 133 53)"/>' +
    '</g>' +
    '<path d="M58 70h84l-11 54H69z" fill="#d7192a"/>' +
    '<path d="M62 92h76l-2 14H64z" fill="#ffc425"/>' +
    '<circle cx="100" cy="99" r="5" fill="#d7192a"/>',

  pie:
    sh +
    '<rect x="36" y="48" width="128" height="64" rx="12" fill="#e8a93a"/>' +
    '<path d="M36 58h128M36 102h128" stroke="#b9771c" stroke-width="3" stroke-dasharray="3 4"/>' +
    '<path d="M164 58q14 8 0 44z" fill="#ff9b3d"/>' +
    '<ellipse cx="156" cy="80" rx="10" ry="14" fill="#ffb347"/>' +
    '<rect x="58" y="68" width="62" height="24" rx="12" fill="#d7192a"/>' +
    '<circle cx="76" cy="80" r="6" fill="#ffc425"/>' +
    '<path d="M52 52c20-6 50-6 70 0" stroke="#f6cc7a" stroke-width="4" fill="none" stroke-linecap="round"/>',

  palabok:
    pl +
    '<ellipse cx="100" cy="88" rx="56" ry="26" fill="#f4a63a"/>' +
    '<path d="M56 86q22-18 44-2t44-2M64 96q36-18 72 0" stroke="#ffd27a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="100" cy="78" rx="44" ry="16" fill="#e9731f"/>' +
    '<g stroke="#ff7b5c" stroke-width="8" fill="none" stroke-linecap="round">' +
    '<path d="M70 72q8-14 20-6"/>' +
    '<path d="M104 62q12-8 22 2"/>' +
    '</g>' +
    '<circle cx="118" cy="76" r="9" fill="#fff"/>' +
    '<circle cx="118" cy="76" r="4" fill="#ffc425"/>' +
    '<g fill="#7a4a1c">' +
    '<circle cx="86" cy="82" r="3"/>' +
    '<circle cx="98" cy="72" r="3"/>' +
    '<circle cx="132" cy="70" r="3"/>' +
    '</g>' +
    '<g fill="#58a83a">' +
    '<circle cx="92" cy="78" r="2"/>' +
    '<circle cx="110" cy="68" r="2"/>' +
    '<circle cx="82" cy="70" r="2"/>' +
    '</g>',

  steak:
    pl +
    rice +
    '<ellipse cx="118" cy="84" rx="42" ry="17" fill="#5a2e17"/>' +
    '<ellipse cx="118" cy="80" rx="40" ry="15" fill="#9a6a3a" opacity=".9"/>' +
    '<g fill="#d2b387">' +
    '<ellipse cx="104" cy="76" rx="9" ry="5"/>' +
    '<ellipse cx="124" cy="72" rx="9" ry="5"/>' +
    '<ellipse cx="136" cy="82" rx="8" ry="5"/>' +
    '</g>' +
    '<g fill="#58a83a">' +
    '<circle cx="112" cy="84" r="2"/>' +
    '<circle cx="130" cy="78" r="2"/>' +
    '</g>',

  drink:
    sh +
    '<path d="M64 38h72l-8 84H72z" fill="#fff" fill-opacity=".4" stroke="#d7192a" stroke-width="3"/>' +
    '<path d="M67 58h66l-6 62H73z" fill="#c9701c"/>' +
    '<g fill="#fff" opacity=".55">' +
    '<rect x="78" y="62" width="18" height="18" rx="4" transform="rotate(12 87 71)"/>' +
    '<rect x="104" y="72" width="18" height="18" rx="4" transform="rotate(-10 113 81)"/>' +
    '<rect x="84" y="92" width="18" height="18" rx="4" transform="rotate(6 93 101)"/>' +
    '</g>' +
    '<rect x="58" y="30" width="84" height="10" rx="5" fill="#d7192a"/>' +
    '<path d="M110 30l16-26" stroke="#ffc425" stroke-width="6" stroke-linecap="round"/>' +
    '<circle cx="136" cy="62" r="12" fill="#ffd54a" stroke="#e8b01a" stroke-width="2"/>',

  sundae:
    sh +
    '<path d="M62 88h76l-10 36H72z" fill="#fff" stroke="#d7192a" stroke-width="3"/>' +
    '<path d="M65 100h70l-3 12H68z" fill="#d7192a"/>' +
    '<path d="M58 90c0-22 18-32 42-32s42 10 42 32z" fill="#fff8ec" stroke="#eadcc3"/>' +
    '<path d="M74 66c10-20 42-20 52 0z" fill="#fffdf6" stroke="#eadcc3"/>' +
    '<path d="M62 80q19 14 38 0t38 0" stroke="#4b2412" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<circle cx="100" cy="44" r="8" fill="#c8102e"/>' +
    '<rect x="118" y="38" width="8" height="40" rx="3" fill="#e8c27a" transform="rotate(20 122 58)"/>'
};


/* Photos for the Explore tiles (home) and the three Our-story cards.
   Files sit next to index.html. Change a filename here and every page updates. */
const PAGE_IMG = {
  exploreMenu:   "explore-menu.jpg",
  explorePromos: "explore-promos.jpg",
  exploreToys:   "explore-toys.jpg",
  exploreDeals:  "explore-deals.jpg",
  exploreStory:  "explore-story.jpg",
  exploreStores: "explore-stores.jpg",
  storyChicken:  "story-chicken.jpg",   /* Chicken, done right */
  storyFamily:   "story-family.jpg",    /* Family first */
  storyReach:    "story-reach.jpg"      /* Close to you (world map) */
};