<?php
/* Sign up / sign in / sign out / session. */

function fn_auth_signup($in)
{
    $email = strtolower(trim((string)(isset($in['email']) ? $in['email'] : '')));
    $pass = (string)(isset($in['password']) ? $in['password'] : '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
        throw new AppError('Please enter a valid email address.');
    }
    if (strlen($pass) < 6) {
        throw new AppError('Password must be at least 6 characters.');
    }
    if (strlen($pass) > 200) {
        throw new AppError('Password is too long.');
    }
    if (row('SELECT id FROM users WHERE email = ?', array($email))) {
        throw new AppError('An account with that email already exists.');
    }
    $id = uuid4();
    q('INSERT INTO users (id, email, password_hash, role) VALUES (?,?,?,?)',
        array($id, $email, password_hash($pass, PASSWORD_DEFAULT), 'customer'));
    $user = array('id' => $id, 'email' => $email, 'role' => 'customer');
    return array('session' => session_payload($user, issue_token($id)));
}

function fn_auth_signin($in)
{
    $email = strtolower(trim((string)(isset($in['email']) ? $in['email'] : '')));
    $pass = (string)(isset($in['password']) ? $in['password'] : '');
    $staffOnly = !empty($in['staffOnly']);
    $u = row('SELECT id, email, role, password_hash FROM users WHERE email = ?', array($email));
    if (!$u || !password_verify($pass, $u['password_hash'])) {
        usleep(400000);   // slows down password guessing a little
        throw new AppError('Invalid email or password.', 401);
    }
    if ($staffOnly && $u['role'] === 'customer') {
        throw new AppError('This account does not have staff access.', 403);
    }
    return array('session' => session_payload($u, issue_token($u['id'])));
}

function fn_auth_signout($in)
{
    $t = current_token();
    if ($t) {
        q('DELETE FROM auth_tokens WHERE token_hash = ?', array(hash('sha256', $t)));
    }
    return true;
}

function fn_auth_session($in)
{
    $u = current_user();
    if (!$u) {
        return array('session' => null);
    }
    return array('session' => session_payload($u, current_token()));
}
