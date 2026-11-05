package com.urbanheat.config;

import com.urbanheat.dto.AnalysisDtos.StartAnalysisRequest;
import com.urbanheat.entity.Role;
import com.urbanheat.entity.RunStatus;
import com.urbanheat.entity.StudyArea;
import com.urbanheat.entity.User;
import com.urbanheat.repository.AnalysisRunRepository;
import com.urbanheat.repository.StudyAreaRepository;
import com.urbanheat.repository.UserRepository;
import com.urbanheat.service.AiServiceClient;
import com.urbanheat.service.AnalysisService;
import com.urbanheat.service.DatasetService;
import com.urbanheat.service.SettingsService;
import com.urbanheat.util.GeoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Seeds demo users, the Nagpur study area and default settings; on first launch it waits for the
 * AI service and automatically runs the demonstration analysis so the dashboard is never empty.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer {
    private final UserRepository users;
    private final StudyAreaRepository studyAreas;
    private final AnalysisRunRepository runs;
    private final PasswordEncoder encoder;
    private final SettingsService settings;
    private final DatasetService datasets;
    private final AnalysisService analysis;
    private final AiServiceClient ai;
    private final TransactionTemplate tx;

    @Value("${app.demo.auto-seed}")
    private boolean autoSeed;

    @Value("${app.demo.seed-users}")
    private boolean seedUsers;

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        tx.executeWithoutResult(s -> {
            if (seedUsers) {
                seedUser("admin", "admin@urbanheat.local", "Admin@123", "System Administrator", Role.ADMIN);
                seedUser("analyst", "analyst@urbanheat.local", "Analyst@123", "GIS Analyst", Role.ANALYST);
                seedUser("viewer", "viewer@urbanheat.local", "Viewer@123", "Project Guide (read-only)", Role.VIEWER);
            }
            seedNagpur();
            settings.ensureDefaults();
            int failed = runs.failInterruptedRuns("Interrupted by a backend restart - please start the analysis again");
            if (failed > 0) {
                log.warn("Marked {} interrupted analysis run(s) as FAILED", failed);
            }
        });
        Thread t = new Thread(this::bootstrapDemo, "demo-bootstrap");
        t.setDaemon(true);
        t.start();
    }

    private void seedUser(String username, String email, String password, String name, Role role) {
        if (!users.existsByUsername(username)) {
            User u = new User();
            u.setUsername(username);
            u.setEmail(email);
            u.setPasswordHash(encoder.encode(password));
            u.setFullName(name);
            u.setRole(role);
            users.save(u);
            log.info("Seeded demo user '{}' ({})", username, role);
        }
    }

    private void seedNagpur() {
        if (studyAreas.findByCode("nagpur").isPresent()) {
            return;
        }
        StudyArea sa = new StudyArea();
        sa.setCode("nagpur");
        sa.setName("Nagpur");
        sa.setCity("Nagpur");
        sa.setState("Maharashtra");
        sa.setCountry("India");
        sa.setDescription("Nagpur Municipal Corporation area and periphery (rectangular analysis extent 78.96-79.20 E, 21.04-21.24 N). "
                + "Processed in WGS 84 / UTM zone 44N at 100 m with 500 m analysis cells.");
        sa.setBoundary(GeoUtil.bbox(78.96, 21.04, 79.20, 21.24));
        sa.setCenter(GeoUtil.point(79.0882, 21.1458));
        sa.setProcessingEpsg(32644);
        sa.setResolutionM(100);
        sa.setCellSizeM(500);
        studyAreas.save(sa);
        log.info("Seeded study area Nagpur");
    }

    private void bootstrapDemo() {
        for (int attempt = 1; attempt <= 90; attempt++) {
            if (ai.isHealthy()) {
                try {
                    datasets.syncFromAiService();
                    if (autoSeed && runs.countByStatus(RunStatus.COMPLETED) == 0 && !runs.existsByStatusIn(java.util.List.of(RunStatus.PENDING, RunStatus.RUNNING))) {
                        User admin = users.findByUsername("admin").orElse(null);
                        log.info("No completed analysis found - starting the Nagpur demonstration analysis");
                        analysis.start(new StartAnalysisRequest(null, null, null, null, null, null), admin);
                    }
                } catch (Exception e) {
                    log.error("Demo bootstrap failed: {}", e.getMessage());
                }
                return;
            }
            if (attempt == 1) {
                log.info("Waiting for AI service to become available...");
            }
            try {
                Thread.sleep(4000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        log.warn("AI service not reachable after 6 minutes - demo analysis not started (use Dataset Management > Run analysis)");
    }
}
