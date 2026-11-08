<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Read-only statistics for the staff dashboard.
 * Every figure comes from the database. A section the caller may not see is returned as null.
 */
class DashboardModel extends Model
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
        return $row ?: [];
    }

    private function all($sql, $params = [])
    {
        return $this->exec_sql($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Integer setting from system_settings, kept inside safe limits. */
    private function setting_int($key, $default, $min, $max)
    {
        $row = $this->one("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [$key]);
        $v = isset($row['setting_value']) ? (int) $row['setting_value'] : $default;
        if ($v < $min || $v > $max) {
            $v = $default;
        }
        return $v;
    }

    /** Last $n months as ['2026-10' => 'Oct 2026', ...], oldest first. */
    private function last_months($n = 6)
    {
        $months = [];
        $d = new DateTime('first day of this month');
        $d->modify('-' . ($n - 1) . ' months');
        for ($i = 0; $i < $n; $i++) {
            $months[$d->format('Y-m')] = $d->format('M Y');
            $d->modify('+1 month');
        }
        return $months;
    }

    public function stats(array $allow)
    {
        $near = $this->setting_int('near_expiry_days', 30, 1, 365);
        $upcoming = 7; // "upcoming" = scheduled doses in the next 7 days (including today)

        $out = [
            'total_patients'      => null,
            'total_bite_cases'    => null,
            'todays_appointments' => null,
            'upcoming_doses'      => null,
            'overdue_followups'   => null,
            'low_stock_items'     => null,
            'near_expiry_items'   => null,
            'total_collections'   => null,
        ];

        $parts = [];
        if (!empty($allow['patients'])) {
            $parts[] = "(SELECT COUNT(*) FROM patients) AS total_patients";
        }
        if (!empty($allow['incidents'])) {
            $parts[] = "(SELECT COUNT(*) FROM animal_bite_incidents) AS total_bite_cases";
        }
        if (!empty($allow['appointments'])) {
            $parts[] = "(SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE() AND status IN ('scheduled','completed')) AS todays_appointments";
        }
        if (!empty($allow['vaccinations'])) {
            $parts[] = "(SELECT COUNT(*) FROM vaccination_schedules WHERE status = 'scheduled' AND scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL {$upcoming} DAY)) AS upcoming_doses";
            $parts[] = "(SELECT COUNT(*) FROM vaccination_schedules WHERE status = 'scheduled' AND scheduled_date < CURDATE()) AS overdue_followups";
        }
        if (!empty($allow['inventory'])) {
            $parts[] = "(SELECT COUNT(*) FROM inventory_items WHERE quantity <= low_stock_threshold) AS low_stock_items";
            $parts[] = "(SELECT COUNT(*) FROM inventory_items WHERE expiration_date IS NOT NULL AND expiration_date >= CURDATE() AND expiration_date <= DATE_ADD(CURDATE(), INTERVAL {$near} DAY)) AS near_expiry_items";
        }
        if (!empty($allow['billing'])) {
            $parts[] = "(SELECT COALESCE(SUM(amount), 0) FROM payment_records) AS total_collections";
        }

        if ($parts) {
            $row = $this->one('SELECT ' . implode(', ', $parts));
            foreach ($row as $k => $v) {
                $out[$k] = ($k === 'total_collections') ? (float) $v : (int) $v;
            }
        }

        $out['upcoming_window_days'] = $upcoming;
        $out['near_expiry_days']     = $near;
        $out['charts'] = [
            'monthly_bite_cases'  => !empty($allow['incidents'])     ? $this->monthly_bite_cases()  : null,
            'followup_status'     => !empty($allow['vaccinations'])  ? $this->followup_status()     : null,
            'appointment_stats'   => !empty($allow['appointments'])  ? $this->appointment_stats()   : null,
            'inventory_status'    => !empty($allow['inventory'])     ? $this->inventory_status($near) : null,
            'monthly_collections' => !empty($allow['billing'])       ? $this->monthly_collections() : null,
        ];
        return $out;
    }

    private function monthly_bite_cases()
    {
        $rows = $this->all(
            "SELECT DATE_FORMAT(incident_date, '%Y-%m') AS ym, COUNT(*) AS c
             FROM animal_bite_incidents
             WHERE incident_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
             GROUP BY ym"
        );
        $map = array_column($rows, 'c', 'ym');
        $data = [];
        foreach ($this->last_months(6) as $ym => $label) {
            $data[] = ['key' => $ym, 'label' => $label, 'value' => (int) ($map[$ym] ?? 0)];
        }
        return $data;
    }

    private function monthly_collections()
    {
        $rows = $this->all(
            "SELECT DATE_FORMAT(payment_date, '%Y-%m') AS ym, SUM(amount) AS total
             FROM payment_records
             WHERE payment_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
             GROUP BY ym"
        );
        $map = array_column($rows, 'total', 'ym');
        $data = [];
        foreach ($this->last_months(6) as $ym => $label) {
            $data[] = ['key' => $ym, 'label' => $label, 'value' => (float) ($map[$ym] ?? 0)];
        }
        return $data;
    }

    private function followup_status()
    {
        $rows = $this->all(
            "SELECT CASE
                        WHEN status = 'scheduled' AND scheduled_date < CURDATE() THEN 'overdue'
                        WHEN status = 'scheduled' THEN 'upcoming'
                        ELSE status
                    END AS s, COUNT(*) AS c
             FROM vaccination_schedules
             GROUP BY s"
        );
        $map = array_column($rows, 'c', 's');
        $labels = ['completed' => 'Completed', 'upcoming' => 'Upcoming', 'overdue' => 'Overdue', 'missed' => 'Missed', 'cancelled' => 'Cancelled'];
        $data = [];
        foreach ($labels as $key => $label) {
            $data[] = ['key' => $key, 'label' => $label, 'value' => (int) ($map[$key] ?? 0)];
        }
        return $data;
    }

    private function appointment_stats()
    {
        $rows = $this->all("SELECT status AS s, COUNT(*) AS c FROM appointments GROUP BY status");
        $map = array_column($rows, 'c', 's');
        $labels = ['scheduled' => 'Scheduled', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'rescheduled' => 'Rescheduled', 'no_show' => 'No-show'];
        $data = [];
        foreach ($labels as $key => $label) {
            $data[] = ['key' => $key, 'label' => $label, 'value' => (int) ($map[$key] ?? 0)];
        }
        return $data;
    }

    /** An item can be both low-stock and near-expiry, so these groups can overlap except "ok". */
    private function inventory_status($near)
    {
        $row = $this->one(
            "SELECT
                SUM(CASE WHEN quantity > low_stock_threshold
                          AND (expiration_date IS NULL OR expiration_date > DATE_ADD(CURDATE(), INTERVAL {$near} DAY))
                         THEN 1 ELSE 0 END) AS ok,
                SUM(CASE WHEN quantity <= low_stock_threshold THEN 1 ELSE 0 END) AS low_stock,
                SUM(CASE WHEN expiration_date IS NOT NULL AND expiration_date >= CURDATE()
                          AND expiration_date <= DATE_ADD(CURDATE(), INTERVAL {$near} DAY) THEN 1 ELSE 0 END) AS near_expiry,
                SUM(CASE WHEN expiration_date IS NOT NULL AND expiration_date < CURDATE() THEN 1 ELSE 0 END) AS expired
             FROM inventory_items"
        );
        $labels = ['ok' => 'In good standing', 'low_stock' => 'Low stock', 'near_expiry' => 'Near expiry', 'expired' => 'Expired'];
        $data = [];
        foreach ($labels as $key => $label) {
            $data[] = ['key' => $key, 'label' => $label, 'value' => (int) ($row[$key] ?? 0)];
        }
        return $data;
    }
}