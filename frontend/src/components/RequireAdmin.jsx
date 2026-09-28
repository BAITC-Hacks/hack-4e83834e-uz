import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../i18n";

export default function RequireAdmin({ children }) {
  const { role, loading } = useAuth();
  const { t } = useLang();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>
        {t("auth_loading")}
      </div>
    );
  }

  if (role !== "admin") {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}
