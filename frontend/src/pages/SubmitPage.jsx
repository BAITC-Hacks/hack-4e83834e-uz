import { useEffect, useState, useCallback } from "react";
import { api, mediaUrl } from "../api";
import { DEFECT_TYPE_MAP } from "../constants";
import { useLang } from "../i18n.jsx";
import MapView from "../components/MapView.jsx";

// ---------------------------------------------------------------------------
// Client-side geo helpers (plain Math)
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
  return best;
}

// ---------------------------------------------------------------------------
// Pure-JS EXIF GPS parser (reads APP1/Exif markers from JPEG ArrayBuffer)
// ---------------------------------------------------------------------------
function extractExifGps(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const view = new DataView(buffer);
        if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
          return resolve(null); // Not a JPEG
        }

        let offset = 2;
        while (offset < view.byteLength) {
          if (view.getUint8(offset) !== 0xff) return resolve(null);
          const marker = view.getUint8(offset + 1);

          if (marker === 0xe1) {
            // APP1 marker
            const app1Len = view.getUint16(offset + 2, false);
            // Check "Exif\0\0" header
            if (
              view.getUint32(offset + 4, false) === 0x45786966 &&
              view.getUint16(offset + 8, false) === 0x0000
            ) {
              const tiffStart = offset + 10;
              const endianMarker = view.getUint16(tiffStart, false);
              const littleEndian = endianMarker === 0x4949; // "II"
              if (!littleEndian && endianMarker !== 0x4d4d) return resolve(null); // "MM"

              const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
              const ifdPtr = tiffStart + firstIfdOffset;
              const numEntries = view.getUint16(ifdPtr, littleEndian);
              let gpsIfdOffset = null;

              for (let i = 0; i < numEntries; i++) {
                const entryOffset = ifdPtr + 2 + i * 12;
                const tag = view.getUint16(entryOffset, littleEndian);
                if (tag === 0x8825) {
                  // GPS Info IFD Pointer
                  gpsIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
                  break;
                }
              }

              if (gpsIfdOffset) {
                const gpsPtr = tiffStart + gpsIfdOffset;
                const gpsEntries = view.getUint16(gpsPtr, littleEndian);
                let latRef = "N";
                let latVals = null;
                let lonRef = "E";
                let lonVals = null;

                for (let i = 0; i < gpsEntries; i++) {
                  const entry = gpsPtr + 2 + i * 12;
                  const tag = view.getUint16(entry, littleEndian);

                  if (tag === 1) {
                    latRef = String.fromCharCode(view.getUint8(entry + 8));
                  } else if (tag === 2) {
                    const valOffset = tiffStart + view.getUint32(entry + 8, littleEndian);
                    latVals = [
                      view.getUint32(valOffset, littleEndian) /
                        (view.getUint32(valOffset + 4, littleEndian) || 1),
                      view.getUint32(valOffset + 8, littleEndian) /
                        (view.getUint32(valOffset + 12, littleEndian) || 1),
                      view.getUint32(valOffset + 16, littleEndian) /
                        (view.getUint32(valOffset + 20, littleEndian) || 1),
                    ];
                  } else if (tag === 3) {
                    lonRef = String.fromCharCode(view.getUint8(entry + 8));
                  } else if (tag === 4) {
                    const valOffset = tiffStart + view.getUint32(entry + 8, littleEndian);
                    lonVals = [
                      view.getUint32(valOffset, littleEndian) /
                        (view.getUint32(valOffset + 4, littleEndian) || 1),
                      view.getUint32(valOffset + 8, littleEndian) /
                        (view.getUint32(valOffset + 12, littleEndian) || 1),
                      view.getUint32(valOffset + 16, littleEndian) /
                        (view.getUint32(valOffset + 20, littleEndian) || 1),
                    ];
                  }
                }

                if (latVals && lonVals) {
                  let lat = latVals[0] + latVals[1] / 60 + latVals[2] / 3600;
                  let lng = lonVals[0] + lonVals[1] / 60 + lonVals[2] / 3600;
                  if (latRef === "S") lat = -lat;
                  if (lonRef === "W") lng = -lng;
                  return resolve({ lat, lng });
                }
              }
            }
            offset += 2 + app1Len;
          } else if (marker >= 0xe0 && marker <= 0xef) {
            offset += 2 + view.getUint16(offset + 2, false);
          } else if (marker === 0xdb || marker === 0xc4 || marker === 0xdd || marker === 0xfe) {
            offset += 2 + view.getUint16(offset + 2, false);
          } else {
            break;
          }
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024)); // First 128KB contains headers & EXIF
  });
}

// ---------------------------------------------------------------------------
// Reverse Geocoder (Nominatim)
// ---------------------------------------------------------------------------
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru,en`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// All defect types available for manual tagging
// ---------------------------------------------------------------------------
const ALL_DEFECT_TAGS = [
  { value: "pothole", label: { en: "Pothole", ru: "Выбоина" } },
  { value: "crack", label: { en: "Crack", ru: "Трещина" } },
  { value: "rutting", label: { en: "Rutting", ru: "Колейность" } },
  { value: "broken_curb", label: { en: "Broken curb", ru: "Повреждённый бордюр" } },
  { value: "faded_marking", label: { en: "Faded marking", ru: "Стёртая разметка" } },
];

// ---------------------------------------------------------------------------
// SubmitPage Component
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

  // GPS state
  const [gpsStatus, setGpsStatus] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);

  // Map view
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(null);
  const [, setGpsMatchedSegment] = useState(false);

  // Geocoded address string (in-map search input sync)
  const [addressName, setAddressName] = useState("");

  // YOLO preview state
  const [detecting, setDetecting] = useState(false);
  const [annotatedUrl, setAnnotatedUrl] = useState(null);
  const [yoloDetections, setYoloDetections] = useState([]);

  // Multi-select defect tags
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    api.getSegments().then((segs) => {
      setSegments(segs);
      if (segs.length) setSegmentId(String(segs[0].id));
    });
    api.getDefects().then(setDefects).catch(() => {});
  }, []);

  // ── Apply coordinates helper ──────────────────────────────────────
  const applyCoordinates = useCallback(
    async (coords) => {
      setGpsCoords(coords);
      setGpsStatus("ok");
      setMapCenter([coords.lat, coords.lng]);
      setMapZoom(16);

      const nearest = findNearestSegment(coords.lat, coords.lng, segments);
      if (nearest) {
        setSegmentId(String(nearest.id));
        setGpsMatchedSegment(true);
      } else {
        setGpsMatchedSegment(false);
      }

      // Reverse geocode to resolve human-readable address & auto-populate search bar
      const addr = await reverseGeocode(coords.lat, coords.lng);
      if (addr) {
        setAddressName(addr);
      }
    },
    [segments]
  );

  // ── GPS & EXIF geolocation on file pick ───────────────────────────
  async function handleFile(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : null);
    setResult(null);
    setAnnotatedUrl(null);
    setYoloDetections([]);
    setSelectedTags([]);
    setAddressName("");

    if (!f) return;

    // Run YOLO detection preview
    runDetectionPreview(f);

    setGpsStatus("pending");
    setGpsCoords(null);
    setGpsMatchedSegment(false);

    // 1. Try extracting EXIF GPS from uploaded image first
    let photoCoords = null;
    try {
      photoCoords = await extractExifGps(f);
    } catch (err) {
      console.warn("EXIF extraction error:", err);
    }

    if (photoCoords && photoCoords.lat && photoCoords.lng) {
      applyCoordinates(photoCoords);
      return;
    }

    // 2. Fallback to device browser geolocation if no EXIF present
    if (!navigator.geolocation) {
      setGpsStatus("unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setGpsStatus("denied");
        setGpsCoords(null);
        setGpsMatchedSegment(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // ── YOLO detection preview ────────────────────────────────────────
  async function runDetectionPreview(imageFile) {
    setDetecting(true);
    try {
      const form = new FormData();
      form.append("file", imageFile);
      const res = await api.detectPreview(form);
      setAnnotatedUrl(res.annotated_image_url);
      setYoloDetections(res.detections || []);
      // Auto-fill tags from detections (unique classes)
      const autoTags = [...new Set((res.detections || []).map((d) => d.defect_class))];
      setSelectedTags(autoTags);
    } catch (err) {
      console.warn("Detection preview failed:", err);
      setAnnotatedUrl(null);
      setYoloDetections([]);
    } finally {
      setDetecting(false);
    }
  }

  // ── Draggable pin handler ─────────────────────────────────────────
  const handlePinDrag = useCallback(
    async (newCoords) => {
      setGpsCoords(newCoords);
      const nearest = findNearestSegment(newCoords.lat, newCoords.lng, segments);
      if (nearest) {
        setSegmentId(String(nearest.id));
        setGpsMatchedSegment(true);
      } else {
        setGpsMatchedSegment(false);
      }

      // Reverse geocode on drag to sync address search bar
      const addr = await reverseGeocode(newCoords.lat, newCoords.lng);
      if (addr) {
        setAddressName(addr);
      }
    },
    [segments]
  );

  // ── In-map geocoder search selection ──────────────────────────────
  const handleGeocode = useCallback(
    ({ lat, lng, name }) => {
      setGpsCoords({ lat, lng });
      setGpsStatus("ok");
      setMapCenter([lat, lng]);
      setMapZoom(16);
      setAddressName(name || "");

      const nearest = findNearestSegment(lat, lng, segments);
      if (nearest) {
        setSegmentId(String(nearest.id));
        setGpsMatchedSegment(true);
      } else {
        setGpsMatchedSegment(false);
      }
    },
    [segments]
  );

  const handleClearAddress = useCallback(() => {
    setAddressName("");
  }, []);

  // ── Tag management ────────────────────────────────────────────────
  function addTag(value) {
    if (!selectedTags.includes(value)) {
      setSelectedTags([...selectedTags, value]);
    }
  }

  function removeTag(value) {
    setSelectedTags(selectedTags.filter((t) => t !== value));
  }

  // ── Submit ────────────────────────────────────────────────────────
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
      if (gpsCoords) {
        form.append("lat", String(gpsCoords.lat));
        form.append("lng", String(gpsCoords.lng));
      }
      if (selectedTags.length) {
        form.append("defect_tags", JSON.stringify(selectedTags));
      }
      const res = await api.submitReport(form);
      setResult(res);
    } catch (err) {
      setError(err?.response?.data?.detail || t("submit_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">{t("submit_title")}</h1>
      <p className="page-subtitle">{t("submit_subtitle")}</p>

      <form onSubmit={handleSubmit}>
        <div className="submit-grid-container">
          {/* ── 1. Photo upload + YOLO preview & defect chips ──────── */}
          <div className="submit-panel-photo card" style={{ padding: 18 }}>
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

              {/* GPS status feedback */}
              {gpsStatus === "pending" && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 4,
                    display: "block",
                  }}
                >
                  📍 {lang === "ru" ? "Определение GPS-координат…" : "Acquiring GPS location…"}
                </span>
              )}
              {gpsStatus === "ok" && gpsCoords && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--status-good, #22c55e)",
                    marginTop: 4,
                    display: "block",
                    lineHeight: 1.4,
                  }}
                >
                  📍 {lang === "ru" ? "Координаты получены" : "Location captured"} (
                  {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)})
                  {addressName ? ` — ${addressName}` : ""}
                </span>
              )}
              {(gpsStatus === "denied" || gpsStatus === "unsupported") && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 4,
                    display: "block",
                  }}
                >
                  📍{" "}
                  {lang === "ru"
                    ? "Геолокация недоступна — найдите адрес на карте справа."
                    : "Location not available — use the search bar on the map to set your location."}
                </span>
              )}
            </div>

            {/* YOLO Detection Preview */}
            {file && (
              <div className="form-field" style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  {lang === "ru" ? "Результат ИИ-анализа" : "AI Detection Preview"}
                </label>

                {detecting && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      padding: "12px 0",
                    }}
                  >
                    <span
                      className="spinner"
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid var(--border)",
                        borderTopColor: "var(--series-1)",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    {lang === "ru" ? "Анализ фото…" : "Analyzing photo…"}
                  </div>
                )}

                {!detecting && annotatedUrl && (
                  <div className="image-frame" style={{ marginBottom: 8 }}>
                    <img src={mediaUrl(annotatedUrl)} alt="YOLO annotated preview" />
                  </div>
                )}

                {!detecting && !annotatedUrl && preview && (
                  <div className="image-frame" style={{ marginBottom: 8 }}>
                    <img src={preview} alt="preview" />
                  </div>
                )}

                {!detecting && yoloDetections.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                    {lang === "ru"
                      ? `Обнаружено ${yoloDetections.length} дефект(ов):`
                      : `Detected ${yoloDetections.length} defect(s):`}{" "}
                    {yoloDetections.map((d, i) => (
                      <span key={i} style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {pick(DEFECT_TYPE_MAP[d.defect_class]?.label) || d.defect_class} (
                        {(d.confidence * 100).toFixed(0)}%)
                        {i < yoloDetections.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                )}

                {!detecting && yoloDetections.length === 0 && preview && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      marginBottom: 6,
                      fontStyle: "italic",
                    }}
                  >
                    {lang === "ru"
                      ? "ИИ не обнаружил дефектов на фото. Вы можете указать тип вручную ниже."
                      : "AI didn't detect any defects. You can tag the defect type manually below."}
                  </div>
                )}
              </div>
            )}

            {/* Multi-Select Defect Tags / Chips */}
            {file && (
              <div className="form-field" style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  {lang === "ru" ? "Тип дефекта" : "Defect type"}
                </label>

                {/* Selected chips */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: selectedTags.length ? 8 : 0,
                  }}
                >
                  {selectedTags.map((tag) => {
                    const meta = ALL_DEFECT_TAGS.find((t) => t.value === tag);
                    return (
                      <span
                        key={tag}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 10px",
                          borderRadius: 12,
                          background: "rgba(59, 130, 246, 0.12)",
                          color: "var(--series-1, #3b82f6)",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {meta ? pick(meta.label) : tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "inherit",
                            fontSize: 14,
                            lineHeight: 1,
                            padding: 0,
                            marginLeft: 2,
                          }}
                          aria-label={`Remove ${tag}`}
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>

                {/* Add tag dropdown */}
                {(() => {
                  const available = ALL_DEFECT_TAGS.filter((t) => !selectedTags.includes(t.value));
                  if (!available.length) return null;
                  return (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) addTag(e.target.value);
                      }}
                      style={{ fontSize: 13, maxWidth: 240 }}
                    >
                      <option value="">
                        {lang === "ru" ? "+ добавить тип…" : "+ add defect type…"}
                      </option>
                      {available.map((t) => (
                        <option key={t.value} value={t.value}>
                          {pick(t.label)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── 2. In-Map Geocoding Search & Defect Pin Confirmation ── */}
          <div
            className="submit-panel-map card"
            style={{ padding: 18, display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {gpsCoords
                    ? lang === "ru"
                      ? "Подтвердите местоположение"
                      : "Confirm Defect Location"
                    : lang === "ru"
                      ? "Укажите местоположение"
                      : "Set Defect Location"}
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                  {gpsCoords
                    ? lang === "ru"
                      ? "Перетащите маркер или найдите адрес в строке поиска на карте."
                      : "Drag the pin or use the search bar on the map to refine."
                    : lang === "ru"
                      ? "Используйте строку поиска на карте, чтобы найти нужный адрес."
                      : "Use the search bar on the map to find the defect location."}
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
                  📍 {lang === "ru" ? "Маркер" : "Pin Draggable"}
                </span>
              )}
            </div>

            <div className="submit-map-wrapper">
              <MapView
                defects={defects}
                pendingPin={gpsCoords}
                onPinDrag={handlePinDrag}
                center={mapCenter}
                zoom={mapZoom}
                showGeocoder={true}
                searchAddress={addressName}
                onGeocode={handleGeocode}
                onClearAddress={handleClearAddress}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <span>
                {gpsCoords
                  ? `Lat: ${gpsCoords.lat.toFixed(5)}, Lng: ${gpsCoords.lng.toFixed(5)}`
                  : lang === "ru"
                    ? "Найдите адрес на карте или сделайте фото."
                    : "Search for an address on the map or take a photo."}
              </span>
              <span>
                {defects.length} {lang === "ru" ? "дефектов" : "defect markers"}
              </span>
            </div>
          </div>

          {/* ── 3. Comments textarea + "Отправить" submit button ───── */}
          <div className="submit-panel-submit card" style={{ padding: 18 }}>
            <div className="form-field">
              <label>{t("submit_note_label")}</label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("submit_note_placeholder")}
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting || !file}
              style={{ width: "100%", padding: "11px 16px", fontSize: 14 }}
            >
              {submitting ? t("submit_button_busy") : t("submit_button")}
            </button>
            {error && (
              <div className="callout callout-error" style={{ marginTop: 12 }}>
                {error}
              </div>
            )}
          </div>

          {/* ── 4. Submission Result & Explainer ───────────────────── */}
          <div
            className="submit-panel-info"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {result && (
              <div className="card" style={{ padding: 18 }}>
                <div className={`callout ${result.defect ? "callout-success" : "callout-error"}`}>
                  {result.no_segment_matched
                    ? lang === "ru"
                      ? "Ваши координаты не совпали ни с одним участком. Найдите адрес на карте и попробуйте снова."
                      : "Your GPS location didn't match any tracked road segment. Use the map search and resubmit."
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
                      {pick(DEFECT_TYPE_MAP[result.defect.defect_class]?.label) ||
                        result.defect.defect_class}
                    </div>
                    <div className="explanation-box">
                      {lang === "ru" ? result.defect.explanation_ru : result.defect.explanation}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3-step breakdown */}
            <details className="card" style={{ padding: "12px 18px", cursor: "pointer" }}>
              <summary
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}
              >
                ℹ️ {t("submit_next_title")}
              </summary>
              <ol
                style={{
                  margin: "10px 0 2px",
                  paddingLeft: 18,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.75,
                }}
              >
                <li>
                  <strong style={{ color: "var(--text-primary)" }}>Detect</strong>
                  {" — "}YOLOv8 scans your photo for potholes and cracks.
                </li>
                <li>
                  <strong style={{ color: "var(--text-primary)" }}>Match or create</strong>
                  {" — "}Becomes a new defect in the analyst queue, or a repeat report on an existing
                  one, raising its priority.
                </li>
                <li>
                  <strong style={{ color: "var(--text-primary)" }}>Human review</strong>
                  {" — "}An analyst makes the final call. Nothing is dispatched automatically.
                </li>
              </ol>
            </details>
          </div>
        </div>
      </form>
    </div>
  );
}
