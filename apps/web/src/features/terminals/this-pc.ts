import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/*
 * Which checkout device (terminal) this PC is. Picked once by an admin on the Settings page and
 * kept in this browser (plan.md → Settings → Terminals). Bill numbers come from the terminal.
 */

interface ThisPcState {
  terminalId: string | null;
  setTerminalId: (terminalId: string) => void;
}

export const useThisPc = create<ThisPcState>()(
  persist(
    (set) => ({
      terminalId: null,
      setTerminalId: (terminalId) => set({ terminalId }),
    }),
    {
      name: "pos.thisPc",
      // Storage can be blocked (private mode): then the choice only lasts until the tab closes.
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
