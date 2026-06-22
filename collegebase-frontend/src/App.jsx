import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { FilterProvider } from "./context/FilterContext";
import { SavedProvider } from "./context/SavedContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Browser from "./pages/Browser";
import Patterns from "./pages/Patterns";
import Schools from "./pages/Schools";
import Demographics from "./pages/Demographics";
import Similar from "./pages/Similar";
import Saved from "./pages/Saved";
import Archetypes from "./pages/Archetypes";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const THEMES = [
  { id: "dark",     label: "Dark",     icon: "🌑", group: "dark" },
  { id: "midnight", label: "Midnight", icon: "🌊", group: "dark" },
  { id: "forest",   label: "Forest",   icon: "🌲", group: "dark" },
  { id: "rose",     label: "Rose",     icon: "🌸", group: "dark" },
  { id: "sunset",   label: "Sunset",   icon: "🌅", group: "dark" },
  { id: "light",    label: "Light",    icon: "☀️", group: "light" },
  { id: "nord",     label: "Nord",     icon: "❄️", group: "light" },
  { id: "lavender", label: "Lavender", icon: "💜", group: "light" },
];

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(stored) {
  if (stored === "auto") return getSystemTheme();
  return stored || "dark";
}

function ThemePicker() {
  const [stored, setStored] = useState(() => localStorage.getItem("theme") || "auto");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
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

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, ref]);

  const current = THEMES.find((t) => t.id === active) || THEMES[0];

  return (
    <div className="theme-picker" ref={ref}>
      <button className="theme-toggle" onClick={() => setOpen(!open)}
        title="Change theme">
        {stored === "auto" ? "🔄" : current.icon}
      </button>
      {open && (
        <div className="theme-dropdown">
          <button
            className={`theme-option ${stored === "auto" ? "active" : ""}`}
            onClick={() => { setStored("auto"); setOpen(false); }}>
            <span className="theme-option-icon">🔄</span>
            <span>Auto</span>
            <span className="theme-option-hint">System</span>
          </button>
          <div className="theme-group-label">Dark</div>
          {THEMES.filter((t) => t.group === "dark").map((t) => (
            <button key={t.id}
              className={`theme-option ${active === t.id && stored !== "auto" ? "active" : ""}`}
              onClick={() => { setStored(t.id); setOpen(false); }}>
              <span className="theme-option-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
          <div className="theme-group-label">Light</div>
          {THEMES.filter((t) => t.group === "light").map((t) => (
            <button key={t.id}
              className={`theme-option ${active === t.id && stored !== "auto" ? "active" : ""}`}
              onClick={() => { setStored(t.id); setOpen(false); }}>
              <span className="theme-option-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
        <NavLink to="/demographics">Demographics</NavLink>
        <NavLink to="/archetypes">Archetypes</NavLink>
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

function DesktopNav() {
  return (
    <nav className="app-nav">
      <span className="brand">CollegeBase</span>
      <NavLink to="/">Dashboard</NavLink>
      <NavLink to="/browser">Browse</NavLink>
      <NavLink to="/patterns">Patterns</NavLink>
      <NavLink to="/schools">Schools</NavLink>
      <NavLink to="/demographics">Demographics</NavLink>
      <NavLink to="/archetypes">Archetypes</NavLink>
      <NavLink to="/similar">Find Similar</NavLink>
      <NavLink to="/saved">Saved</NavLink>
      <ThemePicker />
    </nav>
  );
}

function MainContent() {
  const location = useLocation();
  return (
    <main className="main-content">
      {/* key by route so a crashed page resets when you navigate away */}
      <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/browser" element={<Browser />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/schools" element={<Schools />} />
          <Route path="/demographics" element={<Demographics />} />
          <Route path="/archetypes" element={<Archetypes />} />
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
          <div className={`app-shell ${isMobile ? "mobile" : ""}`}>
            {isMobile ? (
              <MobileNav menuOpen={menuOpen} setMenuOpen={setMenuOpen}
                filterOpen={filterOpen} setFilterOpen={setFilterOpen} />
            ) : (
              <>
                <DesktopNav />
                <Sidebar />
              </>
            )}

            <MainContent />
          </div>
        </SavedProvider>
      </FilterProvider>
    </BrowserRouter>
  );
}
