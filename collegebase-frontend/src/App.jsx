import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
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
import "./index.css";

function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <button className="theme-toggle"
      onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
        <SavedProvider>
          <div className="app-shell">
            <nav className="app-nav">
              <span className="brand">CollegeBase</span>
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/browser">Browse</NavLink>
              <NavLink to="/patterns">Patterns</NavLink>
              <NavLink to="/schools">Schools</NavLink>
              <NavLink to="/demographics">Demographics</NavLink>
              <NavLink to="/similar">Find Similar</NavLink>
              <NavLink to="/saved">Saved</NavLink>
              <ThemeToggle />
            </nav>

            <Sidebar />

            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/browser" element={<Browser />} />
                <Route path="/patterns" element={<Patterns />} />
                <Route path="/schools" element={<Schools />} />
                <Route path="/demographics" element={<Demographics />} />
                <Route path="/similar" element={<Similar />} />
                <Route path="/saved" element={<Saved />} />
              </Routes>
            </main>
          </div>
        </SavedProvider>
      </FilterProvider>
    </BrowserRouter>
  );
}
