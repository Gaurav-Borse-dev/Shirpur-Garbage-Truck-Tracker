import { create } from "zustand";
import {
  useWhatsAppNotification,
  WhatsAppNotificationHost,
  type WhatsAppAlertItem,
} from "./WhatsAppNotification";
import { type SoundType } from "@/lib/notification-sound";

type ToastItem = {
  id: number;
  title: string;
  subtitle?: string;
  tone?: "default" | "success" | "warning" | SoundType;
  link?: string;
  sender?: string;
};

type ToastState = {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
};

export const useToast = create<ToastState>(() => ({
  items: [],
  push: (t) => {
    useWhatsAppNotification.getState().push({
      title: t.title,
      subtitle: t.subtitle,
      tone: t.tone,
      link: t.link,
      sender: t.sender ?? "CleanTrack Shirpur",
    });
  },
  dismiss: (id) => {
    useWhatsAppNotification.getState().dismiss(id);
  },
}));

export function ToastHost() {
  return <WhatsAppNotificationHost />;
}

export { WhatsAppNotificationHost };