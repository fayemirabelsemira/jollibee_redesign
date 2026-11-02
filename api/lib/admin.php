<?php
/* Staff-only endpoints: order queue + generic CRUD for the ops_* tables. */

/* ---------------- order queue (admin.html) ---------------- */

function fn_admin_list_orders($in)
{
    require_staff();
    $view = isset($in['p_view']) ? $in['p_view'] : 'active';
    if ($view === 'history') {
        $where = "o.status IN ('completed','cancelled')";
    } elseif ($view === 'all') {
        $where = '1=1';
    } else {
        $where = "o.status IN ('received','preparing','ready')";
    }
    $orders = rows("SELECT o.*, s.name AS store_name FROM orders o LEFT JOIN stores s ON s.id = o.store_id WHERE $where ORDER BY o.created_at DESC LIMIT 200");
    $out = array();
    foreach ($orders as $o) {
        $steps = order_steps($o['mode']);
        $map = array('received' => 0, 'preparing' => 1, 'ready' => 2, 'completed' => 3, 'cancelled' => 0);
        $out[] = array(
            'orderId' => $o['code'], 'code' => $o['code'], 'status' => $o['status'], 'mode' => $o['mode'],
            'label' => $o['status'] === 'cancelled' ? 'Cancelled' : $steps[$map[$o['status']]],
            'storeId' => $o['store_id'], 'storeName' => $o['store_name'], 'address' => $o['address'],
            'contact' => array('name' => $o['contact_name'], 'phone' => $o['contact_phone']),
            'customerName' => $o['contact_name'], 'customerPhone' => $o['contact_phone'],
            'paymentMethod' => $o['payment_method'], 'voucher' => $o['voucher_code'],
            'subtotal' => (int)$o['subtotal'], 'deliveryFee' => (int)$o['delivery_fee'], 'serviceFee' => (int)$o['service_fee'],
            'discount' => (int)$o['discount'], 'vat' => (int)$o['vat'], 'total' => (int)$o['total'],
            'createdAt' => iso($o['created_at']), 'updatedAt' => iso($o['updated_at']),
            'items' => item_label_rows($o['id']),
        );
    }
    return $out;
}

function fn_admin_set_order_status($in)
{
    require_staff();
    $code = strtoupper(trim((string)(isset($in['p_code']) ? $in['p_code'] : '')));
    $status = (string)(isset($in['p_status']) ? $in['p_status'] : '');
    if (!in_array($status, array('received', 'preparing', 'ready', 'completed', 'cancelled'), true)) {
        throw new AppError('Unknown status.');
    }
    $st = q('UPDATE orders SET status = ? WHERE code = ?', array($status, $code));
    if ($st->rowCount() === 0 && !row('SELECT id FROM orders WHERE code = ?', array($code))) {
        throw new AppError('Order not found.', 404);
    }
    return array('orderId' => $code, 'status' => $status);
}

/* ---------------- generic ops_* CRUD (used by ops.html through ops-db.js) ---------------- */

function ops_tables()
{
    return array(
        'ops_company_info', 'ops_suppliers', 'ops_menu_items', 'ops_inventory', 'ops_purchase_orders',
        'ops_supplier_payments', 'ops_sales', 'ops_customer_payments', 'ops_employees', 'ops_attendance',
        'ops_payroll', 'ops_accounts', 'ops_journal_entries', 'ops_journal_lines',
    );
}

function ops_cols($table)
{
    static $cache = array();
    if (!isset($cache[$table])) {
        $m = array();
        foreach (rows('SELECT COLUMN_NAME AS n, DATA_TYPE AS d, COLUMN_TYPE AS ct, EXTRA AS e FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', array($table)) as $r) {
            $m[$r['n']] = $r;
        }
        $cache[$table] = $m;
    }
    return $cache[$table];
}

function ops_out($cols, $r)
{
    foreach ($r as $k => $v) {
        if ($v === null || !isset($cols[$k])) {
            continue;
        }
        $c = $cols[$k];
        if (in_array($c['d'], array('decimal', 'float', 'double'), true)) {
            $r[$k] = (float)$v;
        } elseif ($c['ct'] === 'tinyint(1)') {
            $r[$k] = ((int)$v) === 1;
        } elseif (in_array($c['d'], array('datetime', 'timestamp'), true)) {
            $r[$k] = iso($v);
        }
    }
    return $r;
}

function ops_in($cols, $data, $forUpdate)
{
    $clean = array();
    foreach ($data as $k => $v) {
        if (!is_string($k) || !isset($cols[$k])) {
            continue;
        }
        if (stripos($cols[$k]['e'], 'GENERATED') !== false) {
            continue;                      // computed by MySQL (e.g. total)
        }
        if ($forUpdate && $k === 'id') {
            continue;
        }
        if (is_bool($v)) {
            $v = $v ? 1 : 0;
        } elseif (is_array($v)) {
            continue;
        } elseif (is_string($v) && in_array($cols[$k]['d'], array('datetime', 'timestamp'), true)) {
            $t = strtotime($v);
            $v = $t ? gmdate('Y-m-d H:i:s', $t) : null;
        }
        $clean[$k] = $v;
    }
    return $clean;
}

function ops_dup_guard(PDOException $e)
{
    if ((string)$e->getCode() === '23000') {
        throw new AppError('duplicate key value violates unique constraint');
    }
    throw $e;
}

function fn_ops($in)
{
    // require_staff(); // ops open access
    $table = isset($in['table']) ? (string)$in['table'] : '';
    if (!in_array($table, ops_tables(), true)) {
        throw new AppError('Unknown table.');
    }
    $cols = ops_cols($table);
    $action = isset($in['action']) ? (string)$in['action'] : 'list';

    if ($action === 'list') {
        $sql = 'SELECT * FROM `' . $table . '`';
        $order = isset($in['order']) ? (string)$in['order'] : '';
        if ($order !== '' && isset($cols[$order])) {      // an unknown column is ignored, not an error
            $sql .= ' ORDER BY `' . $order . '` ' . (!empty($in['asc']) ? 'ASC' : 'DESC');
        }
        $sql .= ' LIMIT 5000';
        return array_map(function ($r) use ($cols) { return ops_out($cols, $r); }, rows($sql));
    }

    if ($action === 'insert') {
        $list = isset($in['rows']) && is_array($in['rows']) ? $in['rows'] : array();
        if (count($list) > 500) {
            throw new AppError('Too many rows in one request.');
        }
        $ids = array();
        try {
            foreach ($list as $data) {
                if (!is_array($data)) {
                    continue;
                }
                $clean = ops_in($cols, $data, false);
                if (isset($cols['id']) && empty($clean['id'])) {
                    $clean['id'] = uuid4();
                }
                if (!$clean) {
                    continue;
                }
                $names = array_map(function ($c) { return '`' . $c . '`'; }, array_keys($clean));
                q('INSERT INTO `' . $table . '` (' . implode(',', $names) . ') VALUES (' . implode(',', array_fill(0, count($clean), '?')) . ')',
                    array_values($clean));
                if (isset($clean['id'])) {
                    $ids[] = $clean['id'];
                }
            }
        } catch (PDOException $e) {
            ops_dup_guard($e);
        }
        if (!$ids) {
            return array();
        }
        $found = rows('SELECT * FROM `' . $table . '` WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', $ids);
        return array_map(function ($r) use ($cols) { return ops_out($cols, $r); }, $found);
    }

    if ($action === 'update') {
        $id = isset($in['id']) ? (string)$in['id'] : '';
        $clean = ops_in($cols, isset($in['patch']) && is_array($in['patch']) ? $in['patch'] : array(), true);
        if ($id === '' || !$clean || !isset($cols['id'])) {
            throw new AppError('Nothing to update.');
        }
        $set = array_map(function ($c) { return '`' . $c . '` = ?'; }, array_keys($clean));
        try {
            q('UPDATE `' . $table . '` SET ' . implode(', ', $set) . ' WHERE id = ?', array_merge(array_values($clean), array($id)));
        } catch (PDOException $e) {
            ops_dup_guard($e);
        }
        return true;
    }

    throw new AppError('Unknown action.');
}
