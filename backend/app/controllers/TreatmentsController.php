<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

class TreatmentsController extends ResourceController
{
    /** The only treatment choices allowed. The labels are saved as text, so they must match Treatments.jsx. */
    private const DETAIL_OPTIONS = [
        'washed'   => 'Washed the wound with soap and water',
        'dressed'  => 'Applied a dressing',
        'vaccine'  => 'Given rabies vaccine',
        'rig'      => 'Given rabies immunoglobulin (RIG)',
        'tetanus'  => 'Given tetanus shot',
        'referred' => 'Referred to physician',
        'other'    => 'Other (see Notes)',
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
                'treatment_details' => ['type' => 'text', 'label' => 'Treatment done', 'required' => true],
                'notes'             => ['type' => 'text', 'label' => 'Notes'],
            ],
            'filters' => [
                'patient_id'  => ['type' => 'int', 'col' => 't.patient_id'],
                'incident_id' => ['type' => 'int', 'col' => 't.incident_id'],
            ],
        ];
    }

    /**
     * POST /treatments/create. Written here instead of using the generic one, so the real
     * database error is shown on screen when a save fails.
     */
    public function create()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('treatments.manage');
        $in    = $this->json_input();
        $cfg   = $this->config();
        $model = $this->call->model('ResourceModel');

        // Validation first. These responses end the request with a readable message.
        $data = $this->prepare($in, 'create', null);

        $treatment_date = (string) ($in['treatment_date'] ?? '');
        $d = DateTime::createFromFormat('Y-m-d', $treatment_date);
        if (!$d || $d->format('Y-m-d') !== $treatment_date) {
            $this->api->respond_error('Treatment date must be a valid date (YYYY-MM-DD).', 422);
        }
        if ($d > new DateTime('today')) {
            $this->api->respond_error('Treatment date cannot be in the future.', 422);
        }

        try {
            $id = $model->insert($cfg, [
                'incident_id'       => (int) $in['incident_id'],
                'patient_id'        => (int) $data['patient_id'],
                'treatment_date'    => $treatment_date,
                'treatment_details' => $data['treatment_details'],
                'notes'             => trim((string) ($in['notes'] ?? '')) === '' ? null : trim((string) $in['notes']),
                'treated_by'        => (int) $auth['profile']['id'],
            ]);
        } catch (Throwable $e) {
            error_log('treatments create: ' . $e->getMessage());
            $this->api->respond_error('Treatment save failed: ' . $e->getMessage(), 500);
        }

        $this->api->respond([
            'message' => 'Treatment record saved',
            'item'    => $model->find($cfg, $id),
        ], 201);
    }

    /**
     * Runs before save. The patient always comes from the incident. The treatment text is checked
     * against the allowed labels, so only known choices can be stored.
     */
    protected function prepare(array $data, $mode, $existing)
    {
        $model    = $this->call->model('ResourceModel');
        $incident = $model->get_row('animal_bite_incidents', (int) ($data['incident_id'] ?? 0));
        if (!$incident) {
            $this->api->respond_error('Choose a valid bite incident.', 422);
        }
        $data['patient_id'] = (int) $incident['patient_id'];

        $parts   = array_filter(array_map('trim', explode(';', (string) ($data['treatment_details'] ?? ''))));
        $allowed = array_values(self::DETAIL_OPTIONS);
        $valid   = array_values(array_intersect($parts, $allowed));
        if (!$valid) {
            $this->api->respond_error('Choose at least one treatment done.', 422);
        }

        $data['treatment_details'] = implode('; ', $valid);
        return $data;
    }
}