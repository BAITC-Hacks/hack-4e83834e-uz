"""Trains the RoadWatch priority ranker: a scikit-learn LogisticRegression
that predicts P(an analyst would prioritize this defect) from the 3-factor
feature vector (severity, traffic, repeat_reports).

Why a synthetic labeled set: the prompt requires "a genuine learned model,
not just an if/else rule," but we don't have a real historical log of
analyst approve/reject decisions to train on (this is a greenfield
prototype - see /model/README.md). So we simulate one, with the generation
logic fully documented here rather than hidden:

  1. Sample (severity, traffic, repeat_reports) feature vectors covering the
     full 0-1 range (uniform), so the model sees the whole feature space
     rather than only realistic clusters.
  2. Compute a *latent* prioritization tendency that mirrors how we'd expect
     a human analyst to weigh factors - severity mattering most, then
     traffic, then repeat-reports (the same 45/35/20 prior used in the
     transparent weighted_model.py, so the two scorers are comparable) -
     but add Gaussian noise to `latent` to simulate realistic human
     inconsistency between analysts/days rather than a perfectly rational
     rule. This noise is the difference between "genuine learned model" and
     "if/else with extra steps": the model has to find the underlying
     pattern through noisy labels, same as it would with real analyst data.
  3. Threshold the noisy latent score at its median to get a roughly
     balanced binary "prioritize" label.

Run with:
    cd backend && source venv/bin/activate && python -m app.scoring.train_ranker
"""
from __future__ import annotations

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import joblib

from app.config import RANKER_MODEL_PATH, WEIGHTED_SCORE_WEIGHTS

N_SAMPLES = 400
NOISE_STD = 0.12
RANDOM_SEED = 42


def generate_synthetic_labeled_set(n: int = N_SAMPLES, seed: int = RANDOM_SEED):
    rng = np.random.default_rng(seed)
    X = rng.uniform(0.0, 1.0, size=(n, 3))  # columns: severity, traffic, repeat_reports
    w = np.array([
        WEIGHTED_SCORE_WEIGHTS["severity"],
        WEIGHTED_SCORE_WEIGHTS["traffic"],
        WEIGHTED_SCORE_WEIGHTS["repeat_reports"],
    ])
    latent = X @ w + rng.normal(0.0, NOISE_STD, size=n)
    threshold = np.median(latent)
    y = (latent > threshold).astype(int)
    return X, y


def main() -> None:
    X, y = generate_synthetic_labeled_set()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_SEED, stratify=y
    )

    pipeline = make_pipeline(StandardScaler(), LogisticRegression())
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "roc_auc": roc_auc_score(y_test, y_proba),
    }
    print("Ranker validation metrics (synthetic labeled holdout):")
    for k, v in metrics.items():
        print(f"  {k}: {v:.3f}")

    scaler = pipeline.named_steps["standardscaler"]
    clf = pipeline.named_steps["logisticregression"]
    print("Learned coefficients (on standardized features):")
    for name, coef in zip(["severity", "traffic", "repeat_reports"], clf.coef_[0]):
        print(f"  {name}: {coef:.3f}")

    RANKER_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "metrics": metrics, "feature_order": ["severity", "traffic", "repeat_reports"]}, RANKER_MODEL_PATH)
    print(f"Saved ranker to {RANKER_MODEL_PATH}")


if __name__ == "__main__":
    main()
