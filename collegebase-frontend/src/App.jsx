import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { FilterProvider } from "./context/FilterContext";
import { SavedProvider } from "./context/SavedContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Browser from "./pages/Browser";
import Patterns from "./pages/Patterns";
import Schools from "./pages/Schools";
import Similar from "./pages/Similar";
import Saved from "./pages/Saved";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(stored) {
  if (stored === "auto") return getSystemTheme();
  return stored || "dark";
}

function ThemePicker() {
  const [stored, setStored] = useState(() => localStorage.getItem("theme") || "dark");
  const active = resolveTheme(stored);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", active);
    localStorage.setItem("theme", stored);
  }, [stored, active]);

  useEffect(() => {
    if (stored !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => document.documentElement.setAttribute("data-theme", getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [stored]);

  const nextTheme = active === "dark" ? "light" : "dark";

  return (
    <button className="theme-toggle" onClick={() => setStored(nextTheme)}
      title={`Switch to ${nextTheme} mode`}
      aria-label={`Switch to ${nextTheme} mode`}>
      {active === "dark" ? "◑" : "◐"}
    </button>
  );
}

function MobileNav({ menuOpen, setMenuOpen, filterOpen, setFilterOpen }) {
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location, setMenuOpen]);

  return (
    <>
      <nav className="app-nav">
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu">
          <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
          <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
          <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
        </button>
        <span className="brand">CollegeBase</span>
        <div className="nav-right">
          <button className="filter-toggle" onClick={() => setFilterOpen(!filterOpen)}
            aria-label="Toggle filters">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
              <circle cx="6" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="18" r="2" fill="currentColor" /><circle cx="8" cy="6" r="2" fill="currentColor" />
            </svg>
          </button>
          <ThemePicker />
        </div>
      </nav>

      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/browser">Browse</NavLink>
        <NavLink to="/patterns">Patterns</NavLink>
        <NavLink to="/schools">Schools</NavLink>
        <NavLink to="/similar">Find Similar</NavLink>
        <NavLink to="/saved">Saved</NavLink>
      </div>

      {filterOpen && <div className="mobile-overlay" onClick={() => setFilterOpen(false)} />}
      <div className={`mobile-filter-drawer ${filterOpen ? "open" : ""}`}>
        <div className="mobile-filter-header">
          <span>Filters</span>
          <button onClick={() => setFilterOpen(false)}>✕</button>
        </div>
        <Sidebar />
      </div>
    </>
  );
}

function DesktopNav({ filterOpen, setFilterOpen }) {
  return (
    <>
      <nav className="side-rail">
        <span className="side-rail-brand">CB</span>

        <div className="side-rail-links">
          <NavLink to="/" end data-tooltip="Dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
            </svg>
            <span className="side-rail-label">Dashboard</span>
          </NavLink>
          <NavLink to="/browser" data-tooltip="Browse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
            </svg>
            <span className="side-rail-label">Browse</span>
          </NavLink>
          <NavLink to="/patterns" data-tooltip="Patterns">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 18 8 12 12 16 16 8 20 4" />
              <line x1="4" y1="20" x2="20" y2="20" />
            </svg>
            <span className="side-rail-label">Patterns</span>
          </NavLink>
          <NavLink to="/schools" data-tooltip="Schools">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21V9l9-5 9 5v12" /><path d="M9 21V13h6v8" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            <span className="side-rail-label">Schools</span>
          </NavLink>
          <NavLink to="/similar" data-tooltip="Find Similar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <span className="side-rail-label">Similar</span>
          </NavLink>
          <NavLink to="/saved" data-tooltip="Saved">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3h14a1 1 0 0 1 1 1v16.5a.5.5 0 0 1-.8.4L12 16l-7.2 4.9A.5.5 0 0 1 4 20.5V4a1 1 0 0 1 1-1z" />
            </svg>
            <span className="side-rail-label">Saved</span>
          </NavLink>
        </div>

        <div className="side-rail-bottom">
          <button className="side-rail-action" onClick={() => setFilterOpen(!filterOpen)}
            aria-label="Toggle filters" data-tooltip="Filters">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
              <circle cx="6" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="18" r="2" fill="currentColor" /><circle cx="8" cy="6" r="2" fill="currentColor" />
            </svg>
          </button>
          <ThemePicker />
        </div>
      </nav>

      {filterOpen && <div className="desktop-filter-overlay" onClick={() => setFilterOpen(false)} />}
      <div className={`desktop-filter-drawer ${filterOpen ? "open" : ""}`}>
        <div className="desktop-filter-header">
          <span>Filters</span>
          <button onClick={() => setFilterOpen(false)}>✕</button>
        </div>
        <Sidebar />
      </div>
    </>
  );
}

function MainContent() {
  const location = useLocation();
  return (
    <main className="main-content" id="main-content">
      {/* key by route so a crashed page resets when you navigate away */}
      <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/browser" element={<Browser />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/schools" element={<Schools />} />
          <Route path="/similar" element={<Similar />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </main>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p className="page-sub">The page you're looking for doesn't exist. Try one of the links in the navigation.</p>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <BrowserRouter>
      <FilterProvider>
        <SavedProvider>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <div className={`app-shell ${isMobile ? "mobile" : ""}`}>
            {isMobile ? (
              <MobileNav menuOpen={menuOpen} setMenuOpen={setMenuOpen}
                filterOpen={filterOpen} setFilterOpen={setFilterOpen} />
            ) : (
              <DesktopNav filterOpen={filterOpen} setFilterOpen={setFilterOpen} />
            )}

            <MainContent />
          </div>
        </SavedProvider>
      </FilterProvider>
    </BrowserRouter>
  );
}
