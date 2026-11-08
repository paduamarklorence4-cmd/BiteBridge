<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AuthController extends Controller
{
    // Valid bcrypt hash used only to keep timing similar when the username does not exist.
    private const DUMMY_HASH = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    /**
     * Raw JSON body. Api::body() HTML-escapes strings (e.g. & < > " '),
     * which would break passwords, so credentials are read raw.
     */
    private function json_input()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    private function client_ip()
    {
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    private function user_payload($profile, $permissions)
    {
        return [
            'id'          => (int) $profile['id'],
            'username'    => $profile['username'],
            'email'       => $profile['email'],
            'full_name'   => $profile['full_name'],
            'role'        => $profile['role'],
            'permissions' => $permissions,
        ];
    }

    public function login()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('login_' . $this->client_ip(), 5, 60);

        $input      = $this->json_input();
        $identifier = trim((string) ($input['username'] ?? ''));
        $password   = (string) ($input['password'] ?? '');

        if ($identifier === '' || $password === '') {
            $this->api->respond_error('Username and password are required', 422);
        }
        if (strlen($identifier) > 120 || strlen($password) > 255) {
            $this->api->respond_error('Invalid username or password', 401);
        }

        $users = $this->call->model('UsersModel');
        $user  = $users->auth_find_user($identifier);

        $valid = password_verify($password, $user['password'] ?? self::DUMMY_HASH);

        if (!$user || !$valid) {
            $users->log_activity(null, 'login_failed', 'auth', 'Failed login attempt');
            $this->api->respond_error('Invalid username or password', 401);
        }

        if ($user['status'] !== 'active') {
            $this->api->respond_error('This account is not active. Please contact the administrator.', 403);
        }

        $permissions = $users->auth_permission_codes($user['id']);

        $tokens = $this->api->issue_tokens([
            'id'     => (int) $user['id'],
            'role'   => $user['role'],
            'scopes' => $permissions,
        ]);

        $users->auth_touch_last_login($user['id']);
        $users->log_activity($user['id'], 'login', 'auth', 'User logged in', $user['id']);

        $this->api->respond([
            'message' => 'Login successful',
            'tokens'  => $tokens,
            'user'    => $this->user_payload($user, $permissions),
        ]);
    }

    public function me()
    {
        $this->api->require_method('GET');
        $payload = $this->api->require_jwt();

        // A refresh token must never be accepted as an access token.
        if (($payload['type'] ?? '') === 'refresh') {
            $this->api->respond_error('Unauthorized', 401);
        }

        $users   = $this->call->model('UsersModel');
        $profile = $users->auth_profile((int) $payload['sub']);

        if (!$profile || $profile['status'] !== 'active') {
            $this->api->respond_error('Unauthorized', 401);
        }

        $this->api->respond([
            'user' => $this->user_payload($profile, $users->auth_permission_codes($profile['id'])),
        ]);
    }

    public function refresh()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('refresh_' . $this->client_ip(), 30, 60);

        $input = $this->json_input();
        $token = (string) ($input['refresh_token'] ?? '');

        $payload = $this->api->validate_jwt($token);
        if (!$payload || ($payload['type'] ?? '') !== 'refresh') {
            $this->api->respond_error('Invalid refresh token', 403);
        }

        $users  = $this->call->model('UsersModel');
        $hashed = hash_hmac('sha256', $token, config_item('refresh_token_key'));

        if (!$users->auth_refresh_exists($hashed)) {
            $this->api->respond_error('Refresh token expired or revoked', 403);
        }

        // Rotate: revoke the old token, then issue a new pair with the CURRENT role and permissions.
        $this->api->revoke_refresh_token($token);

        $profile = $users->auth_profile((int) $payload['sub']);
        if (!$profile || $profile['status'] !== 'active') {
            $this->api->respond_error('Account is not active', 403);
        }

        $permissions = $users->auth_permission_codes($profile['id']);
        $tokens = $this->api->issue_tokens([
            'id'     => (int) $profile['id'],
            'role'   => $profile['role'],
            'scopes' => $permissions,
        ]);

        $this->api->respond([
            'message' => 'Tokens refreshed successfully',
            'tokens'  => $tokens,
        ]);
    }

    public function logout()
    {
        $this->api->require_method('POST');

        $input = $this->json_input();
        $token = (string) ($input['refresh_token'] ?? '');

        if ($token === '') {
            $this->api->respond_error('Refresh token is required', 422);
        }

        $payload = $this->api->validate_jwt($token);
        $this->api->revoke_refresh_token($token);

        if ($payload && isset($payload['sub'])) {
            $users = $this->call->model('UsersModel');
            $users->log_activity((int) $payload['sub'], 'logout', 'auth', 'User logged out', (int) $payload['sub']);
        }

        $this->api->respond(['message' => 'Logged out']);
    }
}