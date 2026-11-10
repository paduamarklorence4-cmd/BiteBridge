<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Public chatbot (no login). Saves the chat, the structured bite questions, an optional wound photo,
 * and gives the patient a reference code to view a safe summary later.
 *
 *   POST /chat/start       { consent: true, language?, recaptcha_token } -> { session_token }
 *   POST /chat/message     { session_token, message }              -> reply from the AI service (saved)
 *   POST /chat/assessment  multipart: session_token, answers (JSON), contact_name?, contact_number?, photo?
 *   POST /chat/retrieve    { code }                                -> { summary, saved_at }
 *
 * The preliminary exposure category is saved for staff only. It is never returned to the patient.
 * All first aid wording below must be approved by the center's nurse or physician before real use.
 */
class ChatController extends Controller
{
    private const SESSION_HOURS = 24;

    /** Short, safe reason for the last AI failure (shown in the 503 message to help fix deployment). */
    private $ai_error = '';
    private const MAX_PHOTO_BYTES = 5242880; // 5 MB

    /** Allowed answers for each structured question. */
    private const QUESTIONS = [
        'animal'        => ['dog', 'cat', 'other'],
        'animal_status' => ['owned_vaccinated', 'owned_unknown', 'stray', 'unknown'],
        'exposure'      => ['bite_broke_skin', 'scratch_bleeding', 'scratch_no_bleeding', 'nibble_no_break',
                            'lick_broken_skin', 'lick_mucous', 'lick_intact', 'touch_feed'],
        'body_part'     => ['head_face_neck', 'hand_fingers', 'arm', 'leg_foot', 'trunk', 'other'],
        'when'          => ['today', '1_3_days', 'more_3_days'],
        'bleeding'      => ['none', 'light', 'heavy'],
        'washed'        => ['yes', 'no'],
    ];

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
        // Load the same model every other controller loads first, so the database connection is ready.
        $this->call->model('UsersModel');
    }

    // ------------------------------------------------------------------ helpers

    private function ip()
    {
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    private function json_input()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    private function rm()
    {
        return $this->call->model('ResourceModel');
    }

    private function find_session($token)
    {
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }
        $hours = self::SESSION_HOURS;
        return $this->rm()->query_one(
            "SELECT * FROM chat_sessions
             WHERE session_token = ? AND consent_given = 1 AND created_at > DATE_SUB(NOW(), INTERVAL {$hours} HOUR)
             LIMIT 1",
            [$token]
        );
    }

    private function require_session($token)
    {
        $s = $this->find_session($token);
        if (!$s) {
            $this->api->respond_error('Your chat session has expired. Please start again.', 410);
        }
        return $s;
    }

    private function setting($key, $default)
    {
        $row = $this->rm()->query_one("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [$key]);
        return ($row && $row['setting_value'] !== null && $row['setting_value'] !== '') ? $row['setting_value'] : $default;
    }


    /**
     * Runs an endpoint and turns any exception into a JSON error (never an HTML error page).
     * In development (APP_ENV=development) the message is included to help debugging.
     */
    private function guard($method)
    {
        try {
            $this->$method();
        } catch (Throwable $e) {
            error_log('ChatController ' . $method . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            $dev = (getenv('APP_ENV') === 'development');
            $this->api->respond_error(
                $dev ? 'Server error: ' . $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')'
                     : 'Something went wrong. Please try again.',
                500
            );
        }
    }

    // ------------------------------------------------------------------ reCAPTCHA

    /** Checks the Google reCAPTCHA token with the secret key kept in RECAPTCHA_SECRET (never in the frontend). */
    private function verify_recaptcha($token)
    {
        $secret = getenv('RECAPTCHA_SECRET');
        if (!$secret || !is_string($token) || $token === '') {
            return false;
        }
        $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'secret'   => $secret,
                'response' => $token,
                'remoteip' => $this->ip(),
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => 10,
        ]);
        $body = curl_exec($ch);
        curl_close($ch);
        $res = json_decode((string) $body, true);
        return is_array($res) && !empty($res['success']);
    }

    // ------------------------------------------------------------------ start

    public function start()
    {
        $this->guard('start_impl');
    }

    private function start_impl()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('chat_start_' . $this->ip(), 10, 60);
        $in = $this->json_input();

        if (empty($in['consent'])) {
            $this->api->respond_error('Please agree to the Privacy Notice to start the chat.', 422);
        }
        if (!$this->verify_recaptcha($in['recaptcha_token'] ?? '')) {
            $this->api->respond_error('Please complete the captcha and try again.', 403);
        }
        $lang  = (($in['language'] ?? '') === 'fil') ? 'fil' : 'en';
        $token = bin2hex(random_bytes(32));

        $id = $this->rm()->insert_get_id(['table' => 'chat_sessions'], [
            'session_token' => $token, 'language' => $lang, 'consent_given' => 1,
            'consent_at' => date('Y-m-d H:i:s'), 'status' => 'active',
        ], ['session_token' => $token]);
        if ($id <= 0) {
            $this->api->respond_error('Could not start the chat. Please try again.', 500);
        }
        $this->api->respond(['session_token' => $token]);
    }

    // ------------------------------------------------------------------ message

    public function message()
    {
        $this->guard('message_impl');
    }

    private function message_impl()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('chat_msg_' . $this->ip(), 30, 60);
        $in = $this->json_input();

        $session = $this->require_session($in['session_token'] ?? '');
        $message = trim((string) ($in['message'] ?? ''));
        if ($message === '') {
            $this->api->respond_error('Message is required', 422);
        }
        if (mb_strlen($message) > 500) {
            $this->api->respond_error('Message is too long (max 500 characters)', 422);
        }

        $base   = rtrim(getenv('AI_SERVICE_URL') ?: 'http://127.0.0.1:5000', '/');
        $result = $this->ask_ai($base . '/chat', $message);
        if ($result === null || !isset($result['reply'])) {
            $why = $this->ai_error;
            if (!getenv('AI_SERVICE_URL')) {
                $why = 'AI_SERVICE_URL is not set on the backend';
            }
            $this->api->respond_error('The AI service is unavailable' . ($why !== '' ? ' (' . $why . ')' : ''), 503);
        }

        $intent = (string) ($result['intent'] ?? 'unknown');
        $conf   = round((float) ($result['confidence'] ?? 0), 4);
        $model  = $this->rm();
        $sid    = (int) $session['id'];

        // One query for both messages keeps this fast even with a remote database.
        $model->insert_rows(['table' => 'chat_messages'],
            ['session_id', 'sender', 'message', 'detected_intent', 'confidence'],
            [
                ['session_id' => $sid, 'sender' => 'user', 'message' => $message,
                 'detected_intent' => mb_substr($intent, 0, 60), 'confidence' => $conf],
                ['session_id' => $sid, 'sender' => 'bot', 'message' => (string) $result['reply'],
                 'detected_intent' => null, 'confidence' => null],
            ]
        );

        $lang = (($result['lang'] ?? '') === 'fil') ? 'fil' : 'en';
        if ($lang !== $session['language']) {
            $model->update(['table' => 'chat_sessions'], $sid, ['language' => $lang]);
        }

        $this->api->respond([
            'intent'           => $intent,
            'confidence'       => (float) ($result['confidence'] ?? 0),
            'reply'            => (string) $result['reply'],
            'options'          => array_values((array) ($result['options'] ?? [])),
            'uncertain'        => (bool) ($result['uncertain'] ?? false),
            'lang'             => $lang,
            'offer_assessment' => in_array($intent, ['bite_report'], true),
        ]);
    }

    private function ask_ai($url, $message)
    {
        // A free hosting plan puts the AI service to sleep when idle, so the first call can take up to a minute.
        @set_time_limit(75);
        $payload = json_encode(['message' => $message]);
        $headers = ['Content-Type: application/json'];
        $key = getenv('AI_SERVICE_KEY');
        if ($key) {
            $headers[] = 'X-AI-Key: ' . $key;
        }
        $body = false;
        $code = 0;
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 65,
            ]);
            $body  = curl_exec($ch);
            $code  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $errno = curl_errno($ch);
            curl_close($ch);
            if ($errno === 28) {
                $this->ai_error = 'timed out. The AI service may be waking up, try again in a minute';
            } elseif ($errno !== 0) {
                $this->ai_error = 'cannot connect to the AI service. Check AI_SERVICE_URL on the backend';
            }
        } else {
            $ctx = stream_context_create(['http' => [
                'method' => 'POST', 'header' => implode("\r\n", $headers) . "\r\n",
                'content' => $payload, 'timeout' => 65, 'ignore_errors' => true,
            ]]);
            $body = @file_get_contents($url, false, $ctx);
            $code = 200;
            if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
                $code = (int) $m[1];
            }
        }
        if ($body === false || $body === null || $code !== 200) {
            if ($this->ai_error === '') {
                $this->ai_error = 'the AI service answered HTTP ' . $code . ($code === 401 ? '. AI_SERVICE_KEY does not match' : '');
            }
            return null;
        }
        $data = json_decode($body, true);
        if (!is_array($data)) {
            $this->ai_error = 'the AI service sent an invalid response';
            return null;
        }
        return $data;
    }

    // ------------------------------------------------------------------ assessment

    /**
     * Preliminary exposure category from the WHO exposure categories. For STAFF REVIEW ONLY.
     * III: bite or scratch that breaks the skin, saliva on broken skin or mucous membranes.
     * II : minor scratch or nibble without bleeding.   I: touching, feeding, or a lick on intact skin.
     * Any bleeding raises the suggestion to III. Staff confirm the final category.
     */
    private function classify(array $a)
    {
        $cat = 'I';
        if (in_array($a['exposure'], ['scratch_no_bleeding', 'nibble_no_break'], true)) {
            $cat = 'II';
        }
        if (in_array($a['exposure'], ['bite_broke_skin', 'scratch_bleeding', 'lick_broken_skin', 'lick_mucous'], true)) {
            $cat = 'III';
        }
        if ($a['bleeding'] !== 'none') {
            $cat = 'III';
        }
        $urgent = ($a['body_part'] === 'head_face_neck') || ($a['bleeding'] === 'heavy') || ($a['exposure'] === 'lick_mucous');
        return [$cat, $urgent];
    }

    private function labels($lang)
    {
        $en = [
            'animal' => ['dog' => 'Dog', 'cat' => 'Cat', 'other' => 'Other animal'],
            'animal_status' => ['owned_vaccinated' => 'Has an owner, vaccinated', 'owned_unknown' => 'Has an owner, not sure if vaccinated', 'stray' => 'Stray (no owner)', 'unknown' => 'Not known'],
            'exposure' => [
                'bite_broke_skin' => 'Bite that broke the skin', 'scratch_bleeding' => 'Scratch with bleeding',
                'scratch_no_bleeding' => 'Scratch without bleeding', 'nibble_no_break' => 'Bite or nibble that did not break the skin',
                'lick_broken_skin' => 'Saliva on a cut or broken skin', 'lick_mucous' => 'Saliva in the eyes, nose, or mouth',
                'lick_intact' => 'Lick on unbroken skin', 'touch_feed' => 'Only touched or fed the animal',
            ],
            'body_part' => ['head_face_neck' => 'Head, face, or neck', 'hand_fingers' => 'Hand or fingers', 'arm' => 'Arm', 'leg_foot' => 'Leg or foot', 'trunk' => 'Body (trunk)', 'other' => 'Other'],
            'when' => ['today' => 'Today', '1_3_days' => '1 to 3 days ago', 'more_3_days' => 'More than 3 days ago'],
            'bleeding' => ['none' => 'No bleeding', 'light' => 'Light bleeding', 'heavy' => 'Heavy bleeding'],
            'washed' => ['yes' => 'Yes', 'no' => 'Not yet'],
        ];
        $fil = [
            'animal' => ['dog' => 'Aso', 'cat' => 'Pusa', 'other' => 'Ibang hayop'],
            'animal_status' => ['owned_vaccinated' => 'May-ari, may bakuna', 'owned_unknown' => 'May-ari, hindi sigurado kung may bakuna', 'stray' => 'Gala (walang may-ari)', 'unknown' => 'Hindi alam'],
            'exposure' => [
                'bite_broke_skin' => 'Kagat na nakasugat sa balat', 'scratch_bleeding' => 'Kalmot na may dugo',
                'scratch_no_bleeding' => 'Kalmot na walang dugo', 'nibble_no_break' => 'Kagat na hindi nakasugat sa balat',
                'lick_broken_skin' => 'Laway sa hiwa o sugat', 'lick_mucous' => 'Laway sa mata, ilong, o bibig',
                'lick_intact' => 'Dinilaan ang buong balat', 'touch_feed' => 'Hinawakan o pinakain lang ang hayop',
            ],
            'body_part' => ['head_face_neck' => 'Ulo, mukha, o leeg', 'hand_fingers' => 'Kamay o daliri', 'arm' => 'Braso', 'leg_foot' => 'Binti o paa', 'trunk' => 'Katawan', 'other' => 'Iba pa'],
            'when' => ['today' => 'Ngayong araw', '1_3_days' => '1 hanggang 3 araw na ang nakalipas', 'more_3_days' => 'Higit 3 araw na ang nakalipas'],
            'bleeding' => ['none' => 'Walang dugo', 'light' => 'Kaunting dugo', 'heavy' => 'Maraming dugo'],
            'washed' => ['yes' => 'Oo', 'no' => 'Hindi pa'],
        ];
        return $lang === 'fil' ? $fil : $en;
    }

    private function staff_summary(array $a, $cat, $urgent)
    {
        $L = $this->labels('en');
        $s  = $L['animal'][$a['animal']] . ' (' . $L['animal_status'][$a['animal_status']] . '): ' . $L['exposure'][$a['exposure']] . '. ';
        $s .= 'Body part: ' . $L['body_part'][$a['body_part']] . '. When: ' . $L['when'][$a['when']] . '. ';
        $s .= 'Bleeding: ' . $L['bleeding'][$a['bleeding']] . '. Wound already washed: ' . $L['washed'][$a['washed']] . '. ';
        $s .= 'Preliminary suggestion: Category ' . $cat . ' (staff must confirm).';
        if ($urgent) {
            $s .= ' URGENT: head, face, neck, mucous membrane, or heavy bleeding reported.';
        }
        return $s;
    }

    /** Patient-safe summary. It never contains the category, staff notes, or contact details. */
    private function public_summary(array $a, $urgent, $code, $lang)
    {
        $L       = $this->labels($lang);
        $address = $this->setting('clinic_address', 'C5 Road, Barangay Sapul, Calapan City');
        $phone   = $this->setting('clinic_phone', '0948 983 8158');
        $date    = date('F j, Y');

        if ($lang === 'fil') {
            $t  = "Reference code: {$code}\nNai-save noong: {$date}\n\n";
            $t .= "Ang sinabi mo sa amin\n";
            $t .= '- Hayop: ' . $L['animal'][$a['animal']] . ' (' . $L['animal_status'][$a['animal_status']] . ")\n";
            $t .= '- Nangyari: ' . $L['exposure'][$a['exposure']] . "\n";
            $t .= '- Bahagi ng katawan: ' . $L['body_part'][$a['body_part']] . "\n";
            $t .= '- Kailan: ' . $L['when'][$a['when']] . "\n";
            $t .= '- Dugo: ' . $L['bleeding'][$a['bleeding']] . "\n";
            $t .= '- Nahugasan na ang sugat: ' . $L['washed'][$a['washed']] . "\n\n";
            $t .= "Ano ang gagawin ngayon\n";
            $t .= "1. Hugasan nang mabuti ang sugat gamit ang sabon at umaagos na tubig nang hindi bababa sa 15 minuto.\n";
            $t .= "2. Takpan ng malinis na tela o benda.\n";
            $t .= "3. Pumunta sa EZ Animal Bite Center sa lalong madaling panahon para masuri ng aming nurse o doktor.\n";
            $t .= "   Address: {$address}. Telepono: {$phone}.\n";
            if ($urgent) {
                $t .= "\nDahil sa lugar ng kagat o sa dami ng dugo, pumunta agad sa center o sa pinakamalapit na ospital.\n";
            }
            $t .= "\nIpakita ang reference code na ito sa center. Pangkalahatang first aid lamang ito. Hindi ito diagnosis at hindi kapalit ng pagsusuri ng nurse o doktor.";
            return $t;
        }

        $t  = "Reference code: {$code}\nSaved on: {$date}\n\n";
        $t .= "What you told us\n";
        $t .= '- Animal: ' . $L['animal'][$a['animal']] . ' (' . $L['animal_status'][$a['animal_status']] . ")\n";
        $t .= '- What happened: ' . $L['exposure'][$a['exposure']] . "\n";
        $t .= '- Body part: ' . $L['body_part'][$a['body_part']] . "\n";
        $t .= '- When: ' . $L['when'][$a['when']] . "\n";
        $t .= '- Bleeding: ' . $L['bleeding'][$a['bleeding']] . "\n";
        $t .= '- Wound already washed: ' . $L['washed'][$a['washed']] . "\n\n";
        $t .= "What to do now\n";
        $t .= "1. Wash the wound well with soap and running water for at least 15 minutes.\n";
        $t .= "2. Cover it with a clean cloth or dressing.\n";
        $t .= "3. Go to EZ Animal Bite Center as soon as possible so our nurse or physician can assess you.\n";
        $t .= "   Address: {$address}. Phone: {$phone}.\n";
        if ($urgent) {
            $t .= "\nBecause of where the bite is or how much it is bleeding, please go to the center or the nearest hospital right away.\n";
        }
        $t .= "\nShow this reference code at the center. This is general first aid information only. It is not a diagnosis and does not replace an assessment by a nurse or physician.";
        return $t;
    }

    private function new_code()
    {
        $alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0, 1, I, L, O
        $model = $this->rm();
        for ($try = 0; $try < 8; $try++) {
            $code = 'BB-';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            if (!$model->exists_where('reference_codes', ['code' => $code])) {
                return $code;
            }
        }
        throw new RuntimeException('Could not create a unique code');
    }

    /**
     * Validates an optional wound photo and returns it for saving in the database (null if none was sent).
     * It is kept in the database because a web host's disk may be wiped on every restart.
     */
    private function read_photo()
    {
        if (!isset($_FILES['photo']) || $_FILES['photo']['error'] === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        $f = $_FILES['photo'];
        if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
            $this->api->respond_error('The photo is too large. Please choose a smaller photo.', 422);
        }
        if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
            $this->api->respond_error('The photo could not be uploaded. Please try again.', 422);
        }
        if ($f['size'] > self::MAX_PHOTO_BYTES) {
            $this->api->respond_error('The photo is too large (up to 5 MB).', 422);
        }

        $info = @getimagesize($f['tmp_name']);
        $mime = class_exists('finfo') ? (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) : ($info['mime'] ?? '');
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || !$info || $info[0] > 10000 || $info[1] > 10000) {
            $this->api->respond_error('Only JPEG, PNG, or WebP photos are allowed.', 422);
        }

        $raw = file_get_contents($f['tmp_name']);
        if ($raw === false) {
            $this->api->respond_error('The photo could not be read. Please try again.', 422);
        }
        return ['mime' => $mime, 'size' => (int) $f['size'], 'b64' => base64_encode($raw)];
    }

    public function assessment()
    {
        $this->guard('assessment_impl');
    }

    private function assessment_impl()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('chat_assess_' . $this->ip(), 5, 60);

        $session = $this->require_session($_POST['session_token'] ?? '');
        $model   = $this->rm();
        $sid     = (int) $session['id'];

        if ($model->exists_where('chat_assessments', ['session_id' => $sid])) {
            $this->api->respond_error('A summary was already saved for this chat. Use your reference code to view it.', 409);
        }

        $raw = json_decode((string) ($_POST['answers'] ?? ''), true);
        $a   = [];
        foreach (self::QUESTIONS as $key => $allowed) {
            $v = (is_array($raw) && isset($raw[$key]) && is_string($raw[$key])) ? $raw[$key] : '';
            if (!in_array($v, $allowed, true)) {
                $this->api->respond_error('Please answer all the questions.', 422);
            }
            $a[$key] = $v;
        }

        $name = trim((string) ($_POST['contact_name'] ?? ''));
        if ($name !== '' && (mb_strlen($name) > 120 || !preg_match('/^[\p{L}\p{M}][\p{L}\p{M}\s\'.\-]*$/u', $name))) {
            $this->api->respond_error('Please enter a valid name (letters only, up to 120 characters).', 422);
        }
        $number = preg_replace('/[\s\-()]/', '', trim((string) ($_POST['contact_number'] ?? '')));
        if ($number !== '' && !preg_match('/^\+?\d{7,15}$/', $number)) {
            $this->api->respond_error('Contact number must be 7 to 15 digits.', 422);
        }

        $photo = $this->read_photo();

        [$cat, $urgent] = $this->classify($a);
        $lang  = $session['language'] === 'fil' ? 'fil' : 'en';
        $days  = $model->setting_int('reference_code_days', 30, 1, 365);

        $model->begin();
        try {
            $aid = $model->insert_get_id(['table' => 'chat_assessments'], [
                'session_id' => $sid, 'answers' => json_encode($a), 'summary' => $this->staff_summary($a, $cat, $urgent),
                'suggested_category' => $cat, 'wound_photo_path' => $photo ? 'database' : null, 'review_status' => 'pending',
            ], ['session_id' => $sid]);
            if ($aid <= 0) {
                throw new RuntimeException('The assessment was not saved.');
            }

            // Save the wound photo (if any) in the database, linked to this assessment.
            if ($photo) {
                $model->insert(['table' => 'chat_photos'], [
                    'assessment_id' => $aid, 'mime_type' => $photo['mime'],
                    'file_size' => $photo['size'], 'image_base64' => $photo['b64'],
                ]);
            }

            $model->update(['table' => 'chat_sessions'], $sid, [
                'contact_name' => $name === '' ? null : $name, 'contact_number' => $number === '' ? null : $number,
                'status' => 'completed',
            ]);
            $code   = $this->new_code();
            $public = $this->public_summary($a, $urgent, $code, $lang);
            $model->insert(['table' => 'reference_codes'], [
                'code' => $code, 'session_id' => $sid, 'assessment_id' => $aid, 'public_summary' => $public,
                'expires_at' => (new DateTime())->modify("+{$days} days")->format('Y-m-d H:i:s'),
            ]);
            $model->commit();
        } catch (Throwable $e) {
            $model->rollback();
            error_log('ChatController assessment: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            $this->api->respond_error('Your summary could not be saved. Please try again or call the center.', 500);
        }

        // Only patient-safe data is returned: no category and no staff fields.
        $this->api->respond(['reference_code' => $code, 'summary' => $public, 'valid_days' => $days], 201);
    }

    // ------------------------------------------------------------------ retrieve

    public function retrieve()
    {
        $this->guard('retrieve_impl');
    }

    private function retrieve_impl()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('chat_ref_' . $this->ip(), 10, 60);
        $in   = $this->json_input();
        $code = strtoupper(trim((string) ($in['code'] ?? '')));

        if (!preg_match('/^BB-[A-Z0-9]{4,12}$/', $code)) {
            $this->api->respond_error('Enter your reference code, for example BB-7K3M9P2X.', 422);
        }
        $row = $this->rm()->query_one(
            "SELECT public_summary, created_at FROM reference_codes
             WHERE code = ? AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1",
            [$code]
        );
        if (!$row) {
            $this->api->respond_error('We could not find that code. Check it and try again, or call the center.', 404);
        }
        $this->api->respond(['summary' => $row['public_summary'], 'saved_at' => $row['created_at']]);
    }
}