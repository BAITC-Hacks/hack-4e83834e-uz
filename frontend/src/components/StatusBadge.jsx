import { STATUS_META } from "../constants";

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.open;
  return (
    <span className="status-badge">
      <span className="status-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
