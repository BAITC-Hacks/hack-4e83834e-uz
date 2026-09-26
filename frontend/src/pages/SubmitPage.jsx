import { useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "../api";
import { DEFECT_TYPE_MAP, DISTRICT_LABEL_MAP } from "../constants";
import { useLang } from "../i18n.jsx";
import MapView from "../components/MapView.jsx";

// ---------------------------------------------------------------------------
// Client-side geo helpers (no new dependencies — plain Math)
// Mirrors the Python haversine in backend/app/scoring/geo.py so the frontend
// can run the same nearest-segment lookup instantly against the already-loaded
// segments list, without an extra network round-trip.
// ---------------------------------------------------------------------------
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Matches the 150 m default radius used by find_nearest_segment() on the
// backend — keep in sync if the server-side default changes.
const NEAREST_RADIUS_M = 150;

function findNearestSegment(lat, lng, segments) {
  let best = null;
  let bestDist = NEAREST_RADIUS_M;
  for (const seg of segments) {
    const d = haversineM(lat, lng, seg.lat, seg.lng);
    if (d < bestDist) {
      bestDist = d;
      best = seg;
    }
  }
  return best; // null if nothing within radius
}

// ---------------------------------------------------------------------------
// SubmitPage
// ---------------------------------------------------------------------------
export default function SubmitPage() {
  const { t, lang, pick } = useLang();
  const [segments, setSegments] = useState([]);
  const [defects, setDefects] = useState([]);
  const [segmentId, setSegmentId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // GPS state: null = not yet attempted, "pending" = waiting for browser,
  // "ok" = coordinates captured, "denied" = permission refused or timed out,
  // "unsupported" = Geolocation API unavailable.
  const [gpsStatus, setGpsStatus] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null); // { lat, lng } | null

  // Map view dynamic center & zoom controller
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(null);

  // True when the segment dropdown was auto-filled from GPS rather than
  // manually chosen by the citizen — drives the label wording so they know
  // it's a suggestion they can still override.
  const [gpsMatchedSegment, setGpsMatchedSegment] = useState(false);

  useEffect(() => {
    api.getSegments().then((segs) => {
      setSegments(segs);
      if (segs.length) setSegmentId(String(segs[0].id));
    });
    api.getDefects().then(setDefects).catch(() => {});
  }, []);

  // Sort segments by distance from the user's GPS coordinates if available,
  // so the nearest segments always appear right at the top of the dropdown.
  const sortedSegments = useMemo(() => {
    if (!gpsCoords || !segments.length) return segments;
    return [...segments].sort((a, b) => {
      const da = haversineM(gpsCoords.lat, gpsCoords.lng, a.lat, a.lng);
      const db = haversineM(gpsCoords.lat, gpsCoords.lng, b.lat, b.lng);
      return da - db;
    });
  }, [segments, gpsCoords]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : null);
    setResult(null);

    if (!f) return;

    // Attempt to capture the device's current position as soon as the user
    // picks a photo — this is the moment they're most likely still on-site.
    // High accuracy gives a more precise reading than the default coarse
    // network-based estimate.
    if (!navigator.geolocation) {
      setGpsStatus("unsupported");
      setGpsCoords(null);
      return;
    }

    setGpsStatus("pending");
    setGpsCoords(null);
    setGpsMatchedSegment(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        setGpsStatus("ok");
        setMapCenter([coords.lat, coords.lng]);
        setMapZoom(16);

        // Auto-select the nearest known segment so the citizen can confirm or
        // correct it rather than scrolling through the full dropdown.
        // Uses the same 150 m radius as the backend's find_nearest_segment().
        const nearest = findNearestSegment(coords.lat, coords.lng, segments);
        if (nearest) {
          setSegmentId(String(nearest.id));
          setGpsMatchedSegment(true);
        }
        // If nothing matched within radius, leave the current dropdown value
        // in place — the citizen will need to confirm manually.
      },
      () => {
        // Permission denied or position unavailable — this is not the
        // citizen's fault, so the message is styled neutrally rather than
        // as an error. The segment dropdown becomes the manual fallback.
        setGpsStatus("denied");
        setGpsCoords(null);
        setGpsMatchedSegment(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  // Called when the citizen drags the map pin. Keeps gpsCoords in sync with
  // the corrected position and re-runs nearest-segment matching in case the
  // drag crossed into a different segment's catchment area.
  function handlePinDrag(newCoords) {
    setGpsCoords(newCoords);
    const nearest = findNearestSegment(newCoords.lat, newCoords.lng, segments);
    if (nearest) {
      setSegmentId(String(nearest.id));
      setGpsMatchedSegment(true);
    } else {
      setGpsMatchedSegment(false);
    }
  }

  function handleSegmentChange(e) {
    const id = e.target.value;
    setSegmentId(id);
    setGpsMatchedSegment(false);
    // If citizen picks a segment manually while GPS is not active,
    // center the map on that segment to give helpful visual context.
    if (!gpsCoords) {
      const seg = segments.find((s) => String(s.id) === String(id));
      if (seg) {
        setMapCenter([seg.lat, seg.lng]);
        setMapZoom(14);
      }
    }
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
      // Only include GPS coordinates when we actually have them; the backend
      // falls back to segment.lat/lng when these fields are absent.
      if (gpsCoords) {
        form.append("lat", String(gpsCoords.lat));
        form.append("lng", String(gpsCoords.lng));
      }
      const res = await api.submitReport(form);
      setResult(res);
    } catch (err) {
      setError(err?.response?.data?.detail || t("submit_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  // The segment dropdown is suppressed only while GPS is actively resolving
  // to avoid the distraction of it jumping to a new value mid-load. It's
  // always shown once GPS settles (ok, denied, or unsupported) or hasn't
  // been triggered yet (initial state before any file is picked).
  const showSegmentDropdown = gpsStatus !== "pending";

  return (
    <div>
      <h1 className="page-title">{t("submit_title")}</h1>
      <p className="page-subtitle">{t("submit_subtitle")}</p>

      <div className="grid-2">
        {/* ── Left column: submission form & explainer ───────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form className="card" style={{ padding: 18 }} onSubmit={handleSubmit}>
            {/* Photo field — required; capture="environment" opens the rear
                camera directly on mobile (ignored on desktop). */}
            <div className="form-field">
              <label>
                {t("submit_photo_label")}
                <span
                  aria-hidden="true"
                  title="Required"
                  style={{ color: "var(--status-critical)", marginLeft: 3 }}
                >
                  *
                </span>
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                required
              />

              {/* GPS status feedback — inline below the file input */}
              {gpsStatus === "pending" && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "block" }}>
                  📍 Acquiring GPS location…
                </span>
              )}
              {gpsStatus === "ok" && gpsCoords && (
                <span style={{ fontSize: 12, color: "var(--status-good, #22c55e)", marginTop: 4, display: "block" }}>
                  📍 Location captured ({gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}) — verify or drag pin on the map 👉
                </span>
              )}
              {(gpsStatus === "denied" || gpsStatus === "unsupported") && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "block" }}>
                  Location not available — please select the nearest road segment below.
                </span>
              )}
            </div>

            {/* Segment dropdown — hidden while GPS is still resolving.
                Label changes to reflect whether the value was auto-matched or
                needs manual selection so the citizen knows what to expect. */}
            {showSegmentDropdown && (
              <div className="form-field">
                <label>
                  {gpsMatchedSegment
                    ? "Nearest segment (auto-selected — you can change this)"
                    : t("submit_segment_label")}
                </label>
                <select
                  value={segmentId}
                  onChange={handleSegmentChange}
                >
                  {sortedSegments.map((s) => {
                    const dist = gpsCoords ? haversineM(gpsCoords.lat, gpsCoords.lng, s.lat, s.lng) : null;
                    const distLabel = dist != null
                      ? dist < 1000
                        ? ` (${Math.round(dist)} m away)`
                        : ` (${(dist / 1000).toFixed(1)} km away)`
                      : "";
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} — {pick(DISTRICT_LABEL_MAP[s.district]) || s.district}{distLabel}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {preview && (
              <div className="image-frame" style={{ marginBottom: 14 }}>
                <img src={preview} alt="preview" />
              </div>
            )}

            <div className="form-field">
              <label>{t("submit_note_label")}</label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("submit_note_placeholder")}
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting || !file}>
              {submitting ? t("submit_button_busy") : t("submit_button")}
            </button>
            {error && <div className="callout callout-error" style={{ marginTop: 12 }}>{error}</div>}
          </form>

          {/* 3-step breakdown relocated under the form in a tidy collapsible element */}
          <details className="card" style={{ padding: "12px 18px", cursor: "pointer" }}>
            <summary style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
              ℹ️ {t("submit_next_title")}
            </summary>
            <ol style={{
              margin: "10px 0 2px",
              paddingLeft: 18,
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.75,
            }}>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Detect</strong>
                {" — "}YOLOv8 scans your photo for potholes and cracks.
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Match or create</strong>
                {" — "}Becomes a new defect in the analyst queue, or a repeat report on an existing one, raising its priority.
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Human review</strong>
                {" — "}An analyst makes the final call. Nothing is dispatched automatically.
              </li>
            </ol>
          </details>
        </div>

        {/* ── Right column: Persistent Dual-Purpose Map + Submission Result ────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Submission result — success, no-defect-detected, or no-segment-matched */}
          {result && (
            <div className="card" style={{ padding: 18 }}>
              <div className={`callout ${result.defect ? "callout-success" : "callout-error"}`}>
                {result.no_segment_matched
                  ? "Your GPS location didn't match any tracked road segment. Please select the nearest one from the dropdown and resubmit."
                  : lang === "ru"
                    ? result.message_ru
                    : result.message}
              </div>

              {result.defect && (
                <div style={{ marginTop: 14 }}>
                  <div className="image-frame" style={{ marginBottom: 10 }}>
                    <img src={mediaUrl(result.defect.image_url)} alt={result.defect.defect_class} />
                  </div>
                  <div className="queue-title-row">
                    <span
                      className="type-dot"
                      style={{ background: DEFECT_TYPE_MAP[result.defect.defect_class]?.color }}
                    />
                    {pick(DEFECT_TYPE_MAP[result.defect.defect_class]?.label) || result.defect.defect_class}
                  </div>
                  <div className="explanation-box">
                    {lang === "ru" ? result.defect.explanation_ru : result.defect.explanation}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Persistent Map Card */}
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {gpsCoords ? "Confirm Defect Location" : "Nearby Road Defects"}
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                  {gpsCoords
                    ? "Drag the blue pin to fine-tune the exact defect location on the road."
                    : "Circle markers show known defects across the city."}
                </p>
              </div>
              {gpsCoords && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 12,
                    background: "rgba(37, 99, 235, 0.12)",
                    color: "var(--series-1, #2563eb)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    marginLeft: 8,
                  }}
                >
                  📍 Pin Draggable
                </span>
              )}
            </div>

            <div style={{ height: 440, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
              <MapView
                defects={defects}
                pendingPin={gpsCoords}
                onPinDrag={handlePinDrag}
                center={mapCenter}
                zoom={mapZoom}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              <span>
                {gpsCoords
                  ? `Lat: ${gpsCoords.lat.toFixed(5)}, Lng: ${gpsCoords.lng.toFixed(5)}`
                  : "Pick a photo to drop your location pin here."}
              </span>
              <span>{defects.length} defect markers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
