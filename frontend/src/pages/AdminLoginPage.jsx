import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../i18n";
import "./AdminLoginPage.css";

export default function AdminLoginPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { role, loading, signInAdmin, authError, setAuthError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState(null);

  // If already authenticated as admin, redirect to queue
  useEffect(() => {
    if (!loading && role === "admin") {
      navigate("/queue", { replace: true });
    }
  }, [role, loading, navigate]);

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminError(null);
    setAuthError(null);

    if (!email.trim() || !password) return;

    setAdminBusy(true);
    const result = await signInAdmin(email.trim(), password);
    setAdminBusy(false);

    if (result.success) {
      navigate("/queue");
    } else {
      setAdminError(result.error);
    }
  };

  return (
    <div className="admin-login-root">
      <div className="admin-login-card">
        <div>
          <h1>{t("landing_admin_title")}</h1>
          <p className="admin-login-desc">{t("landing_admin_desc")}</p>
        </div>

        <form onSubmit={handleAdminSubmit}>
          <div className="form-field" style={{ marginBottom: "14px" }}>
            <label htmlFor="admin-email">{t("landing_email_label")}</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@roadwatch.kz"
              required
              disabled={adminBusy}
              autoComplete="username"
            />
          </div>

          <div className="form-field" style={{ marginBottom: "18px" }}>
            <label htmlFor="admin-password">
              {t("landing_password_label")}
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={adminBusy}
              autoComplete="current-password"
            />
          </div>

          {(adminError || authError) && (
            <div
              className="callout callout-error"
              style={{
                marginBottom: "16px",
                fontSize: "12.5px",
                padding: "10px 12px",
              }}
            >
              {adminError || authError}
            </div>
          )}

          <div style={{ marginTop: "18px" }}>
            <button
              type="submit"
              className="admin-login-submit"
              disabled={adminBusy || !email.trim() || !password}
            >
              {adminBusy ? t("landing_login_busy") : t("landing_login_btn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
