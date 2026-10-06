-- Permission & role keuangan (sama dengan RolePermissionSeeder aplikasi Laravel).

INSERT INTO permissions (name, guard_name, created_at, updated_at) VALUES
    ('dashboard.view', 'web', NOW(), NOW()),
    ('clinics.view', 'web', NOW(), NOW()),
    ('guarantors.view', 'web', NOW(), NOW()),
    ('visits.view', 'web', NOW(), NOW()),
    ('service_tariffs.view', 'web', NOW(), NOW()),
    ('service_tariffs.create', 'web', NOW(), NOW()),
    ('service_tariffs.edit', 'web', NOW(), NOW()),
    ('service_tariffs.delete', 'web', NOW(), NOW()),
    ('bills.view', 'web', NOW(), NOW()),
    ('bills.create', 'web', NOW(), NOW()),
    ('bills.pay', 'web', NOW(), NOW()),
    ('payments.cancel', 'web', NOW(), NOW()),
    ('receivables.view', 'web', NOW(), NOW()),
    ('receivables.settle', 'web', NOW(), NOW()),
    ('cash_sessions.view', 'web', NOW(), NOW()),
    ('cash_sessions.create', 'web', NOW(), NOW()),
    ('cash_transactions.view', 'web', NOW(), NOW()),
    ('cash_transactions.create', 'web', NOW(), NOW()),
    ('cash_transactions.cancel', 'web', NOW(), NOW()),
    ('finance_reports.view', 'web', NOW(), NOW());

INSERT INTO roles (name, guard_name, created_at, updated_at) VALUES
    ('super-admin', 'web', NOW(), NOW()),
    ('keuangan', 'web', NOW(), NOW());

INSERT INTO role_has_permissions (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
JOIN roles r ON r.name = 'keuangan' AND r.guard_name = 'web'
WHERE p.guard_name = 'web'
  AND p.name IN (
    'dashboard.view', 'guarantors.view', 'visits.view',
    'service_tariffs.view', 'service_tariffs.create', 'service_tariffs.edit', 'service_tariffs.delete',
    'bills.view', 'bills.create', 'bills.pay', 'payments.cancel',
    'receivables.view', 'receivables.settle',
    'cash_sessions.view', 'cash_sessions.create',
    'cash_transactions.view', 'cash_transactions.create', 'cash_transactions.cancel',
    'finance_reports.view'
  );
