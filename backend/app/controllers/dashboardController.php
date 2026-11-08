<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class DashboardController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    /**
     * Validate the access token, reload the user from the database, and require a permission.
     * Permissions are read fresh from the database, not from the token. Returns the user's permission codes.
     */
    private function authorize($permission)
    {
        $payload = $this->api->require_jwt();

        // A refresh token must never be accepted as an access token.
        if (($payload['type'] ?? '') === 'refresh') {
            $this->api->respond_error('Unauthorized', 401);
        }

        $users   = $this->call->model('UsersModel');
        $profile = $users->auth_profile((int) ($payload['sub'] ?? 0));

        if (!$profile || $profile['status'] !== 'active') {
            $this->api->respond_error('Unauthorized', 401);
        }

        $codes = $users->auth_permission_codes((int) $profile['id']);
        if (!in_array($permission, $codes, true)) {
            $this->api->respond_error('You do not have permission to view this.', 403);
        }
        return $codes;
    }

    public function stats()
    {
        $this->api->require_method('GET');
        $codes = $this->authorize('dashboard.view');

        // Each figure is only returned if the role may see that module (otherwise null).
        $allow = [
            'patients'     => in_array('patients.view', $codes, true),
            'incidents'    => in_array('incidents.view', $codes, true),
            'appointments' => in_array('appointments.view', $codes, true),
            'vaccinations' => in_array('vaccinations.view', $codes, true),
            'inventory'    => in_array('inventory.view', $codes, true),
            'billing'      => in_array('billing.view', $codes, true),
        ];

        $dash = $this->call->model('DashboardModel');
        $this->api->respond($dash->stats($allow));
    }
}