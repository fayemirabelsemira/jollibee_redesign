<?php
/* Customer-facing API: menu, stores, vouchers, quotes, orders, tracking. */

/* ---------------- menu ---------------- */

function fn_get_menu($in)
{
    $groups = array();
    foreach (rows('SELECT id, label, type FROM option_groups') as $g) {
        $groups[$g['id']] = array('id' => $g['id'], 'label' => $g['label'], 'type' => $g['type'], 'choices' => array());
    }
    foreach (rows('SELECT id, group_id, label, price, img FROM option_choices ORDER BY sort, id') as $c) {
        if (!isset($groups[$c['group_id']])) {
            continue;
        }
        $ch = array('id' => $c['id'], 'label' => $c['label'], 'price' => (int)$c['price']);
        if ($c['img']) {
            $ch['img'] = $c['img'];
        }
        $groups[$c['group_id']]['choices'][] = $ch;
    }

    $variants = array();
    foreach (rows('SELECT id, sku, label, price, art FROM menu_variants ORDER BY sort, id') as $v) {
        $variants[$v['sku']][] = array('id' => $v['id'], 'label' => $v['label'], 'price' => (int)$v['price'], 'art' => $v['art']);
    }
    $itemGroups = array();
    foreach (rows('SELECT sku, group_id FROM item_groups ORDER BY sort') as $ig) {
        $itemGroups[$ig['sku']][] = $ig['group_id'];
    }

    $items = array();
    foreach (rows('SELECT * FROM menu_items WHERE active = 1 ORDER BY sort, sku') as $m) {
        if (empty($variants[$m['sku']])) {
            continue;   // an item with no price cannot be sold
        }
        $tags = array_values(array_filter(array_map('trim', explode(',', $m['tags']))));
        $items[] = array(
            'sku' => $m['sku'],
            'name' => $m['name'],
            'desc' => $m['descr'],
            'cat' => $m['category'],
            'tag' => $m['tag'],
            'tags' => $tags,
            'bg' => $m['bg'],
            'art' => $m['art'],
            'groups' => isset($itemGroups[$m['sku']]) ? $itemGroups[$m['sku']] : array(),
            'variants' => $variants[$m['sku']],
        );
    }
    return array('items' => $items, 'groups' => (object)$groups);
}

/* ---------------- stores + vouchers ---------------- */

function fn_get_stores($in)
{
    $term = trim((string)(isset($in['p_query']) ? $in['p_query'] : ''));
    if ($term === '') {
        return rows('SELECT id, name, area, address, hours FROM stores WHERE active = 1 ORDER BY area, name LIMIT 50');
    }
    $like = '%' . str_replace(array('%', '_'), array('\\%', '\\_'), $term) . '%';
    return rows('SELECT id, name, area, address, hours FROM stores WHERE active = 1 AND (name LIKE ? OR area LIKE ? OR address LIKE ?) ORDER BY area, name LIMIT 50',
        array($like, $like, $like));
}

function fn_get_vouchers($in)
{
    return rows('SELECT code, big, descr AS `desc` FROM vouchers WHERE active = 1 AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP()) ORDER BY code');
}

/* ---------------- pricing (the server is the only source of truth for prices) ---------------- */

function price_cart($cart)
{
    if (!is_array($cart)) {
        $cart = array();
    }
    if (count($cart) > 50) {
        throw new AppError('Too many items in your order.');
    }
    $lines = array();
    foreach ($cart as $c) {
        $sku = (string)(isset($c['sku']) ? $c['sku'] : '');
        $vid = (string)(isset($c['variantId']) ? $c['variantId'] : '');
        $qty = (int)(isset($c['qty']) ? $c['qty'] : 0);
        if ($qty < 1 || $qty > 20) {
            throw new AppError('Quantity must be between 1 and 20.');
        }
        $it = row('SELECT sku, name FROM menu_items WHERE sku = ? AND active = 1', array($sku));
        $v = $it ? row('SELECT id, label, price FROM menu_variants WHERE id = ? AND sku = ?', array($vid, $sku)) : null;
        if (!$it || !$v) {
            throw new AppError('An item in your order is no longer available. Please remove it and try again.');
        }
        $unit = (int)$v['price'];
        $opts = array();
        $seen = array();
        $given = isset($c['options']) && is_array($c['options']) ? $c['options'] : array();
        foreach ($given as $o) {
            $gid = (string)(isset($o['groupId']) ? $o['groupId'] : '');
            $cid = (string)(isset($o['choiceId']) ? $o['choiceId'] : '');
            $ch = row('SELECT c.id, c.label, c.price, g.type, g.id AS gid FROM option_choices c
                       JOIN option_groups g ON g.id = c.group_id
                       JOIN item_groups ig ON ig.group_id = g.id AND ig.sku = ?
                       WHERE c.id = ? AND g.id = ?', array($sku, $cid, $gid));
            if (!$ch) {
                throw new AppError('One of the selected options is not valid.');
            }
            if (isset($seen[$gid . '|' . $cid]) || ($ch['type'] === 'single' && isset($seen[$gid]))) {
                throw new AppError('Duplicate option selected.');
            }
            $seen[$gid . '|' . $cid] = 1;
            $seen[$gid] = 1;
            $unit += (int)$ch['price'];
            $opts[] = array('groupId' => $gid, 'choiceId' => $cid, 'label' => $ch['label'], 'price' => (int)$ch['price']);
        }
        $lines[] = array(
            'sku' => $sku, 'name' => $it['name'], 'variantId' => $v['id'], 'variantLabel' => $v['label'],
            'options' => $opts, 'qty' => $qty, 'unitPrice' => $unit, 'note' => mb_substr((string)(isset($c['note']) ? $c['note'] : ''), 0, 300),
        );
    }
    return $lines;
}

function lines_subtotal($lines)
{
    $s = 0;
    foreach ($lines as $l) {
        $s += $l['unitPrice'] * $l['qty'];
    }
    return $s;
}

function eval_voucher($code, $subtotal, $mode, $deliveryFee)
{
    $code = strtoupper(trim((string)$code));
    $v = row('SELECT * FROM vouchers WHERE code = ? AND active = 1 AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())', array($code));
    if (!$v) {
        return array('known' => false, 'ok' => false, 'code' => $code, 'amount' => 0, 'error' => "That voucher code isn't valid.");
    }
    $res = array('known' => true, 'ok' => false, 'code' => $v['code'], 'amount' => 0, 'error' => null);
    if ($subtotal < (int)$v['min_spend']) {
        $res['error'] = 'Spend ₱' . number_format($v['min_spend'] / 100, 0) . ' or more to use ' . $v['code'] . '.';
        return $res;
    }
    if ($v['type'] === 'free_delivery') {
        if ($mode !== 'delivery') {
            $res['error'] = $v['code'] . ' is for delivery orders only.';
            return $res;
        }
        $amount = $deliveryFee;
    } elseif ($v['type'] === 'percent') {
        $amount = (int)floor($subtotal * (int)$v['value'] / 100);
    } else {
        $amount = min((int)$v['value'], $subtotal);
    }
    $res['ok'] = true;
    $res['amount'] = $amount;
    return $res;
}

function compute_quote($lines, $ctx, $voucherCodes)
{
    $mode = (is_array($ctx) && isset($ctx['mode']) && $ctx['mode'] === 'delivery') ? 'delivery' : 'pickup';
    $subtotal = lines_subtotal($lines);
    $has = count($lines) > 0;
    $deliveryFee = ($has && $mode === 'delivery') ? (int)cfg('delivery_fee') : 0;
    $serviceFee = ($has && $mode === 'delivery') ? (int)cfg('service_fee') : 0;

    $voucher = null;
    $discount = 0;
    if ($has && is_array($voucherCodes) && count($voucherCodes) > 0 && $voucherCodes[0] !== '') {
        $r = eval_voucher($voucherCodes[0], $subtotal, $mode, $deliveryFee);
        $voucher = array('code' => $r['code'], 'ok' => $r['ok'], 'amount' => $r['amount'], 'error' => $r['error']);
        if ($r['ok']) {
            $discount = $r['amount'];
        }
    }
    $total = max(0, $subtotal + $deliveryFee + $serviceFee - $discount);
    $rate = (int)cfg('vat_rate', 12);
    $vat = (int)round($total * $rate / (100 + $rate));   // VAT is already inside the prices
    return array(
        'subtotal' => $subtotal, 'deliveryFee' => $deliveryFee, 'serviceFee' => $serviceFee,
        'discount' => $discount, 'vat' => $vat, 'total' => $total, 'voucher' => $voucher,
    );
}

function fn_validate_voucher($in)
{
    $lines = price_cart(isset($in['p_cart']) ? $in['p_cart'] : array());
    $r = eval_voucher(isset($in['p_code']) ? $in['p_code'] : '', lines_subtotal($lines), 'delivery', (int)cfg('delivery_fee'));
    // "known" only says the code exists; the quote explains whether it applies to this order.
    return array('known' => $r['known'], 'code' => $r['code'], 'error' => $r['known'] ? null : $r['error']);
}

function fn_calculate_quote($in)
{
    $lines = price_cart(isset($in['p_cart']) ? $in['p_cart'] : array());
    return compute_quote($lines, isset($in['p_ctx']) ? $in['p_ctx'] : array(), isset($in['p_vouchers']) ? $in['p_vouchers'] : array());
}

/* ---------------- orders ---------------- */

function order_steps($mode)
{
    return $mode === 'delivery'
        ? array('Received', 'Preparing', 'Out for delivery', 'Delivered')
        : array('Received', 'Preparing', 'Ready for pick-up', 'Picked up');
}

function new_order_code()
{
    for ($i = 0; $i < 10; $i++) {
        $code = 'JB-' . random_int(100000, 999999);
        if (!row('SELECT id FROM orders WHERE code = ?', array($code))) {
            return $code;
        }
    }
    throw new AppError('Could not create an order number. Please try again.');
}

function fn_create_order($in)
{
    $p = isset($in['p_payload']) && is_array($in['p_payload']) ? $in['p_payload'] : array();
    $ctx = isset($p['orderCtx']) && is_array($p['orderCtx']) ? $p['orderCtx'] : array();
    $contact = isset($p['contact']) && is_array($p['contact']) ? $p['contact'] : array();
    $mode = (isset($ctx['mode']) && $ctx['mode'] === 'delivery') ? 'delivery' : 'pickup';
    $pay = (isset($p['paymentMethod']) && $p['paymentMethod'] === 'card') ? 'card' : 'cod';

    $lines = price_cart(isset($p['items']) ? $p['items'] : array());
    if (!$lines) {
        throw new AppError('Your order is empty.');
    }

    $storeId = (string)(isset($ctx['storeId']) ? $ctx['storeId'] : '');
    if (!row('SELECT id FROM stores WHERE id = ? AND active = 1', array($storeId))) {
        throw new AppError('Please select a store.');
    }
    $address = trim((string)(isset($ctx['address']) ? $ctx['address'] : ''));
    if ($mode === 'delivery' && mb_strlen($address) < 5) {
        throw new AppError('Please enter a delivery address.');
    }
    $name = trim((string)(isset($contact['name']) ? $contact['name'] : ''));
    $phone = trim((string)(isset($contact['phone']) ? $contact['phone'] : ''));
    if ($name === '' || mb_strlen($name) > 120) {
        throw new AppError('Please enter your name.');
    }
    if (!preg_match('/^[0-9+\-\s()]{7,20}$/', $phone)) {
        throw new AppError('Please enter a valid mobile number.');
    }

    $codes = isset($p['vouchers']) && is_array($p['vouchers']) ? $p['vouchers'] : array();
    $quote = compute_quote($lines, $ctx, $codes);
    if ($quote['voucher'] && !$quote['voucher']['ok']) {
        throw new AppError($quote['voucher']['error'] ? $quote['voucher']['error'] : 'That voucher cannot be used.');
    }

    $user = current_user();
    $orderId = uuid4();
    $code = new_order_code();
    $token = bin2hex(random_bytes(16));

    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('INSERT INTO orders (id, code, user_id, tracking_hash, mode, store_id, address, contact_name, contact_phone, payment_method, status,
                               subtotal, delivery_fee, service_fee, discount, vat, total, voucher_code)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            array($orderId, $code, $user ? $user['id'] : null, hash('sha256', $token), $mode, $storeId,
                $mode === 'delivery' ? mb_substr($address, 0, 300) : null, $name, $phone, $pay, 'received',
                $quote['subtotal'], $quote['deliveryFee'], $quote['serviceFee'], $quote['discount'], $quote['vat'], $quote['total'],
                $quote['voucher'] ? $quote['voucher']['code'] : null));
        foreach ($lines as $l) {
            q('INSERT INTO order_items (order_id, sku, item_name, variant_id, variant_label, options_json, qty, unit_price, note) VALUES (?,?,?,?,?,?,?,?,?)',
                array($orderId, $l['sku'], $l['name'], $l['variantId'], $l['variantLabel'], json_encode($l['options']), $l['qty'], $l['unitPrice'], $l['note']));
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
    return array('orderId' => $code, 'trackingToken' => $token, 'total' => $quote['total']);
}

function item_label_rows($orderId)
{
    $out = array();
    foreach (rows('SELECT item_name, variant_label, options_json, qty FROM order_items WHERE order_id = ? ORDER BY id', array($orderId)) as $i) {
        $opts = json_decode($i['options_json'], true);
        $labels = array($i['variant_label']);
        if (is_array($opts)) {
            foreach ($opts as $o) {
                $labels[] = $o['label'];
            }
        }
        $out[] = array('qty' => (int)$i['qty'], 'name' => $i['item_name'], 'variantLabel' => implode(' · ', $labels));
    }
    return $out;
}

function fn_get_order_status($in)
{
    $code = strtoupper(trim((string)(isset($in['p_code']) ? $in['p_code'] : '')));
    $token = (string)(isset($in['p_token']) ? $in['p_token'] : '');
    $o = row('SELECT o.*, s.name AS store_name FROM orders o LEFT JOIN stores s ON s.id = o.store_id WHERE o.code = ?', array($code));
    if (!$o || !hash_equals($o['tracking_hash'], hash('sha256', $token))) {
        throw new AppError('Order not found.', 404);
    }
    $steps = order_steps($o['mode']);
    $map = array('received' => 0, 'preparing' => 1, 'ready' => 2, 'completed' => 3, 'cancelled' => 0);
    $step = $map[$o['status']];
    $cancelled = $o['status'] === 'cancelled';

    $eta = null;
    if (!$cancelled && $o['status'] !== 'completed') {
        $base = $o['mode'] === 'delivery' ? 35 : 15;
        $elapsed = (int)floor((time() - strtotime($o['created_at'] . ' UTC')) / 60);
        $eta = max(5, $base - $elapsed);
    }
    return array(
        'orderId' => $o['code'], 'status' => $o['status'], 'step' => $step, 'steps' => $steps,
        'label' => $cancelled ? 'Cancelled' : $steps[$step], 'cancelled' => $cancelled,
        'mode' => $o['mode'], 'storeName' => $o['store_name'], 'paymentMethod' => $o['payment_method'],
        'createdAt' => iso($o['created_at']), 'etaMinutes' => $eta, 'total' => (int)$o['total'],
        'items' => item_label_rows($o['id']),
    );
}
