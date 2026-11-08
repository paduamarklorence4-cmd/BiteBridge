<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

class TreatmentsController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'treatment_records', 'alias' => 't', 'label' => 'treatment record', 'module' => 'treatments',
            'view_perm' => 'treatments.view', 'manage_perm' => 'treatments.manage', 'created_by' => 'treated_by',
            'from' => "treatment_records t
                       INNER JOIN animal_bite_incidents i ON i.id = t.incident_id
                       INNER JOIN patients p ON p.id = t.patient_id
                       LEFT JOIN users u ON u.id = t.treated_by",
            'select' => "t.id, t.incident_id, t.patient_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name), ' - ', i.incident_date, ' - ', i.animal_type) AS incident_label,
                         i.incident_date, i.animal_type, t.treatment_date, t.treatment_details, t.notes,
                         u.full_name AS treated_by_name",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 't.treatment_details', 'i.animal_type'],
            'order'  => 't.treatment_date DESC, t.id DESC',
            'fields' => [
                'incident_id'       => ['type' => 'ref', 'table' => 'animal_bite_incidents', 'label' => 'Bite incident', 'required' => true],
                'treatment_date'    => ['type' => 'date', 'label' => 'Treatment date', 'required' => true, 'no_future' => true],
                'treatment_details' => ['type' => 'text', 'label' => 'Treatment details', 'required' => true],
                'notes'             => ['type' => 'text', 'label' => 'Notes'],
            ],
            'filters' => [
                'patient_id'  => ['type' => 'int', 'col' => 't.patient_id'],
                'incident_id' => ['type' => 'int', 'col' => 't.incident_id'],
            ],
        ];
    }

    /** The patient always comes from the incident, so the two can never disagree. */
    protected function prepare(array $data, $mode, $existing)
    {
        $model    = $this->call->model('ResourceModel');
        $incident = $model->get_row('animal_bite_incidents', (int) $data['incident_id']);
        $data['patient_id'] = (int) $incident['patient_id'];
        return $data;
    }
}