package com.mohit.urbanheatai.service;

import com.mohit.urbanheatai.business.*;
import com.mohit.urbanheatai.dto.*;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.*;

@Service
public class WardDecisionService {

    private final ScoringEngine scoringEngine;
    private final VulnerabilityEngine vulnerabilityEngine;
    private final PriorityEngine priorityEngine;
    private final RecommendationEngine recommendationEngine;
    private final ExplanationEngine explanationEngine;
    private final ScenarioEngine scenarioEngine;

    private final List<WardDTO> wardStore = new ArrayList<>();
    private final List<MitigationStrategyDTO> strategyStore = new ArrayList<>();

    public WardDecisionService(ScoringEngine scoringEngine, VulnerabilityEngine vulnerabilityEngine,
                               PriorityEngine priorityEngine, RecommendationEngine recommendationEngine,
                               ExplanationEngine explanationEngine, ScenarioEngine scenarioEngine) {
        this.scoringEngine = scoringEngine;
        this.vulnerabilityEngine = vulnerabilityEngine;
        this.priorityEngine = priorityEngine;
        this.recommendationEngine = recommendationEngine;
        this.explanationEngine = explanationEngine;
        this.scenarioEngine = scenarioEngine;
    }

    @PostConstruct
    public void initData() {
        // 1. Initialize Mitigation Strategies
        strategyStore.add(new MitigationStrategyDTO(
                "cool-roofs", "Cool Roofs (High-Albedo Reflective Coating)", "Engineering/Albedo",
                "Application of high-reflectance coatings (SRI > 100) on flat building roofs to reject solar radiation.",
                280.0, "₹/m²", 2.1, "Immediate (<3 mo)", "Low", "None", "Rooftop",
                Arrays.asList("Dense Built-up", "Commercial", "Industrial", "Residential Core"),
                "Prototype estimates — to be replaced with validated real-world data."
        ));
        strategyStore.add(new MitigationStrategyDTO(
                "urban-tree-plantation", "Urban Tree Plantation & Avenue Shading", "Nature-Based",
                "Planting native shade trees (Neem, Peepal, Karanj, Gulmohar) along road corridors and institutions.",
                1400.0, "₹/sapling & 3yr guard", 2.6, "Medium (6-12 mo)", "Medium", "High", "Street Corridor",
                Arrays.asList("Road Corridors", "Residential", "Open Periphery", "Institutional"),
                "Prototype estimates — to be replaced with validated real-world data."
        ));
        strategyStore.add(new MitigationStrategyDTO(
                "green-roofs", "Extensive Vegetated Green Roofs", "Nature-Based",
                "Installation of modular soil trays with succulent vegetation for evapotranspiration and insulation.",
                1950.0, "₹/m²", 2.8, "Short (3-6 mo)", "High", "High", "Rooftop",
                Arrays.asList("Institutional", "Commercial", "Public Buildings"),
                "Prototype estimates — to be replaced with validated real-world data."
        ));
        strategyStore.add(new MitigationStrategyDTO(
                "urban-parks", "Urban Pocket Parks & Micro-Forests", "Nature-Based",
                "Creation of dense Miyawaki micro-forests, bioswales, and pocket parks in vacant plots.",
                1100.0, "₹/m²", 3.4, "Medium (6-12 mo)", "Medium", "High", "Open Ground",
                Arrays.asList("Open Space", "Vacant Land", "Residential Outskirts", "Civic Centers"),
                "Prototype estimates — to be replaced with validated real-world data."
        ));
        strategyStore.add(new MitigationStrategyDTO(
                "permeable-pavements", "Permeable Pavements & Porous Walkways", "Engineering/Albedo",
                "Replacement of impermeable concrete surfaces with interlocking permeable blocks.",
                1350.0, "₹/m²", 1.5, "Short (3-6 mo)", "Low", "None", "Pavement",
                Arrays.asList("Walkways", "Parking Lots", "Commercial Squares", "Transit Nodes"),
                "Prototype estimates — to be replaced with validated real-world data."
        ));
        strategyStore.add(new MitigationStrategyDTO(
                "blue-infrastructure", "Urban Water Bodies & Micro-Mist Fountains", "Urban Water",
                "Restoration of urban retention tanks, lake fringes, and mist fountains in congested public squares.",
                2400.0, "₹/m²", 3.1, "Long (>12 mo)", "High", "Low", "Water Body",
                Arrays.asList("Lakeside Zones", "Public Plazas", "Parks", "Civic Squares"),
                "Prototype estimates — to be replaced with validated real-world data."
        ));
        strategyStore.add(new MitigationStrategyDTO(
                "reflective-roads", "Reflective Road & Cool Pavement Coatings", "Engineering/Albedo",
                "Solar-reflective light polymer top-coating on major asphalt arteries.",
                420.0, "₹/m²", 1.8, "Immediate (<3 mo)", "Medium", "None", "Street Corridor",
                Arrays.asList("Arterial Roads", "High-Traffic Corridors", "Industrial Connectors"),
                "Prototype estimates — to be replaced with validated real-world data."
        ));

        // 2. Initialize 12 Nagpur Municipal Wards
        addWard("ward-gandhibagh", "Gandhibagh / Mahal / Itwari", "Zone 3 - Central Heritage & Commercial", 18,
                21.1472, 79.1120, 3.2, 86500L, 27031.0,
                44.6, 0.10, 88.5, 0.12, 4.2, 3.8,
                26.8, 22.0, 1.4, 88.0);

        addWard("ward-midc-hingna", "MIDC Hingna / Wadi Corridor", "Zone 1 - Western Industrial Corridor", 1,
                21.1210, 79.0025, 5.5, 52000L, 9454.0,
                45.2, 0.14, 81.0, 0.11, 11.5, 4.5,
                18.2, 16.5, 3.2, 82.0);

        addWard("ward-lakadganj", "Lakadganj / Shanti Nagar", "Zone 5 - Eastern Industrial & Logistics", 23,
                21.1565, 79.1285, 3.4, 72000L, 21176.0,
                43.8, 0.11, 84.0, 0.13, 6.8, 4.1,
                24.5, 21.0, 2.1, 85.0);

        addWard("ward-sitabuldi", "Sitabuldi / Civil Lines Hub", "Zone 2 - Central Transit & Commerce", 12,
                21.1460, 79.0835, 3.5, 58000L, 16571.0,
                42.4, 0.18, 76.5, 0.15, 10.2, 7.8,
                19.5, 11.0, 0.8, 68.0);

        addWard("ward-sadar", "Sadar / Mohan Nagar", "Zone 2 - North Central Commercial", 9,
                21.1620, 79.0840, 3.0, 64000L, 21333.0,
                41.9, 0.16, 78.0, 0.14, 8.5, 6.2,
                22.0, 14.0, 1.2, 72.0);

        addWard("ward-wardhaman-nagar", "Wardhaman Nagar / Pardi", "Zone 8 - Eastern Mixed Corridor", 29,
                21.1430, 79.1410, 3.7, 68000L, 18378.0,
                42.7, 0.13, 79.5, 0.13, 8.0, 4.9,
                23.1, 19.5, 1.9, 78.0);

        addWard("ward-nandanvan", "Nandanvan / Hasanbagh", "Zone 4 - South-East Residential", 27,
                21.1275, 79.1230, 3.4, 79000L, 23235.0,
                41.5, 0.15, 75.0, 0.15, 10.0, 5.6,
                27.5, 24.0, 1.6, 76.0);

        addWard("ward-dharampeth", "Dharampeth / Ramdaspeth", "Zone 2 - West Central Residential", 14,
                21.1390, 79.0620, 3.6, 51000L, 14166.0,
                38.6, 0.28, 64.0, 0.18, 15.5, 14.8,
                20.0, 6.5, 0.9, 45.0);

        addWard("ward-manish-nagar", "Manish Nagar / Besa", "Zone 9 - Southern Suburbs", 35,
                21.0870, 79.0790, 4.8, 62000L, 12916.0,
                39.2, 0.24, 66.0, 0.19, 18.0, 10.5,
                17.5, 8.0, 2.4, 52.0);

        addWard("ward-jaripatka", "Jaripatka / Mecosabagh", "Zone 10 - North Residential Hub", 4,
                21.1820, 79.0880, 3.7, 66000L, 17837.0,
                39.8, 0.22, 71.0, 0.16, 12.0, 8.9,
                21.8, 14.5, 1.5, 62.0);

        addWard("ward-sakkardara", "Sakkardara / Ayodhya Nagar", "Zone 4 - South Central Lakefront", 25,
                21.1210, 79.1020, 3.7, 57000L, 15405.0,
                38.1, 0.29, 62.0, 0.18, 16.5, 13.5,
                21.0, 13.0, 1.3, 48.0);

        addWard("ward-seminary-hills", "Seminary Hills / Gorewada Buffer", "Zone 2 - North-West Urban Forest", 11,
                21.1660, 79.0520, 7.5, 24000L, 3200.0,
                33.4, 0.62, 22.0, 0.24, 65.0, 58.0,
                14.0, 3.0, 2.2, 5.0);
    }

    private void addWard(String id, String name, String zone, int prabhag,
                         double lat, double lng, double areaKm2, long pop, double popDensity,
                         double lst, double ndvi, double builtUp, double albedo, double openSpace, double canopy,
                         double vulnDemo, double slum, double hospDist, double greenDeficit) {

        WardDTO w = new WardDTO();
        w.setId(id);
        w.setName(name);
        w.setZone(zone);
        w.setPrabhagNo(prabhag);
        w.setCoordinates(Arrays.asList(lat, lng));

        // Simplified 5-point boundary polygon around center
        double d = 0.008;
        w.setBoundaryCoordinates(Arrays.asList(
                Arrays.asList(lat + d, lng - d),
                Arrays.asList(lat + d, lng + d),
                Arrays.asList(lat - d, lng + d),
                Arrays.asList(lat - d, lng - d),
                Arrays.asList(lat + d, lng - d)
        ));

        w.setAreaKm2(areaKm2);
        w.setPopulation(pop);
        w.setPopulationDensity(popDensity);
        w.setMetrics(new HeatMetricsDTO(lst, ndvi, builtUp, albedo, openSpace, canopy));
        w.setVulnerability(new VulnerabilityMetricsDTO(vulnDemo, slum, hospDist, greenDeficit));

        wardStore.add(w);
    }

    public List<WardDTO> getAllWardsWithSummary() {
        List<WardDTO> result = new ArrayList<>();
        for (WardDTO w : wardStore) {
            DecisionResultDTO.HeatSeverityDetails heat = scoringEngine.calculateHeatSeverity(w.getMetrics(), w.getPopulationDensity());
            DecisionResultDTO.VulnerabilityDetails vuln = vulnerabilityEngine.calculateVulnerabilityScore(w, heat.getScore());
            DecisionResultDTO.PriorityDetails prio = priorityEngine.calculatePriorityScore(heat.getScore(), vuln.getScore(), w);
            List<RecommendationDTO> recs = recommendationEngine.recommendMitigationStrategies(w, heat.getScore(), vuln.getScore(), strategyStore);

            WardDTO clone = new WardDTO();
            clone.setId(w.getId());
            clone.setName(w.getName());
            clone.setZone(w.getZone());
            clone.setPrabhagNo(w.getPrabhagNo());
            clone.setCoordinates(w.getCoordinates());
            clone.setBoundaryCoordinates(w.getBoundaryCoordinates());
            clone.setAreaKm2(w.getAreaKm2());
            clone.setPopulation(w.getPopulation());
            clone.setPopulationDensity(w.getPopulationDensity());
            clone.setMetrics(w.getMetrics());
            clone.setVulnerability(w.getVulnerability());

            clone.setHeatSeverityScore(heat.getScore());
            clone.setHeatSeverityLevel(heat.getLevel());
            clone.setVulnerabilityScore(vuln.getScore());
            clone.setVulnerabilityLevel(vuln.getLevel());
            clone.setPriorityScore(prio.getScore());
            clone.setPriorityLevel(prio.getLevel());
            clone.setPrimaryMitigation(!recs.isEmpty() ? recs.get(0).getStrategy().getName() : "Cool Roofs");

            result.add(clone);
        }
        return result;
    }

    public WardDTO getWardById(String id) {
        return wardStore.stream().filter(w -> w.getId().equalsIgnoreCase(id)).findFirst().orElse(null);
    }

    public DecisionResultDTO getWardAnalysis(String id) {
        WardDTO ward = getWardById(id);
        if (ward == null) return null;

        DecisionResultDTO.HeatSeverityDetails heat = scoringEngine.calculateHeatSeverity(ward.getMetrics(), ward.getPopulationDensity());
        DecisionResultDTO.VulnerabilityDetails vuln = vulnerabilityEngine.calculateVulnerabilityScore(ward, heat.getScore());
        DecisionResultDTO.PriorityDetails priority = priorityEngine.calculatePriorityScore(heat.getScore(), vuln.getScore(), ward);
        List<RecommendationDTO> recs = recommendationEngine.recommendMitigationStrategies(ward, heat.getScore(), vuln.getScore(), strategyStore);
        MitigationStrategyDTO topStrategy = !recs.isEmpty() ? recs.get(0).getStrategy() : null;

        DecisionResultDTO.ExplainableFactorsDetails explainable = explanationEngine.generateFeatureExplanation(ward, heat, vuln, topStrategy);

        DecisionResultDTO result = new DecisionResultDTO();
        result.setWardId(ward.getId());
        result.setWardName(ward.getName());
        result.setHeatSeverity(heat);
        result.setVulnerability(vuln);
        result.setPriority(priority);
        result.setExplainableFactors(explainable);
        result.setRecommendations(recs);

        return result;
    }

    public List<RecommendationDTO> getWardRecommendations(String id) {
        WardDTO ward = getWardById(id);
        if (ward == null) return Collections.emptyList();

        DecisionResultDTO.HeatSeverityDetails heat = scoringEngine.calculateHeatSeverity(ward.getMetrics(), ward.getPopulationDensity());
        DecisionResultDTO.VulnerabilityDetails vuln = vulnerabilityEngine.calculateVulnerabilityScore(ward, heat.getScore());
        return recommendationEngine.recommendMitigationStrategies(ward, heat.getScore(), vuln.getScore(), strategyStore);
    }

    public ScenarioResultDTO analyzeScenario(ScenarioInputDTO input) {
        WardDTO ward = getWardById(input.getWardId());
        if (ward == null) return null;
        return scenarioEngine.simulateScenario(ward, input, strategyStore);
    }

    private final List<GridCellDTO> gridCellStore = new ArrayList<>();

    private void initGridCells() {
        // Center coordinates
        double centerLat = 21.1458;
        double centerLng = 79.0882;
        double latStep = 0.009009;
        double lngStep = 0.009660;
        int rows = 15;
        int cols = 19;
        double startLat = centerLat - (rows / 2.0) * latStep;
        double startLng = centerLng - (cols / 2.0) * lngStep;

        int index = 1;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                double lat = startLat + (r + 0.5) * latStep;
                double lng = startLng + (c + 0.5) * lngStep;
                double distLat = (lat - centerLat) * 111.0;
                double distLng = (lng - centerLng) * 103.5;
                double dist = Math.hypot(distLat, distLng);
                double angle = Math.atan2(distLat, distLng);
                double maxR = 8.6 + 1.8 * Math.cos(3 * angle) + 0.8 * Math.sin(2 * angle);

                if (dist <= maxR) {
                    WardDTO ward = wardStore.get(index % wardStore.size());
                    double coreFactor = Math.max(0, 1 - dist / 9.2);
                    double lst = Math.round((ward.getMetrics().getSurfaceTemperature() * 0.65 + (33.0 + coreFactor * 13.0) * 0.35) * 10.0) / 10.0;
                    double builtUp = Math.round(ward.getMetrics().getBuiltUpPercentage() * 0.65 + (coreFactor * 52 + 22) * 0.35);
                    double ndvi = Math.round((ward.getMetrics().getNdvi() * 0.65 + (0.55 - coreFactor * 0.45) * 0.35) * 100.0) / 100.0;
                    int pop = (int) Math.round(ward.getPopulationDensity() * (0.6 + coreFactor * 0.6));
                    double albedo = Math.round((0.12 + (1 - coreFactor) * 0.08) * 100.0) / 100.0;

                    int severity = (int) Math.round(0.40 * (((lst - 30) / 16.0) * 100) + 0.20 * builtUp + 0.20 * (((0.6 - ndvi) / 0.7) * 100) + 0.10 * ((pop / 30000.0) * 100) + 0.10 * (((0.35 - albedo) / 0.30) * 100));
                    severity = Math.max(10, Math.min(98, severity));
                    String sevLevel = severity >= 75 ? "Critical" : severity >= 55 ? "High" : severity >= 35 ? "Moderate" : "Low";

                    int vuln = (int) Math.round(ward.getVulnerability().getVulnerableDemographicPercentage() * 1.8 + ward.getVulnerability().getGreenSpaceDeficitPercentage() * 0.35);
                    int prio = (int) Math.round(0.60 * severity + 0.40 * vuln);
                    String prioLevel = prio >= 75 ? "Critical" : prio >= 55 ? "High" : prio >= 35 ? "Moderate" : "Low";

                    String strategy = builtUp >= 75 ? "Cool Roofs (High-Albedo Reflective Coating)" : ndvi < 0.20 ? "Urban Tree Plantation & Avenue Shading" : "Urban Pocket Parks & Micro-Forests";
                    String cost = builtUp >= 75 ? "₹18.5 Lakh" : ndvi < 0.20 ? "₹24.0 Lakh" : "₹38.0 Lakh";
                    double cooling = builtUp >= 75 ? 3.4 : ndvi < 0.20 ? 2.8 : 3.6;
                    String reason = builtUp >= 75 ? "Dense impervious built-up area (≥75%) with minimal ground space." : "Severe canopy deficit along transit arteries.";

                    gridCellStore.add(new GridCellDTO(
                            "G-" + (100 + index), r, c, Math.round(lat * 100000.0) / 100000.0, Math.round(lng * 100000.0) / 100000.0,
                            ward.getId(), ward.getName(), lst, ndvi, builtUp, pop, albedo, severity, sevLevel, vuln, prio, prioLevel,
                            strategy, cost, cooling, reason
                    ));
                    index++;
                    if (gridCellStore.size() >= 217) break;
                }
            }
            if (gridCellStore.size() >= 217) break;
        }
    }

    public List<GridCellDTO> getAllGridCells() {
        if (gridCellStore.isEmpty()) {
            initGridCells();
        }
        return new ArrayList<>(gridCellStore);
    }

    public GridCellDTO getGridCellById(String id) {
        if (gridCellStore.isEmpty()) {
            initGridCells();
        }
        return gridCellStore.stream().filter(c -> c.getId().equalsIgnoreCase(id)).findFirst().orElse(null);
    }

    public List<MitigationStrategyDTO> getAllStrategies() {
        return new ArrayList<>(strategyStore);
    }
}
