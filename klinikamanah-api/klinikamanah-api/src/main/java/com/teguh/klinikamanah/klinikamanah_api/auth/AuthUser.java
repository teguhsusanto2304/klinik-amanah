package com.teguh.klinikamanah.klinikamanah_api.auth;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Authenticated user of the request with its roles and permissions (Spatie Permission).
 * The "super-admin" role passes every check, like Gate::before in the Laravel application.
 */
public record AuthUser(
        Long id,
        String name,
        String email,
        String phone,
        Long clinicId,
        String clinicName,
        Instant lastLoginAt,
        List<String> roles,
        Set<String> permissions,
        Long tokenId) {

    public boolean isSuperAdmin() {
        return roles.contains("super-admin");
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }

    /**
     * Whether the user holds the permission, e.g. "bills.view".
     */
    public boolean can(String permission) {
        return isSuperAdmin() || permissions.contains(permission);
    }

    /**
     * Result of a policy check, always granted to the super admin.
     */
    public boolean allows(boolean policy) {
        return isSuperAdmin() || policy;
    }

    /**
     * Whether the user sees the data of every clinic (admin pusat).
     */
    public boolean managesAllClinics() {
        return can("clinics.view");
    }

    /**
     * Whether the user may manage data owned by the clinic.
     */
    public boolean canAccessClinic(Long clinicId) {
        return managesAllClinics() || belongsToClinic(clinicId);
    }

    public boolean belongsToClinic(Long clinicId) {
        return clinicId != null && clinicId.equals(this.clinicId);
    }

    /**
     * Whether the user is a doctor limited to the patients whose visits are registered to them.
     */
    public boolean isLimitedToOwnPatients() {
        return hasRole("dokter") && !(hasRole("super-admin") || hasRole("admin") || hasRole("pelanggan"));
    }
}
