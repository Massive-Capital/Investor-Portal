import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PortalMode = "investing" | "syndicating";

type PortalModeContextValue = {
  mode: PortalMode;
  setMode: (mode: PortalMode) => void;
  switchToInvesting: () => void;
  switchToSyndicating: () => void;
};

const PortalModeContext = createContext<PortalModeContextValue | null>(null);

export function PortalModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PortalMode>("syndicating");
  const value = useMemo(
    () => ({
      mode,
      setMode,
      switchToInvesting: () => setMode("investing"),
      switchToSyndicating: () => setMode("syndicating"),
    }),
    [mode],
  );
  return (
    <PortalModeContext.Provider value={value}>
      {children}
    </PortalModeContext.Provider>
  );
}

export function usePortalMode(): PortalModeContextValue {
  const ctx = useContext(PortalModeContext);
  if (!ctx) {
    return {
      mode: "syndicating",
      setMode: () => {},
      switchToInvesting: () => {},
      switchToSyndicating: () => {},
    };
  }
  return ctx;
}
