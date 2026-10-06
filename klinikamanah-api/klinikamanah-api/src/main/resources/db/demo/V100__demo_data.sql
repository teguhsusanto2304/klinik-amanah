-- Data contoh untuk mencoba API. Password semua user: "password".
--   kasir@klinik.id  -> role keuangan, Klinik Hasanah
--   kasir2@klinik.id -> role keuangan, Klinik Hasanah (untuk uji kepemilikan sesi kasir)
-- Kunjungan dibuat pada tanggal saat migration dijalankan (UTC).

INSERT INTO clinics (id, name, city, plan, is_active, created_at, updated_at) VALUES
    (1, 'Klinik Hasanah', 'Bandung', 'pro', 1, NOW(), NOW());

INSERT INTO users (id, clinic_id, name, email, phone, is_active, password, created_at, updated_at) VALUES
    (1, 1, 'Kasir Satu', 'kasir@klinik.id', '081200000001', 1, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NOW(), NOW()),
    (2, 1, 'Kasir Dua', 'kasir2@klinik.id', '081200000002', 1, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NOW(), NOW());

INSERT INTO model_has_roles (role_id, model_type, model_id)
SELECT r.id, 'App\\Models\\User', u.id
FROM roles r
JOIN users u ON u.id IN (1, 2)
WHERE r.name = 'keuangan';

INSERT INTO specialties (id, code, name, title, is_active, created_at, updated_at) VALUES
    (1, 'UMUM', 'Dokter Umum', 'dr.', 1, NOW(), NOW());

INSERT INTO polyclinics (id, specialty_id, code, name, is_active, created_at, updated_at) VALUES
    (1, 1, 'UMUM', 'Poli Umum', 1, NOW(), NOW());

INSERT INTO doctors (id, clinic_id, specialty_id, name, gender, license_number, is_active, created_at, updated_at) VALUES
    (1, 1, NULL, 'dr. Ratih', 'P', 'SIP-0001', 1, NOW(), NOW());

INSERT INTO patients (id, nik, name, birth_place, birth_date, gender, phone, created_at, updated_at) VALUES
    (1, '3273739673552650', 'Siti Aminah', 'Bandung', '2014-07-05', 'P', '085841057734', NOW(), NOW()),
    (2, '3273010101900001', 'Budi Santoso', 'Garut', '1990-01-01', 'L', '081311112222', NOW(), NOW());

INSERT INTO medical_records (id, clinic_id, patient_id, sequence, number, created_at, updated_at) VALUES
    (1, 1, 1, 1, 'RM-000001', NOW(), NOW()),
    (2, 1, 2, 2, 'RM-000002', NOW(), NOW());

INSERT INTO guarantors (id, clinic_id, code, name, type, is_active, created_at, updated_at) VALUES
    (1, 1, 'ASR-SHT', 'Asuransi Sehat', 'insurance', 1, NOW(), NOW());

INSERT INTO visits (id, clinic_id, medical_record_id, doctor_id, polyclinic_id, payment_type, guarantor_id, guarantor_member_number, visit_date, queue_number, complaint, status, created_at, updated_at) VALUES
    (1, 1, 1, 1, 1, 'self', NULL, NULL, CURRENT_DATE, 1, 'Demam tiga hari', 'registered', NOW(), NOW()),
    (2, 1, 2, 1, 1, 'guarantor', 1, 'AS-778899', CURRENT_DATE, 2, 'Luka sobek di tangan', 'registered', NOW(), NOW());

INSERT INTO service_tariffs (id, clinic_id, code, name, category, price, is_active, created_at, updated_at) VALUES
    (1, 1, 'KONS-UMUM', 'Konsultasi Dokter Umum', 'consultation', 50000, 1, NOW(), NOW()),
    (2, 1, 'ADM', 'Administrasi Pendaftaran', 'administration', 25000, 1, NOW(), NOW()),
    (3, 1, 'JAHIT', 'Jahit luka', 'procedure', 75000, 1, NOW(), NOW()),
    (4, 1, 'INJ', 'Injeksi', 'nursing', 15000, 1, NOW(), NOW()),
    (5, 1, 'LAMA', 'Tarif nonaktif', 'other', 1000, 0, NOW(), NOW());

-- Tindakan medis & keperawatan yang akan masuk otomatis ke tagihan kunjungan 2.
INSERT INTO medical_actions (clinic_id, visit_id, service_tariff_id, user_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (1, 2, 3, NULL, NOW(), 'Jahit luka', 1, 75000, 75000, NOW(), NOW());

INSERT INTO nursing_actions (clinic_id, visit_id, service_tariff_id, user_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (1, 2, 4, NULL, NOW(), 'Injeksi', 1, 15000, 15000, NOW(), NOW());
