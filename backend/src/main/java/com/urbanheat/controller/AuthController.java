package com.urbanheat.controller;

import com.urbanheat.dto.AuthDtos.*;
import com.urbanheat.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Authentication & users")
public class AuthController {
    private final AuthService auth;

    @PostMapping("/api/auth/login")
    @Operation(summary = "Log in and receive a JWT bearer token")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @GetMapping("/api/auth/me")
    public UserDto me() {
        return UserDto.from(auth.currentUser());
    }

    @PostMapping("/api/auth/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        auth.changePassword(req);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserDto> users() {
        return auth.list();
    }

    @PostMapping("/api/users")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a user (admin only)")
    public UserDto create(@Valid @RequestBody RegisterRequest req) {
        return auth.register(req);
    }

    @PatchMapping("/api/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest req) {
        return auth.update(id, req);
    }
}
