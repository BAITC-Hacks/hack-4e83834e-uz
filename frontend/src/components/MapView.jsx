import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { DEFECT_TYPE_MAP, STATUS_META } from "../constants";

const ALMATY_CENTER = [43.222, 76.92];

export default function MapView({ defects, onSelect }) {
  return (
    <MapContainer center={ALMATY_CENTER} zoom={11} style={{ height: "100%", width: "100%", borderRadius: 10 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {defects.map((defect) => {
        const statusColor = STATUS_META[defect.status]?.color || "var(--text-muted)";
        const cssColor = resolveCssVar(statusColor);
        const radius = 6 + defect.priority_score * 12;
        const typeMeta = DEFECT_TYPE_MAP[defect.defect_class];
        return (
          <CircleMarker
            key={defect.id}
            center={[defect.segment.lat, defect.segment.lng]}
            radius={radius}
            pathOptions={{ color: cssColor, fillColor: cssColor, fillOpacity: 0.55, weight: 2 }}
          >
            <Popup>
              <div style={{ fontSize: 13 }}>
                <b>{typeMeta?.label || defect.defect_class}</b> · {STATUS_META[defect.status]?.label}
                <br />
                {defect.segment.name}
                <br />
                Priority: {(defect.priority_score * 100).toFixed(0)} / 100
                <br />
                <button
                  style={{ marginTop: 6, cursor: "pointer" }}
                  onClick={() => onSelect(defect)}
                >
                  View details
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

function resolveCssVar(value) {
  if (!value.startsWith("var(")) return value;
  const name = value.slice(4, -1);
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#898781";
}
