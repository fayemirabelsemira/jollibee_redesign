<?php
/* Core helpers: errors, config, database, auth. PHP 7.4+ */

class AppError extends Exception
{
    public $status;
    public function __construct($message, $status = 400)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function cfg($key, $default = null)
{
    static $c = null;
    if ($c === null) {
        $c = require __DIR__ . '/../config.php';
    }
    return array_key_exists($key, $c) ? $c[$key] : $default;
}

function db()
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $dsn = 'mysql:host=' . cfg('db_host') . ';port=' . cfg('db_port') . ';dbname=' . cfg('db_name') . ';charset=utf8mb4';
    $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ));
    $pdo->exec("SET time_zone = '+00:00'");   // all timestamps are stored/returned in UTC
    return $pdo;
}

function q($sql, $params = array())
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function rows($sql, $params = array())
{
    return q($sql, $params)->fetchAll();
}

function row($sql, $params = array())
{
    $r = q($sql, $params)->fetch();
    return $r ? $r : null;
}

function uuid4()
{
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

/* MySQL "2026-10-29 11:00:00" (UTC) -> "2026-10-29T11:00:00Z" */
function iso($s)
{
    if (!$s) {
        return null;
    }
    $t = strtotime($s . ' UTC');
    return $t ? gmdate('Y-m-d\TH:i:s\Z', $t) : null;
}

/* ---------------- auth (opaque bearer tokens, sent in X-Auth-Token) ---------------- */

function issue_token($userId)
{
    $token = bin2hex(random_bytes(32));
    q('INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . (int)cfg('token_days', 14) . ' DAY))',
        array(hash('sha256', $token), $userId));
    return $token;
}

function current_token()
{
    return isset($_SERVER['HTTP_X_AUTH_TOKEN']) ? trim($_SERVER['HTTP_X_AUTH_TOKEN']) : null;
}

function current_user()
{
    static $loaded = false, $user = null;
    if ($loaded) {
        return $user;
    }
    $loaded = true;
    $t = current_token();
    if ($t) {
        $user = row('SELECT u.id, u.email, u.role FROM auth_tokens a JOIN users u ON u.id = a.user_id WHERE a.token_hash = ? AND a.expires_at > UTC_TIMESTAMP()',
            array(hash('sha256', $t)));
    }
    return $user;
}

function require_staff()
{
    $u = current_user();
    if (!$u || ($u['role'] !== 'staff' && $u['role'] !== 'admin')) {
        throw new AppError('Staff sign-in required.', 401);
    }
    return $u;
}

function session_payload($user, $token)
{
    return array(
        'access_token' => $token,
        'user' => array(
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'is_anonymous' => false,
        ),
    );
}
