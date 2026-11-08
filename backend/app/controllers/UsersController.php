<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Staff accounts (users.manage) and permission settings (roles.manage).
 * Accounts are never deleted: set the status to inactive instead, so records keep their history.
 * Passwords are stored only as bcrypt hashes and are never returned.
 */
class UsersController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'users', 'alias' => 'u', 'label' => 'account', 'module' => 'users',
            'view_perm' => 'users.manage', 'manage_perm' => 'users.manage',
            'from' => 'users u INNER JOIN roles r ON r.id = u.role_id',
            'select' => "u.id, u.role_id, r.name AS role_name, r.label AS role_label, u.username, u.email, u.full_name,
                         u.contact_number, u.status, u.last_login_at",
            'search' => ['u.username', 'u.email', 'u.full_name', 'r.label'],
            'order'  => 'u.id ASC',
            'fields' => [
                'role_id'        => ['type' => 'ref', 'table' => 'roles', 'label' => 'Role', 'required' => true],
                'username'       => ['type' => 'string', 'label' => 'Username', 'required' => true, 'max' => 50],
                'email'          => ['type' => 'string', 'label' => 'Email', 'required' => true, 'max' => 120],
                'full_name'      => ['type' => 'string', 'label' => 'Full name', 'required' => true, 'max' => 120],
                'contact_number' => ['type' => 'string', 'label' => 'Contact number', 'max' => 20],
                'status'         => ['type' => 'enum', 'label' => 'Status', 'values' => ['active', 'inactive', 'suspended'], 'default' => 'active'],
                'password'       => ['type' => 'string', 'label' => 'Password', 'max' => 72],
            ],
            'filters' => [
                'status' => ['type' => 'enum', 'col' => 'u.status', 'values' => ['active', 'inactive', 'suspended']],
            ],
        ];
    }

    protected function validate_extra(array $data, $mode, $existing)
    {
        $err   = [];
        $model = $this->call->model('ResourceModel');
        $self  = $existing ? (int) $existing['id'] : 0;

        if (!preg_match('/^[A-Za-z0-9_.\-]{3,50}$/', (string) $data['username'])) {
            $err[] = 'Username must be 3 to 50 characters: letters, numbers, dot, dash, or underscore.';
        } elseif ($model->exists_where('users', ['username' => $data['username']], $self)) {
            $err[] = 'That username is already taken.';
        }

        if (!filter_var((string) $data['email'], FILTER_VALIDATE_EMAIL)) {
            $err[] = 'Enter a valid email address.';
        } elseif ($model->exists_where('users', ['email' => $data['email']], $self)) {
            $err[] = 'That email is already used by another account.';
        }

        if (!empty($data['contact_number']) && !preg_match('/^\+?\d{7,15}$/', preg_replace('/[\s\-()]/', '', $data['contact_number']))) {
            $err[] = 'Contact number must be 7 to 15 digits.';
        }

        $pw = (string) ($data['password'] ?? '');
        if ($mode === 'create' && $pw === '') {
            $err[] = 'Password is required for a new account.';
        }
        if ($pw !== '') {
            if (mb_strlen($pw) < 8 || !preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw)) {
                $err[] = 'Password must be at least 8 characters and include a letter and a number.';
            }
            if (strlen($pw) > 72) {
                $err[] = 'Password is too long (up to 72 characters).';
            }
        }

        // Do not let someone lock themselves out.
        if ($existing && $this->auth && $self === (int) $this->auth['profile']['id']) {
            if ($data['status'] !== 'active') {
                $err[] = 'You cannot deactivate your own account.';
            }
            if ((int) $data['role_id'] !== (int) $existing['role_id']) {
                $err[] = 'You cannot change your own role.';
            }
        }
        return $err;
    }

    protected function prepare(array $data, $mode, $existing)
    {
        $pw = (string) ($data['password'] ?? '');
        if ($pw === '') {
            unset($data['password']);
        } else {
            $data['password'] = password_hash($pw, PASSWORD_BCRYPT);
        }
        if (!empty($data['contact_number'])) {
            $data['contact_number'] = preg_replace('/[\s\-()]/', '', $data['contact_number']);
        }
        return $data;
    }

    /** POST /users/roles -> roles for pick-lists */
    public function roles()
    {
        $this->api->require_method('POST');
        $this->authorize('users.manage');
        $model = $this->call->model('ResourceModel');
        $this->api->respond(['items' => $model->query_all("SELECT id, name, label FROM roles ORDER BY id")]);
    }

    /** POST /users/role-permissions { role_id } -> all permissions and the ids this role has */
    public function role_permissions()
    {
        $this->api->require_method('POST');
        $this->authorize('roles.manage');
        $in    = $this->json_input();
        $model = $this->call->model('ResourceModel');
        $role_id = (int) ($in['role_id'] ?? 0);
        if ($role_id <= 0 || !$model->row_exists('roles', $role_id)) {
            $this->api->respond_error('Role not found', 404);
        }
        $perms = $model->query_all("SELECT id, code, module, description FROM permissions ORDER BY module, code");
        $have  = $model->query_all("SELECT permission_id FROM role_permissions WHERE role_id = ?", [$role_id]);
        $this->api->respond([
            'permissions' => $perms,
            'selected'    => array_map('intval', array_column($have, 'permission_id')),
        ]);
    }

    private function clean_ids($raw)
    {
        $ids = [];
        if (is_array($raw)) {
            foreach ($raw as $v) {
                if ((is_int($v) || (is_string($v) && ctype_digit($v))) && (int) $v > 0) {
                    $ids[(int) $v] = true;
                }
            }
        }
        return array_keys($ids);
    }

    /** Returns the codes for the ids, or responds 422 if any id does not exist. */
    private function codes_for(array $ids)
    {
        if (!$ids) {
            return [];
        }
        $model = $this->call->model('ResourceModel');
        $rows  = $model->query_all(
            "SELECT id, code FROM permissions WHERE id IN (" . implode(',', array_fill(0, count($ids), '?')) . ")", $ids
        );
        if (count($rows) !== count($ids)) {
            $this->api->respond_error('One of the selected permissions does not exist.', 422);
        }
        return array_column($rows, 'code');
    }

    /** POST /users/save-role-permissions { role_id, permission_ids } */
    public function save_role_permissions()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('roles.manage');
        $in    = $this->json_input();
        $model = $this->call->model('ResourceModel');

        $role_id = (int) ($in['role_id'] ?? 0);
        $role    = $role_id > 0 ? $model->get_row('roles', $role_id) : null;
        if (!$role) {
            $this->api->respond_error('Role not found', 404);
        }
        $ids   = $this->clean_ids($in['permission_ids'] ?? []);
        $codes = $this->codes_for($ids);

        if ($role['name'] === 'superadmin') {
            foreach (['users.manage', 'roles.manage', 'dashboard.view'] as $must) {
                if (!in_array($must, $codes, true)) {
                    $this->api->respond_error('The Superadmin role must keep "' . $must . '" so the system can still be managed.', 422);
                }
            }
        }

        $model->begin();
        try {
            $model->execute("DELETE FROM role_permissions WHERE role_id = ?", [$role_id]);
            foreach ($ids as $pid) {
                $model->execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [$role_id, $pid]);
            }
            $model->commit();
        } catch (Throwable $e) {
            $model->rollback();
            $this->api->respond_error('The permissions could not be saved. Please try again.', 500);
        }

        $auth['users']->log_activity((int) $auth['profile']['id'], 'role_permissions_saved', 'users',
            'Updated permissions of role ' . $role['name'], $role_id);
        $this->api->respond(['message' => 'Role permissions saved', 'count' => count($ids)]);
    }

    /** POST /users/user-permissions { user_id } -> each permission with via_role and extra flags */
    public function user_permissions()
    {
        $this->api->require_method('POST');
        $this->authorize('roles.manage');
        $in    = $this->json_input();
        $model = $this->call->model('ResourceModel');
        $uid   = (int) ($in['user_id'] ?? 0);
        $user  = $uid > 0 ? $model->get_row('users', $uid) : null;
        if (!$user) {
            $this->api->respond_error('Account not found', 404);
        }
        $perms = $model->query_all(
            "SELECT p.id, p.code, p.module, p.description,
                    EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role_id = ? AND rp.permission_id = p.id) AS via_role,
                    EXISTS(SELECT 1 FROM user_permissions up WHERE up.user_id = ? AND up.permission_id = p.id) AS extra
             FROM permissions p ORDER BY p.module, p.code",
            [(int) $user['role_id'], $uid]
        );
        foreach ($perms as $k => $p) {
            $perms[$k]['id'] = (int) $p['id'];
            $perms[$k]['via_role'] = (int) $p['via_role'] === 1;
            $perms[$k]['extra'] = (int) $p['extra'] === 1;
        }
        $this->api->respond(['permissions' => $perms, 'username' => $user['username']]);
    }

    /** POST /users/save-user-permissions { user_id, permission_ids } -> extra permissions beyond the role */
    public function save_user_permissions()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('roles.manage');
        $in    = $this->json_input();
        $model = $this->call->model('ResourceModel');

        $uid  = (int) ($in['user_id'] ?? 0);
        $user = $uid > 0 ? $model->get_row('users', $uid) : null;
        if (!$user) {
            $this->api->respond_error('Account not found', 404);
        }
        $ids = $this->clean_ids($in['permission_ids'] ?? []);
        $this->codes_for($ids);

        $model->begin();
        try {
            $model->execute("DELETE FROM user_permissions WHERE user_id = ?", [$uid]);
            foreach ($ids as $pid) {
                $model->execute("INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)", [$uid, $pid]);
            }
            $model->commit();
        } catch (Throwable $e) {
            $model->rollback();
            $this->api->respond_error('The permissions could not be saved. Please try again.', 500);
        }

        $auth['users']->log_activity((int) $auth['profile']['id'], 'user_permissions_saved', 'users',
            'Updated extra permissions of ' . $user['username'], $uid);
        $this->api->respond(['message' => 'Permissions saved', 'count' => count($ids)]);
    }
}