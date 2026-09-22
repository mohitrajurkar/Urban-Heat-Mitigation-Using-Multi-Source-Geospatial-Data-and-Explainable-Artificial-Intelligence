package com.mohit.urbanheatai.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST Client for communicating with the Python AI Microservice (ai-service).
 * Handles health monitoring, ML prediction delegation, and Explainable AI (SHAP) requests.
 * Employs a non-blocking timeout and graceful fallback if the AI microservice is offline.
 */
@Component
public class AiServiceClient {

    private final HttpClient httpClient;
    private final String aiServiceUrl;
    private final boolean enabled;

    public AiServiceClient(
            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl,
            @Value("${ai.service.enabled:true}") boolean enabled) {
        this.aiServiceUrl = aiServiceUrl.endsWith("/") ? aiServiceUrl.substring(0, aiServiceUrl.length() - 1) : aiServiceUrl;
        this.enabled = enabled;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1200))
                .build();
    }

    public String getAiServiceUrl() {
        return aiServiceUrl;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Checks if the Python AI service is reachable and healthy.
     */
    public Map<String, Object> checkHealth() {
        Map<String, Object> status = new LinkedHashMap<>();
        if (!enabled) {
            status.put("available", false);
            status.put("status", "DISABLED");
            status.put("message", "AI service integration is disabled in configuration.");
            return status;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/health"))
                    .timeout(Duration.ofMillis(1500))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                status.put("available", true);
                status.put("status", "UP");
                status.put("aiServiceUrl", aiServiceUrl);
                status.put("rawResponse", response.body());
                return status;
            } else {
                status.put("available", false);
                status.put("status", "HTTP_" + response.statusCode());
                status.put("message", "AI service returned non-200 status code");
                return status;
            }
        } catch (Exception e) {
            status.put("available", false);
            status.put("status", "UNREACHABLE");
            status.put("aiServiceUrl", aiServiceUrl);
            status.put("message", "AI service is offline or unreachable: " + e.getMessage());
            status.put("fallback", "Using Spring Boot deterministic heuristic scoring engine.");
            return status;
        }
    }

    /**
     * Requests SHAP explanation for a given region and feature vector.
     */
    public String requestShapExplanationJson(String regionId, String jsonPayload) {
        if (!enabled) {
            return null;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/api/v1/explain/shap"))
                    .timeout(Duration.ofMillis(2000))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return response.body();
            }
        } catch (Exception ignored) {
            // Graceful fallback to internal explanation engine
        }
        return null;
    }
}
