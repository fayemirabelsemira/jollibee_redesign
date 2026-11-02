<?php
/* Single entry point:  POST api/index.php?fn=<function>   body: JSON   reply: {"data":...} or {"error":"..."} */

require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/auth_api.php';
require __DIR__ . '/lib/shop.php';
require __DIR__ . '/lib/admin.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply($payload, $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

$routes = array(
    'get_menu' => 'fn_get_menu',
    'get_stores' => 'fn_get_stores',
    'get_vouchers' => 'fn_get_vouchers',
    'validate_voucher' => 'fn_validate_voucher',
    'calculate_quote' => 'fn_calculate_quote',
    'create_order' => 'fn_create_order',
    'get_order_status' => 'fn_get_order_status',
    'auth_signup' => 'fn_auth_signup',
    'auth_signin' => 'fn_auth_signin',
    'auth_signout' => 'fn_auth_signout',
    'auth_session' => 'fn_auth_session',
    'admin_list_orders' => 'fn_admin_list_orders',
    'admin_set_order_status' => 'fn_admin_set_order_status',
    'ops' => 'fn_ops',
);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        reply(array('error' => 'Use POST.'), 405);
    }
    $fn = isset($_GET['fn']) ? (string)$_GET['fn'] : '';
    if (!isset($routes[$fn])) {
        reply(array('error' => 'Unknown function.'), 404);
    }
    $raw = file_get_contents('php://input');
    $in = $raw === '' ? array() : json_decode($raw, true);
    if (!is_array($in)) {
        reply(array('error' => 'Invalid request body.'), 400);
    }
    reply(array('data' => call_user_func($routes[$fn], $in)));
} catch (AppError $e) {
    reply(array('error' => $e->getMessage()), $e->status);
} catch (Throwable $e) {
    error_log('[jollibee-api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    reply(array('error' => cfg('debug') ? ('Server error: ' . $e->getMessage()) : 'Something went wrong. Please try again.'), 500);
}
