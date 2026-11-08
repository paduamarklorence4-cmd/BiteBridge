<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/** System settings. The key cannot be changed after it is created. Values for known keys are range-checked. */
class SettingsController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'system_settings', 'alias' => 's', 'label' => 'setting', 'module' => 'settings',
            'view_perm' => 'settings.manage', 'manage_perm' => 'settings.manage', 'updated_by' => 'updated_by',
            'from' => 'system_settings s LEFT JOIN users u ON u.id = s.updated_by',
            'select' => 's.id, s.setting_key, s.setting_value, s.is_public, s.updated_at, u.full_name AS updated_by_name',
            'search' => ['s.setting_key', 's.setting_value'],
            'order'  => 's.setting_key ASC',
            'fields' => [
                'setting_key'   => ['type' => 'string', 'label' => 'Key', 'required' => true, 'max' => 80],
                'setting_value' => ['type' => 'text', 'label' => 'Value', 'max' => 2000],
                'is_public'     => ['type' => 'bool', 'label' => 'Public', 'default' => 0],
            ],
            'filters' => [],
        ];
    }

    protected function validate_extra(array $data, $mode, $existing)
    {
        $err = [];
        $key = $mode === 'update' ? $existing['setting_key'] : (string) $data['setting_key'];

        if ($mode === 'create') {
            if (!preg_match('/^[a-z][a-z0-9_]{2,79}$/', $key)) {
                $err[] = 'Key must use lowercase letters, numbers, and underscores (3 to 80 characters, starting with a letter).';
            } elseif ($this->call->model('ResourceModel')->exists_where('system_settings', ['setting_key' => $key])) {
                $err[] = 'That key already exists.';
            }
        }

        $v = (string) ($data['setting_value'] ?? '');
        $ranges = ['observation_days' => [1, 60], 'near_expiry_days' => [1, 365]];
        if (isset($ranges[$key])) {
            if (!ctype_digit($v) || (int) $v < $ranges[$key][0] || (int) $v > $ranges[$key][1]) {
                $err[] = "{$key} must be a whole number from {$ranges[$key][0]} to {$ranges[$key][1]}.";
            }
        }
        if ($key === 'sms_gateway_enabled' && !in_array($v, ['0', '1'], true)) {
            $err[] = 'sms_gateway_enabled must be 0 or 1.';
        }
        return $err;
    }

    protected function prepare(array $data, $mode, $existing)
    {
        if ($mode === 'update') {
            unset($data['setting_key']);
        }
        return $data;
    }
}