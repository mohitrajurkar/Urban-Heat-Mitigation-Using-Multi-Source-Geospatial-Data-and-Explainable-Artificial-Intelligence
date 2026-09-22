# Explainable AI Module (`xai/`)

## 1. Module Responsibility
The `xai/` module is an independent library and service package providing model interpretability for the Heat-AI decision support system using **SHAP (SHapley Additive exPlanations)**.

It answers the core questions municipal decision-makers ask:
- *Why is Ward X classified as High Priority for heat mitigation?*
- *Which factors (surface temperature, lack of canopy, low albedo, high density) drove the prediction?*
- *What is the marginal impact of increasing tree canopy by 15%?*

---

## 2. Data Integrity Policy (Strict No-Fake-SHAP Rule)

> **Scientific & Engineering Integrity**:
> If no trained ML checkpoint (`.joblib` / `.pkl`) is mounted, the explainer returns an explicit status `MODEL_NOT_TRAINED` with `feature_contributions: null`.
> **Under no circumstances are pseudo-random or fabricated SHAP numbers generated.**

---

## 3. Directory Structure

```text
xai/
├── __init__.py           # Exports BaseExplainer, ShapExplainer, schemas
├── explainer.py          # Real SHAP bindings with uncalibrated guard
├── schemas.py            # Pydantic schemas (ShapExplanationRequest, Response, etc.)
├── requirements.txt      # Module dependencies (shap, numpy, scikit-learn, pydantic)
├── pyproject.toml        # Package distribution metadata
├── tests/
│   └── test_xai.py       # Standalone test suite verifying guards & computations
└── README.md             # This documentation
```

---

## 4. How to Run & Test Independently

```bash
cd xai
python -m venv venv

# Windows:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python tests/test_xai.py
```

---

## 5. Integrating with `ai/`
The `ai/` microservice imports `xai` to provide the `/api/v1/explain/shap` endpoint.
When a model is trained in `ai/`, pass the fitted model instance into `ShapExplainer(model=fitted_model)`.
