<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Generic, config-driven SQL used by the staff modules (see ResourceController).
 * Table, column and join names come only from controller configs written in code, never from the request.
 * Every value from the request is bound as a parameter.
 */
class ResourceModel extends Model
{
    protected $table = 'patients';

    public function __construct()
    {
        parent::__construct();
    }

    private function exec_sql($sql, $params = [])
    {
        $lava = lava_instance();
        // Public controllers (such as the chatbot) do not load the database on their own, so load it here.
        if (!isset($lava->db)) {
            $lava->call->database();
        }
        return $lava->db->raw($sql, $params);
    }

    private function one($sql, $params = [])
    {
        $row = $this->exec_sql($sql, $params)->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function all($sql, $params = [])
    {
        return $this->exec_sql($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Cast id columns to integers so the browser gets numbers. */
    private function clean_row(array $row)
    {
        foreach ($row as $k => $v) {
            if ($v !== null && ($k === 'id' || substr($k, -3) === '_id')) {
                $row[$k] = (int) $v;
            }
        }
        return $row;
    }

    /**
     * $filters is a list of [sql_fragment] or [sql_fragment, value]. Fragments come from controller configs.
     */
    public function search(array $cfg, $term, $page, $per_page, array $filters)
    {
        $per_page = max(1, min(50, (int) $per_page));
        $conds  = [];
        $params = [];

        if ($term !== '' && !empty($cfg['search'])) {
            $like = '%' . addcslashes($term, '%_\\') . '%';
            $ors  = [];
            foreach ($cfg['search'] as $col) {
                $ors[]    = "{$col} LIKE ?";
                $params[] = $like;
            }
            $conds[] = '(' . implode(' OR ', $ors) . ')';
        }
        foreach ($filters as $f) {
            $conds[] = $f[0];
            if (array_key_exists(1, $f)) {
                $params[] = $f[1];
            }
        }
        $where = $conds ? 'WHERE ' . implode(' AND ', $conds) : '';

        $row   = $this->one("SELECT COUNT(*) AS c FROM {$cfg['from']} {$where}", $params);
        $total = (int) ($row['c'] ?? 0);
        $pages = max(1, (int) ceil($total / $per_page));
        $page  = min(max(1, (int) $page), $pages);
        $offset = ($page - 1) * $per_page;

        $items = $this->all(
            "SELECT {$cfg['select']} FROM {$cfg['from']} {$where} ORDER BY {$cfg['order']} LIMIT {$per_page} OFFSET {$offset}",
            $params
        );
        foreach ($items as $k => $it) {
            $items[$k] = $this->clean_row($it);
        }

        return ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per_page, 'total_pages' => $pages];
    }

    public function find(array $cfg, $id)
    {
        $select = $cfg['detail_select'] ?? $cfg['select'];
        $row = $this->one("SELECT {$select} FROM {$cfg['from']} WHERE {$cfg['alias']}.id = ? LIMIT 1", [(int) $id]);
        return $row ? $this->clean_row($row) : null;
    }

    public function row_exists($table, $id)
    {
        return (bool) $this->one("SELECT id FROM `{$table}` WHERE id = ? LIMIT 1", [(int) $id]);
    }

    public function get_row($table, $id)
    {
        return $this->one("SELECT * FROM `{$table}` WHERE id = ? LIMIT 1", [(int) $id]);
    }

    public function insert(array $cfg, array $data)
    {
        $cols = array_keys($data);
        $sql  = "INSERT INTO `{$cfg['table']}` (`" . implode('`, `', $cols) . "`) VALUES ("
              . implode(', ', array_fill(0, count($cols), '?')) . ")";
        $this->run_checked($sql, array_values($data), 'Insert into ' . $cfg['table']);
        $row = $this->one("SELECT LAST_INSERT_ID() AS id");
        return (int) ($row['id'] ?? 0);
    }

    /** Inserts several rows in ONE query (fewer round trips to the database). No id is returned. */
    public function insert_rows(array $cfg, array $columns, array $rows)
    {
        $one    = '(' . implode(', ', array_fill(0, count($columns), '?')) . ')';
        $sql    = "INSERT INTO `{$cfg['table']}` (`" . implode('`, `', $columns) . "`) VALUES "
                . implode(', ', array_fill(0, count($rows), $one));
        $params = [];
        foreach ($rows as $r) {
            foreach ($columns as $c) {
                $params[] = $r[$c] ?? null;
            }
        }
        $this->run_checked($sql, $params, 'Insert into ' . $cfg['table']);
    }

    /**
     * Inserts a row and returns its id. If LAST_INSERT_ID() gives nothing, the row is found again by $lookup
     * (for example ['session_token' => ...]), so callers still get the id.
     */
    public function insert_get_id(array $cfg, array $data, array $lookup)
    {
        $id = $this->insert($cfg, $data);
        if ($id <= 0) {
            $row = $this->find_where($cfg['table'], $lookup);
            $id  = $row ? (int) $row['id'] : 0;
        }
        return $id;
    }

    /** Runs a write statement and throws a readable error if the database reports a problem. */
    private function run_checked($sql, $params, $what)
    {
        $st = $this->exec_sql($sql, $params);
        if ($st === false || $st === null) {
            throw new RuntimeException($what . ' did not run.');
        }
        if (method_exists($st, 'errorCode')) {
            $code = $st->errorCode();
            if ($code !== null && $code !== '' && $code !== '00000') {
                throw new RuntimeException($what . ' failed: ' . implode(' | ', array_map('strval', (array) $st->errorInfo())));
            }
        }
        return $st;
    }

    public function update(array $cfg, $id, array $data)
    {
        $sets = [];
        foreach (array_keys($data) as $col) {
            $sets[] = "`{$col}` = ?";
        }
        $params = array_values($data);
        $params[] = (int) $id;
        $this->run_checked("UPDATE `{$cfg['table']}` SET " . implode(', ', $sets) . " WHERE id = ?", $params, 'Update of ' . $cfg['table']);
    }


    // ---- helpers for controllers (SQL text is always written in code; values are always bound) ----

    public function query_all($sql, $params = [])
    {
        return $this->all($sql, $params);
    }

    public function query_one($sql, $params = [])
    {
        return $this->one($sql, $params);
    }

    /** Runs INSERT/UPDATE/DELETE and returns the number of affected rows. */
    public function execute($sql, $params = [])
    {
        return $this->exec_sql($sql, $params)->rowCount();
    }

    public function last_id()
    {
        $row = $this->one("SELECT LAST_INSERT_ID() AS id");
        return (int) ($row['id'] ?? 0);
    }

    public function begin()    { $this->exec_sql('START TRANSACTION'); }
    public function commit()   { $this->exec_sql('COMMIT'); }
    public function rollback() { $this->exec_sql('ROLLBACK'); }

    /** True if a row matches all [column => value] pairs (optionally ignoring one id). */
    public function exists_where($table, array $where, $exclude_id = 0)
    {
        return (bool) $this->find_where($table, $where, $exclude_id);
    }

    public function find_where($table, array $where, $exclude_id = 0)
    {
        $conds  = [];
        $params = [];
        foreach ($where as $col => $val) {
            $conds[]  = "`{$col}` = ?";
            $params[] = $val;
        }
        if ($exclude_id > 0) {
            $conds[]  = "id <> ?";
            $params[] = (int) $exclude_id;
        }
        return $this->one("SELECT * FROM `{$table}` WHERE " . implode(' AND ', $conds) . " LIMIT 1", $params);
    }

    /** Integer from system_settings, kept inside safe limits. */
    public function setting_int($key, $default, $min, $max)
    {
        $row = $this->one("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [$key]);
        $v = isset($row['setting_value']) ? (int) $row['setting_value'] : $default;
        return ($v < $min || $v > $max) ? $default : $v;
    }

    /** Small pick-lists for form fields: [{id, label}]. Only the resources below exist. */
    public function lookup($resource, $term)
    {
        $like = '%' . addcslashes($term, '%_\\') . '%';
        $out  = [];

        if ($resource === 'patients') {
            $rows = $this->all(
                "SELECT id, patient_code, first_name, last_name FROM patients
                 WHERE (first_name LIKE ? OR last_name LIKE ? OR patient_code LIKE ? OR CONCAT_WS(' ', first_name, last_name) LIKE ?)
                 ORDER BY registration_date DESC, id DESC LIMIT 15",
                [$like, $like, $like, $like]
            );
            foreach ($rows as $r) {
                $out[] = ['id' => (int) $r['id'], 'label' => $r['patient_code'] . ' - ' . $r['first_name'] . ' ' . $r['last_name']];
            }
        } elseif ($resource === 'roles') {
            $rows = $this->all("SELECT id, label FROM roles WHERE label LIKE ? ORDER BY id LIMIT 15", [$like]);
            foreach ($rows as $r) {
                $out[] = ['id' => (int) $r['id'], 'label' => $r['label']];
            }
        } elseif ($resource === 'incidents') {
            $rows = $this->all(
                "SELECT i.id, i.incident_date, i.animal_type, p.patient_code, p.first_name, p.last_name
                 FROM animal_bite_incidents i INNER JOIN patients p ON p.id = i.patient_id
                 WHERE (p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR i.animal_type LIKE ?)
                 ORDER BY i.incident_date DESC, i.id DESC LIMIT 15",
                [$like, $like, $like, $like]
            );
            foreach ($rows as $r) {
                $out[] = ['id' => (int) $r['id'],
                          'label' => $r['patient_code'] . ' - ' . $r['first_name'] . ' ' . $r['last_name'] . ' - ' . $r['incident_date'] . ' - ' . $r['animal_type']];
            }
        }
        return $out;
    }
}