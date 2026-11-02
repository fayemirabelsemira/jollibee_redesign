-- Jollibee PHP backend — MySQL / MariaDB schema
-- Import this in phpMyAdmin (Import tab) into an EXISTING empty database.
-- Works on XAMPP (MariaDB) and InfinityFree (MySQL 5.7+/MariaDB 10.x).

SET NAMES utf8mb4;

/* ---------------- accounts ---------------- */
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','staff','admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------------- catalogue ---------------- */
CREATE TABLE IF NOT EXISTS menu_items (
  sku VARCHAR(40) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  descr VARCHAR(400) NOT NULL DEFAULT '',
  category VARCHAR(60) NOT NULL,
  tag VARCHAR(40) NULL,
  tags VARCHAR(200) NOT NULL DEFAULT '',   -- comma separated search words
  bg VARCHAR(20) NOT NULL DEFAULT '#FFF1D6',
  art VARCHAR(30) NOT NULL DEFAULT 'chicken',
  sort INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS menu_variants (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  sku VARCHAR(40) NOT NULL,
  label VARCHAR(120) NOT NULL,
  price INT NOT NULL,                      -- CENTAVOS (₱99.00 = 9900)
  art VARCHAR(30) NULL,
  sort INT NOT NULL DEFAULT 0,
  INDEX (sku),
  CONSTRAINT fk_var_sku FOREIGN KEY (sku) REFERENCES menu_items(sku) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS option_groups (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  type ENUM('single','multi') NOT NULL DEFAULT 'single'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS option_choices (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  group_id VARCHAR(40) NOT NULL,
  label VARCHAR(120) NOT NULL,
  price INT NOT NULL DEFAULT 0,
  img VARCHAR(120) NULL,
  sort INT NOT NULL DEFAULT 0,
  INDEX (group_id),
  CONSTRAINT fk_choice_group FOREIGN KEY (group_id) REFERENCES option_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS item_groups (
  sku VARCHAR(40) NOT NULL,
  group_id VARCHAR(40) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  PRIMARY KEY (sku, group_id),
  CONSTRAINT fk_ig_sku FOREIGN KEY (sku) REFERENCES menu_items(sku) ON DELETE CASCADE,
  CONSTRAINT fk_ig_group FOREIGN KEY (group_id) REFERENCES option_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  area VARCHAR(80) NOT NULL,
  address VARCHAR(240) NOT NULL,
  hours VARCHAR(80) NOT NULL DEFAULT '7:00 AM – 10:00 PM',
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vouchers (
  code VARCHAR(30) NOT NULL PRIMARY KEY,
  big VARCHAR(40) NOT NULL,                -- headline on the ticket, e.g. "₱50 OFF"
  descr VARCHAR(240) NOT NULL,
  type ENUM('percent','fixed','free_delivery') NOT NULL,
  value INT NOT NULL DEFAULT 0,            -- percent (10) or centavos (5000)
  min_spend INT NOT NULL DEFAULT 0,        -- centavos
  active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---------------- customer orders ---------------- */
CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,        -- e.g. JB-482913 (shown to customer)
  user_id CHAR(36) NULL,
  tracking_hash CHAR(64) NOT NULL,         -- sha256 of the tracking token
  mode ENUM('pickup','delivery') NOT NULL,
  store_id VARCHAR(40) NOT NULL,
  address VARCHAR(300) NULL,
  contact_name VARCHAR(120) NOT NULL,
  contact_phone VARCHAR(30) NOT NULL,
  payment_method ENUM('cod','card') NOT NULL DEFAULT 'cod',
  status ENUM('received','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'received',
  subtotal INT NOT NULL,
  delivery_fee INT NOT NULL DEFAULT 0,
  service_fee INT NOT NULL DEFAULT 0,
  discount INT NOT NULL DEFAULT 0,
  vat INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  voucher_code VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (status),
  INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  sku VARCHAR(40) NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  variant_id VARCHAR(50) NOT NULL,
  variant_label VARCHAR(120) NOT NULL,
  options_json TEXT NOT NULL,
  qty INT NOT NULL,
  unit_price INT NOT NULL,
  note VARCHAR(300) NOT NULL DEFAULT '',
  INDEX (order_id),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* =========================================================
   OPERATIONS INFORMATION SYSTEM (ops.html) — ops_* tables
   Accessed through the generic, staff-only "ops" endpoint.
   ========================================================= */
CREATE TABLE IF NOT EXISTS ops_company_info (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  profile TEXT, nature VARCHAR(255), products TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_suppliers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL, contact VARCHAR(80), email VARCHAR(160),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_menu_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_inventory (
  id CHAR(36) NOT NULL PRIMARY KEY,
  item_name VARCHAR(160) NOT NULL,
  quantity DECIMAL(14,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  reorder_level DECIMAL(14,2) NOT NULL DEFAULT 10,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_purchase_orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  po_code VARCHAR(40) NOT NULL UNIQUE,
  supplier_id CHAR(36) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  quantity DECIMAL(14,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  total DECIMAL(16,2) AS (ROUND(quantity * unit_cost, 2)) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  notes VARCHAR(300) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_supplier_payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  invoice_code VARCHAR(40) NOT NULL UNIQUE,
  supplier_id CHAR(36) NOT NULL,
  purchase_order_id CHAR(36) NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Unpaid',
  paid_at DATETIME NULL,
  notes VARCHAR(300) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_sales (
  id CHAR(36) NOT NULL PRIMARY KEY,
  sale_code VARCHAR(40) NOT NULL UNIQUE,
  menu_item_id CHAR(36) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(16,2) AS (ROUND(quantity * unit_price, 2)) STORED,
  order_type VARCHAR(20) NOT NULL DEFAULT 'Dine-in',
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_customer_payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  payment_code VARCHAR(40) NOT NULL UNIQUE,
  sale_id CHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_employees (
  id CHAR(36) NOT NULL PRIMARY KEY,
  emp_code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  `position` VARCHAR(80) NOT NULL,
  department VARCHAR(60) NOT NULL,
  daily_rate DECIMAL(12,2) NOT NULL,
  contact VARCHAR(40) NULL,
  hire_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_attendance (
  id CHAR(36) NOT NULL PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  work_date DATE NOT NULL,
  time_in TIME NULL,
  time_out TIME NULL,
  hours_worked DECIMAL(6,2) NOT NULL DEFAULT 0,
  ot_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Present',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_att (employee_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_payroll (
  id CHAR(36) NOT NULL PRIMARY KEY,
  payslip_code VARCHAR(40) NOT NULL UNIQUE,
  employee_id CHAR(36) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  days_present INT NOT NULL DEFAULT 0,
  ot_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  basic_pay DECIMAL(14,2) NOT NULL DEFAULT 0,
  ot_pay DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_pay DECIMAL(14,2) NOT NULL DEFAULT 0,
  sss DECIMAL(12,2) NOT NULL DEFAULT 0,
  philhealth DECIMAL(12,2) NOT NULL DEFAULT 0,
  pagibig DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pay (employee_id, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_accounts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  type ENUM('Asset','Liability','Equity','Revenue','Expense') NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_journal_entries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  je_code VARCHAR(40) NOT NULL,
  entry_date DATE NOT NULL,
  memo VARCHAR(300) NULL,
  source VARCHAR(30) NOT NULL,
  ref_code VARCHAR(60) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (source, ref_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_journal_lines (
  id CHAR(36) NOT NULL PRIMARY KEY,
  entry_id CHAR(36) NOT NULL,
  account_code VARCHAR(10) NOT NULL,
  debit DECIMAL(16,2) NOT NULL DEFAULT 0,
  credit DECIMAL(16,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (entry_id),
  INDEX (account_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
