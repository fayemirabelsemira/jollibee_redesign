-- =========================================================
-- TITLE: Jollibee Operations Information System
-- Database: PostgreSQL (Supabase)
-- Purpose: Ordering to Supplier, Payment to Supplier,
--          Sales from Customer, Payment from Customer, Inventory
-- =========================================================
-- HOW TO RUN:
--   Supabase → SQL Editor → New query → paste this whole file → Run
--
-- NOTE: Tables use the "ops_" prefix so they do NOT conflict
-- with any existing menu / product tables in your project.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- Drop old ops objects (safe re-run) ----------
drop view if exists dashboard_stats;
drop table if exists ops_customer_payments cascade;
drop table if exists ops_sales cascade;
drop table if exists ops_supplier_payments cascade;
drop table if exists ops_purchase_orders cascade;
drop table if exists ops_inventory cascade;
drop table if exists ops_suppliers cascade;
drop table if exists ops_menu_items cascade;
drop table if exists ops_company_info cascade;

-- =========================================================
-- COMPANY INFO
-- =========================================================
create table ops_company_info (
  id            uuid primary key default gen_random_uuid(),
  company_name  text not null,
  profile       text,
  nature        text,
  products      text,
  updated_at    timestamptz not null default now()
);

insert into ops_company_info (company_name, profile, nature, products)
values (
  'Jollibee Foods Corporation (Jollibee)',
  'Jollibee is a Filipino fast-food company known for serving affordable and convenient meals. It operates many branches in the Philippines and other countries.',
  'Fast-food restaurant and food service business',
  'Chickenjoy, Jolly Spaghetti, Yumburger, fries, rice meals, beverages, desserts, dine-in, take-out, and delivery services'
);

-- =========================================================
-- MENU ITEMS (for Sales from Customer)
-- =========================================================
create table ops_menu_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  active      boolean not null default true
);

insert into ops_menu_items (name, unit_price) values
  ('Chickenjoy', 99.00),
  ('Jolly Spaghetti', 60.00),
  ('Yumburger', 45.00),
  ('Crispy Fries', 40.00),
  ('Burger Steak', 70.00),
  ('Peach Mango Pie', 30.00),
  ('Chocolate Sundae', 30.00),
  ('Iced Tea', 35.00);

-- =========================================================
-- SUPPLIERS
-- =========================================================
create table ops_suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  contact     text,
  email       text,
  created_at  timestamptz not null default now()
);

insert into ops_suppliers (name, contact, email) values
  ('Fresh Farm Produce Co.', '0917-111-2222', 'orders@freshfarm.ph'),
  ('Golden Oil Trading', '0918-333-4444', 'sales@goldenoil.ph'),
  ('Metro Packaging Inc.', '0919-555-6666', 'supply@metropack.ph');

-- =========================================================
-- INVENTORY
-- =========================================================
create table ops_inventory (
  id            uuid primary key default gen_random_uuid(),
  item_name     text not null unique,
  quantity      numeric(12,2) not null default 0 check (quantity >= 0),
  unit          text not null default 'pcs',
  reorder_level numeric(12,2) not null default 10 check (reorder_level >= 0),
  unit_cost     numeric(12,2) not null default 0 check (unit_cost >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into ops_inventory (item_name, quantity, unit, reorder_level, unit_cost) values
  ('Chicken (raw)', 120, 'kg', 40, 180.00),
  ('Spaghetti pasta', 80, 'kg', 25, 55.00),
  ('Burger buns', 200, 'pcs', 50, 8.00),
  ('Cooking oil', 40, 'L', 15, 95.00),
  ('French fries (frozen)', 60, 'kg', 20, 110.00),
  ('Soft drink syrup', 30, 'L', 10, 120.00),
  ('Paper bags', 500, 'pcs', 100, 2.50),
  ('Cups (16oz)', 400, 'pcs', 80, 3.00);

-- =========================================================
-- 1) ORDERING TO SUPPLIER
-- =========================================================
create table ops_purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  po_code     text not null unique,
  supplier_id uuid not null references ops_suppliers(id) on delete restrict,
  item_name   text not null,
  quantity    numeric(12,2) not null check (quantity > 0),
  unit_cost   numeric(12,2) not null check (unit_cost >= 0),
  total       numeric(12,2) generated always as (quantity * unit_cost) stored,
  status      text not null default 'Pending'
                check (status in ('Pending', 'Sent', 'Received')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_ops_po_status on ops_purchase_orders(status);
create index idx_ops_po_supplier on ops_purchase_orders(supplier_id);

-- =========================================================
-- 2) PAYMENT TO SUPPLIER
-- =========================================================
create table ops_supplier_payments (
  id                uuid primary key default gen_random_uuid(),
  invoice_code      text not null unique,
  supplier_id       uuid not null references ops_suppliers(id) on delete restrict,
  purchase_order_id uuid references ops_purchase_orders(id) on delete set null,
  amount            numeric(12,2) not null check (amount > 0),
  method            text not null default 'Bank Transfer'
                      check (method in ('Bank Transfer', 'Check', 'Cash', 'Online')),
  status            text not null default 'Unpaid'
                      check (status in ('Unpaid', 'Paid')),
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz not null default now()
);

create index idx_ops_sp_status on ops_supplier_payments(status);

-- =========================================================
-- 3) SALES FROM CUSTOMER
-- =========================================================
create table ops_sales (
  id            uuid primary key default gen_random_uuid(),
  sale_code     text not null unique,
  menu_item_id  uuid not null references ops_menu_items(id) on delete restrict,
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  total         numeric(12,2) generated always as (quantity * unit_price) stored,
  order_type    text not null default 'Dine-in'
                  check (order_type in ('Dine-in', 'Take-out', 'Delivery')),
  status        text not null default 'Open'
                  check (status in ('Open', 'Paid', 'Cancelled')),
  created_at    timestamptz not null default now()
);

create index idx_ops_sales_status on ops_sales(status);
create index idx_ops_sales_created on ops_sales(created_at desc);

-- =========================================================
-- 4) PAYMENT FROM CUSTOMER
-- =========================================================
create table ops_customer_payments (
  id            uuid primary key default gen_random_uuid(),
  payment_code  text not null unique,
  sale_id       uuid not null references ops_sales(id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0),
  method        text not null default 'Cash'
                  check (method in ('Cash', 'Card', 'QR')),
  status        text not null default 'Completed'
                  check (status in ('Completed', 'Refunded')),
  created_at    timestamptz not null default now()
);

create index idx_ops_cp_sale on ops_customer_payments(sale_id);

-- =========================================================
-- HELPER: auto-generated codes
-- =========================================================
create or replace function ops_gen_code(prefix text)
returns text
language sql
as $$
  select prefix || '-' || to_char(now(), 'YYMMDD') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

-- =========================================================
-- ROW LEVEL SECURITY (open for student demo)
-- =========================================================
alter table ops_company_info enable row level security;
alter table ops_menu_items enable row level security;
alter table ops_suppliers enable row level security;
alter table ops_inventory enable row level security;
alter table ops_purchase_orders enable row level security;
alter table ops_supplier_payments enable row level security;
alter table ops_sales enable row level security;
alter table ops_customer_payments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ops_company_info','ops_menu_items','ops_suppliers','ops_inventory',
    'ops_purchase_orders','ops_supplier_payments','ops_sales','ops_customer_payments'
  ]
  loop
    execute format('drop policy if exists %I on %I;', t || '_anon', t);
    execute format(
      'create policy %I on %I for all using (true) with check (true);',
      t || '_anon', t
    );
  end loop;
end $$;

-- =========================================================
-- DASHBOARD VIEW
-- =========================================================
create or replace view dashboard_stats as
select
  (select count(*) from ops_purchase_orders where status in ('Pending','Sent')) as open_purchase_orders,
  (select coalesce(sum(amount),0) from ops_supplier_payments where status = 'Unpaid') as amount_owed_suppliers,
  (select coalesce(sum(total),0) from ops_sales where status = 'Paid'
     and created_at >= date_trunc('day', now())) as sales_today,
  (select count(*) from ops_inventory where quantity <= reorder_level) as items_to_reorder;

-- =========================================================
-- END OF SCHEMA — Jollibee Operations Information System
-- =========================================================
