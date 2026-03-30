import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PortalMode = "investing" | "syndicating";

export type PortalSwitchOverlay = { caption: string };

type PortalModeContextValue = {
  mode: PortalMode;
  setMode: (mode: PortalMode) => void;
  switchToInvesting: () => void;
  switchToSyndicating: () => void;
  portalSwitchOverlay: PortalSwitchOverlay | null;
  setPortalSwitchOverlay: (overlay: PortalSwitchOverlay | null) => void;
};

const PortalModeContext = createContext<PortalModeContextValue | null>(null);

export function PortalModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PortalMode>("syndicating");
  const [portalSwitchOverlay, setPortalSwitchOverlay] =
    useState<PortalSwitchOverlay | null>(null);
  const value = useMemo(
    () => ({
      mode,
      setMode,
      switchToInvesting: () => setMode("investing"),
      switchToSyndicating: () => setMode("syndicating"),
      portalSwitchOverlay,
      setPortalSwitchOverlay,
    }),
    [mode, portalSwitchOverlay],
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
      portalSwitchOverlay: null,
      setPortalSwitchOverlay: () => {},
    };
  }
  return ctx;
}
