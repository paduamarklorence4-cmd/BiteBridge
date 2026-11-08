<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/** Activity log (read only). Only search is routed. Needs activity.view. */
class ActivityController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'activity_logs', 'alias' => 'a', 'label' => 'activity entry', 'module' => 'activity',
            'view_perm' => 'activity.view', 'manage_perm' => 'activity.view',
            'from' => 'activity_logs a LEFT JOIN users u ON u.id = a.user_id',
            'select' => 'a.id, a.created_at, u.username, a.action, a.module, a.record_id, a.description, a.ip_address',
            'search' => ['u.username', 'a.action', 'a.module', 'a.description'],
            'order'  => 'a.id DESC',
            'fields' => [],
            'filters' => [],
        ];
    }
}