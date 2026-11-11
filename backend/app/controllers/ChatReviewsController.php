<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Staff review of chatbot assessments (needs chatbot.review).
 * Marking an assessment Reviewed or Referred creates the patient, bite incident and wound assessment
 * automatically, in one transaction. Pending creates nothing.
 */
class ChatReviewsController extends ResourceController
{
    protected function config()
    {
        return [
            'table' => 'chat_assessments', 'alias' => 'a', 'label' => 'chatbot assessment', 'module' => 'chatbot',
            'view_perm' => 'chatbot.review', 'manage_perm' => 'chatbot.review',
            'from' => "chat_assessments a
                       INNER JOIN chat_sessions s ON s.id = a.session_id
                       LEFT JOIN users ru ON ru.id = a.reviewed_by
                       LEFT JOIN reference_codes rc ON rc.assessment_id = a.id",
            'select' => "a.id, a.session_id, s.contact_name, s.contact_number, s.language, s.created_at,
                         a.summary, a.suggested_category, a.review_status, a.reviewed_at,
                         ru.full_name AS reviewed_by_name, a.staff_notes, rc.code AS reference_code,
                         CAST(a.answers AS CHAR) AS answers,
                         CASE WHEN a.wound_photo_path IS NULL THEN 0 ELSE 1 END AS has_photo",
            'search' => ['s.contact_name', 's.contact_number', 'a.summary', 'rc.code'],
            'order'  => "(a.review_status = 'pending') DESC, a.created_at DESC, a.id DESC",
            'fields' => [],
            'filters' => [
                'review_status' => ['type' => 'enum', 'col' => 'a.review_status', 'values' => ['pending', 'reviewed', 'referred']],
            ],
        ];
    }

    /** POST /chatreviews/transcript { id } */
    public function transcript()
    {
        $this->api->require_method('POST');
        $this->authorize('chatbot.review');
        $in    = $this->json_input();
        $model = $this->call->model('ResourceModel');
        $rows  = $model->query_all(
            "SELECT m.id, m.sender, m.message, m.detected_intent, m.created_at
             FROM chat_messages m
             WHERE m.session_id = (SELECT session_id FROM chat_assessments WHERE id = ?)
             ORDER BY m.id ASC LIMIT 300",
            [(int) ($in['id'] ?? 0)]
        );
        $this->api->respond(['items' => $rows]);
    }

    /** POST /chatreviews/photo { id } -> the wound photo as base64. Staff only, and every view is logged. */
    public function photo()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('chatbot.review');
        $in    = $this->json_input();
        $model = $this->call->model('ResourceModel');

        $id  = (int) ($in['id'] ?? 0);
        $row = $id > 0 ? $model->get_row('chat_assessments', $id) : null;
        if (!$row || empty($row['wound_photo_path'])) {
            $this->api->respond_error('There is no photo for this assessment.', 404);
        }

        $stored = $model->query_one("SELECT mime_type, image_base64 FROM chat_photos WHERE assessment_id = ? LIMIT 1", [$id]);
        if ($stored) {
            $auth['users']->log_activity((int) $auth['profile']['id'], 'chat_photo_viewed', 'chatbot',
                'Viewed wound photo of chatbot assessment #' . $id, $id);
            $this->api->respond(['content_type' => $stored['mime_type'], 'data' => $stored['image_base64']]);
        }

        $base = realpath(__DIR__ . '/../../storage/wound_photos');
        $file = $base ? realpath($base . DIRECTORY_SEPARATOR . basename($row['wound_photo_path'])) : false;
        if (!$file || strpos($file, $base) !== 0 || !is_file($file)) {
            $this->api->respond_error('The photo is no longer available. It was uploaded before photos were saved in the database, and the hosting disk was reset.', 404);
        }
        $types = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
        $type  = $types[strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? null;
        if (!$type) {
            $this->api->respond_error('The photo type is not supported.', 422);
        }

        $auth['users']->log_activity((int) $auth['profile']['id'], 'chat_photo_viewed', 'chatbot',
            'Viewed wound photo of chatbot assessment #' . $id, $id);
        $this->api->respond(['content_type' => $type, 'data' => base64_encode(file_get_contents($file))]);
    }

    /** POST /chatreviews/review { id, review_status: reviewed|referred|pending, staff_notes } */
    public function review()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('chatbot.review');
        $in    = $this->json_input();
        $cfg   = $this->config();
        $model = $this->call->model('ResourceModel');

        $id = (int) ($in['id'] ?? 0);
        if ($id <= 0 || !$model->row_exists('chat_assessments', $id)) {
            $this->api->respond_error('Assessment not found', 404);
        }
        $status = (string) ($in['review_status'] ?? '');
        if (!in_array($status, ['pending', 'reviewed', 'referred'], true)) {
            $this->api->respond_error('Choose pending, reviewed, or referred.', 422);
        }
        $notes = trim((string) ($in['staff_notes'] ?? ''));
        if (mb_strlen($notes) > 2000) {
            $this->api->respond_error('Notes are too long (up to 2000 characters).', 422);
        }

        $reviewer_id = (int) $auth['profile']['id'];
        $created     = null;

        $model->begin();
        try {
            $model->update($cfg, $id, [
                'review_status' => $status,
                'staff_notes'   => $notes === '' ? null : $notes,
                'reviewed_by'   => $status === 'pending' ? null : $reviewer_id,
                'reviewed_at'   => $status === 'pending' ? null : (new DateTime())->format('Y-m-d H:i:s'),
            ]);
            if ($status !== 'pending') {
                $created = $this->create_records($model, $id, $reviewer_id);
            }
            $model->commit();
        } catch (Throwable $e) {
            $model->rollback();
            error_log('chat review create: ' . $e->getMessage());
            $this->api->respond_error('The review was not saved: ' . $e->getMessage(), 500);
        }

        $auth['users']->log_activity($reviewer_id, 'chat_review_' . $status, 'chatbot',
            'Marked chatbot assessment #' . $id . ' as ' . $status, $id);

        $this->api->respond([
            'message' => 'Review saved',
            'item'    => $model->find($cfg, $id),
            'created' => $created,
        ]);
    }

        /**
     * Creates the patient, bite incident and wound assessment for one chatbot assessment.
     * Uses no insert IDs: each row is found again by a value we control, so it works inside a transaction.
     * Safe to run again: if the wound assessment already exists, nothing new is created.
     */
    private function create_records($model, $assessment_id, $reviewer_id)
    {
        $existing = $model->query_one(
            "SELECT id, incident_id FROM wound_assessments WHERE chat_assessment_id = ? LIMIT 1",
            [$assessment_id]
        );
        if ($existing) {
            return ['already_created' => true, 'incident_id' => (int) $existing['incident_id']];
        }

        $a = $model->query_one(
            "SELECT a.id, a.summary, a.suggested_category, CAST(a.answers AS CHAR) AS answers,
                    s.contact_name, s.contact_number, s.created_at
             FROM chat_assessments a
             INNER JOIN chat_sessions s ON s.id = a.session_id
             WHERE a.id = ? LIMIT 1",
            [$assessment_id]
        );
        if (!$a) {
            throw new RuntimeException('Assessment not found.');
        }

        $ans = json_decode((string) $a['answers'], true);
        $ans = is_array($ans) ? $ans : [];

        // 1. Patient: reuse an existing patient with the same contact number, otherwise create one.
        $phone      = $this->clean_phone($a['contact_number']);
        $patient_id = 0;
        if ($phone !== null) {
            $p = $model->query_one(
                "SELECT id FROM patients WHERE contact_number = ? ORDER BY id DESC LIMIT 1",
                [$phone]
            );
            $patient_id = $p ? (int) $p['id'] : 0;
        }
        if ($patient_id === 0) {
            [$first, $last] = $this->split_name($a['contact_name']);
            $temp_code = 'TMP-' . bin2hex(random_bytes(8));

            $model->insert_rows(['table' => 'patients'],
                ['patient_code', 'first_name', 'last_name', 'contact_number', 'registration_date', 'notes', 'created_by'],
                [[
                    'patient_code'      => $temp_code,
                    'first_name'        => $first,
                    'last_name'         => $last,
                    'contact_number'    => $phone,
                    'registration_date' => date('Y-m-d'),
                    'notes'             => 'Created automatically from chatbot assessment #' . $assessment_id . '. Please verify the details.',
                    'created_by'        => $reviewer_id,
                ]]
            );

            $new = $model->find_where('patients', ['patient_code' => $temp_code]);
            if (!$new) {
                throw new RuntimeException('The new patient could not be found after saving.');
            }
            $patient_id = (int) $new['id'];

            $model->execute(
                "UPDATE patients SET patient_code = CONCAT('EZ-', LPAD(id, 5, '0')) WHERE id = ?",
                [$patient_id]
            );
        }

        // 2. Bite incident, linked to the patient.
        $model->insert_rows(['table' => 'animal_bite_incidents'],
            ['patient_id', 'incident_date', 'animal_type', 'injury_type', 'body_part', 'wound_details', 'staff_notes', 'recorded_by'],
            [[
                'patient_id'    => $patient_id,
                'incident_date' => $this->incident_date($ans['when'] ?? '', $a['created_at']),
                'animal_type'   => $this->animal_label($ans['animal'] ?? 'other'),
                'injury_type'   => $this->injury_type($ans['exposure'] ?? ''),
                'body_part'     => $this->body_label($ans['body_part'] ?? 'other'),
                'wound_details' => $a['summary'] ?: null,
                'staff_notes'   => 'Created from chatbot assessment #' . $assessment_id
                                 . '. Not yet verified by staff. Owner or vaccination: ' . ($ans['animal_status'] ?? 'unknown')
                                 . '. Bleeding: ' . ($ans['bleeding'] ?? 'unknown')
                                 . '. Washed: ' . ($ans['washed'] ?? 'unknown') . '.',
                'recorded_by'   => $reviewer_id,
            ]]
        );

        // The newest incident for this patient is the one we just created (same transaction).
        $inc = $model->query_one(
            "SELECT id FROM animal_bite_incidents WHERE patient_id = ? ORDER BY id DESC LIMIT 1",
            [$patient_id]
        );
        if (!$inc) {
            throw new RuntimeException('The new bite incident could not be found after saving.');
        }
        $incident_id = (int) $inc['id'];

        // 3. Wound assessment: suggested category only. Final category stays blank until staff confirm it.
        $model->insert_rows(['table' => 'wound_assessments'],
            ['incident_id', 'chat_assessment_id', 'wound_description', 'exposure_details', 'suggested_category', 'assessed_by'],
            [[
                'incident_id'        => $incident_id,
                'chat_assessment_id' => $assessment_id,
                'wound_description'  => $a['summary'] ?: null,
                'exposure_details'   => $this->exposure_label($ans['exposure'] ?? ''),
                'suggested_category' => in_array($a['suggested_category'], ['I', 'II', 'III'], true) ? $a['suggested_category'] : null,
                'assessed_by'        => $reviewer_id,
            ]]
        );

        return ['already_created' => false, 'patient_id' => $patient_id, 'incident_id' => $incident_id];
    }
}