package com.urbanheat.service;

import com.urbanheat.dto.AuthDtos.*;
import com.urbanheat.entity.User;
import com.urbanheat.exception.ApiException;
import com.urbanheat.repository.UserRepository;
import com.urbanheat.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AuthenticationManager authManager;
    private final JwtService jwt;

    @Transactional
    public LoginResponse login(LoginRequest req) {
        authManager.authenticate(new UsernamePasswordAuthenticationToken(req.username(), req.password()));
        User u = users.findByUsername(req.username()).orElseThrow();
        u.setLastLoginAt(OffsetDateTime.now());
        return new LoginResponse(jwt.generate(u.getUsername(), u.getRole().name()), "Bearer", jwt.getExpirationSeconds(), UserDto.from(u));
    }

    @Transactional(readOnly = true)
    public User currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return users.findByUsername(auth.getName()).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Unknown user"));
    }

    @Transactional
    public UserDto register(RegisterRequest req) {
        if (users.existsByUsername(req.username())) {
            throw ApiException.conflict("Username already exists");
        }
        if (users.existsByEmail(req.email())) {
            throw ApiException.conflict("Email already registered");
        }
        User u = new User();
        u.setUsername(req.username());
        u.setEmail(req.email());
        u.setFullName(req.fullName());
        u.setRole(req.role());
        u.setPasswordHash(encoder.encode(req.password()));
        return UserDto.from(users.save(u));
    }

    @Transactional(readOnly = true)
    public List<UserDto> list() {
        return users.findAll().stream().map(UserDto::from).toList();
    }

    @Transactional
    public UserDto update(Long id, UpdateUserRequest req) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        if (u.getUsername().equals(currentUser().getUsername()) && (Boolean.FALSE.equals(req.enabled()) || (req.role() != null && req.role() != u.getRole()))) {
            throw ApiException.badRequest("You cannot disable or change the role of your own account");
        }
        if (req.role() != null) {
            u.setRole(req.role());
        }
        if (req.enabled() != null) {
            u.setEnabled(req.enabled());
        }
        if (req.fullName() != null && !req.fullName().isBlank()) {
            u.setFullName(req.fullName());
        }
        return UserDto.from(u);
    }

    @Transactional
    public void changePassword(ChangePasswordRequest req) {
        User u = users.findByUsername(currentUser().getUsername()).orElseThrow();
        if (!encoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw ApiException.badRequest("Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(req.newPassword()));
    }
}
