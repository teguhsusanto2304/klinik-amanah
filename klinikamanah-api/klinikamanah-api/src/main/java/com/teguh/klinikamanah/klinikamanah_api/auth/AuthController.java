package com.teguh.klinikamanah.klinikamanah_api.auth;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.teguh.klinikamanah.klinikamanah_api.common.Formats;
import com.teguh.klinikamanah.klinikamanah_api.common.Input;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;

    /**
     * Issue an API token for valid credentials.
     */
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody(required = false) Map<String, Object> body) {
        Input input = Input.of(body);
        String email = input.string("email", true, 255);

        if (email != null && !email.matches("^[^@\\s]+@[^@\\s]+$")) {
            input.addError("email", "The email field must be a valid email address.");
        }

        String password = input.string("password", true, Integer.MAX_VALUE);
        String deviceName = input.string("device_name", false, 255);
        input.validate();

        AuthService.IssuedToken issued = auth.login(email, password, deviceName);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Berhasil masuk.");
        response.put("token_type", "Bearer");
        response.put("access_token", issued.plainTextToken());
        response.put("user", payload(issued.user()));

        return response;
    }

    @GetMapping("/me")
    public Map<String, Object> me(AuthUser user) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user", payload(user));

        return response;
    }

    /**
     * Revoke the token used for the current request.
     */
    @PostMapping("/logout")
    public Map<String, Object> logout(AuthUser user) {
        auth.logout(user);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Berhasil keluar.");

        return response;
    }

    private Map<String, Object> payload(AuthUser user) {
        Map<String, Object> clinic = null;

        if (user.clinicId() != null) {
            clinic = new LinkedHashMap<>();
            clinic.put("id", user.clinicId());
            clinic.put("name", user.clinicName());
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", user.id());
        payload.put("name", user.name());
        payload.put("email", user.email());
        payload.put("phone", user.phone());
        payload.put("clinic", clinic);
        payload.put("roles", user.roles());
        payload.put("permissions", user.permissions());
        payload.put("last_login_at", Formats.iso(user.lastLoginAt()));

        return payload;
    }
}
