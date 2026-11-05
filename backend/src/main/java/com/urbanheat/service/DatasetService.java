package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.urbanheat.dto.ViewDtos.DatasetDto;
import com.urbanheat.entity.Dataset;
import com.urbanheat.entity.User;
import com.urbanheat.exception.ApiException;
import com.urbanheat.repository.DatasetRepository;
import com.urbanheat.repository.StudyAreaRepository;
import com.urbanheat.util.GeoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

/** Dataset metadata lives in PostgreSQL; files and inspection live in the AI service. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DatasetService {
    private static final Set<String> TYPES = Set.of("landsat", "sentinel2", "lulc", "population", "meteorological", "roads", "boundary");
    private final DatasetRepository datasets;
    private final StudyAreaRepository studyAreas;
    private final AiServiceClient ai;

    /** Registers datasets known to the AI service (bundled demo data) that are not yet in the database. */
    @Transactional
    public int syncFromAiService() {
        JsonNode list = ai.listDatasets();
        int added = 0;
        for (JsonNode d : list) {
            String id = d.path("dataset_id").asText();
            if (datasets.findByAiDatasetId(id).isEmpty()) {
                datasets.save(fromAi(d, null));
                added++;
            }
        }
        if (added > 0) {
            log.info("Registered {} dataset(s) from the AI service catalogue", added);
        }
        return added;
    }

    private Dataset fromAi(JsonNode d, User user) {
        Dataset ds = new Dataset();
        ds.setAiDatasetId(d.path("dataset_id").asText());
        ds.setName(d.path("name").asText());
        ds.setDataType(d.path("data_type").asText());
        ds.setSource(textOrNull(d, "source"));
        ds.setCollectionDate(textOrNull(d, "collection_date"));
        ds.setCoverage(textOrNull(d, "coverage"));
        ds.setFileFormat(textOrNull(d, "file_format"));
        ds.setFileName(textOrNull(d, "file_name"));
        ds.setFileSize(d.hasNonNull("file_size") ? d.get("file_size").asLong() : null);
        ds.setDemo(d.path("is_demo").asBoolean(false));
        ds.setRealData(d.path("is_real").asBoolean(true));
        ds.setMetadata(d);
        ds.setUploadedBy(user);
        studyAreas.findByCode("nagpur").ifPresent(ds::setStudyArea);
        JsonNode b = d.path("inspection").path("bounds_lonlat");
        if (b.isArray() && b.size() == 4) {
            ds.setFootprint(GeoUtil.bbox(b.get(0).asDouble(), b.get(1).asDouble(), b.get(2).asDouble(), b.get(3).asDouble()));
        }
        return ds;
    }

    private static String textOrNull(JsonNode n, String f) {
        return n.hasNonNull(f) ? n.get(f).asText() : null;
    }

    @Transactional(readOnly = true)
    public List<DatasetDto> list(String type) {
        return datasets.findAllByOrderByDemoDescCreatedAtDesc().stream()
                .filter(d -> type == null || type.isBlank() || d.getDataType().equals(type))
                .map(DatasetDto::from).toList();
    }

    @Transactional
    public DatasetDto upload(MultipartFile file, String dataType, String name, String source, String collectionDate, String coverage,
                             boolean realData, String landsatParams, String lulcMapping, User user) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("A non-empty file is required");
        }
        if (!TYPES.contains(dataType)) {
            throw ApiException.badRequest("dataType must be one of " + new TreeSet<>(TYPES));
        }
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("data_type", dataType);
        fields.put("name", name);
        fields.put("source", source);
        fields.put("collection_date", collectionDate);
        fields.put("coverage", coverage);
        fields.put("is_demo", String.valueOf(!realData));
        fields.put("is_real", String.valueOf(realData));
        fields.put("landsat_params", landsatParams);
        fields.put("lulc_mapping", lulcMapping);
        JsonNode created = ai.upload(file, fields);
        Dataset ds = datasets.save(fromAi(created, user));
        log.info("User {} uploaded dataset {} ({})", user.getUsername(), ds.getAiDatasetId(), dataType);
        return DatasetDto.from(ds);
    }

    @Transactional
    public void delete(Long id) {
        Dataset d = datasets.findById(id).orElseThrow(() -> ApiException.notFound("Dataset"));
        if (d.isDemo() && d.getAiDatasetId().startsWith("demo-")) {
            throw ApiException.badRequest("Bundled demonstration datasets cannot be deleted");
        }
        ai.deleteDataset(d.getAiDatasetId());
        datasets.delete(d);
    }
}
