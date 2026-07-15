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

4. **Solution overview** — One diagram: photo in → YOLOv8 detection →
   3-factor priority scoring (severity, traffic, repeat reports) → learned
   ranker → explained, ranked queue → human Approve/Reject/Defer, logged.
   (Reuse `docs/architecture.md`'s mermaid diagram.)

5. **Data used** — What's real (13 hand-sourced, individually licensed
   pothole/crack photos from Wikimedia Commons) vs. clearly-labeled
   synthetic (traffic volume, repeat-report volume, seed demo data) - and
   why (no accessible open dataset with credentials available in the build
   window). Point to `/data/README.md`.

6. **AI/ML approach** — Two learned components: (a) YOLOv8n fine-tuned for
   detection, (b) a LogisticRegression priority ranker trained on a
   documented synthetic labeled set, whose coefficients directly drive the
   explanation breakdown. Contrast with the transparent weighted-sum
   fallback also included. Point to `/model/README.md`.

7. **Explainability example** — Screenshot of the detail modal: bbox
   overlay, score breakdown bars, generated sentence
   ("Ranked #1 — Pothole, severity: high...").

8. **Human-in-the-loop workflow** — Screenshot of Approve/Reject/Defer +
   decision log. Explain the structural guarantee: only one code path
   (`POST /defects/{id}/review`) can change a defect's status, and it
   requires a named reviewer.

9. **Limitations** — Tiny fine-tuning set (13 images, 2/4 classes covered,
   honest low precision/recall numbers), fully synthetic traffic and much
   of the demo volume, illustrative (not survey-grade) Almaty geography.
   State the real numbers, don't round them up.

10. **Next steps** — Fine-tune on RDD2022 (or a properly licensed
    equivalent) for real detection accuracy across all 4 classes; replace
    synthetic traffic with a real open traffic dataset if/when available;
    retrain the ranker on real analyst approve/reject history collected
    via the already-built `ApprovalLog`; add the Telegram citizen-bot
    surface as an alternative to the web submission form.
