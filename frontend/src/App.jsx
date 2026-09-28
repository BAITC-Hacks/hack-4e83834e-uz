import { useEffect } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import QueuePage from "./pages/QueuePage.jsx";
import MapPage from "./pages/MapPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import SubmitPage from "./pages/SubmitPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";
import RequireCitizen from "./components/RequireCitizen.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useLang } from "./i18n.jsx";

function App() {
  const { t, lang, setLang } = useLang();
  const { role, signOut } = useAuth();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link
          to={role === "admin" ? "/queue" : role === "citizen" ? "/submit" : "/"}
          className="brand"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          {t("brand")}
          <span className="brand-sub">{t("brand_sub")}</span>
        </Link>

        {/* Dynamic navigation links gated by role */}
        <nav className="nav-links">
          {role === "admin" && (
            <>
              <NavLink to="/queue" className={({ isActive }) => (isActive ? "active" : "")}>
                {t("nav_queue")}
              </NavLink>
              <NavLink to="/map" className={({ isActive }) => (isActive ? "active" : "")}>
                {t("nav_map")}
              </NavLink>
              <NavLink to="/analytics" className={({ isActive }) => (isActive ? "active" : "")}>
                {t("nav_analytics")}
              </NavLink>
            </>
          )}

          {role === "citizen" && (
            <NavLink to="/submit" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("nav_submit")}
            </NavLink>
          )}
        </nav>

        {/* Right side controls: Sign out (if authenticated) and language switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {role && (
            <button
              onClick={signOut}
              className="btn"
              style={{
                padding: "5px 12px",
                fontSize: "12.5px",
                lineHeight: "1.2",
              }}
            >
              {t("nav_sign_out")}
            </button>
          )}

          <div className="lang-toggle">
            <button
              className={lang === "ru" ? "active" : ""}
              onClick={() => setLang("ru")}
              aria-label="Русский"
            >
              RU
            </button>
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
              aria-label="English"
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route
            path="/queue"
            element={
              <RequireAdmin>
                <QueuePage />
              </RequireAdmin>
            }
          />
          <Route
            path="/map"
            element={
              <RequireAdmin>
                <MapPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireAdmin>
                <AnalyticsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/submit"
            element={
              <RequireCitizen>
                <SubmitPage />
              </RequireCitizen>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
