<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Base class for staff CRUD modules. It is NOT routed by itself.
 * A child controller only describes the module in config(); this class provides
 * search (paged), detail, store (create) and modify (update), with permission checks,
 * validation, and activity logging.
 *
 * config() keys:
 *   table, alias, label, module, view_perm, manage_perm, created_by (column set on create, optional)
 *   from, select, detail_select (optional), search (list of columns), order
 *   fields  : name => [type, label, required, max, values, table, no_future, ...]
 *   filters : key => [type int|enum|map, col, values|map]
 *
 * Field types: string, text, int, decimal, date, time, enum, ref, bool
 */
abstract class ResourceController extends Controller
{
    /** Set by authorize(): ['profile' => ..., 'codes' => [...], 'users' => UsersModel]. Available to hooks. */
    protected $auth = null;

    abstract protected function config();

    public function __construct()
    {
        parent::__construct();
        $this->call->library('api');
    }

    protected function json_input()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    /** Validate the token, reload the user from the database, and require a permission. */
    protected function authorize($permission)
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
        $this->auth = ['profile' => $profile, 'codes' => $codes, 'users' => $users];
        return $this->auth;
    }

    protected function valid_date($v)
    {
        $d = DateTime::createFromFormat('Y-m-d', $v);
        return ($d && $d->format('Y-m-d') === $v) ? $d : null;
    }

    /** Hooks for child controllers. */
    protected function validate_extra(array $data, $mode, $existing)
    {
        return [];
    }

    protected function prepare(array $data, $mode, $existing)
    {
        return $data;
    }

    protected function after_save($mode, $id, array $data, array $auth)
    {
    }

    /** Validate request input against the field definitions. Responds with 422 and a readable message if invalid. */
    protected function validate(array $in, $mode, $existing = null)
    {
        $cfg   = $this->config();
        $model = $this->call->model('ResourceModel');
        $today = new DateTime('today');
        $err   = [];
        $out   = [];

        foreach ($cfg['fields'] as $name => $def) {
            $label = $def['label'] ?? $name;
            $raw   = $in[$name] ?? null;
            if (is_array($raw)) {
                $err[] = "{$label} is invalid.";
                continue;
            }
            $val = $raw === null ? '' : trim((string) $raw);

            if ($val === '') {
                if (!empty($def['required'])) {
                    $err[] = "{$label} is required.";
                }
                $out[$name] = array_key_exists('default', $def) ? $def['default'] : null;
                continue;
            }

            switch ($def['type']) {
                case 'string':
                case 'text':
                    $max = $def['max'] ?? ($def['type'] === 'text' ? 5000 : 255);
                    if (mb_strlen($val) > $max) {
                        $err[] = "{$label} is too long (up to {$max} characters).";
                    }
                    $out[$name] = $val;
                    break;

                case 'int':
                    if (!ctype_digit($val) || (isset($def['min']) && (int) $val < $def['min']) || (isset($def['max']) && (int) $val > $def['max'])) {
                        $err[] = "{$label} must be a whole number" . (isset($def['min']) ? " from {$def['min']}" : '') . (isset($def['max']) ? " to {$def['max']}" : '') . '.';
                    }
                    $out[$name] = (int) $val;
                    break;

                case 'decimal':
                    if (!preg_match('/^\d{1,8}(\.\d{1,2})?$/', $val) || (isset($def['min']) && (float) $val < $def['min'])) {
                        $err[] = "{$label} must be a valid amount.";
                    }
                    $out[$name] = $val;
                    break;

                case 'date':
                    $d = $this->valid_date($val);
                    if (!$d) {
                        $err[] = "{$label} is not a valid date.";
                    } elseif (!empty($def['no_future']) && $d > $today) {
                        $err[] = "{$label} cannot be in the future.";
                    } elseif (!empty($def['no_past']) && $d < $today) {
                        $err[] = "{$label} cannot be in the past.";
                    }
                    $out[$name] = $val;
                    break;

                case 'time':
                    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $val)) {
                        $err[] = "{$label} is not a valid time.";
                    }
                    $out[$name] = strlen($val) === 5 ? $val . ':00' : $val;
                    break;

                case 'enum':
                    if (!in_array($val, $def['values'], true)) {
                        $err[] = "{$label} has an invalid choice.";
                    }
                    $out[$name] = $val;
                    break;

                case 'ref':
                    if (!ctype_digit($val) || !$model->row_exists($def['table'], (int) $val)) {
                        $err[] = "{$label} was not found.";
                    }
                    $out[$name] = (int) $val;
                    break;

                case 'bool':
                    $out[$name] = in_array(strtolower($val), ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
                    break;

                default:
                    $err[] = "{$label} has an unsupported type.";
            }
        }

        $err = array_merge($err, $this->validate_extra($out, $mode, $existing));
        if ($err) {
            $this->api->respond_error(implode(' ', $err), 422);
        }
        return $this->prepare($out, $mode, $existing);
    }

    protected function build_filters(array $cfg, array $in)
    {
        $out = [];
        $req = (isset($in['filters']) && is_array($in['filters'])) ? $in['filters'] : [];
        foreach (($cfg['filters'] ?? []) as $key => $def) {
            if (!isset($req[$key]) || is_array($req[$key])) {
                continue;
            }
            $v = trim((string) $req[$key]);
            if ($v === '') {
                continue;
            }
            if ($def['type'] === 'int' && ctype_digit($v)) {
                $out[] = ["{$def['col']} = ?", (int) $v];
            } elseif ($def['type'] === 'enum' && in_array($v, $def['values'], true)) {
                $out[] = ["{$def['col']} = ?", $v];
            } elseif ($def['type'] === 'map' && isset($def['map'][$v])) {
                $out[] = [$def['map'][$v]];
            }
        }
        return $out;
    }

    public function search()
    {
        $this->api->require_method('POST');
        $cfg = $this->config();
        $this->authorize($cfg['view_perm']);
        $in = $this->json_input();

        $term = trim((string) ($in['search'] ?? ''));
        if (mb_strlen($term) > 100) {
            $term = mb_substr($term, 0, 100);
        }
        $model = $this->call->model('ResourceModel');
        $this->api->respond($model->search(
            $cfg, $term, (int) ($in['page'] ?? 1), (int) ($in['per_page'] ?? 10), $this->build_filters($cfg, $in)
        ));
    }

    public function detail()
    {
        $this->api->require_method('POST');
        $cfg = $this->config();
        $this->authorize($cfg['view_perm']);
        $in = $this->json_input();

        $model = $this->call->model('ResourceModel');
        $item  = $model->find($cfg, (int) ($in['id'] ?? 0));
        if (!$item) {
            $this->api->respond_error(ucfirst($cfg['label']) . ' not found', 404);
        }
        $this->api->respond(['item' => $item]);
    }

    public function store()
    {
        $this->api->require_method('POST');
        $cfg  = $this->config();
        $auth = $this->authorize($cfg['manage_perm']);

        $data = $this->validate($this->json_input(), 'create');
        if (!empty($cfg['created_by'])) {
            $data[$cfg['created_by']] = (int) $auth['profile']['id'];
        }
        if (!empty($cfg['updated_by'])) {
            $data[$cfg['updated_by']] = (int) $auth['profile']['id'];
        }

        $model = $this->call->model('ResourceModel');
        $id = $model->insert($cfg, $data);
        if ($id <= 0) {
            $this->api->respond_error('The ' . $cfg['label'] . ' could not be saved. Please try again.', 500);
        }
        $this->after_save('create', $id, $data, $auth);

        $auth['users']->log_activity((int) $auth['profile']['id'], $cfg['module'] . '_created', $cfg['module'],
            'Created ' . $cfg['label'] . ' #' . $id, $id);

        $this->api->respond(['message' => ucfirst($cfg['label']) . ' saved', 'item' => $model->find($cfg, $id)], 201);
    }

    public function modify()
    {
        $this->api->require_method('POST');
        $cfg  = $this->config();
        $auth = $this->authorize($cfg['manage_perm']);
        $in   = $this->json_input();

        $id    = (int) ($in['id'] ?? 0);
        $model = $this->call->model('ResourceModel');
        $existing = $id > 0 ? $model->get_row($cfg['table'], $id) : null;
        if (!$existing) {
            $this->api->respond_error(ucfirst($cfg['label']) . ' not found', 404);
        }

        $data = $this->validate($in, 'update', $existing);
        if (!empty($cfg['updated_by'])) {
            $data[$cfg['updated_by']] = (int) $auth['profile']['id'];
        }
        $model->update($cfg, $id, $data);
        $this->after_save('update', $id, $data, $auth);

        $auth['users']->log_activity((int) $auth['profile']['id'], $cfg['module'] . '_updated', $cfg['module'],
            'Updated ' . $cfg['label'] . ' #' . $id, $id);

        $this->api->respond(['message' => ucfirst($cfg['label']) . ' updated', 'item' => $model->find($cfg, $id)]);
    }
}