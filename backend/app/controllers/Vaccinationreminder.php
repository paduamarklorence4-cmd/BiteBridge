<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Reminder history (read only). Only search and detail are routed.
 * No SMS gateway is configured yet, so this list shows whatever rows exist; nothing is sent from here.
 */
class VaccinationRemindersController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'follow_up_reminders', 'alias' => 'r', 'label' => 'reminder', 'module' => 'vaccinations',
            'view_perm' => 'vaccinations.view', 'manage_perm' => 'vaccinations.manage',
            'from' => "follow_up_reminders r
                       INNER JOIN patients p ON p.id = r.patient_id
                       INNER JOIN vaccination_schedules s ON s.id = r.schedule_id",
            'select' => "r.id, r.schedule_id, r.patient_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         r.contact_number, r.message, s.dose_number, s.scheduled_date, r.scheduled_for, r.status,
                         r.attempts, r.last_attempt_at, r.gateway_response, r.delivered_at",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'r.contact_number'],
            'order'  => 'r.scheduled_for DESC, r.id DESC',
            'fields' => [],
            'filters' => [
                'status' => ['type' => 'enum', 'col' => 'r.status', 'values' => ['pending', 'sent', 'delivered', 'failed', 'cancelled']],
            ],
        ];
    }
}