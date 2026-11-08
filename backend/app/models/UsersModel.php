<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class UsersModel extends Model
{
    protected $table = 'users';

    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Run a prepared statement through the framework DB (same call the Api library uses).
     */
    private function exec_sql($sql, $params = [])
    {
        return lava_instance()->db->raw($sql, $params);
    }

    /**
     * Find a user by username or email, with the role name.
     */
    public function auth_find_user($identifier)
    {
        $stmt = $this->exec_sql(
            "SELECT u.id, u.username, u.email, u.password, u.full_name, u.status, r.name AS role
             FROM users u
             INNER JOIN roles r ON r.id = u.role_id
             WHERE u.username = ? OR u.email = ?
             LIMIT 1",
            [$identifier, $identifier]
        );
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * Fresh profile by id (never trust role/permissions stored inside a token).
     */
    public function auth_profile($id)
    {
        $stmt = $this->exec_sql(
            "SELECT u.id, u.username, u.email, u.full_name, u.status, r.name AS role
             FROM users u
             INNER JOIN roles r ON r.id = u.role_id
             WHERE u.id = ?
             LIMIT 1",
            [$id]
        );
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * Permission codes = role permissions + extra per-user permissions (Staff role).
     */
    public function auth_permission_codes($user_id)
    {
        $stmt = $this->exec_sql(
            "SELECT p.code
             FROM permissions p
             INNER JOIN role_permissions rp ON rp.permission_id = p.id
             INNER JOIN users u ON u.role_id = rp.role_id
             WHERE u.id = ?
             UNION
             SELECT p.code
             FROM permissions p
             INNER JOIN user_permissions up ON up.permission_id = p.id
             WHERE up.user_id = ?",
            [$user_id, $user_id]
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_values(array_column($rows, 'code'));
    }

    /**
     * Is this (hashed) refresh token stored and not expired?
     */
    public function auth_refresh_exists($hashed_token)
    {
        $stmt = $this->exec_sql(
            "SELECT id FROM refresh_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1",
            [$hashed_token]
        );
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function auth_touch_last_login($id)
    {
        $this->exec_sql("UPDATE users SET last_login_at = NOW() WHERE id = ?", [$id]);
    }

    public function log_activity($user_id, $action, $module, $description = null, $record_id = null)
    {
        $this->exec_sql(
            "INSERT INTO activity_logs (user_id, action, module, record_id, description, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)",
            [$user_id, $action, $module, $record_id, $description, $_SERVER['REMOTE_ADDR'] ?? null]
        );
    }
}
