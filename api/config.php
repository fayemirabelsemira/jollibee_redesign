<?php
/* Defaults. DO NOT put real passwords here — copy config.local.php.example to
   config.local.php and put your real values there. */
$defaults = array(
    'db_host'  => 'localhost',
    'db_port'  => 3306,
    'db_name'  => 'jollibee',
    'db_user'  => 'root',
    'db_pass'  => '',

    'debug'    => false,          // true = show real error text in API responses (dev only)
    'token_days' => 14,           // how long a sign-in lasts

    // Money rules (centavos)
    'delivery_fee' => 4900,       // ₱49 for delivery orders
    'service_fee'  => 1000,       // ₱10 for delivery orders
    'vat_rate'     => 12,         // VAT is INCLUDED in prices

    // Used only by api/tools/create_staff.php. Leave empty to disable the tool.
    'setup_key' => ''
);

$local = __DIR__ . '/config.local.php';
if (file_exists($local)) {
    $over = require $local;
    if (is_array($over)) {
        $defaults = array_merge($defaults, $over);
    }
}
return $defaults;
