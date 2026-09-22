"""
XAI (Explainable AI) Module for Urban Heat Mitigation.
Provides game-theoretic model interpretation using SHAP (SHapley Additive exPlanations).
Strictly enforces analytical integrity: no fake or synthetic SHAP values are ever generated.
"""

from .explainer import BaseExplainer, ShapExplainer
from .schemas import (
    FeatureContribution,
    ShapExplanationRequest,
    ShapExplanationResponse
)

__version__ = "1.0.0"

__all__ = [
    "BaseExplainer",
    "ShapExplainer",
    "FeatureContribution",
    "ShapExplanationRequest",
    "ShapExplanationResponse"
]
