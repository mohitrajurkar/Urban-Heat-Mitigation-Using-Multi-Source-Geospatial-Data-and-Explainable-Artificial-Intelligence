from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import numpy as np

class BaseExplainer(ABC):
    """
    Abstract interface for model interpretability and explainers.
    Guarantees consistent contracts across different explanation backends (SHAP, LIME, Integrated Gradients).
    """

    @abstractmethod
    def explain(self, region_id: str, feature_vector: Dict[str, float]) -> Dict[str, Any]:
        """Compute feature attributions for a given prediction instance."""
        pass

    @abstractmethod
    def is_calibrated(self) -> bool:
        """Indicates whether a valid model and baseline dataset are loaded."""
        pass


class ShapExplainer(BaseExplainer):
    """
    Production SHAP (SHapley Additive exPlanations) Explainer.
    Implements true cooperative game theory Shapley values for microclimate ML models.

    DATA INTEGRITY CONTRACT:
    When no trained ML model checkpoint is mounted, this class strictly reports
    'MODEL_NOT_TRAINED' with explanation_ready=False.
    Fabrication of synthetic or random numbers is strictly prohibited.
    """

    DEFAULT_FEATURE_ORDER = [
        "surface_temperature_celsius",
        "ndvi",
        "built_up_percentage",
        "canopy_cover_percentage",
        "albedo",
        "population_density_per_km2"
    ]

    def __init__(self, model=None, background_data: Optional[np.ndarray] = None, feature_order: Optional[List[str]] = None):
        self.model = model
        self.background_data = background_data
        self.feature_order = feature_order or self.DEFAULT_FEATURE_ORDER
        self.explainer = None
        self._initialize_explainer()

    def _initialize_explainer(self):
        if self.model is None:
            self.explainer = None
            return

        try:
            import shap
            # Select appropriate SHAP explainer
            if hasattr(self.model, "estimators_") or hasattr(self.model, "get_booster"):
                # Tree-based model (Random Forest, Gradient Boosting, XGBoost)
                self.explainer = shap.TreeExplainer(self.model, data=self.background_data)
            elif self.background_data is not None:
                # Kernel SHAP for arbitrary regressors
                self.explainer = shap.KernelExplainer(self.model.predict, self.background_data)
            else:
                self.explainer = shap.Explainer(self.model)
        except Exception:
            self.explainer = None

    def is_calibrated(self) -> bool:
        return self.explainer is not None

    def explain(self, region_id: str, feature_vector: Dict[str, float]) -> Dict[str, Any]:
        """
        Calculates exact SHAP values if trained model is present.
        If uncalibrated, returns an honest diagnostic contract with null feature contributions.
        """
        if not self.is_calibrated():
            return {
                "region_id": region_id,
                "status": "MODEL_NOT_TRAINED",
                "explanation_ready": False,
                "base_value": None,
                "feature_contributions": None,
                "message": (
                    "Explainable AI requires a trained model artifact (.joblib / .pkl) "
                    "and a background reference distribution to compute real Shapley values. "
                    "No synthetic SHAP numbers are generated to protect data validity. "
                    "Mount model weights to enable real-time XAI interpretation."
                ),
                "metadata": {
                    "required_features": self.feature_order,
                    "explainer_class": self.__class__.__name__
                }
            }

        feature_values = [feature_vector.get(k, 0.0) for k in self.feature_order]
        x_input = np.array([feature_values])

        try:
            shap_values = self.explainer.shap_values(x_input)
            base_val = getattr(self.explainer, "expected_value", None)
            if isinstance(base_val, np.ndarray):
                base_val = float(base_val[0])
            elif base_val is not None:
                base_val = float(base_val)

            # Extract raw values
            if isinstance(shap_values, list):
                raw_shap = shap_values[0][0]
            elif shap_values.ndim == 2:
                raw_shap = shap_values[0]
            else:
                raw_shap = shap_values

            contributions = []
            for name, val, sv in zip(self.feature_order, feature_values, raw_shap):
                sv_float = float(sv)
                if sv_float > 0.01:
                    direction = "INCREASES_HEAT"
                elif sv_float < -0.01:
                    direction = "REDUCES_HEAT"
                else:
                    direction = "NEUTRAL"

                contributions.append({
                    "feature_name": name,
                    "feature_value": float(val),
                    "shap_value": round(sv_float, 4),
                    "impact_direction": direction
                })

            contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

            return {
                "region_id": region_id,
                "status": "COMPUTED",
                "explanation_ready": True,
                "base_value": round(base_val, 4) if base_val is not None else None,
                "feature_contributions": contributions,
                "message": "SHAP feature attributions computed successfully using trained model.",
                "metadata": {
                    "explainer_type": type(self.explainer).__name__,
                    "feature_count": len(self.feature_order)
                }
            }

        except Exception as e:
            return {
                "region_id": region_id,
                "status": "COMPUTATION_ERROR",
                "explanation_ready": False,
                "base_value": None,
                "feature_contributions": None,
                "message": f"Error during SHAP computation: {str(e)}",
                "metadata": {}
            }
