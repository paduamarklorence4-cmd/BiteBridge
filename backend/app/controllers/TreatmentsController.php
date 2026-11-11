<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

class TreatmentsController extends ResourceController
{
    /** The only treatment choices staff can pick. Keys are stored as sent; labels are saved as text. */
    private const DETAIL_OPTIONS = [
        'washed'       => 'Hinugasan ang sugat ng sabon at tubig',
        'dressed'      => 'Nilagyan ng dressing',
        'vaccine'      => 'Binigyan ng bakuna laban sa rabies',
        'rig'          => 'Binigyan ng rabies immunoglobulin (RIG)',
        'tetanus'      => 'Tinurukan ng tetanus',
        'referred'     => 'Ni-refer sa physician',
        'other'        => 'Iba pa (tingnan ang Notes)',
    ];

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
                'treatment_details' => ['type' => 'checkboxes', 'label' => 'Ginawa', 'required' => true, 'options' => self::DETAIL_OPTIONS],
                'notes'             => ['type' => 'text', 'label' => 'Notes'],
            ],
            'filters' => [
                'patient_id'  => ['type' => 'int', 'col' => 't.patient_id'],
                'incident_id' => ['type' => 'int', 'col' => 't.incident_id'],
            ],
        ];
    }

    /**
     * Runs before save. The patient always comes from the incident, and the checked options are turned
     * into readable text. Only known option keys are accepted, so nothing else can be stored.
     */
    protected function prepare(array $data, $mode, $existing)
    {
        $model    = $this->call->model('ResourceModel');
        $incident = $model->get_row('animal_bite_incidents', (int) ($data['incident_id'] ?? 0));
        if (!$incident) {
            $this->api->respond_error('Choose a valid bite incident.', 422);
        }
        $data['patient_id'] = (int) $incident['patient_id'];

        $picked = $data['treatment_details'] ?? [];
        if (!is_array($picked)) {
            $picked = $picked === '' ? [] : [$picked];
        }
        $picked = array_values(array_intersect($picked, array_keys(self::DETAIL_OPTIONS)));
        if (!$picked) {
            $this->api->respond_error('Choose at least one thing that was done.', 422);
        }

        $data['treatment_details'] = implode('; ', array_map(
            fn ($k) => self::DETAIL_OPTIONS[$k],
            $picked
        ));
        return $data;
    }
}