<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Patient records.
 *   patients.view   -> search, detail
 *   patients.manage -> store, modify
 * Every endpoint reads the user and permissions from the database on each request.
 * Patient records are not deleted here: incidents, treatment and billing records depend on them.
 */
class PatientsController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    private function json_input()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    private function authorize($permission)
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
        if (!in_array($permission, $codes, true)) {
            $this->api->respond_error('You do not have permission to do this.', 403);
        }
        return ['profile' => $profile, 'codes' => $codes, 'users' => $users];
    }

    private function valid_date($v)
    {
        $d = DateTime::createFromFormat('Y-m-d', $v);
        return $d && $d->format('Y-m-d') === $v ? $d : null;
    }

    /** Validate and normalize patient fields. Responds with 422 and a readable message if invalid. */
    private function clean(array $in)
    {
        $err   = [];
        $today = new DateTime('today');
        $name_re = '/^[\p{L}\p{M}][\p{L}\p{M}\s\'.\-]*$/u';

        $first  = trim((string) ($in['first_name'] ?? ''));
        $middle = trim((string) ($in['middle_name'] ?? ''));
        $last   = trim((string) ($in['last_name'] ?? ''));

        if ($first === '' || mb_strlen($first) > 60 || !preg_match($name_re, $first)) {
            $err[] = 'First name is required (letters only, up to 60 characters).';
        }
        if ($last === '' || mb_strlen($last) > 60 || !preg_match($name_re, $last)) {
            $err[] = 'Last name is required (letters only, up to 60 characters).';
        }
        if ($middle !== '' && (mb_strlen($middle) > 60 || !preg_match($name_re, $middle))) {
            $err[] = 'Middle name may contain letters only (up to 60 characters).';
        }

        $birth = trim((string) ($in['birth_date'] ?? ''));
        $age   = trim((string) ($in['age_years'] ?? ''));
        $birth_date = null;
        $age_years  = null;

        if ($birth !== '') {
            $bd = $this->valid_date($birth);
            if (!$bd || $bd > $today) {
                $err[] = 'Date of birth is not a valid past date.';
            } else {
                $calc = $bd->diff($today)->y;
                if ($calc > 120) {
                    $err[] = 'Date of birth is not realistic.';
                } else {
                    $birth_date = $birth;
                    $age_years  = $calc;
                }
            }
        } elseif ($age !== '') {
            if (!ctype_digit($age) || (int) $age > 120) {
                $err[] = 'Age must be a whole number from 0 to 120.';
            } else {
                $age_years = (int) $age;
            }
        } else {
            $err[] = 'Enter the date of birth or the age.';
        }

        $contact = trim((string) ($in['contact_number'] ?? ''));
        if ($contact !== '') {
            $contact = preg_replace('/[\s\-()]/', '', $contact);
            if (!preg_match('/^\+?\d{7,15}$/', $contact)) {
                $err[] = 'Contact number must be 7 to 15 digits (a leading + is allowed).';
            }
        }

        $address = trim((string) ($in['address'] ?? ''));
        if (mb_strlen($address) > 255) {
            $err[] = 'Address is too long (up to 255 characters).';
        }

        $notes = trim((string) ($in['notes'] ?? ''));
        if (mb_strlen($notes) > 2000) {
            $err[] = 'Notes are too long (up to 2000 characters).';
        }

        $reg = trim((string) ($in['registration_date'] ?? ''));
        if ($reg === '') {
            $reg = $today->format('Y-m-d');
        } else {
            $rd = $this->valid_date($reg);
            if (!$rd || $rd > $today) {
                $err[] = 'Registration date must be a valid date that is not in the future.';
            }
        }

        if ($err) {
            $this->api->respond_error(implode(' ', $err), 422);
        }

        return [
            'first_name'        => $first,
            'middle_name'       => $middle === '' ? null : $middle,
            'last_name'         => $last,
            'birth_date'        => $birth_date,
            'age_years'         => $age_years,
            'contact_number'    => $contact === '' ? null : $contact,
            'address'           => $address === '' ? null : $address,
            'registration_date' => $reg,
            'notes'             => $notes === '' ? null : $notes,
        ];
    }

    public function search()
    {
        $this->api->require_method('POST');
        $auth = $this->authorize('patients.view');
        $in   = $this->json_input();

        $term = trim((string) ($in['search'] ?? ''));
        if (mb_strlen($term) > 100) {
            $term = mb_substr($term, 0, 100);
        }
        $page = (int) ($in['page'] ?? 1);
        $per  = (int) ($in['per_page'] ?? 10);

        $model = $this->call->model('PatientsModel');
        $this->api->respond($model->search($term, $page, $per, in_array('incidents.view', $auth['codes'], true)));
    }

    public function detail()
    {
        $this->api->require_method('POST');
        $auth = $this->authorize('patients.view');
        $in   = $this->json_input();

        $model   = $this->call->model('PatientsModel');
        $patient = $model->find((int) ($in['id'] ?? 0));
        if (!$patient) {
            $this->api->respond_error('Patient not found', 404);
        }

        $patient['incidents'] = in_array('incidents.view', $auth['codes'], true)
            ? $model->incidents_of($patient['id'])
            : null;

        $this->api->respond(['patient' => $patient]);
    }

    public function store()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('patients.manage');
        $clean = $this->clean($this->json_input());

        $model = $this->call->model('PatientsModel');
        $id    = $model->create($clean, (int) $auth['profile']['id']);
        if ($id <= 0) {
            $this->api->respond_error('The patient could not be saved. Please try again.', 500);
        }

        $patient = $model->find($id);
        $auth['users']->log_activity((int) $auth['profile']['id'], 'patient_created', 'patients',
            'Created patient ' . $patient['patient_code'], $id);

        $this->api->respond(['message' => 'Patient registered', 'patient' => $patient], 201);
    }

    public function modify()
    {
        $this->api->require_method('POST');
        $auth = $this->authorize('patients.manage');
        $in   = $this->json_input();

        $id    = (int) ($in['id'] ?? 0);
        $model = $this->call->model('PatientsModel');
        if ($id <= 0 || !$model->find($id)) {
            $this->api->respond_error('Patient not found', 404);
        }

        $clean = $this->clean($in);
        $model->update_patient($id, $clean);

        $patient = $model->find($id);
        $auth['users']->log_activity((int) $auth['profile']['id'], 'patient_updated', 'patients',
            'Updated patient ' . $patient['patient_code'], $id);

        $this->api->respond(['message' => 'Patient updated', 'patient' => $patient]);
    }
}