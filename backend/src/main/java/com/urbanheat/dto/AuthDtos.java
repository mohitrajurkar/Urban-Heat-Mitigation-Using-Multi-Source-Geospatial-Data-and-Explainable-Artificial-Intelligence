package com.urbanheat.dto;

import com.urbanheat.entity.Role;
import com.urbanheat.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class AuthDtos {
    private AuthDtos() {
    }

    public record LoginRequest(@NotBlank @Size(max = 50) String username, @NotBlank @Size(max = 100) String password) {
    }

    public record LoginResponse(String token, String tokenType, long expiresIn, UserDto user) {
    }

    public record UserDto(Long id, String username, String email, String fullName, Role role, boolean enabled,
                          OffsetDateTime createdAt, OffsetDateTime lastLoginAt) {
        public static UserDto from(User u) {
            return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getFullName(), u.getRole(), u.isEnabled(), u.getCreatedAt(), u.getLastLoginAt());
        }
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "^[A-Za-z0-9_.-]+$", message = "letters, digits, '.', '_' or '-' only") String username,
            @NotBlank @Email @Size(max = 120) String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 120) String fullName,
            @NotNull Role role) {
    }

    public record UpdateUserRequest(Role role, Boolean enabled, @Size(max = 120) String fullName) {
    }

    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }
}
