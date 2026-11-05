package com.urbanheat.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {
    private final JwtService jwt = new JwtService("unit-test-secret-key-that-is-definitely-longer-than-32-bytes", 60);

    @Test
    void generatesAndParsesToken() {
        String token = jwt.generate("analyst", "ANALYST");
        var claims = jwt.parse(token).orElseThrow();
        assertThat(claims.getSubject()).isEqualTo("analyst");
        assertThat(claims.get("role", String.class)).isEqualTo("ANALYST");
        assertThat(jwt.getExpirationSeconds()).isEqualTo(3600);
    }

    @Test
    void rejectsTamperedOrForeignTokens() {
        String token = jwt.generate("admin", "ADMIN");
        assertThat(jwt.parse(token.substring(0, token.length() - 2) + "xx")).isEmpty();
        JwtService other = new JwtService("another-secret-key-which-is-also-longer-than-32-bytes!!", 60);
        assertThat(jwt.parse(other.generate("admin", "ADMIN"))).isEmpty();
        assertThat(jwt.parse("not-a-jwt")).isEmpty();
    }

    @Test
    void rejectsShortSecret() {
        assertThatThrownBy(() -> new JwtService("short", 60)).isInstanceOf(IllegalStateException.class);
    }
}
