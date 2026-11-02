-- Jollibee PHP backend — SAMPLE DATA. Import AFTER schema.sql.
-- Menu items, prices, stores and vouchers are sample content (matches the footer note on the site).
SET NAMES utf8mb4;

/* ---------------- option groups ---------------- */
INSERT INTO option_groups (id, label, type) VALUES
 ('toy',   'Choose your Snoopy toy', 'single'),
 ('addon', 'Add-ons',                'multi');

INSERT INTO option_choices (id, group_id, label, price, img, sort) VALUES
 ('toy-1','toy','Birthday Snoopy',0,'toy-1.jpg',1),
 ('toy-2','toy','Detective Snoopy',0,'toy-2.jpg',2),
 ('toy-3','toy','Joe Cool Rocker',0,'toy-3.jpg',3),
 ('toy-4','toy','Pirate Snoopy & Woodstock',0,'toy-4.jpg',4),
 ('toy-5','toy','Cupid Snoopy',0,'toy-5.jpg',5),
 ('toy-6','toy','Doghouse Snoopy & Woodstock',0,'toy-6.jpg',6),
 ('add-rice','addon','Extra rice',2500,NULL,1),
 ('add-gravy','addon','Extra gravy',1500,NULL,2),
 ('add-cheese','addon','Cheese slice',1800,NULL,3);

/* ---------------- menu ---------------- */
INSERT INTO menu_items (sku, name, descr, category, tag, tags, bg, art, sort) VALUES
 ('PRM-SHARE','Sharing Combo','2 pcs Chickenjoy, Jolly Spaghetti and a drink. Perfect for two.','Promos','Best value','combo,share,chicken,spaghetti','#FFE3B0','chicken',10),
 ('PRM-BUCKET','Bucket Barkada','A bucket of crispy Chickenjoy for the whole group.','Promos','Barkada','bucket,chicken,party,share','#FFE3B0','chicken',20),
 ('PRM-DUO','Burger Duo','Two Yumburgers and two fries. Quick and easy.','Promos',NULL,'burger,duo,fries','#FFE3B0','burger',30),
 ('KID-MEAL','Jolly Kiddie Meal','A kid-sized meal with a collectible Snoopy toy.','Kiddie Meals','Toy inside','kids,kiddie,toy,snoopy','#CFEFFF','kid1',40),
 ('CHK-JOY','Chickenjoy','Crispy, juicy fried chicken. Our bestseller.','Chicken','Bestseller','chicken,crispy,fried,spicy','#FFE9C2','chicken',50),
 ('PST-SPAG','Jolly Spaghetti','Sweet-style spaghetti with hot dog slices and cheese.','Pasta',NULL,'spaghetti,pasta,sweet','#FFD9C7','spaghetti',60),
 ('PST-PALA','Palabok Fiesta','Rice noodles in rich shrimp sauce with toppings.','Pasta',NULL,'palabok,noodles,pasta','#FFE9C2','palabok',70),
 ('BGR-YUM','Yumburger','The classic Jollibee burger.','Burgers',NULL,'burger,yum,beef','#FFE9C2','burger',80),
 ('BGR-STEAK','Burger Steak','Savory patties with mushroom gravy and rice.','Burgers',NULL,'steak,rice,gravy','#FFE9C2','steak',90),
 ('SDE-FRIES','Crispy Fries','Golden, crispy and lightly salted.','Sides',NULL,'fries,potato,side','#FFF1B8','fries',100),
 ('DST-PIE','Peach Mango Pie','Warm, crispy pie with a sweet peach-mango filling.','Desserts',NULL,'pie,dessert,sweet,mango','#FFE0B8','pie',110),
 ('DST-SUNDAE','Chocolate Sundae','Soft-serve topped with chocolate syrup.','Desserts',NULL,'sundae,ice cream,dessert,chocolate','#F7E2D6','sundae',120),
 ('DRK-TEA','Iced Tea','Refreshing house-blend iced tea.','Drinks',NULL,'tea,drink,cold','#FFE9C2','drink',130);

/* variants: price in CENTAVOS. The first variant of each item is the default. */
INSERT INTO menu_variants (id, sku, label, price, art, sort) VALUES
 ('PRM-SHARE-1','PRM-SHARE','2 pc Chickenjoy + Spaghetti + Drink',29900,NULL,1),
 ('PRM-BUCKET-1','PRM-BUCKET','6 pc Bucket',48900,NULL,1),
 ('PRM-BUCKET-2','PRM-BUCKET','8 pc Bucket',62900,NULL,2),
 ('PRM-DUO-1','PRM-DUO','2 Yumburger + 2 Fries',11900,NULL,1),
 ('KID-MEAL-1','KID-MEAL','Chicken + Rice',12900,'kid1',1),
 ('KID-MEAL-2','KID-MEAL','Spaghetti + Fries',11900,'kid2',2),
 ('CHK-JOY-1','CHK-JOY','1 pc Solo',9900,NULL,1),
 ('CHK-JOY-2','CHK-JOY','2 pc with Rice',18900,NULL,2),
 ('CHK-JOY-3','CHK-JOY','6 pc Bucket',48900,NULL,3),
 ('PST-SPAG-1','PST-SPAG','Solo',6000,NULL,1),
 ('PST-SPAG-2','PST-SPAG','Family Pan',28900,NULL,2),
 ('PST-PALA-1','PST-PALA','Solo',7500,NULL,1),
 ('BGR-YUM-1','BGR-YUM','Yumburger',4500,NULL,1),
 ('BGR-YUM-2','BGR-YUM','Yumburger with Cheese',5500,NULL,2),
 ('BGR-STEAK-1','BGR-STEAK','1 pc with Rice',7000,NULL,1),
 ('BGR-STEAK-2','BGR-STEAK','2 pc with Rice',12900,NULL,2),
 ('SDE-FRIES-1','SDE-FRIES','Regular',4000,NULL,1),
 ('SDE-FRIES-2','SDE-FRIES','Large',5500,NULL,2),
 ('DST-PIE-1','DST-PIE','1 pc',3000,NULL,1),
 ('DST-SUNDAE-1','DST-SUNDAE','Regular',3000,NULL,1),
 ('DRK-TEA-1','DRK-TEA','Regular',3500,NULL,1),
 ('DRK-TEA-2','DRK-TEA','Large',4500,NULL,2);

INSERT INTO item_groups (sku, group_id, sort) VALUES
 ('KID-MEAL','toy',1),
 ('CHK-JOY','addon',1),
 ('BGR-STEAK','addon',1),
 ('PST-PALA','addon',1);

/* ---------------- stores (sample) ---------------- */
INSERT INTO stores (id, name, area, address, hours) VALUES
 ('st-taguig-1','Jollibee Taguig Central','Taguig','Sample address 1, Central Signal Village, Taguig City','6:00 AM – 11:00 PM'),
 ('st-taguig-2','Jollibee Taguig Bonifacio','Taguig','Sample address 2, Bonifacio Global City, Taguig','24 hours'),
 ('st-makati-1','Jollibee Makati Ayala','Makati','Sample address 3, Ayala Avenue, Makati City','6:00 AM – 11:00 PM'),
 ('st-makati-2','Jollibee Makati Poblacion','Makati','Sample address 4, Poblacion, Makati City','7:00 AM – 12:00 AM'),
 ('st-manila-1','Jollibee Manila Taft','Manila','Sample address 5, Taft Avenue, Manila','6:00 AM – 10:00 PM'),
 ('st-qc-1','Jollibee Quezon City Cubao','Quezon City','Sample address 6, Araneta City, Cubao, Quezon City','24 hours');

/* ---------------- vouchers (sample) ---------------- */
INSERT INTO vouchers (code, big, descr, type, value, min_spend, active) VALUES
 ('BIDA10','10% OFF','10% off your food total. No minimum spend.','percent',10,0,1),
 ('JOLLY50','₱50 OFF','₱50 off when you spend ₱300 or more.','fixed',5000,30000,1),
 ('FREEDEL','FREE DELIVERY','Free delivery fee on any delivery order of ₱200 or more.','free_delivery',0,20000,1);

/* ---------------- operations system: starter data ---------------- */
INSERT INTO ops_company_info (id, company_name, profile, nature, products) VALUES
 (UUID(),'Jollibee Foods Corporation (Jollibee)',
  'Jollibee is a Filipino fast-food company known for serving affordable and convenient meals. It operates many branches in the Philippines and other countries.',
  'Fast-food restaurant and food service business',
  'Chickenjoy, Jolly Spaghetti, Yumburger, fries, rice meals, beverages, desserts, dine-in, take-out, and delivery services');

INSERT INTO ops_accounts (id, code, name, type, active) VALUES
 (UUID(),'1000','Cash on Hand and in Bank','Asset',1),
 (UUID(),'1200','Inventory','Asset',1),
 (UUID(),'2000','Accounts Payable','Liability',1),
 (UUID(),'2100','Output VAT Payable','Liability',1),
 (UUID(),'2200','Payroll Contributions and Tax Payable','Liability',1),
 (UUID(),'3000','Owner''s Capital','Equity',1),
 (UUID(),'4000','Sales Revenue','Revenue',1),
 (UUID(),'5000','Cost of Goods Sold','Expense',1),
 (UUID(),'5100','Salaries and Wages Expense','Expense',1),
 (UUID(),'5200','Utilities Expense','Expense',1),
 (UUID(),'5300','Rent Expense','Expense',1);

INSERT INTO ops_suppliers (id, name, contact, email) VALUES
 (UUID(),'Fresh Farm Produce Co.','0917-111-2222','orders@freshfarm.example'),
 (UUID(),'Golden Oil Trading','0918-333-4444','sales@goldenoil.example'),
 (UUID(),'Metro Packaging Inc.','0919-555-6666','supply@metropack.example');

INSERT INTO ops_menu_items (id, name, unit_price, active) VALUES
 (UUID(),'Chickenjoy',99,1),(UUID(),'Jolly Spaghetti',60,1),(UUID(),'Yumburger',45,1),(UUID(),'Crispy Fries',40,1),
 (UUID(),'Burger Steak',70,1),(UUID(),'Peach Mango Pie',30,1),(UUID(),'Chocolate Sundae',30,1),(UUID(),'Iced Tea',35,1);

INSERT INTO ops_inventory (id, item_name, quantity, unit, reorder_level, unit_cost) VALUES
 (UUID(),'Chicken (raw)',120,'kg',40,180),
 (UUID(),'Spaghetti pasta',18,'kg',25,55),
 (UUID(),'Burger buns',200,'pcs',50,8),
 (UUID(),'Cooking oil',12,'L',15,95),
 (UUID(),'French fries (frozen)',60,'kg',20,110),
 (UUID(),'Paper bags',500,'pcs',100,2.5);

INSERT INTO ops_employees (id, emp_code, full_name, `position`, department, daily_rate, contact, hire_date, status) VALUES
 (UUID(),'EMP-001','Maria Santos','Store Manager','Management',1100,'0917-210-0001','2023-02-01','Active'),
 (UUID(),'EMP-002','Juan Dela Cruz','Cashier','Counter',645,'0917-210-0002','2024-06-10','Active'),
 (UUID(),'EMP-003','Ana Reyes','Crew - Kitchen','Kitchen',645,'0917-210-0003','2024-08-15','Active'),
 (UUID(),'EMP-004','Pedro Garcia','Crew - Kitchen','Kitchen',645,'0917-210-0004','2025-01-20','Active');
