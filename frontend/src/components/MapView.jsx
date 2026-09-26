import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { DEFECT_TYPE_MAP, STATUS_META } from "../constants";
import { useLang } from "../i18n.jsx";

const ALMATY_CENTER = [43.222, 76.92];

// Custom DivIcon for the draggable pending pin — avoids Leaflet PNG bundling issues
// and provides a sharp, branded pin with a distinct pulsing ring.
const PENDING_PIN_ICON = new L.DivIcon({
  html: `<div style="
    position: relative;
    width: 22px;
    height: 22px;
    background: var(--series-1, #3b82f6);
    border: 3px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
    cursor: grab;
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: "roadwatch-pending-pin",
});

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] != null && center[1] != null) {
      map.setView(center, zoom ?? map.getZoom(), { animate: true });
    }
  }, [center?.[0], center?.[1], zoom, map]);
  return null;
}

function DraggableMarker({ lat, lng, onChange }) {
  const markerRef = useRef(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m) {
          const pos = m.getLatLng();
          onChange?.({ lat: pos.lat, lng: pos.lng });
        }
      },
    }),
    [onChange],
  );

  return (
    <Marker
      draggable
      position={[lat, lng]}
      ref={markerRef}
      icon={PENDING_PIN_ICON}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div style={{ fontSize: 13, minWidth: 160 }}>
          <b>📍 New Defect Location</b>
          <br />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Drag to refine the exact coordinates.
          </span>
          <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapView({
  defects = [],
  onSelect,
  pendingPin = null,
  onPinDrag,
  center,
  zoom = 11,
  style,
}) {
  const { t, pick } = useLang();

  const initialCenter = center || (pendingPin ? [pendingPin.lat, pendingPin.lng] : ALMATY_CENTER);
  const initialZoom = zoom ?? (pendingPin ? 15 : 11);

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      style={{ height: "100%", width: "100%", borderRadius: 10, ...style }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Recenter controller when center or zoom props update */}
      <MapController center={center} zoom={zoom} />

      {/* Existing defects as circle markers */}
      {defects.map((defect) => {
        if (!defect.segment?.lat || !defect.segment?.lng) return null;
        const statusColor = STATUS_META[defect.status]?.color || "var(--text-muted)";
        const cssColor = resolveCssVar(statusColor);
        const radius = 6 + (defect.priority_score || 0.3) * 12;
        const typeMeta = DEFECT_TYPE_MAP[defect.defect_class];
        const lat = defect.lat ?? defect.segment.lat;
        const lng = defect.lng ?? defect.segment.lng;

        return (
          <CircleMarker
            key={defect.id}
            center={[lat, lng]}
            radius={radius}
            pathOptions={{ color: cssColor, fillColor: cssColor, fillOpacity: 0.55, weight: 2 }}
          >
            <Popup>
              <div style={{ fontSize: 13 }}>
                <b>{pick(typeMeta?.label) || defect.defect_class}</b> · {pick(STATUS_META[defect.status]?.label)}
                <br />
                {defect.segment.name}
                <br />
                {t("priority_score_label")}: {((defect.priority_score || 0) * 100).toFixed(0)} / 100
                {onSelect && (
                  <>
                    <br />
                    <button
                      style={{ marginTop: 6, cursor: "pointer" }}
                      onClick={() => onSelect(defect)}
                    >
                      {t("view_details")}
                    </button>
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Draggable pending defect pin */}
      {pendingPin && (
        <DraggableMarker
          lat={pendingPin.lat}
          lng={pendingPin.lng}
          onChange={onPinDrag}
        />
      )}
    </MapContainer>
  );
}

function resolveCssVar(value) {
  if (!value || typeof value !== "string") return "#898781";
  if (!value.startsWith("var(")) return value;
  const name = value.slice(4, -1).split(",")[0].trim();
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#898781";
}
