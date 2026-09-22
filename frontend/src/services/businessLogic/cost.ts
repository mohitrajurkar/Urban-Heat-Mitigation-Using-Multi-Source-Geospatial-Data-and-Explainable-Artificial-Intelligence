import { MitigationStrategy, Ward } from "../../types";

export function formatINR(amount: number): string {
  if (amount >= 10000000) {
    const cr = (amount / 10000000).toFixed(2);
    return `₹${cr} Cr`;
  }
  if (amount >= 100000) {
    const lakh = (amount / 100000).toFixed(1);
    return `₹${lakh} Lakh`;
  }
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function estimateImplementationCost(
  strategy: MitigationStrategy,
  ward: Ward,
  coverageFraction: number = 0.25
): { costINR: number; formattedCost: string; disclaimer: string } {
  const totalWardAreaM2 = ward.areaKm2 * 1_000_000;
  let targetUnits = 0;

  switch (strategy.id) {
    case "cool-roofs": {
      const totalRooftopM2 = totalWardAreaM2 * (ward.metrics.builtUpPercentage / 100) * 0.30;
      targetUnits = totalRooftopM2 * coverageFraction;
      break;
    }
    case "urban-tree-plantation": {
      const canopyDeficit = Math.max(0, (25 - ward.metrics.treeCanopyPercentage) / 25);
      const totalTargetTrees = ward.areaKm2 * 1200 * canopyDeficit;
      targetUnits = Math.max(150, totalTargetTrees * coverageFraction);
      break;
    }
    case "green-roofs": {
      const greenRoofM2 = totalWardAreaM2 * (ward.metrics.builtUpPercentage / 100) * 0.08;
      targetUnits = greenRoofM2 * coverageFraction;
      break;
    }
    case "urban-parks": {
      const openGroundM2 = totalWardAreaM2 * (ward.metrics.openSpacePercentage / 100) * 0.20;
      targetUnits = Math.max(500, openGroundM2 * coverageFraction);
      break;
    }
    case "permeable-pavements": {
      const pavementM2 = totalWardAreaM2 * 0.05;
      targetUnits = pavementM2 * coverageFraction;
      break;
    }
    case "blue-infrastructure": {
      const waterM2 = totalWardAreaM2 * 0.015;
      targetUnits = Math.max(300, waterM2 * coverageFraction);
      break;
    }
    case "reflective-roads": {
      const roadM2 = totalWardAreaM2 * 0.07;
      targetUnits = roadM2 * coverageFraction;
      break;
    }
    default: {
      targetUnits = totalWardAreaM2 * 0.05 * coverageFraction;
      break;
    }
  }

  const rawCost = Math.round(targetUnits * strategy.costPerUnitINR);
  const costINR = Math.max(1500000, rawCost);

  return {
    costINR,
    formattedCost: formatINR(costINR),
    disclaimer: "Prototype estimate — based on modeled spatial area and normative unit schedule."
  };
}
