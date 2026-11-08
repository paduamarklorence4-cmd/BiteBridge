<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class PatientsModel extends Model
{
    protected $table = 'patients';

    public function __construct()
    {
        parent::__construct();
    }

    private function exec_sql($sql, $params = [])
    {
        return lava_instance()->db->raw($sql, $params);
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

    /** Escape LIKE wildcards so a search for "50%" or "_" is treated as plain text. */
    private function like($term)
    {
        return '%' . addcslashes($term, '%_\\') . '%';
    }

    public function search($term, $page, $per_page, $with_counts)
    {
        $per_page = max(1, min(50, (int) $per_page));
        $where  = '';
        $params = [];
        if ($term !== '') {
            $like   = $this->like($term);
            $where  = "WHERE (p.first_name LIKE ? OR p.middle_name LIKE ? OR p.last_name LIKE ?
                        OR CONCAT_WS(' ', p.first_name, p.last_name) LIKE ?
                        OR p.patient_code LIKE ? OR p.contact_number LIKE ?)";
            $params = [$like, $like, $like, $like, $like, $like];
        }

        $row   = $this->one("SELECT COUNT(*) AS c FROM patients p {$where}", $params);
        $total = (int) ($row['c'] ?? 0);
        $pages = max(1, (int) ceil($total / $per_page));
        $page  = min(max(1, (int) $page), $pages);
        $offset = ($page - 1) * $per_page;

        $count_sql = $with_counts
            ? "(SELECT COUNT(*) FROM animal_bite_incidents i WHERE i.patient_id = p.id)"
            : "NULL";

        $items = $this->all(
            "SELECT p.id, p.patient_code, p.first_name, p.middle_name, p.last_name, p.age_years,
                    p.contact_number, p.address, p.registration_date, {$count_sql} AS incident_count
             FROM patients p
             {$where}
             ORDER BY p.registration_date DESC, p.id DESC
             LIMIT {$per_page} OFFSET {$offset}",
            $params
        );

        foreach ($items as &$it) {
            $it['id'] = (int) $it['id'];
            $it['age_years'] = $it['age_years'] === null ? null : (int) $it['age_years'];
            $it['incident_count'] = $it['incident_count'] === null ? null : (int) $it['incident_count'];
        }
        unset($it);

        return [
            'items'       => $items,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => $pages,
        ];
    }

    public function find($id)
    {
        $p = $this->one(
            "SELECT id, patient_code, first_name, middle_name, last_name, birth_date, age_years,
                    contact_number, address, registration_date, notes, created_at, updated_at
             FROM patients WHERE id = ? LIMIT 1",
            [(int) $id]
        );
        if ($p) {
            $p['id'] = (int) $p['id'];
            $p['age_years'] = $p['age_years'] === null ? null : (int) $p['age_years'];
        }
        return $p;
    }

    public function incidents_of($patient_id)
    {
        return $this->all(
            "SELECT id, incident_date, animal_type, injury_type, body_part
             FROM animal_bite_incidents
             WHERE patient_id = ?
             ORDER BY incident_date DESC, id DESC
             LIMIT 50",
            [(int) $patient_id]
        );
    }

    /** Creates the patient and a readable code such as EZ-00013. Returns the new id (0 on failure). */
    public function create(array $d, $user_id)
    {
        $this->exec_sql(
            "INSERT INTO patients
                (patient_code, first_name, middle_name, last_name, birth_date, age_years,
                 contact_number, address, registration_date, notes, created_by)
             VALUES (CONCAT('TMP-', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12)), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $d['first_name'], $d['middle_name'], $d['last_name'], $d['birth_date'], $d['age_years'],
                $d['contact_number'], $d['address'], $d['registration_date'], $d['notes'], $user_id,
            ]
        );
        $row = $this->one("SELECT LAST_INSERT_ID() AS id");
        $id  = (int) ($row['id'] ?? 0);
        if ($id > 0) {
            $this->exec_sql(
                "UPDATE patients SET patient_code = CONCAT('EZ-', LPAD(id, GREATEST(5, CHAR_LENGTH(id)), '0')) WHERE id = ?",
                [$id]
            );
        }
        return $id;
    }

    public function update_patient($id, array $d)
    {
        $this->exec_sql(
            "UPDATE patients
             SET first_name = ?, middle_name = ?, last_name = ?, birth_date = ?, age_years = ?,
                 contact_number = ?, address = ?, registration_date = ?, notes = ?
             WHERE id = ?",
            [
                $d['first_name'], $d['middle_name'], $d['last_name'], $d['birth_date'], $d['age_years'],
                $d['contact_number'], $d['address'], $d['registration_date'], $d['notes'], (int) $id,
            ]
        );
    }
}