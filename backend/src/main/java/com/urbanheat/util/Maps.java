package com.urbanheat.util;

import java.util.LinkedHashMap;
import java.util.Map;

/** Insertion-ordered map literal that (unlike Map.of) accepts null values and maps NaN/inf to null. */
public final class Maps {
    private Maps() {
    }

    public static Map<String, Object> of(Object... kv) {
        if (kv.length % 2 != 0) {
            throw new IllegalArgumentException("key/value pairs expected");
        }
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            Object v = kv[i + 1];
            if (v instanceof Double d && !Double.isFinite(d)) {
                v = null;
            }
            m.put((String) kv[i], v);
        }
        return m;
    }
}
