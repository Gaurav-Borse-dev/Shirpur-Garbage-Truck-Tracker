import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  alertRadius: number; // meters
  notificationsEnabled: boolean;
  setAlertRadius: (r: number) => void;
  setNotifications: (v: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      alertRadius: 500,
      notificationsEnabled: true,
      setAlertRadius: (alertRadius) => set({ alertRadius }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    { name: "cleantrack-settings" },
  ),
);
