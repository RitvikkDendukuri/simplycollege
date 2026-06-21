import { createContext, useContext, useState, useEffect } from "react";

const SavedContext = createContext(null);

export function SavedProvider({ children }) {
  const [savedIds, setSavedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("savedProfiles")) || [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("savedProfiles", JSON.stringify(savedIds));
  }, [savedIds]);

  const toggle = (id) =>
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const isSaved = (id) => savedIds.includes(id);
  const clear = () => setSavedIds([]);

  return (
    <SavedContext.Provider value={{ savedIds, toggle, isSaved, clear }}>
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  return useContext(SavedContext);
}
