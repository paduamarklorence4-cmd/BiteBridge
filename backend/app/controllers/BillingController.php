<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Billing and payment records. All payments are recorded as paid AT THE CENTER (cash, GCash, or Maya).
 * There is no online payment processing. A bill is paid in full by one payment record.
 */
class BillingController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'billing_records', 'alias' => 'b', 'label' => 'bill', 'module' => 'billing',
            'view_perm' => 'billing.view', 'manage_perm' => 'billing.manage', 'created_by' => 'created_by',
            'from' => "billing_records b
                       INNER JOIN patients p ON p.id = b.patient_id
                       LEFT JOIN animal_bite_incidents i ON i.id = b.incident_id
                       LEFT JOIN payment_records pr ON pr.billing_id = b.id",
            'select' => "b.id, b.patient_id, b.incident_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name)) AS patient_label,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name), ' - ', i.incident_date, ' - ', i.animal_type) AS incident_label,
                         b.service_description, b.service_fee, b.total_amount, b.payment_status, b.notes,
                         pr.payment_method, pr.payment_date, pr.reference_number, b.created_at",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'b.service_description', 'pr.reference_number'],
            'order'  => 'b.id DESC',
            'fields' => [
                'patient_id'          => ['type' => 'ref', 'table' => 'patients', 'label' => 'Patient', 'required' => true],
                'incident_id'         => ['type' => 'ref', 'table' => 'animal_bite_incidents', 'label' => 'Bite incident'],
                'service_description' => ['type' => 'string', 'label' => 'Service', 'required' => true, 'max' => 200],
                'service_fee'         => ['type' => 'decimal', 'label' => 'Service fee', 'required' => true, 'min' => 0],
                'total_amount'        => ['type' => 'decimal', 'label' => 'Total amount', 'min' => 0],
                'notes'               => ['type' => 'text', 'label' => 'Notes'],
            ],
            'filters' => [
                'payment_status' => ['type' => 'enum', 'col' => 'b.payment_status', 'values' => ['unpaid', 'paid', 'cancelled']],
                'payment_method' => ['type' => 'enum', 'col' => 'pr.payment_method', 'values' => ['cash', 'gcash', 'maya']],
                'patient_id'     => ['type' => 'int', 'col' => 'b.patient_id'],
            ],
        ];
    }

    protected function validate_extra(array $data, $mode, $existing)
    {
        $err = [];
        if ($existing && $existing['payment_status'] !== 'unpaid') {
            $err[] = 'Only an unpaid bill can be edited.';
        }
        if (!empty($data['incident_id']) && !empty($data['patient_id'])) {
            $inc = $this->call->model('ResourceModel')->get_row('animal_bite_incidents', (int) $data['incident_id']);
            if ($inc && (int) $inc['patient_id'] !== (int) $data['patient_id']) {
                $err[] = 'The bite incident does not belong to this patient.';
            }
        }
        return $err;
    }

    protected function prepare(array $data, $mode, $existing)
    {
        if ($data['total_amount'] === null) {
            $data['total_amount'] = $data['service_fee'];
        }
        return $data;
    }

    /** POST /billing/pay { id, payment_method, payment_date?, reference_number? } Pays the full total. */
    public function pay()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('billing.manage');
        $in    = $this->json_input();
        $cfg   = $this->config();
        $model = $this->call->model('ResourceModel');

        $id   = (int) ($in['id'] ?? 0);
        $bill = $id > 0 ? $model->get_row('billing_records', $id) : null;
        if (!$bill) {
            $this->api->respond_error('Bill not found', 404);
        }
        if ($bill['payment_status'] !== 'unpaid') {
            $this->api->respond_error('This bill is not unpaid.', 422);
        }
        if ((float) $bill['total_amount'] <= 0) {
            $this->api->respond_error('The total amount must be greater than zero before payment.', 422);
        }

        $method = (string) ($in['payment_method'] ?? '');
        if (!in_array($method, ['cash', 'gcash', 'maya'], true)) {
            $this->api->respond_error('Choose cash, GCash, or Maya.', 422);
        }
        $date = trim((string) ($in['payment_date'] ?? ''));
        if ($date === '') {
            $date = (new DateTime('today'))->format('Y-m-d');
        }
        $d = $this->valid_date($date);
        if (!$d || $d > new DateTime('today')) {
            $this->api->respond_error('Payment date must be a valid date that is not in the future.', 422);
        }
        $ref = trim((string) ($in['reference_number'] ?? ''));
        if (mb_strlen($ref) > 60) {
            $this->api->respond_error('Reference number is too long (up to 60 characters).', 422);
        }

        $model->begin();
        try {
            $model->insert(['table' => 'payment_records'], [
                'billing_id' => $id, 'amount' => $bill['total_amount'], 'payment_method' => $method,
                'payment_date' => $date, 'reference_number' => $ref === '' ? null : $ref,
                'received_by' => (int) $auth['profile']['id'],
            ]);
            $rows = $model->execute("UPDATE billing_records SET payment_status = 'paid' WHERE id = ? AND payment_status = 'unpaid'", [$id]);
            if ($rows < 1) {
                throw new RuntimeException('Bill changed');
            }
            $model->commit();
        } catch (Throwable $e) {
            $model->rollback();
            $this->api->respond_error('The payment could not be recorded. Please try again.', 500);
        }

        $auth['users']->log_activity((int) $auth['profile']['id'], 'payment_recorded', 'billing',
            'Recorded ' . $method . ' payment for bill #' . $id, $id);
        $this->api->respond(['message' => 'Payment recorded', 'item' => $model->find($cfg, $id)]);
    }

    /** POST /billing/cancel { id } Only an unpaid bill can be cancelled. */
    public function cancel()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('billing.manage');
        $in    = $this->json_input();
        $cfg   = $this->config();
        $model = $this->call->model('ResourceModel');

        $id   = (int) ($in['id'] ?? 0);
        $bill = $id > 0 ? $model->get_row('billing_records', $id) : null;
        if (!$bill) {
            $this->api->respond_error('Bill not found', 404);
        }
        if ($bill['payment_status'] !== 'unpaid') {
            $this->api->respond_error('Only an unpaid bill can be cancelled.', 422);
        }
        $model->update($cfg, $id, ['payment_status' => 'cancelled']);
        $auth['users']->log_activity((int) $auth['profile']['id'], 'bill_cancelled', 'billing', 'Cancelled bill #' . $id, $id);
        $this->api->respond(['message' => 'Bill cancelled', 'item' => $model->find($cfg, $id)]);
    }
}