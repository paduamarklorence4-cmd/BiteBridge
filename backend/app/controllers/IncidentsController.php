<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
require_once __DIR__ . '/ResourceController.php';

class IncidentsController extends ResourceController
{
    protected function config()
    {
        $injuries = ['bite', 'scratch', 'bite_and_scratch', 'lick_on_broken_skin', 'other'];
        return [
            'table' => 'animal_bite_incidents', 'alias' => 'i', 'label' => 'bite incident', 'module' => 'incidents',
            'view_perm' => 'incidents.view', 'manage_perm' => 'incidents.manage', 'created_by' => 'recorded_by',
            'from' => "animal_bite_incidents i INNER JOIN patients p ON p.id = i.patient_id",
            'select' => "i.id, i.patient_id, p.patient_code,
                         CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
                         CONCAT(p.patient_code, ' - ', CONCAT_WS(' ', p.first_name, p.last_name)) AS patient_label,
                         i.incident_date, i.animal_type, i.injury_type, i.body_part, i.incident_location,
                         i.wound_details, i.staff_notes",
            'search' => ['p.first_name', 'p.last_name', 'p.patient_code', 'i.animal_type', 'i.body_part', 'i.incident_location'],
            'order'  => 'i.incident_date DESC, i.id DESC',
            'fields' => [
                'patient_id'        => ['type' => 'ref', 'table' => 'patients', 'label' => 'Patient', 'required' => true],
                'incident_date'     => ['type' => 'date', 'label' => 'Incident date', 'required' => true, 'no_future' => true],
                'animal_type'       => ['type' => 'string', 'label' => 'Animal type', 'required' => true, 'max' => 40],
                'injury_type'       => ['type' => 'enum', 'label' => 'Injury type', 'required' => true, 'values' => $injuries],
                'body_part'         => ['type' => 'string', 'label' => 'Body part', 'max' => 80],
                'incident_location' => ['type' => 'string', 'label' => 'Incident location', 'max' => 255],
                'wound_details'     => ['type' => 'text', 'label' => 'Wound details'],
                'staff_notes'       => ['type' => 'text', 'label' => 'Staff notes'],
            ],
            'filters' => [
                'injury_type' => ['type' => 'enum', 'col' => 'i.injury_type', 'values' => $injuries],
                'patient_id'  => ['type' => 'int', 'col' => 'i.patient_id'],
            ],
        ];
    }
}