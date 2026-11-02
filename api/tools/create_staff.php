<?php
/* ONE-TIME tool to create a staff/admin login (needed for ops.html and admin.html).
   1. Set 'setup_key' in api/config.local.php
   2. Open:  http://localhost/jollibee-php/api/tools/create_staff.php?key=YOUR_SETUP_KEY
   3. DELETE THIS FILE (or clear setup_key) when you are done. */
require __DIR__ . '/../lib/core.php';

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$key = (string)cfg('setup_key', '');
$given = isset($_REQUEST['key']) ? (string)$_REQUEST['key'] : '';
if ($key === '' || strlen($key) < 12 || !hash_equals($key, $given)) {
    http_response_code(403);
    exit('Forbidden. Set a setup_key (12+ characters) in config.local.php and pass it as ?key=');
}

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim((string)(isset($_POST['email']) ? $_POST['email'] : '')));
    $pass = (string)(isset($_POST['password']) ? $_POST['password'] : '');
    $role = (isset($_POST['role']) && $_POST['role'] === 'admin') ? 'admin' : 'staff';
    try {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new Exception('Invalid email.');
        if (strlen($pass) < 8) throw new Exception('Use at least 8 characters.');
        $existing = row('SELECT id FROM users WHERE email = ?', array($email));
        if ($existing) {
            q('UPDATE users SET password_hash = ?, role = ? WHERE id = ?', array(password_hash($pass, PASSWORD_DEFAULT), $role, $existing['id']));
            $msg = "Updated $email as $role.";
        } else {
            q('INSERT INTO users (id, email, password_hash, role) VALUES (?,?,?,?)', array(uuid4(), $email, password_hash($pass, PASSWORD_DEFAULT), $role));
            $msg = "Created $email as $role.";
        }
        $msg .= ' Now delete this file.';
    } catch (Exception $e) {
        $msg = 'Error: ' . $e->getMessage();
    }
}
?><!doctype html>
<meta charset="utf-8"><title>Create staff</title>
<body style="font-family:system-ui;max-width:420px;margin:40px auto">
<h2>Create staff / admin login</h2>
<?php if ($msg) echo '<p><b>' . h($msg) . '</b></p>'; ?>
<form method="post">
  <input type="hidden" name="key" value="<?php echo h($given); ?>">
  <p><label>Email<br><input name="email" type="email" required style="width:100%"></label></p>
  <p><label>Password (8+)<br><input name="password" type="password" required style="width:100%"></label></p>
  <p><label>Role<br><select name="role"><option value="staff">staff</option><option value="admin">admin</option></select></label></p>
  <button>Save</button>
</form>
</body>
