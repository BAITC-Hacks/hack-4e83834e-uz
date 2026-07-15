"""Trains the RoadWatch priority ranker: a scikit-learn LogisticRegression
that predicts P(an analyst would prioritize this defect) from the 3-factor
feature vector (severity, traffic, repeat_reports).

Two training modes:

1. **Synthetic (default)** - the prompt requires "a genuine learned model,
   not just an if/else rule," but a greenfield prototype has no real
   historical log of analyst approve/reject decisions on day one. So by
   default we simulate one, with the generation logic fully documented here
   rather than hidden:

     a. Sample (severity, traffic, repeat_reports) feature vectors covering
        the full 0-1 range (uniform), so the model sees the whole feature
        space rather than only realistic clusters.
     b. Compute a *latent* prioritization tendency that mirrors how we'd
        expect a human analyst to weigh factors - severity mattering most,
        then traffic, then repeat-reports (the same 45/35/20 prior used in
        the transparent weighted_model.py, so the two scorers are
        comparable) - but add Gaussian noise to `latent` to simulate
        realistic human inconsistency between analysts/days rather than a
        perfectly rational rule.
     c. Threshold the noisy latent score at its median to get a
        roughly-balanced binary "prioritize" label.

2. **`--from-approvals`** - RoadWatch's `ApprovalLog` table already records
   every real human decision made through `POST /defects/{id}/review`
   (action + reviewer + timestamp - see /README.md's "Human-in-the-loop
   workflow"). Once enough of those exist, the ranker should learn from
   them instead of the synthetic prior: each ApprovalLog row becomes one
   training example, with `action == "approve"` as the positive label and
   `reject`/`defer` as negative, using the defect's feature vector
   *as it would have looked at decision time* (repeat-report ages are
   computed relative to `decided_at`, not "now"). If fewer than
   `MIN_REAL_SAMPLES` such rows exist, this mode prints a warning and falls
   back to the synthetic generator rather than training on a handful of
   noisy points - the fallback is explicit in both the console output and
   the saved model's `trained_on` metadata field, never silent.

Run with:
    cd backend && source venv/bin/activate && python -m app.scoring.train_ranker
    cd backend && source venv/bin/activate && python -m app.scoring.train_ranker --from-approvals
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone

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

# Below this many real ApprovalLog-derived examples, a logistic regression
# fit is dominated by noise (with 3 features, ~10 examples/feature is a
# conventional rule-of-thumb floor) - fall back to the synthetic generator
# instead of shipping a model trained on too few real decisions.
MIN_REAL_SAMPLES = 30


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


def _report_ages_days_at(defect, at: datetime) -> list[float]:
    """Report ages relative to `at` (a past decision time), not "now" -
    only counts reports that existed by the time the decision was made, so
    the training feature faithfully reflects what an analyst would have
    seen at decision time."""
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    ages = []
    for r in defect.reports:
        submitted = r.submitted_at
        if submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=timezone.utc)
        if submitted > at:
            continue
        ages.append(max(0.0, (at - submitted).total_seconds() / 86400.0))
    return ages


def load_approval_labeled_set(db) -> tuple[np.ndarray, np.ndarray] | None:
    """Builds a real labeled set from ApprovalLog rows. Returns None if
    there are fewer than MIN_REAL_SAMPLES usable rows."""
    from app import models
    from app.scoring.features import DefectFeatures

    logs = db.query(models.ApprovalLog).all()
    X: list[list[float]] = []
    y: list[int] = []
    for log in logs:
        defect = log.defect
        if defect is None or defect.segment is None:
            continue
        ages = _report_ages_days_at(defect, log.decided_at)
        features = DefectFeatures(
            defect_class=defect.defect_class,
            confidence=defect.confidence,
            area_pct=defect.area_pct,
            daily_traffic=defect.segment.daily_traffic,
            report_ages_days=ages,
        )
        X.append(features.as_vector())
        y.append(1 if log.action == "approve" else 0)

    if len(X) < MIN_REAL_SAMPLES:
        return None
    return np.array(X), np.array(y)


def _fit_and_save(X: np.ndarray, y: np.ndarray, trained_on: str, n_samples: int) -> dict:
    stratify = y if len(np.unique(y)) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_SEED, stratify=stratify
    )

    pipeline = make_pipeline(StandardScaler(), LogisticRegression())
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
    }
    if len(np.unique(y_test)) > 1:
        y_proba = pipeline.predict_proba(X_test)[:, 1]
        metrics["roc_auc"] = roc_auc_score(y_test, y_proba)

    print(f"Ranker validation metrics (trained_on={trained_on}, n_samples={n_samples}):")
    for k, v in metrics.items():
        print(f"  {k}: {v:.3f}")

    scaler = pipeline.named_steps["standardscaler"]
    clf = pipeline.named_steps["logisticregression"]
    print("Learned coefficients (on standardized features):")
    for name, coef in zip(["severity", "traffic", "repeat_reports"], clf.coef_[0]):
        print(f"  {name}: {coef:.3f}")

    RANKER_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "pipeline": pipeline,
            "metrics": metrics,
            "feature_order": ["severity", "traffic", "repeat_reports"],
            "trained_on": trained_on,
            "n_samples": n_samples,
        },
        RANKER_MODEL_PATH,
    )
    print(f"Saved ranker to {RANKER_MODEL_PATH}")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--from-approvals",
        action="store_true",
        help=f"Train on real ApprovalLog decisions if at least {MIN_REAL_SAMPLES} exist; "
        "falls back to the synthetic generator (with a printed warning) otherwise.",
    )
    args = parser.parse_args()

    if args.from_approvals:
        from app.database import SessionLocal

        db = SessionLocal()
        try:
            real = load_approval_labeled_set(db)
        finally:
            db.close()

        if real is not None:
            X, y = real
            _fit_and_save(X, y, trained_on="real-approvals", n_samples=len(X))
            return
        print(
            f"--from-approvals requested but fewer than {MIN_REAL_SAMPLES} usable "
            "ApprovalLog rows exist yet - falling back to the synthetic labeled set. "
            "Review more defects through POST /defects/{id}/review and re-run this "
            "command once enough real decisions have accumulated."
        )
        X, y = generate_synthetic_labeled_set()
        _fit_and_save(X, y, trained_on="synthetic-fallback", n_samples=len(X))
        return

    X, y = generate_synthetic_labeled_set()
    _fit_and_save(X, y, trained_on="synthetic", n_samples=len(X))


if __name__ == "__main__":
    main()
