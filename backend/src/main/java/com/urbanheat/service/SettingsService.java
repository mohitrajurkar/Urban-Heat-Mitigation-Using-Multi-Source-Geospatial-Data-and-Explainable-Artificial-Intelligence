package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.urbanheat.entity.AppSetting;
import com.urbanheat.repository.AppSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SettingsService {
    public static final String PRIORITY_WEIGHTS = "priority_weights";
    private final AppSettingRepository settings;
    private final ObjectMapper mapper;

    public static Map<String, Double> defaultWeights() {
        Map<String, Double> w = new LinkedHashMap<>();
        w.put("heat_severity", 0.35);
        w.put("population_vulnerability", 0.25);
        w.put("vegetation_deficit", 0.15);
        w.put("implementation_feasibility", 0.10);
        w.put("cooling_benefit", 0.15);
        return w;
    }

    @Transactional(readOnly = true)
    public Map<String, Double> getPriorityWeights() {
        return settings.findById(PRIORITY_WEIGHTS)
                .map(s -> {
                    Map<String, Double> w = new LinkedHashMap<>();
                    s.getValue().fields().forEachRemaining(e -> w.put(e.getKey(), e.getValue().asDouble()));
                    return w;
                })
                .orElseGet(SettingsService::defaultWeights);
    }

    @Transactional
    public Map<String, Double> setPriorityWeights(Map<String, Double> weights) {
        save(PRIORITY_WEIGHTS, mapper.valueToTree(weights));
        return weights;
    }

    @Transactional
    public void save(String key, JsonNode value) {
        AppSetting s = settings.findById(key).orElseGet(() -> {
            AppSetting n = new AppSetting();
            n.setKey(key);
            return n;
        });
        s.setValue(value);
        s.setUpdatedAt(OffsetDateTime.now());
        settings.save(s);
    }

    @Transactional
    public void ensureDefaults() {
        if (!settings.existsById(PRIORITY_WEIGHTS)) {
            save(PRIORITY_WEIGHTS, mapper.valueToTree(defaultWeights()));
        }
    }
}
