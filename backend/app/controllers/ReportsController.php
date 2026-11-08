<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Database-backed reports with a date range. Needs reports.view AND the permission of the module
 * the report reads (for example billing.view for the billing report).
 * POST /reports/list  -> the reports this user may run
 * POST /reports/run   -> { report, from, to } -> { title, columns, rows, summary, truncated }
 */
class ReportsController extends Controller
{
    private const MAX_ROWS = 1000;

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    private function authorize()
    {
        $payload = $this->api->require_jwt();
        if (($payload['type'] ?? '') === 'refresh') {
            $this->api->respond_error('Unauthorized', 401);
        }
        $users   = $this->call->model('UsersModel');
        $profile = $users->auth_profile((int) ($payload['sub'] ?? 0));
        if (!$profile || $profile['status'] !== 'active') {
            $this->api->respond_error('Unauthorized', 401);
        }
        $codes = $users->auth_permission_codes((int) $profile['id']);
        if (!in_array('reports.view', $codes, true)) {
            $this->api->respond_error('You do not have permission to view reports.', 403);
        }
        return ['profile' => $profile, 'codes' => $codes, 'users' => $users];
    }

    private function definitions($near_days)
    {
        $name = "CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name)";
        return [
            'patients' => [
                'title' => 'Patients', 'perm' => 'patients.view', 'date' => 'p.registration_date',
                'sql' => "SELECT p.registration_date, p.patient_code, {$name} AS patient, p.age_years, p.contact_number, p.address
                          FROM patients p WHERE p.registration_date BETWEEN ? AND ? ORDER BY p.registration_date DESC, p.id DESC",
                'columns' => [['registration_date', 'Registered', 'date'], ['patient_code', 'Code'], ['patient', 'Patient'], ['age_years', 'Age'], ['contact_number', 'Contact'], ['address', 'Address']],
                'groups' => [],
            ],
            'incidents' => [
                'title' => 'Animal bite incidents', 'perm' => 'incidents.view', 'date' => 'i.incident_date',
                'sql' => "SELECT i.incident_date, p.patient_code, {$name} AS patient, i.animal_type, i.injury_type, i.body_part, i.incident_location
                          FROM animal_bite_incidents i INNER JOIN patients p ON p.id = i.patient_id
                          WHERE i.incident_date BETWEEN ? AND ? ORDER BY i.incident_date DESC, i.id DESC",
                'columns' => [['incident_date', 'Date', 'date'], ['patient_code', 'Code'], ['patient', 'Patient'], ['animal_type', 'Animal'], ['injury_type', 'Injury'], ['body_part', 'Body part'], ['incident_location', 'Location']],
                'groups' => ['animal_type' => 'By animal', 'injury_type' => 'By injury'],
            ],
            'assessments' => [
                'title' => 'Exposure assessments', 'perm' => 'assessments.view', 'date' => 'i.incident_date',
                'sql' => "SELECT i.incident_date, p.patient_code, {$name} AS patient, i.animal_type,
                                 COALESCE(w.suggested_category, 'None') AS preliminary,
                                 COALESCE(w.final_category, 'Pending') AS final_category, cu.full_name AS confirmed_by
                          FROM wound_assessments w
                          INNER JOIN animal_bite_incidents i ON i.id = w.incident_id
                          INNER JOIN patients p ON p.id = i.patient_id
                          LEFT JOIN users cu ON cu.id = w.confirmed_by
                          WHERE i.incident_date BETWEEN ? AND ? ORDER BY i.incident_date DESC, w.id DESC",
                'columns' => [['incident_date', 'Incident', 'date'], ['patient_code', 'Code'], ['patient', 'Patient'], ['animal_type', 'Animal'], ['preliminary', 'Preliminary'], ['final_category', 'Final'], ['confirmed_by', 'Confirmed by']],
                'groups' => ['final_category' => 'By final category'],
            ],
            'treatments' => [
                'title' => 'Treatment records', 'perm' => 'treatments.view', 'date' => 't.treatment_date',
                'sql' => "SELECT t.treatment_date, p.patient_code, {$name} AS patient, i.animal_type, t.treatment_details, u.full_name AS treated_by
                          FROM treatment_records t
                          INNER JOIN patients p ON p.id = t.patient_id
                          INNER JOIN animal_bite_incidents i ON i.id = t.incident_id
                          LEFT JOIN users u ON u.id = t.treated_by
                          WHERE t.treatment_date BETWEEN ? AND ? ORDER BY t.treatment_date DESC, t.id DESC",
                'columns' => [['treatment_date', 'Date', 'date'], ['patient_code', 'Code'], ['patient', 'Patient'], ['animal_type', 'Animal'], ['treatment_details', 'Details'], ['treated_by', 'Treated by']],
                'groups' => [],
            ],
            'vaccinations' => [
                'title' => 'Vaccination records', 'perm' => 'vaccinations.view', 'date' => 'v.administered_date',
                'sql' => "SELECT v.administered_date, p.patient_code, {$name} AS patient, v.vaccine_name, v.dose_number, v.next_scheduled_date, u.full_name AS administered_by
                          FROM vaccination_records v
                          INNER JOIN patients p ON p.id = v.patient_id
                          LEFT JOIN users u ON u.id = v.administered_by
                          WHERE v.administered_date BETWEEN ? AND ? ORDER BY v.administered_date DESC, v.id DESC",
                'columns' => [['administered_date', 'Date given', 'date'], ['patient_code', 'Code'], ['patient', 'Patient'], ['vaccine_name', 'Vaccine'], ['dose_number', 'Dose'], ['next_scheduled_date', 'Next dose', 'date'], ['administered_by', 'Given by']],
                'groups' => ['dose_number' => 'By dose'],
            ],
            'followups' => [
                'title' => 'Follow-up status', 'perm' => 'vaccinations.view', 'date' => 's.scheduled_date',
                'sql' => "SELECT s.scheduled_date, p.patient_code, {$name} AS patient, p.contact_number, s.dose_number,
                                 CASE WHEN s.status = 'scheduled' AND s.scheduled_date < CURDATE() THEN 'overdue' ELSE s.status END AS follow_up_status
                          FROM vaccination_schedules s INNER JOIN patients p ON p.id = s.patient_id
                          WHERE s.scheduled_date BETWEEN ? AND ? ORDER BY s.scheduled_date ASC, s.id ASC",
                'columns' => [['scheduled_date', 'Scheduled', 'date'], ['patient_code', 'Code'], ['patient', 'Patient'], ['contact_number', 'Contact'], ['dose_number', 'Dose'], ['follow_up_status', 'Status']],
                'groups' => ['follow_up_status' => 'By status'],
            ],
            'appointments' => [
                'title' => 'Appointments', 'perm' => 'appointments.view', 'date' => 'a.appointment_date',
                'sql' => "SELECT a.appointment_date, a.appointment_time, p.patient_code, {$name} AS patient, a.appointment_type, a.purpose, a.status
                          FROM appointments a INNER JOIN patients p ON p.id = a.patient_id
                          WHERE a.appointment_date BETWEEN ? AND ? ORDER BY a.appointment_date DESC, a.appointment_time ASC",
                'columns' => [['appointment_date', 'Date', 'date'], ['appointment_time', 'Time'], ['patient_code', 'Code'], ['patient', 'Patient'], ['appointment_type', 'Type'], ['purpose', 'Purpose'], ['status', 'Status']],
                'groups' => ['status' => 'By status', 'appointment_type' => 'By type'],
            ],
            'inventory' => [
                'title' => 'Inventory (current stock)', 'perm' => 'inventory.view', 'date' => null,
                'sql' => "SELECT i.item_name, i.category, i.quantity, i.unit, i.low_stock_threshold, i.expiration_date,
                                 CASE WHEN i.expiration_date IS NOT NULL AND i.expiration_date < CURDATE() THEN 'Expired'
                                      WHEN i.quantity <= i.low_stock_threshold THEN 'Low stock'
                                      WHEN i.expiration_date IS NOT NULL AND i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL {$near_days} DAY) THEN 'Near expiry'
                                      ELSE 'OK' END AS item_condition
                          FROM inventory_items i ORDER BY i.item_name ASC",
                'columns' => [['item_name', 'Item'], ['category', 'Category'], ['quantity', 'Quantity'], ['unit', 'Unit'], ['low_stock_threshold', 'Low-stock level'], ['expiration_date', 'Expires', 'date'], ['item_condition', 'Condition']],
                'groups' => ['item_condition' => 'By condition'],
            ],
            'billing' => [
                'title' => 'Billing and collections', 'perm' => 'billing.view', 'date' => 'DATE(b.created_at)',
                'sql' => "SELECT DATE(b.created_at) AS billed_date, p.patient_code, {$name} AS patient, b.service_description,
                                 b.total_amount, b.payment_status, pr.payment_method, pr.payment_date
                          FROM billing_records b
                          INNER JOIN patients p ON p.id = b.patient_id
                          LEFT JOIN payment_records pr ON pr.billing_id = b.id
                          WHERE DATE(b.created_at) BETWEEN ? AND ? ORDER BY b.created_at DESC, b.id DESC",
                'columns' => [['billed_date', 'Billed', 'date'], ['patient_code', 'Code'], ['patient', 'Patient'], ['service_description', 'Service'], ['total_amount', 'Total', 'money'], ['payment_status', 'Status'], ['payment_method', 'Method'], ['payment_date', 'Paid on', 'date']],
                'groups' => ['payment_status' => 'By status', 'payment_method' => 'By payment method'],
            ],
        ];
    }

    public function catalog()
    {
        $this->api->require_method('POST');
        $auth = $this->authorize();
        $model = $this->call->model('ResourceModel');
        $defs = $this->definitions($model->setting_int('near_expiry_days', 30, 1, 365));
        $out = [];
        foreach ($defs as $key => $d) {
            if (in_array($d['perm'], $auth['codes'], true)) {
                $out[] = ['key' => $key, 'title' => $d['title'], 'uses_dates' => $d['date'] !== null];
            }
        }
        $this->api->respond(['items' => $out]);
    }

    public function run()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize();
        $in    = json_decode(file_get_contents('php://input'), true);
        $in    = is_array($in) ? $in : [];
        $model = $this->call->model('ResourceModel');
        $defs  = $this->definitions($model->setting_int('near_expiry_days', 30, 1, 365));

        $key = (string) ($in['report'] ?? '');
        if (!isset($defs[$key])) {
            $this->api->respond_error('Unknown report', 422);
        }
        $def = $defs[$key];
        if (!in_array($def['perm'], $auth['codes'], true)) {
            $this->api->respond_error('You do not have permission to view this report.', 403);
        }

        $params = [];
        $from = $to = null;
        if ($def['date'] !== null) {
            $from = trim((string) ($in['from'] ?? ''));
            $to   = trim((string) ($in['to'] ?? ''));
            $df = DateTime::createFromFormat('Y-m-d', $from);
            $dt = DateTime::createFromFormat('Y-m-d', $to);
            if (!$df || $df->format('Y-m-d') !== $from || !$dt || $dt->format('Y-m-d') !== $to) {
                $this->api->respond_error('Choose a valid start and end date.', 422);
            }
            if ($df > $dt) {
                $this->api->respond_error('The start date cannot be after the end date.', 422);
            }
            if ($df->diff($dt)->days > 1830) {
                $this->api->respond_error('The date range is too long (up to 5 years).', 422);
            }
            $params = [$from, $to];
        }

        $rows = $model->query_all($def['sql'] . ' LIMIT ' . (self::MAX_ROWS + 1), $params);
        $truncated = count($rows) > self::MAX_ROWS;
        if ($truncated) {
            $rows = array_slice($rows, 0, self::MAX_ROWS);
        }

        $summary = [['label' => 'Total rows', 'value' => count($rows) . ($truncated ? '+' : '')]];
        foreach ($def['groups'] as $col => $title) {
            $counts = [];
            foreach ($rows as $r) {
                $k = ($r[$col] === null || $r[$col] === '') ? 'None' : (string) $r[$col];
                $counts[$k] = ($counts[$k] ?? 0) + 1;
            }
            arsort($counts);
            foreach ($counts as $k => $c) {
                $summary[] = ['label' => $title . ': ' . $k, 'value' => (string) $c];
            }
        }
        if ($key === 'billing') {
            $billed = $collected = $unpaid = 0.0;
            foreach ($rows as $r) {
                $amt = (float) $r['total_amount'];
                if ($r['payment_status'] === 'paid') { $billed += $amt; $collected += $amt; }
                elseif ($r['payment_status'] === 'unpaid') { $billed += $amt; $unpaid += $amt; }
            }
            $summary[] = ['label' => 'Total billed (not cancelled)', 'value' => number_format($billed, 2)];
            $summary[] = ['label' => 'Collected', 'value' => number_format($collected, 2)];
            $summary[] = ['label' => 'Unpaid', 'value' => number_format($unpaid, 2)];
        }

        $columns = [];
        foreach ($def['columns'] as $c) {
            $columns[] = ['key' => $c[0], 'label' => $c[1], 'type' => $c[2] ?? 'text'];
        }

        $auth['users']->log_activity((int) $auth['profile']['id'], 'report_run', 'reports', 'Ran report: ' . $def['title']);
        $this->api->respond([
            'title' => $def['title'], 'from' => $from, 'to' => $to,
            'columns' => $columns, 'rows' => $rows, 'summary' => $summary, 'truncated' => $truncated,
        ]);
    }
}