import { useEffect, useState } from "react";
import { api, mediaUrl } from "../api";
import { DEFECT_TYPE_MAP } from "../constants";

export default function SubmitPage() {
  const [segments, setSegments] = useState([]);
  const [segmentId, setSegmentId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSegments().then((segs) => {
      setSegments(segs);
      if (segs.length) setSegmentId(String(segs[0].id));
    });
  }, []);

  function handleFile(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || !segmentId) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("segment_id", segmentId);
      form.append("source", "citizen");
      if (note) form.append("note", note);
      form.append("file", file);
      const res = await api.submitReport(form);
      setResult(res);
    } catch (e) {
      setError(e?.response?.data?.detail || "Submission failed - please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Report a road defect</h1>
      <p className="page-subtitle">
        Citizen submission form. Upload a photo of a pothole, crack, broken curb, or faded lane marking near you -
        RoadWatch will detect it automatically and add it to the analyst's review queue.
      </p>

      <div className="grid-2">
        <form className="card" style={{ padding: 18 }} onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Road segment / nearest street</label>
            <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.district}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Photo</label>
            <input type="file" accept="image/*" onChange={handleFile} required />
          </div>
          {preview && (
            <div className="image-frame" style={{ marginBottom: 14 }}>
              <img src={preview} alt="preview" />
            </div>
          )}
          <div className="form-field">
            <label>Note (optional)</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else worth mentioning?" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting || !file}>
            {submitting ? "Submitting…" : "Submit report"}
          </button>
          {error && <div className="callout callout-error">{error}</div>}
        </form>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>What happens next</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            RoadWatch runs the same YOLOv8 detector used for inspection photos. If a defect is found, it's either
            added as a brand-new item in the analyst queue, or - if it matches an existing open report at this
            location - counted as a repeat report, which raises its priority. Your photo never causes a repair crew
            to be dispatched automatically; a human analyst always makes that call.
          </p>

          {result && (
            <div className={`callout ${result.defect ? "callout-success" : "callout-error"}`}>
              {result.message}
            </div>
          )}

          {result?.defect && (
            <div style={{ marginTop: 14 }}>
              <div className="image-frame" style={{ marginBottom: 10 }}>
                <img src={mediaUrl(result.defect.image_url)} alt={result.defect.defect_class} />
              </div>
              <div className="queue-title-row">
                <span className="type-dot" style={{ background: DEFECT_TYPE_MAP[result.defect.defect_class]?.color }} />
                {DEFECT_TYPE_MAP[result.defect.defect_class]?.label || result.defect.defect_class}
              </div>
              <div className="explanation-box">{result.defect.explanation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
