import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

// Lets the Report tab switch between real sensor data (/room1/events) and a
// seeded demo month (/sim/room1/events, written by sim/generate_month.py --
// never the real path, see that script's docstring). Per-device preference,
// not synced to Firebase, so it never affects what the live Live/Room tabs
// show (those always read the real /room1/state).
export type DataSource = "real" | "simulated";

const STORAGE_KEY = "wattwise:data-source";

interface DataSourceContextValue {
  source: DataSource;
  setSource: (s: DataSource) => void;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const [source, setSourceState] = useState<DataSource>("real");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "real" || saved === "simulated") setSourceState(saved);
    });
  }, []);

  function setSource(s: DataSource) {
    setSourceState(s);
    AsyncStorage.setItem(STORAGE_KEY, s).catch(() => {});
  }

  return <DataSourceContext.Provider value={{ source, setSource }}>{children}</DataSourceContext.Provider>;
}

export function useDataSource(): DataSourceContextValue {
  const ctx = useContext(DataSourceContext);
  if (!ctx) throw new Error("useDataSource must be used inside DataSourceProvider");
  return ctx;
}
