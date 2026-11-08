<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Animal observation tracking (default 14 days, setting observation_days).
 * This is an administrative tracker only, not a replacement for professional assessment.
 */
class MonitoringController extends ResourceController
{
    protected function config()
    {
        $statuses = ['under_observation', 'completed', 'animal_died', 'lost', 'cancelled'];
        return [
            'table' => 'animal_monitoring', 'alias' => 'm', 'label' => 'monitoring record', 'module' => 'monitoring',
            'view_perm' => 'monitoring.view', 'manage_perm' => 'monitoring.manage', 'created_by' => 'recorded_by',
            'from' => "animal_monitoring m
                       INNER JOIN animal_bite_incidents i ON i.id = m.incident_id
                       INNER JOIN patients p ON p.id = i.patient_id",
            'select' => "m.id, m.incident_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name), ' - ', i.incident_date, ' - ', i.animal_type) AS incident_label,
                         i.animal_type, m.animal_description, m.observation_start_date, m.expected_end_date, m.status,
                         m.animal_death_reported, m.death_reported_date, m.notes,
                         DATEDIFF(CURDATE(), m.observation_start_date) + 1 AS observation_day,
                         DATEDIFF(m.expected_end_date, CURDATE()) AS days_left",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'i.animal_type', 'm.animal_description'],
            'order'  => "(m.status = 'under_observation') DESC, m.expected_end_date ASC, m.id DESC",
            'fields' => [
                'incident_id'            => ['type' => 'ref', 'table' => 'animal_bite_incidents', 'label' => 'Bite incident', 'required' => true],
                'animal_description'     => ['type' => 'string', 'label' => 'Animal description', 'max' => 255],
                'observation_start_date' => ['type' => 'date', 'label' => 'Observation start date', 'required' => true, 'no_future' => true],
                'status'                 => ['type' => 'enum', 'label' => 'Status', 'values' => $statuses, 'default' => 'under_observation'],
                'animal_death_reported'  => ['type' => 'bool', 'label' => 'Animal death reported', 'default' => 0],
                'death_reported_date'    => ['type' => 'date', 'label' => 'Date death was reported', 'no_future' => true],
                'notes'                  => ['type' => 'text', 'label' => 'Notes'],
            ],
            'filters' => [
                'status' => ['type' => 'enum', 'col' => 'm.status', 'values' => $statuses],
                'view' => ['type' => 'map', 'map' => [
                    'alerts' => "(m.animal_death_reported = 1 OR (m.status = 'under_observation' AND m.expected_end_date < CURDATE()))",
                    'ending' => "m.status = 'under_observation' AND m.expected_end_date >= CURDATE() AND m.expected_end_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)",
                ]],
            ],
        ];
    }

    protected function validate_extra(array $data, $mode, $existing)
    {
        $death = !empty($data['animal_death_reported']) || $data['status'] === 'animal_died';
        if ($death && empty($data['death_reported_date'])) {
            return ['Enter the date the animal\'s death was reported.'];
        }
        if ($death && $data['death_reported_date'] < $data['observation_start_date']) {
            return ['The death date cannot be before the observation start date.'];
        }
        return [];
    }

    protected function prepare(array $data, $mode, $existing)
    {
        $model = $this->call->model('ResourceModel');
        $days  = $model->setting_int('observation_days', 14, 1, 60);
        $data['expected_end_date'] = (new DateTime($data['observation_start_date']))->modify("+{$days} days")->format('Y-m-d');

        if ($data['status'] === 'animal_died') {
            $data['animal_death_reported'] = 1;
        }
        if (empty($data['animal_death_reported'])) {
            $data['death_reported_date'] = null;
        }
        return $data;
    }
}