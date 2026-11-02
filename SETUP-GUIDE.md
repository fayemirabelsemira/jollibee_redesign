# Jollibee site — PHP backend setup (Kali + XAMPP → InfinityFree)

## What you have now

```
jollibee-php/
├─ index.html, ops.html, style.css, app.js, art.js, motion.js, ops.js   (your frontend)
├─ api.js        ← NEW: talks to PHP instead of Supabase (same method names)
├─ ops-db.js     ← NEW: lets ops.html/ops.js talk to PHP without editing ops.js
├─ api/
│  ├─ index.php            single entry point  (POST api/index.php?fn=get_menu)
│  ├─ config.php           defaults (no secrets)
│  ├─ config.local.php     YOU create this from config.local.php.example (secrets)
│  ├─ lib/                 core.php, auth_api.php, shop.php, admin.php
│  └─ tools/create_staff.php   one-time tool to make your staff login
└─ sql/schema.sql, sql/seed.sql
```

Supabase function → PHP function: `get_menu`, `get_stores`, `get_vouchers`, `validate_voucher`,
`calculate_quote`, `create_order`, `get_order_status`, `admin_list_orders`, `admin_set_order_status`
keep their names. Supabase Auth became `auth_signup / auth_signin / auth_signout / auth_session`.
The `ops_*` tables are reached through one staff-only endpoint (`ops`).

**Important:** the frontend and the API must be on the **same domain** (they are: `api/index.php` is relative).
That avoids CORS and also avoids an InfinityFree anti-bot problem with cross-site requests.

---

## PART 1 — Local setup on Kali

### 1. Install XAMPP
Download the Linux installer from https://www.apachefriends.org (pick a PHP 8.x build).
```bash
cd ~/Downloads
chmod +x xampp-linux-x64-*-installer.run
sudo ./xampp-linux-x64-*-installer.run      # installs to /opt/lampp
```

### 2. Free the ports, then start it
Kali's own Apache/MariaDB would clash if they are running:
```bash
sudo systemctl stop apache2 mariadb mysql 2>/dev/null
sudo /opt/lampp/lampp start
sudo /opt/lampp/lampp status
```
Open http://localhost — you should see the XAMPP dashboard.
(Useful: `sudo /opt/lampp/lampp restart`, `stop`. Logs: `/opt/lampp/logs/php_error_log`, `error_log`.)

### 3. Put the project in htdocs
```bash
sudo cp -r ~/jollibee-php /opt/lampp/htdocs/jollibee-php
sudo chmod -R a+rX /opt/lampp/htdocs/jollibee-php
```
Tip: for easy editing, keep your folder in your home dir and symlink it:
`sudo ln -s ~/jollibee-php /opt/lampp/htdocs/jollibee-php` (make sure `~` and the folder are readable by others: `chmod o+x ~`).

### 4. Create the database
1. Open http://localhost/phpmyadmin
2. **New** → name `jollibee` → collation `utf8mb4_general_ci` → Create.
3. Select `jollibee` → **Import** → choose `sql/schema.sql` → Go.
4. **Import** again → `sql/seed.sql` → Go.

(You should now see ~25 tables. XAMPP's `root` user has an empty password by default — fine on your own laptop only.)

### 5. Configure the API
```bash
cd /opt/lampp/htdocs/jollibee-php/api
cp config.local.php.example config.local.php
nano config.local.php      # local values are already right; set a long random setup_key
```

### 6. Test the API from the terminal
```bash
curl -s -X POST 'http://localhost/jollibee-php/api/index.php?fn=get_menu' | head -c 400; echo
curl -s -X POST 'http://localhost/jollibee-php/api/index.php?fn=get_stores' -d '{"p_query":"Taguig"}'; echo
curl -s -X POST 'http://localhost/jollibee-php/api/index.php?fn=calculate_quote' \
  -d '{"p_cart":[{"sku":"CHK-JOY","variantId":"CHK-JOY-1","qty":2,"options":[]}],"p_ctx":{"mode":"delivery"},"p_vouchers":["FREEDEL"]}'; echo
```
You should get `{"data":...}`. If you get `{"error":"Server error: ..."}` (debug is on) read the message —
most often wrong DB name/user/password in `config.local.php`.

### 7. Make your staff login (for ops.html and admin)
Open `http://localhost/jollibee-php/api/tools/create_staff.php?key=YOUR_SETUP_KEY`, create an email + password
with role **admin**. Then **delete** `api/tools/create_staff.php`.

### 8. Try the website
http://localhost/jollibee-php/index.html
- Menu loads → add Chickenjoy → Review order → pick a store → place order → you land on tracking.
- http://localhost/jollibee-php/ops.html → sign in with your staff account.

Browser DevTools → **Network** tab is your best debugging friend: click the `index.php?fn=...` request and read the JSON.

---

## PART 2 — Deploy on InfinityFree

### 1. Account + hosting
1. Sign up at https://infinityfree.com → **Create account** → choose a free subdomain (e.g. `jollibee-demo.infinityfreeapp.com`) or connect your own domain.
2. Wait until the account is **Active** (can take a few minutes).

### 2. Create the MySQL database
Client Area → your account → **MySQL Databases** → create `jollibee`. Write down (they are NOT `localhost`/`root`):
- host: something like `sql123.infinityfree.com`
- database: `if0_12345678_jollibee`
- user: `if0_12345678`
- password: your hosting (vPanel) password

Open **phpMyAdmin** from there → select the database → **Import** `schema.sql`, then `seed.sql`.
(Import size is limited; both files are small, so it's fine.)

### 3. Upload the files
Use FileZilla (FTP details are in the account page) or the Online File Manager. Upload **the contents** of
`jollibee-php/` into the **`htdocs`** folder (so `htdocs/index.html` and `htdocs/api/index.php` exist).
- Do **not** upload `sql/`, `api.supabase.js.bak`, or `config.local.php.example`.
- Also upload your images: `mascot.jpg, logo.jpg, prod-*.jpg, toy-*.jpg, explore-*.jpg, story-*.jpg, story-bg.jpg`.
- InfinityFree puts a default `index2.html` in htdocs — delete it.

### 4. Create the live config
In File Manager, inside `htdocs/api/` create `config.local.php` with your **InfinityFree** values:
```php
<?php
return array(
  'db_host' => 'sql123.infinityfree.com',
  'db_name' => 'if0_12345678_jollibee',
  'db_user' => 'if0_12345678',
  'db_pass' => 'YOUR_VPANEL_PASSWORD',
  'debug'   => false,
  'setup_key' => 'a-long-random-string'
);
```
Create the staff login via `https://YOURSITE/api/tools/create_staff.php?key=...` then **delete that file**.

### 5. Turn on HTTPS
Client Area → **SSL Certificates** → get a free certificate, install it. Then use `https://` everywhere
(your login token travels in a header; never send it over plain http on the live site).

### 6. Test live
`https://YOURSITE/` → menu → place an order → check it appears in `ops.html`/admin.

---

## InfinityFree limitations you should know

| Limitation | What it means for you |
|---|---|
| Anti-bot JavaScript check | Requests from `curl` or other sites get an HTML challenge page instead of JSON. Your own pages in a normal browser work (same domain). Test live with the browser, not `curl`. If the app says "unexpected response", clear cookies and reload once. |
| No SSH / no Composer | That's why this backend uses plain PHP with no libraries. |
| No websockets | Staff screens poll every 5 s (`subscribeToOrders`) instead of Supabase realtime. |
| Daily hit limit & sleeping | Fine for a student project; not for real traffic. |
| Outbound email is limited | There is no email confirmation on sign-up (accounts work immediately). |

---

## Security notes (read once)

- Prices and totals are recomputed on the server from the database; the browser cannot set a price.
- All SQL uses prepared statements; passwords use `password_hash`.
- Staff-only endpoints (`admin_*`, `ops`) require a staff/admin token.
- Tokens are sent in the `X-Auth-Token` header (not cookies), so classic CSRF doesn't apply.
- Never commit `config.local.php`. Delete `create_staff.php` after use.
- Guest checkout needs no account. Tracking uses a secret token saved in the buyer's browser, so only that browser can view the order.

## Assumptions I made (change if wrong)

- **Sample content:** menu, prices, stores, vouchers (`BIDA10`, `JOLLY50`, `FREEDEL`) are placeholders in `sql/seed.sql`. Edit in phpMyAdmin.
- **Fees:** delivery ₱49 + service fee ₱10 for delivery orders (`api/config.php`); pickup has none. VAT 12% is included in prices.
- **admin.html** wasn't in the files you sent. I kept `adminListOrders`, `adminSetOrderStatus`, `signInStaff`, `getSession`, `subscribeToOrders` with the same names, but the order object fields are my guess. Send me `admin.html` and I'll match it.
- Customer web orders are **not yet** posted into the `ops_sales` / journal tables (that was also separate in your Supabase design). Say the word and I'll add it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Menu skeleton forever / "Sorry, this page could not load" | DevTools → Network → `fn=get_menu`. Red? Look at the response text. |
| `Server error: SQLSTATE[HY000] [1045]` | Wrong DB user/password in `config.local.php`. |
| `... [1049] Unknown database` | DB name wrong, or you didn't create/import it. |
| `... [2002]` on InfinityFree | You left `db_host` as `localhost`; use the `sqlXXX.infinityfree.com` host. |
| 403/404 on `api/index.php` locally | Folder not in `/opt/lampp/htdocs`, or permissions (`chmod -R a+rX`). |
| `ops.html` says "Staff sign-in required" | You haven't created a staff user, or you signed in with a customer account. |
| Images missing | Upload the `.jpg` files next to `index.html`. |
