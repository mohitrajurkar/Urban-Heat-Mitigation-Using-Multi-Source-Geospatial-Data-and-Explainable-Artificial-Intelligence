import { NAGPUR_WARDS } from "../data/nagpurWards";
import { MITIGATION_STRATEGIES } from "../data/mitigationStrategies";
import { DecisionResult, Recommendation, ScenarioInput, ScenarioResult, Ward } from "../types";
import { calculateHeatSeverity } from "../business/scoring";
import { calculateVulnerabilityScore } from "../business/vulnerability";
import { calculatePriorityScore } from "../business/priority";
import { recommendMitigationStrategies } from "../business/recommendation";
import { generateFeatureExplanation } from "../business/explanation";
import { simulateScenario } from "../business/scenario";

export interface WardSummaryItem extends Ward {
  heatSeverityScore: number;
  heatSeverityLevel: string;
  vulnerabilityScore: number;
  vulnerabilityLevel: string;
  priorityScore: number;
  priorityLevel: string;
  primaryMitigation: string;
}

export class WardService {
  public getAllWards(): WardSummaryItem[] {
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

  public getWardById(id: string): Ward | undefined {
    return NAGPUR_WARDS.find((w) => w.id === id);
  }

  public getWardAnalysis(id: string): DecisionResult | null {
    const ward = this.getWardById(id);
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

  public getWardRecommendations(id: string): Recommendation[] | null {
    const ward = this.getWardById(id);
    if (!ward) return null;

    const heatSeverity = calculateHeatSeverity(ward.metrics, ward.populationDensity);
    const vulnerability = calculateVulnerabilityScore(ward, heatSeverity.score);
    return recommendMitigationStrategies(ward, heatSeverity.score, vulnerability.score);
  }

  public analyzeScenario(input: ScenarioInput): ScenarioResult | null {
    const ward = this.getWardById(input.wardId);
    if (!ward) return null;
    return simulateScenario(ward, input);
  }

  public getStrategies() {
    return MITIGATION_STRATEGIES;
  }
}

export const wardService = new WardService();
