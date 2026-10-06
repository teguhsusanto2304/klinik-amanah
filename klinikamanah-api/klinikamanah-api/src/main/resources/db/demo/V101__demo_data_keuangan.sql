-- Data contoh tambahan agar demo aplikasi mobile terlihat lengkap: kunjungan hari ini dengan berbagai status
-- tagihan, riwayat tagihan & pembayaran dua hari terakhir, sesi kasir (berjalan dan ditutup), serta transaksi kas.
-- Tanggal relatif terhadap saat migration dijalankan (UTC): hari ini, kemarin (H-1) dan dua hari lalu (H-2).
--
-- Ringkasan kunjungan hari ini (tanggal default daftar tagihan):
--   1, 2, 7  -> belum ditagih (2 dan 7 sudah punya tindakan/obat yang otomatis masuk tagihan)
--   3        -> tagihan draft, siap dibayar
--   4, 5     -> lunas (tunai; QRIS + tunai)
--   6        -> piutang PT Maju Bersama
--   8        -> tagihan draft dengan pembayaran yang dibatalkan
-- kasir@klinik.id memiliki sesi kasir yang sedang berjalan hari ini; kasir2@klinik.id tidak.
--
-- Nomor dokumen keuangan (INV, BYR, KSR, KM, KK) melanjutkan nomor terakhir pada bulannya,
-- sehingga aman dijalankan pada database yang sudah dipakai mencoba aplikasi.

SET @d0 = CURRENT_DATE;
SET @d1 = @d0 - INTERVAL 1 DAY;
SET @d2 = @d0 - INTERVAL 2 DAY;
SET @t0 = GREATEST(TIMESTAMP(@d0), NOW() - INTERVAL 3 HOUR);
SET @p1 = LEAST(NOW(), @t0 + INTERVAL 20 MINUTE);
SET @p2 = LEAST(NOW(), @t0 + INTERVAL 40 MINUTE);
SET @p3 = LEAST(NOW(), @t0 + INTERVAL 60 MINUTE);
SET @p4 = LEAST(NOW(), @t0 + INTERVAL 80 MINUTE);
SET @p5 = LEAST(NOW(), @t0 + INTERVAL 100 MINUTE);

-- Nomor dokumen berikutnya pada tabel & tanggal tertentu (format sama dengan DocumentNumbers), hasil di @no.
DROP PROCEDURE IF EXISTS demo_next_number;

DELIMITER $$
CREATE PROCEDURE demo_next_number(IN tbl VARCHAR(64), IN prefix VARCHAR(10), IN doc_date DATE)
BEGIN
    SET @np = CONCAT(prefix, '-', DATE_FORMAT(doc_date, '%y%m'), '-');
    SET @np_like = CONCAT(@np, '%');
    SET @sql = CONCAT('SELECT CONCAT(?, LPAD(COALESCE(MAX(CAST(RIGHT(number, 4) AS UNSIGNED)), 0) + 1, 4, ''0'')) INTO @no FROM ',
                      tbl, ' WHERE clinic_id = 1 AND number LIKE ?');
    PREPARE stmt FROM @sql;
    EXECUTE stmt USING @np, @np_like;
    DEALLOCATE PREPARE stmt;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------------------------------------------------
-- Master
-- ---------------------------------------------------------------------------------------------------------------

INSERT INTO specialties (id, code, name, title, is_active, created_at, updated_at) VALUES
    (2, 'GIGI', 'Dokter Gigi', 'drg.', 1, NOW(), NOW());

INSERT INTO polyclinics (id, specialty_id, code, name, is_active, created_at, updated_at) VALUES
    (2, 2, 'GIGI', 'Poli Gigi', 1, NOW(), NOW());

INSERT INTO doctors (id, clinic_id, specialty_id, name, gender, license_number, phone, is_active, created_at, updated_at) VALUES
    (2, 1, 1, 'dr. Andi Pratama', 'L', 'SIP-0002', '081300000002', 1, NOW(), NOW()),
    (3, 1, 2, 'drg. Maya Sari', 'P', 'SIP-0003', '081300000003', 1, NOW(), NOW());

INSERT INTO guarantors (id, clinic_id, code, name, type, contact_person, phone, email, address, cooperation_starts_at, cooperation_ends_at, is_active, created_at, updated_at) VALUES
    (2, 1, 'PRS-MJB', 'PT Maju Bersama', 'company', 'Wulan (HRD)', '0227301234', 'hrd@majubersama.co.id',
     'Jl. Soekarno-Hatta No. 120, Bandung', @d0 - INTERVAL 6 MONTH, @d0 + INTERVAL 6 MONTH, 1, NOW(), NOW());

INSERT INTO service_tariffs (id, clinic_id, code, name, category, price, is_active, created_at, updated_at) VALUES
    (6, 1, 'KONS-GIGI', 'Konsultasi Dokter Gigi', 'consultation', 75000, 1, NOW(), NOW()),
    (7, 1, 'CABUT', 'Cabut gigi', 'procedure', 150000, 1, NOW(), NOW()),
    (8, 1, 'LAB-DL', 'Darah Lengkap', 'laboratory', 85000, 1, NOW(), NOW()),
    (9, 1, 'LAB-GDS', 'Gula Darah Sewaktu', 'laboratory', 30000, 1, NOW(), NOW()),
    (10, 1, 'NEBU', 'Nebulizer', 'nursing', 50000, 1, NOW(), NOW()),
    (11, 1, 'RO-THORAX', 'Rontgen Thorax', 'radiology', 150000, 1, NOW(), NOW()),
    (12, 1, 'SCALING', 'Scaling gigi', 'procedure', 200000, 1, NOW(), NOW()),
    (13, 1, 'RAWAT-LUKA', 'Perawatan luka', 'nursing', 40000, 1, NOW(), NOW()),
    (14, 1, 'TAMBAL', 'Tambal gigi komposit', 'procedure', 175000, 1, NOW(), NOW()),
    (15, 1, 'FISIO', 'Fisioterapi per sesi', 'physiotherapy', 100000, 1, NOW(), NOW());

INSERT INTO patients (id, nik, name, birth_place, birth_date, gender, phone, address, occupation, created_at, updated_at) VALUES
    (3, '3273011203850003', 'Ahmad Fauzi', 'Bandung', '1985-03-12', 'L', '081322334401', 'Jl. Cihampelas No. 21, Bandung', 'Karyawan Swasta', NOW(), NOW()),
    (4, '3277016108920004', 'Dewi Lestari', 'Cimahi', '1992-08-21', 'P', '081322334402', 'Jl. Gatot Subroto No. 5, Cimahi', 'Guru', NOW(), NOW()),
    (5, '3211010211780005', 'Rudi Hartono', 'Sumedang', '1978-11-02', 'L', '081322334403', 'Jl. Prabu Geusan Ulun No. 9, Sumedang', 'Wiraswasta', NOW(), NOW()),
    (6, '3273015705010006', 'Nur Halimah', 'Bandung', '2001-05-17', 'P', '081322334404', 'Jl. Dago No. 88, Bandung', 'Karyawan Swasta', NOW(), NOW()),
    (7, '3206013009690007', 'Agus Setiawan', 'Tasikmalaya', '1969-09-30', 'L', '081322334405', 'Jl. HZ Mustofa No. 14, Tasikmalaya', 'Pedagang', NOW(), NOW()),
    (8, '3273014812950008', 'Rina Marlina', 'Bandung', '1995-12-08', 'P', '081322334406', 'Jl. Buah Batu No. 101, Bandung', 'Perawat', NOW(), NOW()),
    (9, '3273011402180009', 'Yusuf Maulana', 'Bandung', '2018-02-14', 'L', '081322334407', 'Jl. Kopo No. 45, Bandung', 'Pelajar', NOW(), NOW()),
    (10, '3205016506880010', 'Fitri Handayani', 'Garut', '1988-06-25', 'P', '081322334408', 'Jl. Ciledug No. 7, Garut', 'Pegawai Negeri', NOW(), NOW()),
    (11, '3203011901750011', 'Hendra Gunawan', 'Cianjur', '1975-01-19', 'L', '081322334409', 'Jl. Siliwangi No. 30, Cianjur', 'Sopir', NOW(), NOW()),
    (12, '3273014310990012', 'Lina Kusuma', 'Bandung', '1999-10-03', 'P', '081322334410', 'Jl. Riau No. 12, Bandung', 'Mahasiswa', NOW(), NOW());

INSERT INTO medical_records (id, clinic_id, patient_id, sequence, number, created_at, updated_at) VALUES
    (3, 1, 3, 3, 'RM-000003', NOW(), NOW()),
    (4, 1, 4, 4, 'RM-000004', NOW(), NOW()),
    (5, 1, 5, 5, 'RM-000005', NOW(), NOW()),
    (6, 1, 6, 6, 'RM-000006', NOW(), NOW()),
    (7, 1, 7, 7, 'RM-000007', NOW(), NOW()),
    (8, 1, 8, 8, 'RM-000008', NOW(), NOW()),
    (9, 1, 9, 9, 'RM-000009', NOW(), NOW()),
    (10, 1, 10, 10, 'RM-000010', NOW(), NOW()),
    (11, 1, 11, 11, 'RM-000011', NOW(), NOW()),
    (12, 1, 12, 12, 'RM-000012', NOW(), NOW());

-- ---------------------------------------------------------------------------------------------------------------
-- Kunjungan: 3-8 hari ini, 9-12 kemarin, 13-15 dua hari lalu
-- ---------------------------------------------------------------------------------------------------------------

INSERT INTO visits (id, clinic_id, medical_record_id, doctor_id, polyclinic_id, payment_type, guarantor_id, guarantor_member_number, visit_date, queue_number, complaint, status, created_at, updated_at) VALUES
    (3, 1, 3, 1, 1, 'self', NULL, NULL, @d0, 3, 'Batuk pilek dan demam dua hari', 'registered', @t0, @t0),
    (4, 1, 4, 1, 1, 'self', NULL, NULL, @d0, 4, 'Pusing dan mual sejak pagi', 'registered', @t0, @t0),
    (5, 1, 5, 2, 1, 'self', NULL, NULL, @d0, 1, 'Kontrol gula darah', 'registered', @t0, @t0),
    (6, 1, 6, 2, 1, 'guarantor', 2, 'MJB-0457', @d0, 2, 'Sesak napas', 'registered', @t0, @t0),
    (7, 1, 7, 3, 2, 'self', NULL, NULL, @d0, 1, 'Gigi geraham berlubang', 'registered', @t0, @t0),
    (8, 1, 8, 3, 2, 'self', NULL, NULL, @d0, 2, 'Gigi goyang dan nyeri', 'registered', @t0, @t0),
    (9, 1, 9, 1, 1, 'self', NULL, NULL, @d1, 1, 'Demam dan batuk', 'registered', TIMESTAMP(@d1) + INTERVAL 60 MINUTE, TIMESTAMP(@d1) + INTERVAL 60 MINUTE),
    (10, 1, 10, 1, 1, 'guarantor', 1, 'AS-551204', @d1, 2, 'Nyeri dada dan batuk lama', 'registered', TIMESTAMP(@d1) + INTERVAL 70 MINUTE, TIMESTAMP(@d1) + INTERVAL 70 MINUTE),
    (11, 1, 11, 2, 1, 'self', NULL, NULL, @d1, 1, 'Asma kambuh', 'registered', TIMESTAMP(@d1) + INTERVAL 90 MINUTE, TIMESTAMP(@d1) + INTERVAL 90 MINUTE),
    (12, 1, 1, 3, 2, 'self', NULL, NULL, @d1, 1, 'Karang gigi dan gusi berdarah', 'registered', TIMESTAMP(@d1) + INTERVAL 150 MINUTE, TIMESTAMP(@d1) + INTERVAL 150 MINUTE),
    (13, 1, 2, 1, 1, 'guarantor', 1, 'AS-778899', @d2, 1, 'Kontrol luka jahitan, badan lemas', 'registered', TIMESTAMP(@d2) + INTERVAL 60 MINUTE, TIMESTAMP(@d2) + INTERVAL 60 MINUTE),
    (14, 1, 12, 2, 1, 'self', NULL, NULL, @d2, 1, 'Lemas dan sering haus', 'registered', TIMESTAMP(@d2) + INTERVAL 75 MINUTE, TIMESTAMP(@d2) + INTERVAL 75 MINUTE),
    (15, 1, 3, 1, 1, 'self', NULL, NULL, @d2, 2, 'Luka robek di kaki karena terjatuh', 'registered', TIMESTAMP(@d2) + INTERVAL 90 MINUTE, TIMESTAMP(@d2) + INTERVAL 90 MINUTE);

-- ---------------------------------------------------------------------------------------------------------------
-- Biaya kunjungan dari modul klinis (tindakan, laboratorium, farmasi)
-- ---------------------------------------------------------------------------------------------------------------

INSERT INTO medical_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 15, 3, TIMESTAMP(@d2) + INTERVAL 120 MINUTE, 'Jahit luka', 1, 75000, 75000, NOW(), NOW());
SET @ma15 = LAST_INSERT_ID();

INSERT INTO medical_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 12, 12, TIMESTAMP(@d1) + INTERVAL 180 MINUTE, 'Scaling gigi', 1, 200000, 200000, NOW(), NOW());
SET @ma12 = LAST_INSERT_ID();

INSERT INTO medical_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 7, 14, @t0, 'Tambal gigi komposit', 1, 175000, 175000, NOW(), NOW());

INSERT INTO medical_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 8, 7, @t0, 'Cabut gigi', 1, 150000, 150000, NOW(), NOW());
SET @ma8 = LAST_INSERT_ID();

INSERT INTO nursing_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 15, 13, TIMESTAMP(@d2) + INTERVAL 125 MINUTE, 'Perawatan luka', 1, 40000, 40000, NOW(), NOW());
SET @na15 = LAST_INSERT_ID();

INSERT INTO nursing_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 9, 4, TIMESTAMP(@d1) + INTERVAL 90 MINUTE, 'Injeksi', 1, 15000, 15000, NOW(), NOW());
SET @na9 = LAST_INSERT_ID();

INSERT INTO nursing_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 11, 10, TIMESTAMP(@d1) + INTERVAL 120 MINUTE, 'Nebulizer', 1, 50000, 50000, NOW(), NOW());
SET @na11 = LAST_INSERT_ID();

INSERT INTO nursing_actions (clinic_id, visit_id, service_tariff_id, performed_at, description, quantity, unit_price, subtotal, created_at, updated_at)
VALUES (1, 6, 10, @t0, 'Nebulizer', 1, 50000, 50000, NOW(), NOW());
SET @na6 = LAST_INSERT_ID();

-- Laboratorium
SET @lab13 = CONCAT('LAB-', DATE_FORMAT(@d2, '%y%m'), '-0001');
INSERT INTO lab_orders (clinic_id, visit_id, number, priority, status, requested_at, completed_at, total_price, created_at, updated_at)
VALUES (1, 13, @lab13, 'routine', 'completed', TIMESTAMP(@d2) + INTERVAL 80 MINUTE, TIMESTAMP(@d2) + INTERVAL 140 MINUTE, 85000, NOW(), NOW());
INSERT INTO lab_order_items (lab_order_id, service_tariff_id, test_name, section, unit_price, quantity, total_price, status, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 8, 'Darah Lengkap', 'hematology', 85000, 1, 85000, 'completed', NOW(), NOW());
SET @li13 = LAST_INSERT_ID();

SET @lab14 = CONCAT('LAB-', DATE_FORMAT(@d2, '%y%m'), '-0002');
INSERT INTO lab_orders (clinic_id, visit_id, number, priority, status, requested_at, completed_at, total_price, created_at, updated_at)
VALUES (1, 14, @lab14, 'routine', 'completed', TIMESTAMP(@d2) + INTERVAL 95 MINUTE, TIMESTAMP(@d2) + INTERVAL 125 MINUTE, 30000, NOW(), NOW());
INSERT INTO lab_order_items (lab_order_id, service_tariff_id, test_name, section, unit_price, quantity, total_price, status, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 9, 'Gula Darah Sewaktu', 'chemistry', 30000, 1, 30000, 'completed', NOW(), NOW());
SET @li14 = LAST_INSERT_ID();

SET @lab10 = CONCAT('LAB-', DATE_FORMAT(@d1, '%y%m'), '-0003');
INSERT INTO lab_orders (clinic_id, visit_id, number, priority, status, requested_at, completed_at, total_price, created_at, updated_at)
VALUES (1, 10, @lab10, 'routine', 'completed', TIMESTAMP(@d1) + INTERVAL 90 MINUTE, TIMESTAMP(@d1) + INTERVAL 150 MINUTE, 85000, NOW(), NOW());
INSERT INTO lab_order_items (lab_order_id, service_tariff_id, test_name, section, unit_price, quantity, total_price, status, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 8, 'Darah Lengkap', 'hematology', 85000, 1, 85000, 'completed', NOW(), NOW());
SET @li10 = LAST_INSERT_ID();

SET @lab5 = CONCAT('LAB-', DATE_FORMAT(@d0, '%y%m'), '-0004');
INSERT INTO lab_orders (clinic_id, visit_id, number, priority, status, requested_at, completed_at, total_price, created_at, updated_at)
VALUES (1, 5, @lab5, 'routine', 'completed', @t0, @t0, 115000, NOW(), NOW());
SET @lo5 = LAST_INSERT_ID();
INSERT INTO lab_order_items (lab_order_id, service_tariff_id, test_name, section, unit_price, quantity, total_price, status, created_at, updated_at)
VALUES (@lo5, 9, 'Gula Darah Sewaktu', 'chemistry', 30000, 1, 30000, 'completed', NOW(), NOW());
SET @li5a = LAST_INSERT_ID();
INSERT INTO lab_order_items (lab_order_id, service_tariff_id, test_name, section, unit_price, quantity, total_price, status, created_at, updated_at)
VALUES (@lo5, 8, 'Darah Lengkap', 'hematology', 85000, 1, 85000, 'completed', NOW(), NOW());
SET @li5b = LAST_INSERT_ID();

SET @lab3 = CONCAT('LAB-', DATE_FORMAT(@d0, '%y%m'), '-0005');
INSERT INTO lab_orders (clinic_id, visit_id, number, priority, status, requested_at, completed_at, total_price, created_at, updated_at)
VALUES (1, 3, @lab3, 'routine', 'completed', @t0, @t0, 30000, NOW(), NOW());
INSERT INTO lab_order_items (lab_order_id, service_tariff_id, test_name, section, unit_price, quantity, total_price, status, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 9, 'Gula Darah Sewaktu', 'chemistry', 30000, 1, 30000, 'completed', NOW(), NOW());
SET @li3 = LAST_INSERT_ID();

-- Farmasi (hanya penjualan berstatus completed yang ditagihkan)
SET @frm13 = CONCAT('FRM-', DATE_FORMAT(@d2, '%y%m'), '-0001');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 13, @frm13, @d2, 'completed', 60000, 0, 60000, NOW(), NOW());
SET @ps13 = LAST_INSERT_ID();

SET @frm14 = CONCAT('FRM-', DATE_FORMAT(@d2, '%y%m'), '-0002');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 14, @frm14, @d2, 'completed', 45000, 0, 45000, NOW(), NOW());
SET @ps14 = LAST_INSERT_ID();

SET @frm9 = CONCAT('FRM-', DATE_FORMAT(@d1, '%y%m'), '-0003');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 9, @frm9, @d1, 'completed', 25000, 10000, 35000, NOW(), NOW());
SET @ps9 = LAST_INSERT_ID();

SET @frm11 = CONCAT('FRM-', DATE_FORMAT(@d1, '%y%m'), '-0004');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 11, @frm11, @d1, 'completed', 55000, 0, 55000, NOW(), NOW());
SET @ps11 = LAST_INSERT_ID();

SET @frm4 = CONCAT('FRM-', DATE_FORMAT(@d0, '%y%m'), '-0005');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 4, @frm4, @d0, 'completed', 40000, 0, 40000, NOW(), NOW());
SET @ps4 = LAST_INSERT_ID();

SET @frm5 = CONCAT('FRM-', DATE_FORMAT(@d0, '%y%m'), '-0006');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 5, @frm5, @d0, 'completed', 75000, 0, 75000, NOW(), NOW());
SET @ps5 = LAST_INSERT_ID();

SET @frm6 = CONCAT('FRM-', DATE_FORMAT(@d0, '%y%m'), '-0007');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 6, @frm6, @d0, 'completed', 30000, 0, 30000, NOW(), NOW());
SET @ps6 = LAST_INSERT_ID();

SET @frm3 = CONCAT('FRM-', DATE_FORMAT(@d0, '%y%m'), '-0008');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 3, @frm3, @d0, 'completed', 25000, 0, 25000, NOW(), NOW());
SET @ps3 = LAST_INSERT_ID();

SET @frm7 = CONCAT('FRM-', DATE_FORMAT(@d0, '%y%m'), '-0009');
INSERT INTO pharmacy_sales (clinic_id, visit_id, number, sale_date, status, items_total, compounding_fee, total, created_at, updated_at)
VALUES (1, 7, @frm7, @d0, 'completed', 35000, 0, 35000, NOW(), NOW());

-- ---------------------------------------------------------------------------------------------------------------
-- Sesi kasir
--   S1 kasir 1, H-2, ditutup tanpa selisih      S2 kasir 1, H-1, ditutup dengan selisih kurang Rp5.000
--   S3 kasir 2, H-1, ditutup tanpa selisih      S4 kasir 1, hari ini, masih berjalan
-- Kas seharusnya = saldo awal + tunai pembayaran (setelah kembalian) + kas masuk tunai - kas keluar tunai.
-- ---------------------------------------------------------------------------------------------------------------

CALL demo_next_number('cash_sessions', 'KSR', @d2);
INSERT INTO cash_sessions (clinic_id, user_id, number, status, opened_at, opening_balance, opening_notes, closed_at, expected_cash, counted_cash, difference, closing_notes, created_at, updated_at)
VALUES (1, 1, @no, 'closed', TIMESTAMP(@d2) + INTERVAL 60 MINUTE, 500000, 'Modal kasir pagi',
        TIMESTAMP(@d2) + INTERVAL 600 MINUTE, 615000, 615000, 0, 'Kas sesuai', TIMESTAMP(@d2) + INTERVAL 60 MINUTE, TIMESTAMP(@d2) + INTERVAL 600 MINUTE);
SET @s1 = LAST_INSERT_ID();

CALL demo_next_number('cash_sessions', 'KSR', @d1);
INSERT INTO cash_sessions (clinic_id, user_id, number, status, opened_at, opening_balance, opening_notes, closed_at, expected_cash, counted_cash, difference, closing_notes, created_at, updated_at)
VALUES (1, 1, @no, 'closed', TIMESTAMP(@d1) + INTERVAL 60 MINUTE, 500000, 'Modal kasir pagi',
        TIMESTAMP(@d1) + INTERVAL 600 MINUTE, 585000, 580000, -5000, 'Selisih kurang Rp5.000, sudah dilaporkan ke supervisor', TIMESTAMP(@d1) + INTERVAL 60 MINUTE, TIMESTAMP(@d1) + INTERVAL 600 MINUTE);
SET @s2 = LAST_INSERT_ID();

CALL demo_next_number('cash_sessions', 'KSR', @d1);
INSERT INTO cash_sessions (clinic_id, user_id, number, status, opened_at, opening_balance, opening_notes, closed_at, expected_cash, counted_cash, difference, closing_notes, created_at, updated_at)
VALUES (1, 2, @no, 'closed', TIMESTAMP(@d1) + INTERVAL 90 MINUTE, 300000, 'Kasir shift kedua',
        TIMESTAMP(@d1) + INTERVAL 600 MINUTE, 550000, 550000, 0, NULL, TIMESTAMP(@d1) + INTERVAL 90 MINUTE, TIMESTAMP(@d1) + INTERVAL 600 MINUTE);
SET @s3 = LAST_INSERT_ID();

CALL demo_next_number('cash_sessions', 'KSR', @d0);
INSERT INTO cash_sessions (clinic_id, user_id, number, status, opened_at, opening_balance, opening_notes, created_at, updated_at)
VALUES (1, 1, @no, 'open', @t0, 500000, 'Modal kasir pagi', @t0, @t0);
SET @s4 = LAST_INSERT_ID();

-- ---------------------------------------------------------------------------------------------------------------
-- Tagihan & pembayaran H-2
-- ---------------------------------------------------------------------------------------------------------------

-- Kunjungan 13 (penjamin Asuransi Sehat): piutang H-2, dilunasi transfer pada H-1. Total 75.000 + 85.000 + 60.000.
CALL demo_next_number('bills', 'INV', @d2);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 13, 1, 1, @no, @d2, 'guarantor', 'paid', 75000, 0, 0, 85000, 60000, 0, 220000, 220000, NULL,
        TIMESTAMP(@d2) + INTERVAL 180 MINUTE, TIMESTAMP(@d2) + INTERVAL 150 MINUTE, TIMESTAMP(@d1) + INTERVAL 360 MINUTE);
SET @b13 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, pharmacy_sale_id, lab_order_item_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b13, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b13, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b13, 8, NULL, @li13, CONCAT('Laboratorium: Darah Lengkap (', @lab13, ')'), 1, 85000, 85000, NOW(), NOW()),
    (@b13, NULL, @ps13, NULL, CONCAT('Obat & alkes farmasi (', @frm13, ')'), 1, 60000, 60000, NOW(), NOW());

-- Kunjungan 14: lunas tunai di S1. Total 75.000 + 30.000 + 45.000 = 150.000, dibayar 200.000, kembali 50.000.
CALL demo_next_number('bills', 'INV', @d2);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 14, NULL, 1, @no, @d2, 'self', 'paid', 75000, 0, 0, 30000, 45000, 0, 150000, 150000, NULL,
        TIMESTAMP(@d2) + INTERVAL 150 MINUTE, TIMESTAMP(@d2) + INTERVAL 140 MINUTE, TIMESTAMP(@d2) + INTERVAL 150 MINUTE);
SET @b14 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, pharmacy_sale_id, lab_order_item_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b14, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b14, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b14, 9, NULL, @li14, CONCAT('Laboratorium: Gula Darah Sewaktu (', @lab14, ')'), 1, 30000, 30000, NOW(), NOW()),
    (@b14, NULL, @ps14, NULL, CONCAT('Obat & alkes farmasi (', @frm14, ')'), 1, 45000, 45000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d2);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, created_at, updated_at)
VALUES (1, @b14, @s1, 1, @no, 'self', 'completed', TIMESTAMP(@d2) + INTERVAL 150 MINUTE, 150000, 200000, 50000, TIMESTAMP(@d2) + INTERVAL 150 MINUTE, TIMESTAMP(@d2) + INTERVAL 150 MINUTE);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'cash', 200000, NULL, NOW(), NOW());

-- Kunjungan 15: lunas transfer di S1. Total 75.000 + 75.000 (jahit) + 40.000 (rawat luka) = 190.000.
CALL demo_next_number('bills', 'INV', @d2);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 15, NULL, 1, @no, @d2, 'self', 'paid', 75000, 75000, 40000, 0, 0, 0, 190000, 190000, NULL,
        TIMESTAMP(@d2) + INTERVAL 195 MINUTE, TIMESTAMP(@d2) + INTERVAL 190 MINUTE, TIMESTAMP(@d2) + INTERVAL 195 MINUTE);
SET @b15 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, medical_action_id, nursing_action_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b15, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b15, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b15, 3, @ma15, NULL, 'Tindakan medis: Jahit luka', 1, 75000, 75000, NOW(), NOW()),
    (@b15, 13, NULL, @na15, 'Tindakan keperawatan: Perawatan luka', 1, 40000, 40000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d2);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, created_at, updated_at)
VALUES (1, @b15, @s1, 1, @no, 'self', 'completed', TIMESTAMP(@d2) + INTERVAL 195 MINUTE, 190000, 190000, 0, TIMESTAMP(@d2) + INTERVAL 195 MINUTE, TIMESTAMP(@d2) + INTERVAL 195 MINUTE);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'transfer', 190000, 'BCA 0412-8871', NOW(), NOW());

-- ---------------------------------------------------------------------------------------------------------------
-- Tagihan & pembayaran H-1
-- ---------------------------------------------------------------------------------------------------------------

-- Kunjungan 9: lunas tunai di S2. Total 75.000 + 15.000 (injeksi) + 35.000 (farmasi) = 125.000, dibayar 150.000.
CALL demo_next_number('bills', 'INV', @d1);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 9, NULL, 1, @no, @d1, 'self', 'paid', 75000, 0, 15000, 0, 35000, 0, 125000, 125000, NULL,
        TIMESTAMP(@d1) + INTERVAL 120 MINUTE, TIMESTAMP(@d1) + INTERVAL 110 MINUTE, TIMESTAMP(@d1) + INTERVAL 120 MINUTE);
SET @b9 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, nursing_action_id, pharmacy_sale_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b9, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b9, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b9, 4, @na9, NULL, 'Tindakan keperawatan: Injeksi', 1, 15000, 15000, NOW(), NOW()),
    (@b9, NULL, NULL, @ps9, CONCAT('Obat & alkes farmasi (', @frm9, ')'), 1, 35000, 35000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d1);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, created_at, updated_at)
VALUES (1, @b9, @s2, 1, @no, 'self', 'completed', TIMESTAMP(@d1) + INTERVAL 120 MINUTE, 125000, 150000, 25000, TIMESTAMP(@d1) + INTERVAL 120 MINUTE, TIMESTAMP(@d1) + INTERVAL 120 MINUTE);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'cash', 150000, NULL, NOW(), NOW());

-- Kunjungan 10 (penjamin Asuransi Sehat): piutang 310.000, baru dibayar sebagian hari ini.
CALL demo_next_number('bills', 'INV', @d1);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 10, 1, 1, @no, @d1, 'guarantor', 'receivable', 225000, 0, 0, 85000, 0, 0, 310000, 100000, 'Klaim dikirim ke Asuransi Sehat',
        TIMESTAMP(@d1) + INTERVAL 180 MINUTE, TIMESTAMP(@d1) + INTERVAL 160 MINUTE, @p3);
SET @b10 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, lab_order_item_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b10, 1, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b10, 2, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b10, 11, NULL, 'Rontgen Thorax', 1, 150000, 150000, NOW(), NOW()),
    (@b10, 8, @li10, CONCAT('Laboratorium: Darah Lengkap (', @lab10, ')'), 1, 85000, 85000, NOW(), NOW());

-- Kunjungan 11: lunas kartu debit di S3 (kasir 2). Total 75.000 + 50.000 (nebulizer) + 55.000 (farmasi) = 180.000.
CALL demo_next_number('bills', 'INV', @d1);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 11, NULL, 2, @no, @d1, 'self', 'paid', 75000, 0, 50000, 0, 55000, 0, 180000, 180000, NULL,
        TIMESTAMP(@d1) + INTERVAL 210 MINUTE, TIMESTAMP(@d1) + INTERVAL 200 MINUTE, TIMESTAMP(@d1) + INTERVAL 210 MINUTE);
SET @b11 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, nursing_action_id, pharmacy_sale_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b11, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b11, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b11, 10, @na11, NULL, 'Tindakan keperawatan: Nebulizer', 1, 50000, 50000, NOW(), NOW()),
    (@b11, NULL, NULL, @ps11, CONCAT('Obat & alkes farmasi (', @frm11, ')'), 1, 55000, 55000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d1);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, created_at, updated_at)
VALUES (1, @b11, @s3, 2, @no, 'self', 'completed', TIMESTAMP(@d1) + INTERVAL 210 MINUTE, 180000, 180000, 0, TIMESTAMP(@d1) + INTERVAL 210 MINUTE, TIMESTAMP(@d1) + INTERVAL 210 MINUTE);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'debit_card', 180000, 'EDC 883421', NOW(), NOW());

-- Kunjungan 12 (poli gigi): lunas tunai di S3 dengan diskon. 100.000 + 200.000 (scaling) - 25.000 = 275.000, dibayar 300.000.
CALL demo_next_number('bills', 'INV', @d1);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 12, NULL, 2, @no, @d1, 'self', 'paid', 100000, 200000, 0, 0, 0, 25000, 275000, 275000, 'Diskon pasien lama',
        TIMESTAMP(@d1) + INTERVAL 300 MINUTE, TIMESTAMP(@d1) + INTERVAL 290 MINUTE, TIMESTAMP(@d1) + INTERVAL 300 MINUTE);
SET @b12 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, medical_action_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b12, 6, NULL, 'Konsultasi Dokter Gigi', 1, 75000, 75000, NOW(), NOW()),
    (@b12, 2, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b12, 12, @ma12, 'Tindakan medis: Scaling gigi', 1, 200000, 200000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d1);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, created_at, updated_at)
VALUES (1, @b12, @s3, 2, @no, 'self', 'completed', TIMESTAMP(@d1) + INTERVAL 300 MINUTE, 275000, 300000, 25000, TIMESTAMP(@d1) + INTERVAL 300 MINUTE, TIMESTAMP(@d1) + INTERVAL 300 MINUTE);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'cash', 300000, NULL, NOW(), NOW());

-- Pelunasan piutang kunjungan 13 oleh Asuransi Sehat (transfer) di S2.
CALL demo_next_number('payments', 'BYR', @d1);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, notes, created_at, updated_at)
VALUES (1, @b13, @s2, 1, @no, 'guarantor', 'completed', TIMESTAMP(@d1) + INTERVAL 360 MINUTE, 220000, 220000, 0, 'Pelunasan klaim Asuransi Sehat',
        TIMESTAMP(@d1) + INTERVAL 360 MINUTE, TIMESTAMP(@d1) + INTERVAL 360 MINUTE);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'transfer', 220000, 'Mandiri CLM-2207', NOW(), NOW());

-- ---------------------------------------------------------------------------------------------------------------
-- Tagihan & pembayaran hari ini (sesi S4 kasir 1 masih berjalan)
-- ---------------------------------------------------------------------------------------------------------------

-- Kunjungan 4: lunas tunai. 75.000 + 40.000 (farmasi) = 115.000, dibayar 120.000.
CALL demo_next_number('bills', 'INV', @d0);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 4, NULL, 1, @no, @d0, 'self', 'paid', 75000, 0, 0, 0, 40000, 0, 115000, 115000, NULL, @p1, @t0, @p1);
SET @b4 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, pharmacy_sale_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b4, 1, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b4, 2, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b4, NULL, @ps4, CONCAT('Obat & alkes farmasi (', @frm4, ')'), 1, 40000, 40000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d0);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, created_at, updated_at)
VALUES (1, @b4, @s4, 1, @no, 'self', 'completed', @p1, 115000, 120000, 5000, @p1, @p1);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'cash', 120000, NULL, NOW(), NOW());

-- Kunjungan 5: lunas QRIS + tunai. 75.000 + 115.000 (lab) + 75.000 (farmasi) = 265.000, dibayar 270.000.
CALL demo_next_number('bills', 'INV', @d0);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 5, NULL, 1, @no, @d0, 'self', 'paid', 75000, 0, 0, 115000, 75000, 0, 265000, 265000, NULL, @p2, @t0, @p2);
SET @b5 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, lab_order_item_id, pharmacy_sale_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b5, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b5, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b5, 9, @li5a, NULL, CONCAT('Laboratorium: Gula Darah Sewaktu (', @lab5, ')'), 1, 30000, 30000, NOW(), NOW()),
    (@b5, 8, @li5b, NULL, CONCAT('Laboratorium: Darah Lengkap (', @lab5, ')'), 1, 85000, 85000, NOW(), NOW()),
    (@b5, NULL, NULL, @ps5, CONCAT('Obat & alkes farmasi (', @frm5, ')'), 1, 75000, 75000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d0);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, created_at, updated_at)
VALUES (1, @b5, @s4, 1, @no, 'self', 'completed', @p2, 265000, 270000, 5000, @p2, @p2);
SET @pay5 = LAST_INSERT_ID();
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at) VALUES
    (@pay5, 'qris', 200000, 'QRIS 20419877', NOW(), NOW()),
    (@pay5, 'cash', 70000, NULL, NOW(), NOW());

-- Kunjungan 6 (penjamin PT Maju Bersama): piutang 75.000 + 50.000 (nebulizer) + 30.000 (farmasi) = 155.000.
CALL demo_next_number('bills', 'INV', @d0);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 6, 2, 1, @no, @d0, 'guarantor', 'receivable', 75000, 0, 50000, 0, 30000, 0, 155000, 0, NULL, @p3, @t0, @p3);
SET @b6 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, nursing_action_id, pharmacy_sale_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b6, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b6, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b6, 10, @na6, NULL, 'Tindakan keperawatan: Nebulizer', 1, 50000, 50000, NOW(), NOW()),
    (@b6, NULL, NULL, @ps6, CONCAT('Obat & alkes farmasi (', @frm6, ')'), 1, 30000, 30000, NOW(), NOW());

-- Pembayaran sebagian piutang kunjungan 10 oleh Asuransi Sehat (transfer), sisa 210.000.
CALL demo_next_number('payments', 'BYR', @d0);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, notes, created_at, updated_at)
VALUES (1, @b10, @s4, 1, @no, 'guarantor', 'completed', @p3, 100000, 100000, 0, 'Pembayaran termin pertama', @p3, @p3);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'transfer', 100000, 'Mandiri CLM-2231', NOW(), NOW());

-- Kunjungan 3: tagihan draft siap dibayar. 75.000 + 30.000 (lab) + 25.000 (farmasi) = 130.000.
CALL demo_next_number('bills', 'INV', @d0);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 3, NULL, 1, @no, @d0, 'self', 'draft', 75000, 0, 0, 30000, 25000, 0, 130000, 0, NULL, NULL, @p4, @p4);
SET @b3 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, lab_order_item_id, pharmacy_sale_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b3, 1, NULL, NULL, 'Konsultasi Dokter Umum', 1, 50000, 50000, NOW(), NOW()),
    (@b3, 2, NULL, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b3, 9, @li3, NULL, CONCAT('Laboratorium: Gula Darah Sewaktu (', @lab3, ')'), 1, 30000, 30000, NOW(), NOW()),
    (@b3, NULL, NULL, @ps3, CONCAT('Obat & alkes farmasi (', @frm3, ')'), 1, 25000, 25000, NOW(), NOW());

-- Kunjungan 8 (poli gigi): tagihan draft 100.000 + 150.000 (cabut gigi) = 250.000, pembayaran tunainya dibatalkan.
CALL demo_next_number('bills', 'INV', @d0);
INSERT INTO bills (clinic_id, visit_id, guarantor_id, user_id, number, bill_date, payer_type, status, services_total, medical_total, nursing_total, laboratory_total, pharmacy_total, discount, total, paid_amount, notes, finalized_at, created_at, updated_at)
VALUES (1, 8, NULL, 1, @no, @d0, 'self', 'draft', 100000, 150000, 0, 0, 0, 0, 250000, 0, NULL, NULL, @p4, @p5);
SET @b8 = LAST_INSERT_ID();
INSERT INTO bill_items (bill_id, service_tariff_id, medical_action_id, description, quantity, unit_price, subtotal, created_at, updated_at) VALUES
    (@b8, 6, NULL, 'Konsultasi Dokter Gigi', 1, 75000, 75000, NOW(), NOW()),
    (@b8, 2, NULL, 'Administrasi Pendaftaran', 1, 25000, 25000, NOW(), NOW()),
    (@b8, 7, @ma8, 'Tindakan medis: Cabut gigi', 1, 150000, 150000, NOW(), NOW());

CALL demo_next_number('payments', 'BYR', @d0);
INSERT INTO payments (clinic_id, bill_id, cash_session_id, user_id, number, payer_type, status, paid_at, amount, tendered, change_amount, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at)
VALUES (1, @b8, @s4, 1, @no, 'self', 'cancelled', @p4, 250000, 250000, 0, @p5, 1, 'Pasien minta ganti metode pembayaran ke QRIS', @p4, @p5);
INSERT INTO payment_details (payment_id, method, amount, reference, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'cash', 250000, NULL, NOW(), NOW());

-- ---------------------------------------------------------------------------------------------------------------
-- Transaksi kas di luar tagihan (KM = kas masuk, KK = kas keluar)
-- ---------------------------------------------------------------------------------------------------------------

CALL demo_next_number('cash_transactions', 'KK', @d2);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, @s1, 1, @no, 'out', 'operational', 'cash', 'completed', @d2, 35000, 'Beli air galon dan tisu', NULL, TIMESTAMP(@d2) + INTERVAL 240 MINUTE, TIMESTAMP(@d2) + INTERVAL 240 MINUTE);

CALL demo_next_number('cash_transactions', 'KK', @d2);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, NULL, 1, @no, 'out', 'utilities', 'transfer', 'completed', @d2, 1250000, 'Pembayaran listrik dan internet', 'PLN/INDIHOME 0927', TIMESTAMP(@d2) + INTERVAL 300 MINUTE, TIMESTAMP(@d2) + INTERVAL 300 MINUTE);

CALL demo_next_number('cash_transactions', 'KK', @d1);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, @s2, 1, @no, 'out', 'supplies', 'cash', 'completed', @d1, 60000, 'Beli kertas struk dan pulpen', NULL, TIMESTAMP(@d1) + INTERVAL 150 MINUTE, TIMESTAMP(@d1) + INTERVAL 150 MINUTE);

CALL demo_next_number('cash_transactions', 'KM', @d1);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, @s2, 1, @no, 'in', 'other', 'cash', 'completed', @d1, 20000, 'Penjualan kardus bekas', NULL, TIMESTAMP(@d1) + INTERVAL 270 MINUTE, TIMESTAMP(@d1) + INTERVAL 270 MINUTE);

CALL demo_next_number('cash_transactions', 'KK', @d1);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, @s3, 2, @no, 'out', 'operational', 'cash', 'completed', @d1, 25000, 'Ongkos kurir antar hasil lab', NULL, TIMESTAMP(@d1) + INTERVAL 330 MINUTE, TIMESTAMP(@d1) + INTERVAL 330 MINUTE);

CALL demo_next_number('cash_transactions', 'KK', @d1);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, NULL, 1, @no, 'out', 'salary', 'transfer', 'completed', @d1, 2500000, 'Honor dokter jaga minggu ini', 'BCA PAYROLL 1009', TIMESTAMP(@d1) + INTERVAL 420 MINUTE, TIMESTAMP(@d1) + INTERVAL 420 MINUTE);

CALL demo_next_number('cash_transactions', 'KM', @d1);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, NULL, 1, @no, 'in', 'partnership', 'transfer', 'completed', @d1, 1500000, 'Kerja sama pemeriksaan kesehatan karyawan PT Maju Bersama', 'MJB/MCU/0098', TIMESTAMP(@d1) + INTERVAL 450 MINUTE, TIMESTAMP(@d1) + INTERVAL 450 MINUTE);

CALL demo_next_number('cash_transactions', 'KK', @d1);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at)
VALUES (1, NULL, 1, @no, 'out', 'maintenance', 'transfer', 'cancelled', @d1, 350000, 'Servis AC ruang tunggu', NULL,
        TIMESTAMP(@d1) + INTERVAL 485 MINUTE, 1, 'Salah input nominal', TIMESTAMP(@d1) + INTERVAL 480 MINUTE, TIMESTAMP(@d1) + INTERVAL 485 MINUTE);

CALL demo_next_number('cash_transactions', 'KK', @d1);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, NULL, 1, @no, 'out', 'maintenance', 'transfer', 'completed', @d1, 300000, 'Servis AC ruang tunggu', 'BCA 7781-AC', TIMESTAMP(@d1) + INTERVAL 490 MINUTE, TIMESTAMP(@d1) + INTERVAL 490 MINUTE);

CALL demo_next_number('cash_transactions', 'KK', @d0);
INSERT INTO cash_transactions (clinic_id, cash_session_id, user_id, number, type, category, method, status, transaction_date, amount, description, reference, created_at, updated_at)
VALUES (1, @s4, 1, @no, 'out', 'operational', 'cash', 'completed', @d0, 45000, 'Beli cairan pembersih lantai', NULL, @p3, @p3);

DROP PROCEDURE demo_next_number;
