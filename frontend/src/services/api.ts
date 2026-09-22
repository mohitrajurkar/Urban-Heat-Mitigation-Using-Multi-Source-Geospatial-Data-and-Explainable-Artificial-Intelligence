import { DecisionResult, MitigationStrategy, Recommendation, ScenarioInput, ScenarioResult, Ward } from "../types";
import { NAGPUR_WARDS } from "../data/nagpurWards";
import { MITIGATION_STRATEGIES } from "../data/mitigationStrategies";
import { calculateHeatSeverity } from "./businessLogic/scoring";
import { calculateVulnerabilityScore } from "./businessLogic/vulnerability";
import { calculatePriorityScore } from "./businessLogic/priority";
import { recommendMitigationStrategies } from "./businessLogic/recommendation";
import { generateFeatureExplanation } from "./businessLogic/explanation";
import { simulateScenario as localSimulateScenario } from "./businessLogic/scenario";

const CANDIDATE_API_URLS = [
  "http://localhost:8080/api", // Spring Boot Java Backend
  "http://localhost:5000/api"  // Node.js Express Backend
];

export interface WardSummaryItem extends Ward {
  heatSeverityScore: number;
  heatSeverityLevel: string;
  vulnerabilityScore: number;
  vulnerabilityLevel: string;
  priorityScore: number;
  priorityLevel: string;
  primaryMitigation: string;
}

export type DataSourceMode =
  | "Spring Boot API (Java 21 - Port 8080)"
  | "Node.js Express API (Port 5000)"
  | "In-Browser Fallback Engine";

let currentDataSource: DataSourceMode = "In-Browser Fallback Engine";

export function getDataSource(): DataSourceMode {
  return currentDataSource;
}

// Local in-memory fallback implementation
function getLocalWardSummaries(): WardSummaryItem[] {
  return NAGPUR_WARDS.map((ward) => {
    const heatResult = calculateHeatSeverity(ward.metrics, ward.populationDensity);
    const vulnResult = calculateVulnerabilityScore(ward, heatResult.score);
    const priorityResult = calculatePriorityScore(heatResult.score, vulnResult.score, ward);
    const recs = recommendMitigationStrategies(ward, heatResult.score, vulnResult.score);

    return {
      ...ward,
      heatSeverityScore: heatResult.score,
      heatSeverityLevel: heatResult.level,
      vulnerabilityScore: vulnResult.score,
      vulnerabilityLevel: vulnResult.level,
      priorityScore: priorityResult.score,
      priorityLevel: priorityResult.level,
      primaryMitigation: recs[0]?.strategy.name || "Cool Roofs"
    };
  });
}

function getLocalWardAnalysis(id: string): DecisionResult | null {
  const ward = NAGPUR_WARDS.find((w) => w.id === id);
  if (!ward) return null;

  const heatSeverity = calculateHeatSeverity(ward.metrics, ward.populationDensity);
  const vulnerability = calculateVulnerabilityScore(ward, heatSeverity.score);
  const priority = calculatePriorityScore(heatSeverity.score, vulnerability.score, ward);
  const recommendations = recommendMitigationStrategies(ward, heatSeverity.score, vulnerability.score);
  const explainableFactors = generateFeatureExplanation(
    ward,
    heatSeverity,
    vulnerability,
    recommendations[0]?.strategy
  );

  return {
    wardId: ward.id,
    wardName: ward.name,
    heatSeverity,
    vulnerability,
    priority,
    explainableFactors,
    recommendations
  };
}

async function requestWithFallback(endpoint: string, options?: RequestInit): Promise<{ data: any; source: DataSourceMode } | null> {
  for (const baseUrl of CANDIDATE_API_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const source: DataSourceMode = baseUrl.includes("8080")
          ? "Spring Boot API (Java 21 - Port 8080)"
          : "Node.js Express API (Port 5000)";
        return { data: json.data || json, source };
      }
    } catch {
      // Continue to next candidate URL
    }
  }
  return null;
}

export async function fetchWards(): Promise<WardSummaryItem[]> {
  const result = await requestWithFallback("/wards");
  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  currentDataSource = "In-Browser Fallback Engine";
  return getLocalWardSummaries();
}

export async function fetchWardById(id: string): Promise<Ward | null> {
  const result = await requestWithFallback(`/wards/${id}`);
  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  currentDataSource = "In-Browser Fallback Engine";
  return NAGPUR_WARDS.find((w) => w.id === id) || null;
}

export async function fetchWardAnalysis(id: string): Promise<DecisionResult | null> {
  const result = await requestWithFallback(`/wards/${id}/analysis`);
  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  currentDataSource = "In-Browser Fallback Engine";
  return getLocalWardAnalysis(id);
}

export async function fetchWardRecommendations(id: string): Promise<Recommendation[]> {
  const result = await requestWithFallback(`/wards/${id}/recommendations`);
  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  currentDataSource = "In-Browser Fallback Engine";
  const ward = NAGPUR_WARDS.find((w) => w.id === id);
  if (!ward) return [];
  const heat = calculateHeatSeverity(ward.metrics, ward.populationDensity);
  const vuln = calculateVulnerabilityScore(ward, heat.score);
  return recommendMitigationStrategies(ward, heat.score, vuln.score);
}

export async function fetchStrategies(): Promise<MitigationStrategy[]> {
  const result = await requestWithFallback("/strategies");
  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  currentDataSource = "In-Browser Fallback Engine";
  return MITIGATION_STRATEGIES;
}

export async function runScenarioAnalysis(input: ScenarioInput): Promise<ScenarioResult | null> {
  const result = await requestWithFallback("/scenario/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  currentDataSource = "In-Browser Fallback Engine";
  const ward = NAGPUR_WARDS.find((w) => w.id === input.wardId);
  if (!ward) return null;
  return localSimulateScenario(ward, input);
}

// ----------------------------------------------------------------------
// Generic City & 1 km x 1 km Grid Cell Architecture
// ----------------------------------------------------------------------

import { City, GridCell } from "../types/index";
import { SUPPORTED_CITIES } from "../data/cities";
import { GRID_CELLS } from "../data/gridCells";

export async function fetchCities(): Promise<City[]> {
  return SUPPORTED_CITIES;
}

export function getCityData(cityId: string = "nagpur") {
  const city = SUPPORTED_CITIES.find((c) => c.id === cityId) || SUPPORTED_CITIES[0];
  return {
    city,
    wards: getLocalWardSummaries(),
    gridCells: GRID_CELLS
  };
}

export async function fetchGridCells(cityId: string = "nagpur"): Promise<GridCell[]> {
  const result = await requestWithFallback(`/grid-cells?city=${cityId}`);
  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  return GRID_CELLS;
}

export async function fetchGridCellById(id: string): Promise<GridCell | null> {
  const result = await requestWithFallback(`/grid-cells/${id}`);
  if (result) {
    currentDataSource = result.source;
    return result.data;
  }
  return GRID_CELLS.find((c) => c.id === id) || null;
}

