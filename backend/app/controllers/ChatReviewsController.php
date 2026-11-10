<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Staff review of chatbot assessments (needs chatbot.review). The suggested category is shown to staff only.
 * Only search, detail, transcript and review are routed (no create or edit: chats are written by the chatbot).
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

        // Photos are kept in the database (chat_photos). Older photos may still be files on the server disk.
        $stored = $model->query_one("SELECT mime_type, image_base64 FROM chat_photos WHERE assessment_id = ? LIMIT 1", [$id]);
        if ($stored) {
            $auth['users']->log_activity((int) $auth['profile']['id'], 'chat_photo_viewed', 'chatbot',
                'Viewed wound photo of chatbot assessment #' . $id, $id);
         $this->api->respond(['data' => ['content_type' => $stored['mime_type'], 'data' => $stored['image_base64']]]);

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

        $model->update($cfg, $id, [
            'review_status' => $status,
            'staff_notes'   => $notes === '' ? null : $notes,
            'reviewed_by'   => $status === 'pending' ? null : (int) $auth['profile']['id'],
            'reviewed_at'   => $status === 'pending' ? null : (new DateTime())->format('Y-m-d H:i:s'),
        ]);
        $auth['users']->log_activity((int) $auth['profile']['id'], 'chat_review_' . $status, 'chatbot',
            'Marked chatbot assessment #' . $id . ' as ' . $status, $id);
        $this->api->respond(['message' => 'Review saved', 'item' => $model->find($cfg, $id)]);
    }
}