package com.teguh.klinikamanah.klinikamanah_api.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Enum values and their Indonesian labels (dokumentasi bagian 8).
 */
public final class Labels {

    public static final String PAYMENT_SELF = "self";
    public static final String PAYMENT_GUARANTOR = "guarantor";

    public static final Map<String, String> PAYMENT_TYPES = ordered(
            PAYMENT_SELF, "Tanpa Penjamin",
            PAYMENT_GUARANTOR, "Penjamin");

    public static final String VISIT_CANCELLED = "cancelled";

    public static final Map<String, String> VISIT_STATUSES = ordered(
            "registered", "Terdaftar",
            VISIT_CANCELLED, "Batal");

    public static final Map<String, String> REFERRAL_TYPES = ordered(
            "none", "Datang Sendiri",
            "internal", "Rujukan Internal",
            "external", "Rujukan Faskes Lain",
            "back", "Rujuk Balik");

    public static final Map<String, String> GENDERS = ordered(
            "L", "Laki-laki",
            "P", "Perempuan");

    public static final String BILL_DRAFT = "draft";
    public static final String BILL_RECEIVABLE = "receivable";
    public static final String BILL_PAID = "paid";

    public static final Map<String, String> BILL_STATUSES = ordered(
            BILL_DRAFT, "Belum Dibayar",
            BILL_RECEIVABLE, "Piutang",
            BILL_PAID, "Lunas");

    public static final String METHOD_CASH = "cash";

    public static final Map<String, String> PAYMENT_METHODS = ordered(
            METHOD_CASH, "Tunai",
            "credit_card", "Kartu Kredit",
            "debit_card", "Kartu Debit",
            "qris", "QRIS",
            "transfer", "Transfer Rekening");

    public static final String PAYMENT_COMPLETED = "completed";
    public static final String PAYMENT_CANCELLED = "cancelled";

    public static final Map<String, String> PAYMENT_STATUSES = ordered(
            PAYMENT_COMPLETED, "Berhasil",
            PAYMENT_CANCELLED, "Dibatalkan");

    public static final String SESSION_OPEN = "open";
    public static final String SESSION_CLOSED = "closed";

    public static final Map<String, String> SESSION_STATUSES = ordered(
            SESSION_OPEN, "Berjalan",
            SESSION_CLOSED, "Ditutup");

    public static final String TYPE_IN = "in";
    public static final String TYPE_OUT = "out";

    public static final Map<String, String> CASH_TYPES = ordered(
            TYPE_IN, "Kas Masuk",
            TYPE_OUT, "Kas Keluar");

    public static final Map<String, String> CASH_PREFIXES = ordered(
            TYPE_IN, "KM",
            TYPE_OUT, "KK");

    public static final Map<String, Map<String, String>> CASH_CATEGORIES = new LinkedHashMap<>();

    static {
        CASH_CATEGORIES.put(TYPE_IN, ordered(
                "capital", "Setoran Modal",
                "rent", "Sewa Ruang / Fasilitas",
                "partnership", "Kerja Sama & Sponsor",
                "donation", "Donasi / Hibah",
                "interest", "Bunga Bank",
                "other", "Pendapatan Lain-lain"));
        CASH_CATEGORIES.put(TYPE_OUT, ordered(
                "operational", "Operasional Harian",
                "salary", "Gaji & Honor",
                "utilities", "Listrik, Air & Internet",
                "supplies", "ATK & Perlengkapan",
                "maintenance", "Perawatan & Perbaikan",
                "rent", "Sewa",
                "tax", "Pajak & Retribusi",
                "deposit", "Setoran ke Bank",
                "other", "Pengeluaran Lain-lain"));
    }

    public static final Map<String, String> CASH_METHODS = ordered(
            METHOD_CASH, "Tunai",
            "transfer", "Transfer Rekening");

    public static final String CASH_COMPLETED = "completed";
    public static final String CASH_CANCELLED = "cancelled";

    public static final Map<String, String> CASH_STATUSES = ordered(
            CASH_COMPLETED, "Tercatat",
            CASH_CANCELLED, "Dibatalkan");

    public static final Map<String, String> TARIFF_CATEGORIES = ordered(
            "administration", "Administrasi & Pendaftaran",
            "consultation", "Konsultasi Dokter",
            "procedure", "Tindakan Medis",
            "nursing", "Tindakan Keperawatan",
            "laboratory", "Laboratorium",
            "radiology", "Radiologi",
            "physiotherapy", "Fisioterapi",
            "other", "Lainnya");

    public static final String LAB_CANCELLED = "cancelled";
    public static final String PHARMACY_COMPLETED = "completed";

    private Labels() {
    }

    /**
     * Turn labels keyed by their value into a list of {value, label} pairs.
     */
    public static List<Map<String, Object>> options(Map<String, String> labels) {
        List<Map<String, Object>> options = new ArrayList<>();

        labels.forEach((value, label) -> {
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("value", value);
            option.put("label", label);
            options.add(option);
        });

        return options;
    }

    private static Map<String, String> ordered(String... pairs) {
        Map<String, String> map = new LinkedHashMap<>();

        for (int i = 0; i < pairs.length; i += 2) {
            map.put(pairs[i], pairs[i + 1]);
        }

        return map;
    }
}
