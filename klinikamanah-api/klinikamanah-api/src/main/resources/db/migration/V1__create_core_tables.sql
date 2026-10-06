-- Tabel inti yang dibutuhkan modul keuangan: klinik, user & hak akses (kompatibel Spatie Permission),
-- token API (kompatibel Laravel Sanctum), serta master dan kunjungan pasien.
-- Nama kolom mengikuti migration aplikasi Laravel klinik-amanah.

CREATE TABLE clinics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(20) NULL,
    city VARCHAR(100) NULL,
    address TEXT NULL,
    plan VARCHAR(20) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    trial_ends_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at TIMESTAMP NULL,
    email_verified_at TIMESTAMP NULL,
    password VARCHAR(255) NOT NULL,
    remember_token VARCHAR(100) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY users_email_unique (email),
    CONSTRAINT users_clinic_id_foreign FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY permissions_name_guard_name_unique (name, guard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY roles_name_guard_name_unique (name, guard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE model_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL,
    model_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (permission_id, model_id, model_type),
    KEY model_has_permissions_model_id_model_type_index (model_id, model_type),
    CONSTRAINT model_has_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE model_has_roles (
    role_id BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(255) NOT NULL,
    model_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, model_id, model_type),
    KEY model_has_roles_model_id_model_type_index (model_id, model_type),
    CONSTRAINT model_has_roles_role_id_foreign FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (permission_id, role_id),
    CONSTRAINT role_has_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
    CONSTRAINT role_has_permissions_role_id_foreign FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE personal_access_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id BIGINT UNSIGNED NOT NULL,
    name TEXT NOT NULL,
    token VARCHAR(64) NOT NULL,
    abilities TEXT NULL,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY personal_access_tokens_token_unique (token),
    KEY personal_access_tokens_tokenable_type_tokenable_id_index (tokenable_type, tokenable_id),
    KEY personal_access_tokens_expires_at_index (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE specialties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(50) NULL,
    description TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY specialties_code_unique (code),
    UNIQUE KEY specialties_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE polyclinics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    specialty_id BIGINT UNSIGNED NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY polyclinics_code_unique (code),
    UNIQUE KEY polyclinics_name_unique (name),
    CONSTRAINT polyclinics_specialty_id_foreign FOREIGN KEY (specialty_id) REFERENCES specialties (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE doctors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    specialty_id BIGINT UNSIGNED NULL,
    user_id BIGINT UNSIGNED NULL,
    name VARCHAR(255) NOT NULL,
    gender CHAR(1) NULL,
    license_number VARCHAR(50) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY doctors_clinic_id_license_number_unique (clinic_id, license_number),
    UNIQUE KEY doctors_user_id_unique (user_id),
    CONSTRAINT doctors_clinic_id_foreign FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
    CONSTRAINT doctors_specialty_id_foreign FOREIGN KEY (specialty_id) REFERENCES specialties (id),
    CONSTRAINT doctors_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patients (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nik CHAR(16) NULL,
    name VARCHAR(255) NOT NULL,
    birth_place VARCHAR(100) NULL,
    birth_date DATE NOT NULL,
    gender CHAR(1) NOT NULL,
    phone VARCHAR(20) NULL,
    address TEXT NULL,
    religion VARCHAR(20) NULL,
    education VARCHAR(20) NULL,
    occupation VARCHAR(100) NULL,
    marital_status VARCHAR(20) NULL,
    nationality CHAR(3) NULL,
    guardian_name VARCHAR(255) NULL,
    guardian_relationship VARCHAR(20) NULL,
    guardian_phone VARCHAR(20) NULL,
    guardian_address TEXT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY patients_nik_unique (nik),
    KEY patients_name_birth_date_index (name, birth_date),
    KEY patients_birth_date_index (birth_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    sequence INT UNSIGNED NOT NULL,
    number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY medical_records_clinic_id_patient_id_unique (clinic_id, patient_id),
    UNIQUE KEY medical_records_clinic_id_sequence_unique (clinic_id, sequence),
    UNIQUE KEY medical_records_clinic_id_number_unique (clinic_id, number),
    CONSTRAINT medical_records_clinic_id_foreign FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
    CONSTRAINT medical_records_patient_id_foreign FOREIGN KEY (patient_id) REFERENCES patients (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guarantors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(20) NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    contact_person VARCHAR(255) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    cooperation_starts_at DATE NULL,
    cooperation_ends_at DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY guarantors_clinic_id_code_unique (clinic_id, code),
    KEY guarantors_clinic_id_type_index (clinic_id, type),
    CONSTRAINT guarantors_clinic_id_foreign FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE visits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id BIGINT UNSIGNED NOT NULL,
    medical_record_id BIGINT UNSIGNED NOT NULL,
    doctor_id BIGINT UNSIGNED NOT NULL,
    doctor_schedule_id BIGINT UNSIGNED NULL,
    polyclinic_id BIGINT UNSIGNED NULL,
    payment_type VARCHAR(20) NOT NULL,
    guarantor_id BIGINT UNSIGNED NULL,
    guarantor_member_number VARCHAR(50) NULL,
    referral_type VARCHAR(20) NOT NULL DEFAULT 'none',
    referral_facility VARCHAR(150) NULL,
    referral_number VARCHAR(50) NULL,
    referral_date DATE NULL,
    has_referral_document TINYINT(1) NOT NULL DEFAULT 0,
    visit_date DATE NOT NULL,
    queue_number SMALLINT UNSIGNED NOT NULL,
    complaint TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'registered',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY visits_doctor_id_visit_date_queue_number_unique (doctor_id, visit_date, queue_number),
    KEY visits_clinic_id_visit_date_index (clinic_id, visit_date),
    CONSTRAINT visits_clinic_id_foreign FOREIGN KEY (clinic_id) REFERENCES clinics (id) ON DELETE CASCADE,
    CONSTRAINT visits_medical_record_id_foreign FOREIGN KEY (medical_record_id) REFERENCES medical_records (id) ON DELETE CASCADE,
    CONSTRAINT visits_doctor_id_foreign FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE CASCADE,
    CONSTRAINT visits_polyclinic_id_foreign FOREIGN KEY (polyclinic_id) REFERENCES polyclinics (id),
    CONSTRAINT visits_guarantor_id_foreign FOREIGN KEY (guarantor_id) REFERENCES guarantors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
