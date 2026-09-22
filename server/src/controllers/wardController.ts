import { Request, Response } from "express";
import { wardService } from "../services/wardService";

export class WardController {
  public getAllWards = (_req: Request, res: Response): void => {
    try {
      const wards = wardService.getAllWards();
      res.json({
        success: true,
        count: wards.length,
        data: wards,
        mode: "Prototype Mode",
        message: "Simulated geospatial and thermal proxy data for Nagpur municipal wards."
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public getWardById = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const ward = wardService.getWardById(id);
      if (!ward) {
        res.status(404).json({ success: false, error: `Ward '${id}' not found.` });
        return;
      }
      res.json({ success: true, data: ward });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public getWardAnalysis = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const analysis = wardService.getWardAnalysis(id);
      if (!analysis) {
        res.status(404).json({ success: false, error: `Ward '${id}' not found for analysis.` });
        return;
      }
      res.json({ success: true, data: analysis });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public getWardRecommendations = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const recommendations = wardService.getWardRecommendations(id);
      if (!recommendations) {
        res.status(404).json({ success: false, error: `Ward '${id}' not found.` });
        return;
      }
      res.json({ success: true, data: recommendations });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public postScenarioAnalyze = (req: Request, res: Response): void => {
    try {
      const { wardId, strategyId, coveragePercentage } = req.body;
      if (!wardId || !strategyId || coveragePercentage === undefined) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: wardId, strategyId, coveragePercentage"
        });
        return;
      }

      const result = wardService.analyzeScenario({
        wardId,
        strategyId,
        coveragePercentage: Number(coveragePercentage)
      });

      if (!result) {
        res.status(404).json({ success: false, error: `Ward '${wardId}' not found.` });
        return;
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public getStrategies = (_req: Request, res: Response): void => {
    try {
      const strategies = wardService.getStrategies();
      res.json({ success: true, data: strategies });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public getHealth = (_req: Request, res: Response): void => {
    res.json({
      status: "UP",
      service: "Urban Heat Mitigation Decision Support System (Nagpur Prototype API)",
      timestamp: new Date().toISOString(),
      mode: "Prototype Mode",
      notice: "Data shown for demonstration. Real satellite, meteorological and validated cost datasets will be integrated in Phase 2."
    });
  };
}

export const wardController = new WardController();
