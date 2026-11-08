<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Pick-lists for form fields (patient or incident selectors). Each list needs the matching view permission. */
class LookupController extends Controller
{
    private const RESOURCES = [
        'patients'  => 'patients.view',
        'incidents' => 'incidents.view',
        'roles'     => 'users.manage',
    ];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    public function search()
    {
        $this->api->require_method('POST');

        $payload = $this->api->require_jwt();
        if (($payload['type'] ?? '') === 'refresh') {
            $this->api->respond_error('Unauthorized', 401);
        }
        $users   = $this->call->model('UsersModel');
        $profile = $users->auth_profile((int) ($payload['sub'] ?? 0));
        if (!$profile || $profile['status'] !== 'active') {
            $this->api->respond_error('Unauthorized', 401);
        }

        $in = json_decode(file_get_contents('php://input'), true);
        $in = is_array($in) ? $in : [];
        $resource = (string) ($in['resource'] ?? '');
        if (!isset(self::RESOURCES[$resource])) {
            $this->api->respond_error('Unknown list', 422);
        }

        $codes = $users->auth_permission_codes((int) $profile['id']);
        if (!in_array(self::RESOURCES[$resource], $codes, true)) {
            $this->api->respond_error('You do not have permission to do this.', 403);
        }

        $term = trim((string) ($in['term'] ?? ''));
        if (mb_strlen($term) > 100) {
            $term = mb_substr($term, 0, 100);
        }
        $model = $this->call->model('ResourceModel');
        $this->api->respond(['items' => $model->lookup($resource, $term)]);
    }
}