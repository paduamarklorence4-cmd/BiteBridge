<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

/**
 * Inventory items. The quantity can only be set when the item is created;
 * after that it changes only through stock(), which also writes the stock history.
 */
class InventoryController extends ResourceController
{
    protected function config()
    {
        $model = $this->call->model('ResourceModel');
        $near  = $model->setting_int('near_expiry_days', 30, 1, 365);
        return [
            'table' => 'inventory_items', 'alias' => 'i', 'label' => 'inventory item', 'module' => 'inventory',
            'view_perm' => 'inventory.view', 'manage_perm' => 'inventory.manage',
            'from' => 'inventory_items i',
            'select' => "i.id, i.item_name, i.category, i.unit, i.quantity, i.low_stock_threshold, i.expiration_date,
                         i.supplier_name, i.supplier_contact,
                         CASE WHEN i.quantity <= i.low_stock_threshold THEN 1 ELSE 0 END AS is_low,
                         DATEDIFF(i.expiration_date, CURDATE()) AS days_to_expiry,
                         CASE WHEN i.expiration_date IS NOT NULL AND i.expiration_date >= CURDATE()
                                   AND i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL {$near} DAY) THEN 1 ELSE 0 END AS is_near_expiry",
            'search' => ['i.item_name', 'i.category', 'i.supplier_name'],
            'order'  => 'i.item_name ASC, i.id ASC',
            'fields' => [
                'item_name'           => ['type' => 'string', 'label' => 'Item name', 'required' => true, 'max' => 120],
                'category'            => ['type' => 'string', 'label' => 'Category', 'required' => true, 'max' => 60],
                'unit'                => ['type' => 'string', 'label' => 'Unit', 'required' => true, 'max' => 20],
                'quantity'            => ['type' => 'int', 'label' => 'Starting quantity', 'min' => 0, 'max' => 1000000, 'default' => 0],
                'low_stock_threshold' => ['type' => 'int', 'label' => 'Low-stock level', 'min' => 0, 'max' => 1000000, 'default' => 0],
                'expiration_date'     => ['type' => 'date', 'label' => 'Expiration date'],
                'supplier_name'       => ['type' => 'string', 'label' => 'Supplier', 'max' => 120],
                'supplier_contact'    => ['type' => 'string', 'label' => 'Supplier contact', 'max' => 120],
            ],
            'filters' => [
                'alert' => ['type' => 'map', 'map' => [
                    'low'     => 'i.quantity <= i.low_stock_threshold',
                    'near'    => "i.expiration_date IS NOT NULL AND i.expiration_date >= CURDATE() AND i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL {$near} DAY)",
                    'expired' => 'i.expiration_date IS NOT NULL AND i.expiration_date < CURDATE()',
                ]],
            ],
        ];
    }

    protected function prepare(array $data, $mode, $existing)
    {
        if ($mode === 'update') {
            unset($data['quantity']); // changed only through stock()
        }
        return $data;
    }

    protected function after_save($mode, $id, array $data, array $auth)
    {
        if ($mode === 'create' && (int) $data['quantity'] > 0) {
            $this->call->model('ResourceModel')->insert(['table' => 'inventory_transactions'], [
                'item_id' => $id, 'transaction_type' => 'stock_in', 'quantity' => (int) $data['quantity'],
                'remarks' => 'Initial stock', 'performed_by' => (int) $auth['profile']['id'],
            ]);
        }
    }

    /** POST /inventory/stock { id, type: stock_in|stock_out|adjustment, quantity, remarks } */
    public function stock()
    {
        $this->api->require_method('POST');
        $auth  = $this->authorize('inventory.manage');
        $in    = $this->json_input();
        $cfg   = $this->config();
        $model = $this->call->model('ResourceModel');

        $id   = (int) ($in['id'] ?? 0);
        $item = $id > 0 ? $model->get_row('inventory_items', $id) : null;
        if (!$item) {
            $this->api->respond_error('Item not found', 404);
        }

        $type = (string) ($in['type'] ?? '');
        if (!in_array($type, ['stock_in', 'stock_out', 'adjustment'], true)) {
            $this->api->respond_error('Choose stock in, stock out, or adjustment.', 422);
        }
        $q = trim((string) ($in['quantity'] ?? ''));
        if ($q === '' || !ctype_digit($q) || (int) $q > 1000000) {
            $this->api->respond_error('Quantity must be a whole number.', 422);
        }
        $qty = (int) $q;
        if ($type !== 'adjustment' && $qty < 1) {
            $this->api->respond_error('Quantity must be at least 1.', 422);
        }
        $remarks = trim((string) ($in['remarks'] ?? ''));
        if (mb_strlen($remarks) > 255) {
            $this->api->respond_error('Remarks are too long (up to 255 characters).', 422);
        }

        $uid = (int) $auth['profile']['id'];
        $model->begin();
        try {
            if ($type === 'stock_in') {
                $model->execute("UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?", [$qty, $id]);
                $logged = $qty;
            } elseif ($type === 'stock_out') {
                $rows = $model->execute("UPDATE inventory_items SET quantity = quantity - ? WHERE id = ? AND quantity >= ?", [$qty, $id, $qty]);
                if ($rows < 1) {
                    $model->rollback();
                    $this->api->respond_error('Not enough stock. Only ' . (int) $item['quantity'] . ' in stock.', 422);
                }
                $logged = $qty;
            } else {
                $logged = $qty - (int) $item['quantity'];
                if ($logged === 0) {
                    $model->rollback();
                    $this->api->respond_error('The quantity is already ' . $qty . '. Nothing to change.', 422);
                }
                $model->execute("UPDATE inventory_items SET quantity = ? WHERE id = ?", [$qty, $id]);
            }
            $model->insert(['table' => 'inventory_transactions'], [
                'item_id' => $id, 'transaction_type' => $type, 'quantity' => $logged,
                'remarks' => $remarks === '' ? null : $remarks, 'performed_by' => $uid,
            ]);
            $model->commit();
        } catch (Throwable $e) {
            $model->rollback();
            $this->api->respond_error('The stock could not be updated. Please try again.', 500);
        }

        $auth['users']->log_activity($uid, 'inventory_' . $type, 'inventory', 'Stock change for item #' . $id, $id);
        $this->api->respond(['message' => 'Stock updated', 'item' => $model->find($cfg, $id)]);
    }

    /** POST /inventory/history { id } */
    public function history()
    {
        $this->api->require_method('POST');
        $this->authorize('inventory.view');
        $in    = $this->json_input();
        $model = $this->call->model('ResourceModel');
        $rows  = $model->query_all(
            "SELECT t.id, t.transaction_type, t.quantity, t.remarks, t.created_at, u.full_name AS performed_by_name
             FROM inventory_transactions t LEFT JOIN users u ON u.id = t.performed_by
             WHERE t.item_id = ? ORDER BY t.id DESC LIMIT 50",
            [(int) ($in['id'] ?? 0)]
        );
        $this->api->respond(['items' => $rows]);
    }
}