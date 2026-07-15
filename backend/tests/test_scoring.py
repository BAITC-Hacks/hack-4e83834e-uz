from app.scoring.features import DefectFeatures, severity_score
from app.scoring.ranker_model import ranker_available, score
from app.scoring.repeat_reports import decay_weight, repeat_report_score
from app.scoring.weighted_model import weighted_breakdown, weighted_score


def test_severity_score_weights_pothole_above_faded_marking():
    pothole = severity_score("pothole", confidence=0.8, area_pct=10.0)
    faded = severity_score("faded_marking", confidence=0.8, area_pct=10.0)
    assert pothole > faded


def test_severity_score_is_bounded():
    s = severity_score("pothole", confidence=1.0, area_pct=1000.0)
    assert 0.0 <= s <= 1.0


def test_repeat_report_decay_recent_beats_old():
    recent = decay_weight(age_days=0)
    old = decay_weight(age_days=60)
    assert recent > old
    assert recent == 1.0


def test_repeat_report_score_multiple_reports_beats_single():
    single = repeat_report_score([1.0])
    multiple = repeat_report_score([1.0, 3.0, 8.0])
    assert multiple > single


def test_weighted_score_matches_configured_weights():
    features = DefectFeatures(
        defect_class="pothole", confidence=1.0, area_pct=100.0,
        daily_traffic=15000, report_ages_days=[],
    )
    # severity=1.0, traffic=1.0 (clamped), repeat=0.0 -> 0.45*1 + 0.35*1 + 0.20*0
    assert weighted_score(features) == 0.8


def test_weighted_breakdown_sums_to_100():
    features = DefectFeatures(
        defect_class="crack", confidence=0.5, area_pct=5.0,
        daily_traffic=3000, report_ages_days=[2.0],
    )
    breakdown = weighted_breakdown(features)
    assert abs(sum(breakdown.values()) - 100.0) < 0.5


def test_ranker_available_and_scores_in_unit_interval():
    assert ranker_available(), "run `python -m app.scoring.train_ranker` before running tests"
    features = DefectFeatures(
        defect_class="pothole", confidence=0.9, area_pct=12.0,
        daily_traffic=8000, report_ages_days=[1.0, 5.0],
    )
    priority, breakdown, source = score(features)
    assert 0.0 <= priority <= 1.0
    assert source == "logistic-ranker"
    assert abs(sum(breakdown.values()) - 100.0) < 0.5


def test_ranker_ranks_worse_defect_lower():
    strong = DefectFeatures(
        defect_class="pothole", confidence=0.95, area_pct=20.0,
        daily_traffic=15000, report_ages_days=[0.5, 1.0, 2.0],
    )
    weak = DefectFeatures(
        defect_class="faded_marking", confidence=0.4, area_pct=2.0,
        daily_traffic=500, report_ages_days=[],
    )
    strong_score, _, _ = score(strong)
    weak_score, _, _ = score(weak)
    assert strong_score > weak_score
