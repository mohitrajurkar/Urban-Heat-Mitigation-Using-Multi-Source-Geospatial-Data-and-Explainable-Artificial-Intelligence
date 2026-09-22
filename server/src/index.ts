import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { wardController } from "./controllers/wardController";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// REST API Endpoints
app.get("/api/health", wardController.getHealth);
app.get("/api/wards", wardController.getAllWards);
app.get("/api/wards/:id", wardController.getWardById);
app.get("/api/wards/:id/analysis", wardController.getWardAnalysis);
app.get("/api/wards/:id/recommendations", wardController.getWardRecommendations);
app.get("/api/strategies", wardController.getStrategies);
app.post("/api/scenario/analyze", wardController.postScenarioAnalyze);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Urban Heat Mitigation Decision Support System`);
  console.log(` Nagpur Prototype API Server Running on Port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` Wards endpoint: http://localhost:${PORT}/api/wards`);
  console.log(` Mode: Prototype / Project-II Development`);
  console.log(`=======================================================`);
});

export default app;
