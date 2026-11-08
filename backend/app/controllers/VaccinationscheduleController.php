<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/** Vaccination dose schedule / follow-up tracker. The nurse or physician sets the schedule. */
class VaccinationSchedulesController extends ResourceController
{
    protected function config()
    {
        $statuses = ['scheduled', 'completed', 'missed', 'cancelled'];
        return [
            'table' => 'vaccination_schedules', 'alias' => 's', 'label' => 'vaccine schedule', 'module' => 'vaccinations',
            'view_perm' => 'vaccinations.view', 'manage_perm' => 'vaccinations.manage',
            'from' => "vaccination_schedules s
                       INNER JOIN patients p ON p.id = s.patient_id
                       INNER JOIN animal_bite_incidents i ON i.id = s.incident_id",
            'select' => "s.id, s.patient_id, s.incident_id, p.patient_code, p.contact_number,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name), ' - ', i.incident_date, ' - ', i.animal_type) AS incident_label,
                         s.dose_number, s.scheduled_date, s.status, s.follow_up_notes,
                         CASE WHEN s.status = 'scheduled' AND s.scheduled_date < CURDATE() THEN 1 ELSE 0 END AS is_overdue,
                         DATEDIFF(s.scheduled_date, CURDATE()) AS days_until",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'p.contact_number'],
            'order'  => "(s.status = 'scheduled') DESC, s.scheduled_date ASC, s.id ASC",
            'fields' => [
                'incident_id'     => ['type' => 'ref', 'table' => 'animal_bite_incidents', 'label' => 'Bite incident', 'required' => true],
                'dose_number'     => ['type' => 'int', 'label' => 'Dose number', 'required' => true, 'min' => 0, 'max' => 10],
                'scheduled_date'  => ['type' => 'date', 'label' => 'Scheduled date', 'required' => true],
                'status'          => ['type' => 'enum', 'label' => 'Status', 'values' => $statuses, 'default' => 'scheduled'],
                'follow_up_notes' => ['type' => 'text', 'label' => 'Follow-up notes'],
            ],
            'filters' => [
                'view' => ['type' => 'map', 'map' => [
                    'upcoming'  => "s.status = 'scheduled' AND s.scheduled_date >= CURDATE() AND s.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)",
                    'overdue'   => "s.status = 'scheduled' AND s.scheduled_date < CURDATE()",
                    'scheduled' => "s.status = 'scheduled'",
                    'completed' => "s.status = 'completed'",
                    'missed'    => "s.status = 'missed'",
                ]],
                'incident_id' => ['type' => 'int', 'col' => 's.incident_id'],
            ],
        ];
    }

    protected function validate_extra(array $data, $mode, $existing)
    {
        $model = $this->call->model('ResourceModel');
        $dup = $model->exists_where('vaccination_schedules',
            ['incident_id' => $data['incident_id'], 'dose_number' => $data['dose_number']],
            $existing ? (int) $existing['id'] : 0);
        return $dup ? ['A schedule for this dose already exists for this incident.'] : [];
    }

    protected function prepare(array $data, $mode, $existing)
    {
        $model    = $this->call->model('ResourceModel');
        $incident = $model->get_row('animal_bite_incidents', (int) $data['incident_id']);
        $data['patient_id'] = (int) $incident['patient_id'];
        return $data;
    }
}