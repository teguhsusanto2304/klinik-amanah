package com.teguh.klinikamanah.klinikamanah_api.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.zip.CRC32;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.teguh.klinikamanah.klinikamanah_api.common.AppTime;
import com.teguh.klinikamanah.klinikamanah_api.common.ValidationException;

import lombok.RequiredArgsConstructor;

/**
 * Login with email and password, and API tokens stored the way Laravel Sanctum does: the client gets
 * "{id}|{token}" while the table keeps the SHA-256 hash of the token, so both applications share the tokens.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    /**
     * Morph type of the users in the token and permission tables of the Laravel application.
     */
    public static final String USER_MODEL = "App\\Models\\User";

    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder();

    private final JdbcTemplate jdbc;
    private final AppTime time;

    public record IssuedToken(String plainTextToken, AuthUser user) {
    }

    /**
     * Check the credentials and issue a new token.
     */
    @Transactional
    public IssuedToken login(String email, String password, String deviceName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT u.id, u.password, u.is_active, c.is_active AS clinic_active FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id WHERE u.email = ?",
                email);

        if (rows.isEmpty() || !passwordMatches(password, (String) rows.getFirst().get("password"))) {
            throw ValidationException.of("email", "Email atau kata sandi tidak sesuai.");
        }

        Map<String, Object> row = rows.getFirst();

        if (!truthy(row.get("is_active"))) {
            throw ValidationException.of("email", "Akun Anda dinonaktifkan. Silakan hubungi administrator.");
        }
        if (row.get("clinic_active") != null && !truthy(row.get("clinic_active"))) {
            throw ValidationException.of("email", "Klinik Anda sedang dinonaktifkan. Silakan hubungi tim Klinik Amanah.");
        }

        long userId = ((Number) row.get("id")).longValue();
        Timestamp now = Timestamp.from(time.now());

        jdbc.update("UPDATE users SET last_login_at = ? WHERE id = ?", now, userId);

        String entropy = randomString(40);
        String plain = entropy + crc32b(entropy);

        jdbc.update("""
                INSERT INTO personal_access_tokens (tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
                VALUES (?, ?, ?, ?, '["*"]', ?, ?)""",
                USER_MODEL, userId, deviceName == null ? "api" : deviceName, sha256(plain), now, now);

        Long tokenId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);

        return new IssuedToken(tokenId + "|" + plain, loadUser(userId, tokenId));
    }

    /**
     * Find the user of a bearer token, or null when the token is invalid or expired.
     */
    @Transactional
    public AuthUser authenticate(String bearer) {
        if (bearer == null || bearer.isBlank()) {
            return null;
        }

        List<Map<String, Object>> rows;
        String token = bearer;
        int separator = bearer.indexOf('|');

        if (separator >= 0) {
            String id = bearer.substring(0, separator);
            token = bearer.substring(separator + 1);

            if (!id.matches("\\d+")) {
                return null;
            }
            rows = jdbc.queryForList("SELECT id, tokenable_id, token, expires_at FROM personal_access_tokens WHERE id = ? AND tokenable_type = ?",
                    Long.parseLong(id), USER_MODEL);
        } else {
            rows = jdbc.queryForList("SELECT id, tokenable_id, token, expires_at FROM personal_access_tokens WHERE token = ? AND tokenable_type = ?",
                    sha256(bearer), USER_MODEL);
        }

        if (rows.isEmpty()) {
            return null;
        }

        Map<String, Object> row = rows.getFirst();

        if (!MessageDigest.isEqual(((String) row.get("token")).getBytes(StandardCharsets.UTF_8), sha256(token).getBytes(StandardCharsets.UTF_8))) {
            return null;
        }

        Object expiresAt = row.get("expires_at");

        if (expiresAt != null && toInstant(expiresAt).isBefore(Instant.now())) {
            return null;
        }

        long tokenId = ((Number) row.get("id")).longValue();
        jdbc.update("UPDATE personal_access_tokens SET last_used_at = ?, updated_at = ? WHERE id = ?",
                Timestamp.from(time.now()), Timestamp.from(time.now()), tokenId);

        return loadUser(((Number) row.get("tokenable_id")).longValue(), tokenId);
    }

    /**
     * Revoke the token used for the current request.
     */
    @Transactional
    public void logout(AuthUser user) {
        jdbc.update("DELETE FROM personal_access_tokens WHERE id = ?", user.tokenId());
    }

    private AuthUser loadUser(long userId, Long tokenId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT u.id, u.name, u.email, u.phone, u.clinic_id, u.last_login_at, c.name AS clinic_name
                FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id WHERE u.id = ?""", userId);

        if (rows.isEmpty()) {
            return null;
        }

        Map<String, Object> row = rows.getFirst();

        List<String> roles = jdbc.queryForList("""
                SELECT r.name FROM roles r JOIN model_has_roles m ON m.role_id = r.id
                WHERE m.model_type = ? AND m.model_id = ? ORDER BY r.id""", String.class, USER_MODEL, userId);

        List<String> permissions = jdbc.queryForList("""
                SELECT p.name FROM permissions p
                JOIN role_has_permissions rp ON rp.permission_id = p.id
                JOIN model_has_roles m ON m.role_id = rp.role_id
                WHERE m.model_type = ? AND m.model_id = ?
                UNION
                SELECT p.name FROM permissions p
                JOIN model_has_permissions mp ON mp.permission_id = p.id
                WHERE mp.model_type = ? AND mp.model_id = ?""", String.class, USER_MODEL, userId, USER_MODEL, userId);

        Object clinicId = row.get("clinic_id");
        Object lastLoginAt = row.get("last_login_at");

        return new AuthUser(
                userId,
                (String) row.get("name"),
                (String) row.get("email"),
                (String) row.get("phone"),
                clinicId == null ? null : ((Number) clinicId).longValue(),
                (String) row.get("clinic_name"),
                lastLoginAt == null ? null : toInstant(lastLoginAt),
                roles,
                new LinkedHashSet<>(permissions),
                tokenId);
    }

    private static boolean passwordMatches(String password, String hash) {
        try {
            return hash != null && BCRYPT.matches(password, hash);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean truthy(Object value) {
        return value instanceof Boolean b ? b : value instanceof Number n && n.intValue() != 0;
    }

    private static Instant toInstant(Object value) {
        if (value instanceof Timestamp t) {
            return t.toInstant();
        }
        if (value instanceof java.time.LocalDateTime l) {
            return l.toInstant(java.time.ZoneOffset.UTC);
        }
        return (Instant) value;
    }

    private static String randomString(int length) {
        StringBuilder builder = new StringBuilder(length);

        for (int i = 0; i < length; i++) {
            builder.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }

        return builder.toString();
    }

    private static String crc32b(String value) {
        CRC32 crc = new CRC32();
        crc.update(value.getBytes(StandardCharsets.UTF_8));

        return String.format("%08x", crc.getValue());
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
