export type Role = 'ADMIN' | 'ANALYST' | 'VIEWER';
export type Severity = 'Low' | 'Moderate' | 'High' | 'Very High';
export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResponse { token: string; tokenType: string; expiresIn: number; user: User; }

export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }

export interface Run {
  id: number;
  aiRunId: string | null;
  studyAreaId: number;
  studyAreaName: string;
  status: RunStatus;
  currentStep: string | null;
  progress: number;
  message: string | null;
  demo: boolean;
  parameters: Record<string, number> | null;
  datasetSelection: Record<string, string> | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface StudyArea {
  id: number; code: string; name: string; city: string; state: string; country: string; description: string;
  bbox: [number, number, number, number]; center: [number, number]; processingEpsg: number; resolutionM: number; cellSizeM: number;
}

export interface Dataset {
  id: number; aiDatasetId: string; name: string; dataType: string; source: string | null; collectionDate: string | null;
  coverage: string | null; fileFormat: string | null; fileName: string | null; fileSize: number | null; demo: boolean; realData: boolean;
  metadata: Record<string, unknown> | null; uploadedBy: string | null; createdAt: string;
}

export interface PriorityInfo {
  id: number; rank: number; score: number; level: PriorityLevel;
  components: Record<string, number>; contributions: Record<string, number>; weights: Record<string, number>;
  expectedCoolingC: number | null; estimatedCost: number | null; nInterventions: number | null;
}

export interface HotspotRow {
  hotspotId: number; regionId: number; regionCode: string; name: string; locality: string; lon: number; lat: number;
  severity: Severity; severitySource: string; observedSeverity: Severity | null; predictedSeverity: Severity; hotspot: boolean;
  lst: number | null; lstAnomaly: number | null; giStarZ: number | null; giStarSignificant: boolean;
  ndvi: number | null; ndbi: number | null; builtFraction: number | null; populationDensity: number | null; priority: PriorityInfo | null;
}

export interface IndicatorRow {
  regionId: number; regionCode: string; name: string; locality: string; lon: number; lat: number;
  lstMean: number | null; lstMin: number | null; lstMax: number | null; ndvi: number | null; ndbi: number | null; ndwi: number | null;
  albedo: number | null; lulc: number | null; lulcName: string | null; builtFraction: number | null; vegetationFraction: number | null;
  waterFraction: number | null; openLandFraction: number | null; airTempMax: number | null; relativeHumidity: number | null;
  windSpeed: number | null; population: number | null; populationDensity: number | null; roadDensity: number | null;
  validPixelPct: number | null; labelQualityOk: boolean;
}

export interface Cost {
  estimated: number; low: number; high: number; unitCost: number; unitCostBasis: string; costPerDegree: number | null;
  currency: string; approximate: boolean;
}

export interface Recommendation {
  id: number; type: string; name: string; description: string; regionId: number; regionCode: string; regionName: string;
  locality: string; lon: number; lat: number; locationDescription: string; reason: string; areaM2: number; quantity: number;
  unit: string; coolingC: number; suitability: number; priorityLevel: PriorityLevel; costEffectivenessRank: number; cost: Cost;
}

export interface Contribution { feature: string; label: string; value: number; shap: number; imputed?: boolean; }

export interface LocalExplanation {
  regionId: number; regionCode: string; name: string; model: string; baseValue: number; predictedValue: number;
  predictedClass: Severity; observedLst: number | null; contributions: Contribution[]; classContributions: Contribution[];
  explanation: string;
}

export interface Evaluation {
  modelName: string; task: 'classification' | 'regression'; accuracy: number | null; precision: number | null; recall: number | null;
  f1: number | null; mae: number | null; rmse: number | null; r2: number | null; cvMean: number | null; cvStd: number | null;
  trainSamples: number; testSamples: number; trainingSeconds: number; best: boolean; confusionMatrix: number[][] | null;
  featureImportance: { feature: string; label: string; importance: number }[];
  details: Record<string, unknown> & { scatter?: { observed: number; predicted: number }[]; per_class?: { class: string; precision: number; recall: number; f1: number; support: number }[]; train_accuracy?: number; train_r2?: number; cv_metric?: string };
}

export interface PredictionModelView { predictedClass: Severity; predictedLst: number; probabilities: Record<string, number>; bestModel: boolean; }
export interface PredictionRow { regionId: number; regionCode: string; name: string; locality: string; observedLst: number | null; observedClass: Severity | null; models: Record<string, PredictionModelView>; }

export interface LayerMeta {
  label: string; unit: string; bounds: [number, number, number, number]; vmin?: number; vmax?: number;
  stops?: { value: number; color: string }[]; categories?: { value: number; label: string; color: string }[];
}

export interface RegionFeature {
  type: 'Feature'; id: number;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  properties: {
    regionId: number; code: string; name: string; locality: string; lst: number | null; ndvi: number | null; ndbi: number | null;
    ndwi: number | null; albedo: number | null; lulc: number | null; lulcName: string | null; builtFraction: number | null;
    vegetationFraction: number | null; populationDensity: number | null; hotspotId?: number; severity?: Severity; isHotspot?: boolean;
    giStarZ?: number | null; giStarSignificant?: boolean; predictedLst?: number | null; predictedClass?: Severity; rank?: number;
    priorityScore?: number | null; priorityLevel?: PriorityLevel;
  };
}

export interface InterventionMarker {
  id: number; type: string; name: string; lon: number; lat: number; regionId: number; regionName: string; coolingC: number;
  areaM2: number; priorityLevel: PriorityLevel; costInr: number | null;
}

export interface ReportSummary { id: number; title: string; fileName: string; fileSize: number; createdAt: string; runId: number; generatedBy: string; }

export interface ShapImportance { feature: string; label: string; mean_abs_shap: number; }
export interface ShapTaskGlobal {
  importance: ShapImportance[]; beeswarm: { feature: string; label: string; points: { shap: number; value: number }[] }[];
  plot: string; base_value: number | number[]; unit: string; n_explained: number;
}
export interface ShapGlobal {
  runId: number;
  shap: { global: Record<string, { regression: ShapTaskGlobal; classification: ShapTaskGlobal }>; best_model: Record<string, string> } | null;
}
