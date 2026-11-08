<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/** Walk-in and booked appointments, with reschedule and cancel. */
class AppointmentsController extends ResourceController
{
    protected function config()
    {
        $statuses = ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'];
        return [
            'table' => 'appointments', 'alias' => 'a', 'label' => 'appointment', 'module' => 'appointments',
            'view_perm' => 'appointments.view', 'manage_perm' => 'appointments.manage', 'created_by' => 'created_by',
            'from' => "appointments a INNER JOIN patients p ON p.id = a.patient_id",
            'select' => "a.id, a.patient_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name)) AS patient_label,
                         a.appointment_type, a.appointment_date, a.appointment_time, a.purpose, a.status,
                         a.cancel_reason, a.rescheduled_from_id",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'a.purpose'],
            'order'  => 'a.appointment_date DESC, a.appointment_time ASC, a.id DESC',
            'fields' => [
                'patient_id'       => ['type' => 'ref', 'table' => 'patients', 'label' => 'Patient', 'required' => true],
                'appointment_type' => ['type' => 'enum', 'label' => 'Type', 'values' => ['walk_in', 'booked'], 'default' => 'booked'],
                'appointment_date' => ['type' => 'date', 'label' => 'Date', 'required' => true],
                'appointment_time' => ['type' => 'time', 'label' => 'Time'],
                'purpose'          => ['type' => 'string', 'label' => 'Purpose', 'required' => true, 'max' => 150],
                'status'           => ['type' => 'enum', 'label' => 'Status', 'values' => $statuses, 'default' => 'scheduled'],
                'cancel_reason'    => ['type' => 'string', 'label' => 'Cancel reason', 'max' => 255],
            ],
            'filters' => [
                'status' => ['type' => 'enum', 'col' => 'a.status', 'values' => $statuses],
                'when' => ['type' => 'map', 'map' => [
                    'today'    => 'a.appointment_date = CURDATE()',
                    'upcoming' => 'a.appointment_date > CURDATE()',
                    'past'     => 'a.appointment_date < CURDATE()',
                ]],
                'patient_id' => ['type' => 'int', 'col' => 'a.patient_id'],
            ],
        ];
    }

    protected function validate_extra(array $data, $mode, $existing)
    {
        if ($data['status'] === 'cancelled' && empty($data['cancel_reason'])) {
            return ['Enter the reason for cancelling.'];
        }
        return [];
    }

    protected function prepare(array $data, $mode, $existing)
    {
        if ($data['status'] !== 'cancelled') {
            $data['cancel_reason'] = null;
        }
        return $data;
    }

    /** POST /appointments/reschedule { id, appointment_date, appointment_time? } */
    public function reschedule()
    {
        $this->api->require_method('POST');
        $auth = $this->authorize('appointments.manage');
        $in   = $this->json_input();
        $cfg  = $this->config();
        $model = $this->call->model('ResourceModel');

        $id  = (int) ($in['id'] ?? 0);
        $old = $id > 0 ? $model->get_row('appointments', $id) : null;
        if (!$old) {
            $this->api->respond_error('Appointment not found', 404);
        }
        if ($old['status'] !== 'scheduled') {
            $this->api->respond_error('Only a scheduled appointment can be rescheduled.', 422);
        }

        $date = trim((string) ($in['appointment_date'] ?? ''));
        $d = $this->valid_date($date);
        if (!$d || $d < new DateTime('today')) {
            $this->api->respond_error('Choose a valid new date that is not in the past.', 422);
        }
        $time = trim((string) ($in['appointment_time'] ?? ''));
        if ($time !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $time)) {
            $this->api->respond_error('The new time is not valid.', 422);
        }
        if ($time !== '' && strlen($time) === 5) {
            $time .= ':00';
        }

        $model->begin();
        try {
            $model->update($cfg, $id, ['status' => 'rescheduled']);
            $new_id = $model->insert($cfg, [
                'patient_id' => (int) $old['patient_id'], 'appointment_type' => 'booked',
                'appointment_date' => $date, 'appointment_time' => $time === '' ? null : $time,
                'purpose' => $old['purpose'], 'status' => 'scheduled',
                'rescheduled_from_id' => $id, 'created_by' => (int) $auth['profile']['id'],
            ]);
            $model->commit();
        } catch (Throwable $e) {
            $model->rollback();
            $this->api->respond_error('The appointment could not be rescheduled. Please try again.', 500);
        }

        $auth['users']->log_activity((int) $auth['profile']['id'], 'appointment_rescheduled', 'appointments',
            'Rescheduled appointment #' . $id . ' to #' . $new_id, $new_id);
        $this->api->respond(['message' => 'Appointment rescheduled', 'item' => $model->find($cfg, $new_id)]);
    }

    /** POST /appointments/cancel { id, reason } */
    public function cancel()
    {
        $this->api->require_method('POST');
        $auth = $this->authorize('appointments.manage');
        $in   = $this->json_input();
        $cfg  = $this->config();
        $model = $this->call->model('ResourceModel');

        $id  = (int) ($in['id'] ?? 0);
        $row = $id > 0 ? $model->get_row('appointments', $id) : null;
        if (!$row) {
            $this->api->respond_error('Appointment not found', 404);
        }
        if ($row['status'] !== 'scheduled') {
            $this->api->respond_error('Only a scheduled appointment can be cancelled.', 422);
        }
        $reason = trim((string) ($in['reason'] ?? ''));
        if ($reason === '' || mb_strlen($reason) > 255) {
            $this->api->respond_error('Enter the reason for cancelling (up to 255 characters).', 422);
        }

        $model->update($cfg, $id, ['status' => 'cancelled', 'cancel_reason' => $reason]);
        $auth['users']->log_activity((int) $auth['profile']['id'], 'appointment_cancelled', 'appointments',
            'Cancelled appointment #' . $id, $id);
        $this->api->respond(['message' => 'Appointment cancelled', 'item' => $model->find($cfg, $id)]);
    }
}