import { useEffect, useState } from "react";
import { api, mediaUrl } from "../api";
import { DEFECT_TYPE_MAP, DISTRICT_LABEL_MAP } from "../constants";
import { useLang } from "../i18n.jsx";

export default function SubmitPage() {
  const { t, lang, pick } = useLang();
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
      setError(e?.response?.data?.detail || t("submit_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">{t("submit_title")}</h1>
      <p className="page-subtitle">{t("submit_subtitle")}</p>

      <div className="grid-2">
        <form className="card" style={{ padding: 18 }} onSubmit={handleSubmit}>
          <div className="form-field">
            <label>{t("submit_segment_label")}</label>
            <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {pick(DISTRICT_LABEL_MAP[s.district]) || s.district}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>{t("submit_photo_label")}</label>
            <input type="file" accept="image/*" onChange={handleFile} required />
          </div>
          {preview && (
            <div className="image-frame" style={{ marginBottom: 14 }}>
              <img src={preview} alt="preview" />
            </div>
          )}
          <div className="form-field">
            <label>{t("submit_note_label")}</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("submit_note_placeholder")} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting || !file}>
            {submitting ? t("submit_button_busy") : t("submit_button")}
          </button>
          {error && <div className="callout callout-error">{error}</div>}
        </form>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{t("submit_next_title")}</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{t("submit_next_body")}</p>

          {result && (
            <div className={`callout ${result.defect ? "callout-success" : "callout-error"}`}>
              {lang === "ru" ? result.message_ru : result.message}
            </div>
          )}

          {result?.defect && (
            <div style={{ marginTop: 14 }}>
              <div className="image-frame" style={{ marginBottom: 10 }}>
                <img src={mediaUrl(result.defect.image_url)} alt={result.defect.defect_class} />
              </div>
              <div className="queue-title-row">
                <span className="type-dot" style={{ background: DEFECT_TYPE_MAP[result.defect.defect_class]?.color }} />
                {pick(DEFECT_TYPE_MAP[result.defect.defect_class]?.label) || result.defect.defect_class}
              </div>
              <div className="explanation-box">{lang === "ru" ? result.defect.explanation_ru : result.defect.explanation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
