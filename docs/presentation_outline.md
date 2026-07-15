# Presentation outline (7-10 slides)

1. **Title** — RoadWatch: AI-assisted road defect detection & repair
   prioritization. Team name, hackathon track (GovTech).

2. **Problem** — Road maintenance departments get scattered, unstructured
   defect reports (citizens, dashcams, inspection drives) with no
   systematic way to detect them or decide what to fix first under limited
   budget/crew capacity.

3. **Users** — Primary: akimat road-infrastructure analyst who reviews a
   ranked queue and approves work orders. Secondary: citizens submitting
   photos of defects near them. The AI never dispatches crews - a human
   always approves.

4. **Why this isn't a form + spreadsheet** — Photo understanding needs
   computer vision (there's no field to write a rule against a photo);
   prioritizing noisy, repeated, conflicting citizen reports needs a
   scoring model, not a chronological queue. See `/README.md`'s "Why this
   can't be solved by ordinary automation" and the measured comparison on
   slide 9.

5. **Solution overview** — One diagram: photo in → YOLOv8 detection →
   3-factor priority scoring (severity, traffic, repeat reports) → learned
   ranker → explained, ranked queue → human Approve/Reject/Defer, logged.
   (Reuse `docs/architecture.md`'s mermaid diagram.)

6. **Data used** — Real detector training data from two sources: 13
   hand-labeled Wikimedia Commons photos, plus a 1,000-image sample of
   RDD2022 (CRDDC'2022, Czech Republic subset, CC BY-SA 4.0), both mapped
   into RoadWatch's taxonomy and merged - see `/data/README.md` for the
   exact class mapping and `scripts/fetch_rdd2022.sh` to reproduce.
   `broken_curb`/`faded_marking` still have zero real examples and are
   explicitly marked "planned," not shown as detectable in the demo.

7. **AI/ML approach** — Two learned components: (a) YOLOv8n fine-tuned for
   detection on the merged dataset above, (b) a LogisticRegression priority
   ranker. The ranker starts on a documented synthetic labeled set but is
   built to retrain on real analyst decisions the moment enough exist
   (`train_ranker.py --from-approvals`, reading the already-live
   `ApprovalLog` table) - removing the "synthetic labels mirror the
   baseline" circularity once real usage accumulates. Contrast with the
   transparent weighted-sum fallback also included. Point to
   `/model/README.md`.

8. **Explainability example** — Screenshot of the detail modal (ru or en):
   bbox overlay, score breakdown bars, generated sentence ("Ранг №1 —
   Выбоина, серьёзность: высокая...").

9. **Human-in-the-loop + measured impact** — Screenshot of
   Approve/Reject/Defer + decision log; explain the structural guarantee
   (only `POST /defects/{id}/review` can change status, requires a named
   reviewer). Then the numbers from `/README.md`'s "Measurable impact"
   section (computed by `measure_impact.py` against the seeded data, not
   invented): how many high-traffic-road defects the learned ranker
   surfaces into the top 10 of the queue vs. a plain chronological (no-AI)
   ordering, and measured detection throughput.

10. **Limitations & next steps** — State real numbers, don't round them up:
    current detector mAP/precision/recall (see `/model/README.md`),
    `broken_curb`/`faded_marking` still untrained, fully synthetic traffic
    data, illustrative (not survey-grade) Almaty geography. Next steps:
    accumulate real `ApprovalLog` volume and retrain the ranker on it,
    label `broken_curb`/`faded_marking` examples (no clean RDD2022
    equivalent exists), replace synthetic traffic with a real open
    dataset if one becomes reachable, `docker compose up` is already a
    one-command deploy today (see `/README.md`).
