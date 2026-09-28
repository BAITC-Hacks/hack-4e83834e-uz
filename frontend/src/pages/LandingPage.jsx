import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../i18n";
import PhoneLogin from "../components/PhoneLogin";
import "./LandingPage.css";

/* ── Inline SVG icons ────────────────────────────────────────────── */

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="8" x2="13" y2="8" />
      <polyline points="9,4 13,8 9,12" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────────────── */

export default function LandingPage() {
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const { role, loading } = useAuth();
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [theme, setTheme] = useState("dark");

  // If already authenticated with a known role, automatically redirect to their area
  useEffect(() => {
    if (!loading) {
      if (role === "citizen") {
        navigate("/submit", { replace: true });
      } else if (role === "admin") {
        navigate("/queue", { replace: true });
      }
    }
  }, [role, loading, navigate]);

  const handleCitizenSuccess = () => {
    navigate("/submit");
  };

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <div className={`landing-page${theme === "light" ? " lp-light" : ""}`}>
      {/* ── Navigation ── */}
      <nav className="lp-nav">
        <div className="lp-nav-left">
          <div className="lp-logo-badge">rw</div>
          <div className="lp-brand-block">
            <span className="lp-brand-name">{t("brand")}</span>
            <span className="lp-brand-sub">{t("brand_sub")}</span>
          </div>
        </div>

        <div className="lp-nav-right">
          <div className="lp-lang-toggle">
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
              aria-label="English"
            >
              EN
            </button>
            <button
              className={lang === "ru" ? "active" : ""}
              onClick={() => setLang("ru")}
              aria-label="Русский"
            >
              RU
            </button>
          </div>

          <button
            className="lp-theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            className="lp-nav-cta"
            onClick={() => setShowPhoneLogin(true)}
          >
            {t("hero_btn_start")} <ArrowIcon />
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-eyebrow">
          <span className="lp-eyebrow-dot" />
          {t("hero_eyebrow")}
        </div>

        <h1 className="lp-headline">
          {t("hero_heading_1")}
          <span className="lp-headline-accent">
            {t("hero_heading_highlight")}
          </span>
        </h1>

        <p className="lp-subtext">{t("hero_desc")}</p>

        {!showPhoneLogin ? (
          <div className="lp-cta-row">
            <button
              type="button"
              className="lp-btn-primary"
              onClick={() => setShowPhoneLogin(true)}
            >
              {t("hero_btn_citizen")} <ArrowIcon />
            </button>
          </div>
        ) : (
          <div className="lp-auth-wrapper">
            <button
              type="button"
              className="lp-back-link"
              onClick={() => setShowPhoneLogin(false)}
            >
              ←
            </button>
            <div className="lp-auth-card">
              <PhoneLogin onSuccess={handleCitizenSuccess} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
