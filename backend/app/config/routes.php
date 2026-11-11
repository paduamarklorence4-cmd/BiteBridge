<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/**
 * ------------------------------------------------------------------
 * LavaLust - an opensource lightweight PHP MVC Framework
 * MIT License - Copyright (c) 2020 Ronald M. Marasigan
 * ------------------------------------------------------------------
 *
 * URI ROUTING for BiteBridge.
 *
 * The old /users, /products, /student and migration routes were removed:
 * /users printed every account (including password hashes) and the
 * migration routes could roll back tables from the browser.
 * The database is managed through Navicat and the SQL files in /database.
 */
/** @var object $router **/

$router->get('/', 'Welcome::index');

// Authentication API
$router->post('/auth/login',   'AuthController::login');
$router->post('/auth/logout',  'AuthController::logout');
$router->post('/auth/refresh', 'AuthController::refresh');
$router->get('/auth/me',       'AuthController::me');
// Public chatbot (no login)
$router->post('/chat/message', 'ChatController::message');
$router->get('/dashboard/stats', 'DashboardController::stats');
// Patients
$router->post('/patients/search', 'PatientsController::search');
$router->post('/patients/detail', 'PatientsController::detail');
$router->post('/patients/create', 'PatientsController::store');
$router->post('/patients/update', 'PatientsController::modify');
// Lookup (pick-lists sa mga form)
$router->post('/lookup/search', 'LookupController::search');

// Bite incidents
$router->post('/incidents/search', 'IncidentsController::search');
$router->post('/incidents/detail', 'IncidentsController::detail');
$router->post('/incidents/create', 'IncidentsController::store');
$router->post('/incidents/update', 'IncidentsController::modify');

// Assessments
$router->post('/assessments/search',  'AssessmentsController::search');
$router->post('/assessments/detail',  'AssessmentsController::detail');
$router->post('/assessments/create',  'AssessmentsController::store');
$router->post('/assessments/update',  'AssessmentsController::modify');
$router->post('/assessments/confirm', 'AssessmentsController::confirm');

// Treatments
$router->post('/treatments/search', 'TreatmentsController::search');
$router->post('/treatments/detail', 'TreatmentsController::detail');
$router->post('/treatments/create', 'TreatmentsController::create');
$router->post('/treatments/update', 'TreatmentsController::modify');
// Vaccination
$router->post('/vaccination-schedules/search', 'VaccinationSchedulesController::search');
$router->post('/vaccination-schedules/detail', 'VaccinationSchedulesController::detail');
$router->post('/vaccination-schedules/create', 'VaccinationSchedulesController::store');
$router->post('/vaccination-schedules/update', 'VaccinationSchedulesController::modify');
$router->post('/vaccination-records/search', 'VaccinationRecordsController::search');
$router->post('/vaccination-records/detail', 'VaccinationRecordsController::detail');
$router->post('/vaccination-records/create', 'VaccinationRecordsController::store');
$router->post('/vaccination-records/update', 'VaccinationRecordsController::modify');
$router->post('/vaccination-reminders/search', 'VaccinationRemindersController::search');
$router->post('/vaccination-reminders/detail', 'VaccinationRemindersController::detail');

// Animal monitoring
$router->post('/monitoring/search', 'MonitoringController::search');
$router->post('/monitoring/detail', 'MonitoringController::detail');
$router->post('/monitoring/create', 'MonitoringController::store');
$router->post('/monitoring/update', 'MonitoringController::modify');

// Appointments
$router->post('/appointments/search', 'AppointmentsController::search');
$router->post('/appointments/detail', 'AppointmentsController::detail');
$router->post('/appointments/create', 'AppointmentsController::store');
$router->post('/appointments/update', 'AppointmentsController::modify');
$router->post('/appointments/reschedule', 'AppointmentsController::reschedule');
$router->post('/appointments/cancel', 'AppointmentsController::cancel');

// Inventory
$router->post('/inventory/search', 'InventoryController::search');
$router->post('/inventory/detail', 'InventoryController::detail');
$router->post('/inventory/create', 'InventoryController::store');
$router->post('/inventory/update', 'InventoryController::modify');
$router->post('/inventory/stock', 'InventoryController::stock');
$router->post('/inventory/history', 'InventoryController::history');

// Billing
$router->post('/billing/search', 'BillingController::search');
$router->post('/billing/detail', 'BillingController::detail');
$router->post('/billing/create', 'BillingController::store');
$router->post('/billing/update', 'BillingController::modify');
$router->post('/billing/pay', 'BillingController::pay');
$router->post('/billing/cancel', 'BillingController::cancel');

// Reports
$router->post('/reports/catalog', 'ReportsController::catalog');
$router->post('/reports/run', 'ReportsController::run');

// Chatbot reviews
$router->post('/chatreviews/search', 'ChatReviewsController::search');
$router->post('/chatreviews/detail', 'ChatReviewsController::detail');
$router->post('/chatreviews/transcript', 'ChatReviewsController::transcript');
$router->post('/chatreviews/review', 'ChatReviewsController::review');

// Users and permissions
$router->post('/users/search', 'UsersController::search');
$router->post('/users/detail', 'UsersController::detail');
$router->post('/users/create', 'UsersController::store');
$router->post('/users/update', 'UsersController::modify');
$router->post('/users/roles', 'UsersController::roles');
$router->post('/users/role-permissions', 'UsersController::role_permissions');
$router->post('/users/save-role-permissions', 'UsersController::save_role_permissions');
$router->post('/users/user-permissions', 'UsersController::user_permissions');
$router->post('/users/save-user-permissions', 'UsersController::save_user_permissions');

// Settings and activity log
$router->post('/settings/search', 'SettingsController::search');
$router->post('/settings/detail', 'SettingsController::detail');
$router->post('/settings/create', 'SettingsController::store');
$router->post('/settings/update', 'SettingsController::modify');
$router->post('/activity/search', 'ActivityController::search');
$router->post('/chat/start',      'ChatController::start');
$router->post('/chat/assessment', 'ChatController::assessment');
$router->post('/chat/retrieve',   'ChatController::retrieve');
$router->post('/chatreviews/photo', 'ChatReviewsController::photo');