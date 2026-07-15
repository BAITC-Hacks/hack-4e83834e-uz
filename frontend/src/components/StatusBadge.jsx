import { STATUS_META } from "../constants";
import { useLang } from "../i18n.jsx";

export default function StatusBadge({ status }) {
  const { pick } = useLang();
  const meta = STATUS_META[status] || STATUS_META.open;
  return (
    <span className="status-badge">
      <span className="status-dot" style={{ background: meta.color }} />
      {pick(meta.label)}
    </span>
  );
}
