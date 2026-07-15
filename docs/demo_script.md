# Demo video script (2-3 minutes)

Target runtime: ~3:00. Screen-record the dashboard at `localhost:5173`
with the backend already seeded (`python -m app.seed`) so the queue/map/
analytics aren't empty.

---

**[0:00-0:15] Hook — the problem**

> "City road maintenance teams get scattered reports of potholes and
> cracks from citizens, dashcams, and inspection drives - with no
> systematic way to decide which one to fix first. RoadWatch is an
> AI-assisted prototype that detects road defects from photos and ranks
> them for a human analyst to review - the AI never dispatches a repair
> crew itself."

*(Show: title card or the Queue page as a establishing shot.)*

**[0:15-0:45] Upload → detect → score**

- Navigate to **Submit a report** (note the RU/EN toggle top-right - ru is
  the default).
- Pick a road segment, upload a real pothole photo.
- Narrate while it processes: "This runs a YOLOv8 model fine-tuned on our
  own hand-labeled photos plus a 1,000-image sample of RDD2022, an open
  road-damage dataset - honest measured accuracy numbers are in the model
  card, not rounded up."
- Show the result panel: detected defect, thumbnail, and the generated
  explanation sentence appearing (in Russian by default).

**[0:45-1:15] The ranked queue**

- Navigate to **Queue**.
- Point out: rank number, defect type dot, status badge, priority score,
  and the one-line explanation inline in the list.
- Click into the top-ranked item to open the detail modal.
- Show: photo with the detection bounding box drawn over it, the
  severity/traffic/repeat-reports breakdown bars, and the full explanation
  text.
- Narrate: "Every ranked item shows exactly why it's ranked there - no
  black-box score. This is a logistic regression trained on labeled
  priority data, and we read the factor breakdown straight off its
  coefficients."

**[1:15-1:45] Human-in-the-loop approval**

- In the same modal, type a reviewer name and a short comment.
- Click **Approve**.
- Show the status badge flip to "Scheduled" and the decision log entry
  appear with timestamp + reviewer name.
- Narrate: "This is the only way anything in RoadWatch changes status. The
  AI ranks and explains; a named human always makes the actual call, and
  every decision is logged."

**[1:45-2:10] Map + analytics**

- Navigate to **Map**: point out pin size = priority, color = review
  status, click a pin to reopen a defect.
- Navigate to **Analytics**: briefly show defects-by-type, by-district,
  trend-over-time, and the approve/reject/defer outcome chart.

**[2:10-2:40] Measurable impact + how to run it yourself**

- Narrate: "This isn't just a UI - on the seeded demo data, the learned
  ranker surfaces more of the highest-traffic-road defects into the top of
  the queue than a plain chronological, no-AI ordering would. Those
  numbers, and detection throughput, are computed by a script in the repo
  (`measure_impact.py`), not made up - see the README's Measurable impact
  section."
- Mention: "`docker compose up` builds and runs the whole stack - backend,
  frontend, seeded data - from a fresh clone, no manual setup steps."

**[2:40-3:00] Close**

> "Everything here is documented honestly - the detection model's real
> accuracy numbers, exactly which parts of the traffic and repeat-report
> data are synthetic and why, and the full architecture - all in the
> repo's README and /docs. RoadWatch is a two-week hackathon prototype,
> not a production system, but the pipeline - real detection on an open
> dataset, learned prioritization designed to retrain on real analyst
> decisions, explainability in Russian and English, and mandatory human
> approval - is real and runs end-to-end today, from one `docker compose
> up`."

*(End card: repo link / team name.)*
