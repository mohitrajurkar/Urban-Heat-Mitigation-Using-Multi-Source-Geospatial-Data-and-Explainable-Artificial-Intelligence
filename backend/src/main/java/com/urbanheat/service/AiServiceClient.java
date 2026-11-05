package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.urbanheat.exception.AiServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import java.util.function.Supplier;

/** Thin REST client for the Python FastAPI AI/ML service (see ai-service/app/api/routes.py). */
@Slf4j
@Component
public class AiServiceClient {
    private final RestClient client;
    private final ObjectMapper mapper;
    private final String baseUrl;

    public AiServiceClient(@Value("${app.ai-service.base-url}") String baseUrl,
                           @Value("${app.ai-service.connect-timeout-seconds}") int connectTimeout,
                           @Value("${app.ai-service.read-timeout-seconds}") int readTimeout,
                           ObjectMapper mapper) {
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(connectTimeout)).version(HttpClient.Version.HTTP_1_1).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(readTimeout));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.mapper = mapper;
        this.baseUrl = baseUrl;
    }

    private <T> T call(String what, Supplier<T> fn) {
        try {
            return fn.get();
        } catch (RestClientResponseException e) {
            String msg = e.getResponseBodyAsString();
            try {
                JsonNode body = mapper.readTree(msg);
                if (body.hasNonNull("message")) {
                    msg = body.get("message").asText();
                }
            } catch (IOException ignored) {
                // keep raw body
            }
            HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
            HttpStatus mapped = status != null && status.is4xxClientError() ? status : HttpStatus.BAD_GATEWAY;
            throw new AiServiceException(mapped, "AI service " + what + " failed: " + msg);
        } catch (ResourceAccessException e) {
            throw new AiServiceException(HttpStatus.SERVICE_UNAVAILABLE, "AI service is not reachable at " + baseUrl + " (" + e.getMessage() + ")");
        }
    }

    private JsonNode post(String path, Object body) {
        return call(path, () -> client.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class));
    }

    public JsonNode get(String path) {
        return call(path, () -> client.get().uri(path).retrieve().body(JsonNode.class));
    }

    public byte[] getBytes(String path) {
        return call(path, () -> client.get().uri(path).retrieve().body(byte[].class));
    }

    public boolean isHealthy() {
        try {
            JsonNode h = client.get().uri("/health").retrieve().body(JsonNode.class);
            return h != null && "UP".equals(h.path("status").asText());
        } catch (Exception e) {
            return false;
        }
    }

    public JsonNode health() {
        return get("/health");
    }

    public JsonNode listDatasets() {
        return get("/datasets");
    }

    public void deleteDataset(String id) {
        call("delete dataset", () -> client.delete().uri("/datasets/{id}", id).retrieve().toBodilessEntity());
    }

    public JsonNode upload(MultipartFile file, Map<String, String> fields) {
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        try {
            byte[] bytes = file.getBytes();
            parts.add("file", new ByteArrayResource(bytes) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });
        } catch (IOException e) {
            throw new AiServiceException("Could not read uploaded file: " + e.getMessage());
        }
        fields.forEach((k, v) -> {
            if (v != null && !v.isBlank()) {
                parts.add(k, v);
            }
        });
        return call("upload", () -> client.post().uri("/data/upload").contentType(MediaType.MULTIPART_FORM_DATA).body(parts).retrieve().body(JsonNode.class));
    }

    public JsonNode preprocess(Map<String, Object> body) {
        return post("/data/preprocess", body);
    }

    public JsonNode extractFeatures(String runId) {
        return post("/features/extract", Map.of("run_id", runId));
    }

    public JsonNode train(String runId, Map<String, Object> params) {
        return post("/model/train", Map.of("run_id", runId, "params", params));
    }

    public JsonNode predict(String runId) {
        return post("/model/predict", Map.of("run_id", runId));
    }

    public JsonNode explain(String runId) {
        return post("/explain/shap", Map.of("run_id", runId));
    }

    public JsonNode explainCustom(String runId, Object features) {
        return post("/explain/shap", Map.of("run_id", runId, "features", features));
    }

    public JsonNode detectHotspots(String runId) {
        return post("/hotspots/detect", Map.of("run_id", runId));
    }

    public JsonNode generateRecommendations(String runId, Map<String, Object> overrides) {
        return post("/recommendations/generate", overrides == null ? Map.of("run_id", runId) : Map.of("run_id", runId, "overrides", overrides));
    }

    public JsonNode recommendationConfig() {
        return get("/recommendations/config");
    }

    public byte[] layerPng(String runId, String layer) {
        return getBytes("/layers/" + runId + "/" + layer + ".png");
    }

    public byte[] shapPlot(String runId, String fileName) {
        return getBytes("/explain/plot/" + runId + "/" + fileName);
    }
}
