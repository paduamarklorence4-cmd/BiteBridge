<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/** Administered vaccine doses. Saving a dose also marks the matching schedule as completed. */
class VaccinationRecordsController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'vaccination_records', 'alias' => 'v', 'label' => 'vaccination record', 'module' => 'vaccinations',
            'view_perm' => 'vaccinations.view', 'manage_perm' => 'vaccinations.manage', 'created_by' => 'administered_by',
            'from' => "vaccination_records v
                       INNER JOIN patients p ON p.id = v.patient_id
                       INNER JOIN animal_bite_incidents i ON i.id = v.incident_id
                       LEFT JOIN users u ON u.id = v.administered_by",
            'select' => "v.id, v.patient_id, v.incident_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name), ' - ', i.incident_date, ' - ', i.animal_type) AS incident_label,
                         v.vaccine_name, v.dose_number, v.administered_date, v.next_scheduled_date, v.notes,
                         u.full_name AS administered_by_name",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'v.vaccine_name'],
            'order'  => 'v.administered_date DESC, v.id DESC',
            'fields' => [
                'incident_id'         => ['type' => 'ref', 'table' => 'animal_bite_incidents', 'label' => 'Bite incident', 'required' => true],
                'vaccine_name'        => ['type' => 'string', 'label' => 'Vaccine', 'required' => true, 'max' => 100],
                'dose_number'         => ['type' => 'int', 'label' => 'Dose number', 'required' => true, 'min' => 0, 'max' => 10],
                'administered_date'   => ['type' => 'date', 'label' => 'Date given', 'required' => true, 'no_future' => true],
                'next_scheduled_date' => ['type' => 'date', 'label' => 'Next dose date'],
                'notes'               => ['type' => 'text', 'label' => 'Notes'],
            ],
            'filters' => [
                'incident_id' => ['type' => 'int', 'col' => 'v.incident_id'],
            ],
        ];
    }

    protected function validate_extra(array $data, $mode, $existing)
    {
        $err   = [];
        $model = $this->call->model('ResourceModel');
        $dup = $model->exists_where('vaccination_records',
            ['incident_id' => $data['incident_id'], 'dose_number' => $data['dose_number'], 'vaccine_name' => $data['vaccine_name']],
            $existing ? (int) $existing['id'] : 0);
        if ($dup) {
            $err[] = 'This dose of this vaccine is already recorded for the incident.';
        }
        if (!empty($data['next_scheduled_date']) && !empty($data['administered_date'])
            && $data['next_scheduled_date'] < $data['administered_date']) {
            $err[] = 'The next dose date cannot be before the date given.';
        }
        return $err;
    }

    protected function prepare(array $data, $mode, $existing)
    {
        $model    = $this->call->model('ResourceModel');
        $incident = $model->get_row('animal_bite_incidents', (int) $data['incident_id']);
        $data['patient_id'] = (int) $incident['patient_id'];
        return $data;
    }

    /** Link the dose to its schedule, and create the next dose's schedule if it does not exist yet. */
    protected function after_save($mode, $id, array $data, array $auth)
    {
        if ($mode !== 'create') {
            return;
        }
        $model = $this->call->model('ResourceModel');
        $sched = $model->find_where('vaccination_schedules', ['incident_id' => $data['incident_id'], 'dose_number' => $data['dose_number']]);
        if ($sched && $sched['status'] === 'scheduled') {
            $model->update(['table' => 'vaccination_schedules'], (int) $sched['id'],
                ['status' => 'completed', 'vaccination_record_id' => $id]);
        }
        if (!empty($data['next_scheduled_date'])) {
            $next = (int) $data['dose_number'] + 1;
            if ($next <= 10 && !$model->exists_where('vaccination_schedules', ['incident_id' => $data['incident_id'], 'dose_number' => $next])) {
                $model->insert(['table' => 'vaccination_schedules'], [
                    'patient_id' => $data['patient_id'], 'incident_id' => $data['incident_id'], 'dose_number' => $next,
                    'scheduled_date' => $data['next_scheduled_date'], 'status' => 'scheduled',
                ]);
            }
        }
    }
}