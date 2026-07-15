import { NavLink, Route, Routes } from "react-router-dom";
import QueuePage from "./pages/QueuePage.jsx";
import MapPage from "./pages/MapPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import SubmitPage from "./pages/SubmitPage.jsx";

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          RoadWatch<span className="brand-sub">repair prioritization</span>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Queue
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => (isActive ? "active" : "")}>
            Map
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? "active" : "")}>
            Analytics
          </NavLink>
          <NavLink to="/submit" className={({ isActive }) => (isActive ? "active" : "")}>
            Submit a report
          </NavLink>
        </nav>
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
