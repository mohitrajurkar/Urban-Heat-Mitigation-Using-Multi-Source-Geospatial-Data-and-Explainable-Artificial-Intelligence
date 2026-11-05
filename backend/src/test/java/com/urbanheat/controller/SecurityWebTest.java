package com.urbanheat.controller;

import com.urbanheat.config.SecurityConfig;
import com.urbanheat.dto.AuthDtos.LoginResponse;
import com.urbanheat.dto.AuthDtos.UserDto;
import com.urbanheat.entity.Role;
import com.urbanheat.security.AppUserDetailsService;
import com.urbanheat.security.JwtAuthFilter;
import com.urbanheat.security.JwtService;
import com.urbanheat.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Web-layer tests: JWT filter, role-based access and request validation (no database needed). */
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtService.class})
class SecurityWebTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    JwtService jwt;
    @MockBean
    AuthService authService;
    @MockBean
    AppUserDetailsService userDetailsService;

    @BeforeEach
    void users() {
        when(userDetailsService.loadUserByUsername("admin")).thenReturn(User.withUsername("admin").password("x").roles("ADMIN").build());
        when(userDetailsService.loadUserByUsername("viewer")).thenReturn(User.withUsername("viewer").password("x").roles("VIEWER").build());
    }

    @Test
    void loginIsPublicAndValidated() throws Exception {
        UserDto u = new UserDto(1L, "admin", "a@b.c", "Admin", Role.ADMIN, true, OffsetDateTime.now(), null);
        when(authService.login(any())).thenReturn(new LoginResponse("tok", "Bearer", 3600, u));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"admin\",\"password\":\"Admin@123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").value("tok"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details").isArray());
    }

    @Test
    void protectedEndpointsRequireToken() throws Exception {
        mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users").header("Authorization", "Bearer garbage")).andExpect(status().isUnauthorized());
    }

    @Test
    void roleBasedAccess() throws Exception {
        when(authService.list()).thenReturn(List.of());
        mvc.perform(get("/api/users").header("Authorization", "Bearer " + jwt.generate("viewer", "VIEWER"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/users").header("Authorization", "Bearer " + jwt.generate("admin", "ADMIN"))).andExpect(status().isOk());
    }
}
