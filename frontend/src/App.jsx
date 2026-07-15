import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import QueuePage from "./pages/QueuePage.jsx";
import MapPage from "./pages/MapPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import SubmitPage from "./pages/SubmitPage.jsx";
import { useLang } from "./i18n.jsx";

function App() {
  const { t, lang, setLang } = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          {t("brand")}
          <span className="brand-sub">{t("brand_sub")}</span>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            {t("nav_queue")}
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => (isActive ? "active" : "")}>
            {t("nav_map")}
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? "active" : "")}>
            {t("nav_analytics")}
          </NavLink>
          <NavLink to="/submit" className={({ isActive }) => (isActive ? "active" : "")}>
            {t("nav_submit")}
          </NavLink>
        </nav>
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
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<QueuePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/submit" element={<SubmitPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
