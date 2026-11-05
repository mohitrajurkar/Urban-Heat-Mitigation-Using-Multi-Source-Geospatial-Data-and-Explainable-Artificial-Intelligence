package com.urbanheat.util;

import com.fasterxml.jackson.databind.JsonNode;

/** Null-safe accessors for JSON returned by the AI service (Python None -> JSON null). */
public final class Json {
    private Json() {
    }

    public static Double dbl(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() || !v.isNumber() ? null : v.asDouble();
    }

    public static Integer integer(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asInt();
    }

    public static String str(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    public static boolean bool(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v != null && v.asBoolean(false);
    }
}
