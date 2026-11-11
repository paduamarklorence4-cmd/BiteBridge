<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Wound and exposure assessments.
 * Staff with assessments.manage record the assessment and a PRELIMINARY category.
 * Only users with assessments.confirm can set the FINAL category (confirm()).
 */
class AssessmentsController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'wound_assessments', 'alias' => 'w', 'label' => 'assessment', 'module' => 'assessments',
            'view_perm' => 'assessments.view', 'manage_perm' => 'assessments.manage', 'created_by' => 'assessed_by',
            'from' => "wound_assessments w
                       INNER JOIN animal_bite_incidents i ON i.id = w.incident_id
                       INNER JOIN patients p ON p.id = i.patient_id
                       LEFT JOIN users cu ON cu.id = w.confirmed_by",
            'select' => "w.id, w.incident_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name), ' - ', i.incident_date, ' - ', i.animal_type) AS incident_label,
                         i.incident_date, i.animal_type, w.wound_description, w.exposure_details,
                         w.suggested_category, w.final_category, w.confirmed_at, cu.full_name AS confirmed_by_name",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'i.animal_type', 'w.wound_description'],
            'order'  => 'w.id DESC',
            'fields' => [
                'incident_id'        => ['type' => 'ref', 'table' => 'animal_bite_incidents', 'label' => 'Bite incident', 'required' => true],
                'wound_description'  => ['type' => 'text', 'label' => 'Wound description'],
                'exposure_details'   => ['type' => 'text', 'label' => 'Exposure details'],
                'suggested_category' => ['type' => 'enum', 'label' => 'Preliminary category', 'values' => ['I', 'II', 'III']],
            ],
            'filters' => [
                'confirmed' => ['type' => 'map', 'map' => [
                    'pending'   => 'w.final_category IS NULL',
                    'confirmed' => 'w.final_category IS NOT NULL',
                ]],
                'incident_id' => ['type' => 'int', 'col' => 'w.incident_id'],
            ],
        ];
    }

    /** POST /assessments/confirm  { id, final_category } */
    public function confirm()
    {
        $this->api->require_method('POST');
        $auth = $this->authorize('assessments.confirm');
        $in   = $this->json_input();
        $cfg  = $this->config();

        $id  = (int) ($in['id'] ?? 0);
        $cat = trim((string) ($in['final_category'] ?? ''));
        if (!in_array($cat, ['I', 'II', 'III'], true)) {
            $this->api->respond_error('Choose Category I, II, or III.', 422);
        }

        $model = $this->call->model('ResourceModel');
        if ($id <= 0 || !$model->row_exists('wound_assessments', $id)) {
            $this->api->respond_error('Assessment not found', 404);
        }

        $model->update($cfg, $id, [
            'final_category' => $cat,
            'confirmed_by'   => (int) $auth['profile']['id'],
            'confirmed_at'   => (new DateTime())->format('Y-m-d H:i:s'),
        ]);
        $auth['users']->log_activity((int) $auth['profile']['id'], 'assessment_confirmed', 'assessments',
            'Confirmed Category ' . $cat . ' for assessment #' . $id, $id);

        $this->api->respond(['message' => 'Category confirmed', 'item' => $model->find($cfg, $id)]);
    }
}