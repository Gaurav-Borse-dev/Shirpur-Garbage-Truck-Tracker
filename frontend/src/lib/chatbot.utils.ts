import { Lang } from "@/store/i18n";

// Category definitions
export const CHATBOT_CATEGORIES = [
  {
    id: "truck-location",
    icon: "🚛",
    label: {
      en: "Truck Location",
      hi: "ट्रक का स्थान",
      mr: "ट्रकचे स्थान",
    },
  },
  {
    id: "arrival-eta",
    icon: "⏱️",
    label: {
      en: "Arrival / ETA",
      hi: "आगमन / ETA",
      mr: "आगमन / ETA",
    },
  },
  {
    id: "area-route",
    icon: "📍",
    label: {
      en: "Area & Route",
      hi: "क्षेत्र और मार्ग",
      mr: "क्षेत्र आणि मार्ग",
    },
  },
  {
    id: "truck-status",
    icon: "🚦",
    label: {
      en: "Truck Status",
      hi: "ट्रक की स्थिति",
      mr: "ट्रकची स्थिती",
    },
  },
  {
    id: "big-dustbin",
    icon: "🗑️",
    label: {
      en: "Big Dustbin Booking",
      hi: "बड़े कचरे के डिब्बे की बुकिंग",
      mr: "मोठ्या कचराकुंडी बुकिंग",
    },
  },
  {
    id: "notifications",
    icon: "🔔",
    label: {
      en: "Notifications",
      hi: "सूचनाएं",
      mr: "सूचना",
    },
  },
  {
    id: "profile-help",
    icon: "👤",
    label: {
      en: "Profile Help",
      hi: "प्रोफ़ाइल सहायता",
      mr: "प्रोफाइल मदत",
    },
  },
  {
    id: "general-help",
    icon: "ℹ️",
    label: {
      en: "General Help",
      hi: "सामान्य सहायता",
      mr: "सामान्य मदत",
    },
  },
];

// Questions for each category
export const CATEGORY_QUESTIONS = {
  "truck-location": [
    {
      id: "where-is-truck",
      label: {
        en: "Where is my garbage truck?",
        hi: "मेरी कचरा गाड़ी कहाँ है?",
        mr: "माझी कचरा गाडी कोठे आहे?",
      },
    },
    {
      id: "how-far",
      label: {
        en: "How far is the truck from me?",
        hi: "ट्रक मुझ से कितना दूर है?",
        mr: "ट्रक माझ्यापासून कितर दूर आहे?",
      },
    },
    {
      id: "show-nearby",
      label: {
        en: "Show nearby truck",
        hi: "पास की ट्रक दिखाएं",
        mr: "जवळचा ट्रक दाखवा",
      },
    },
    {
      id: "assigned-truck",
      label: {
        en: "Which truck is assigned to my area?",
        hi: "मेरे क्षेत्र को कौन सी ट्रक सौंपी गई है?",
        mr: "माझ्या क्षेत्राला कोणती ट्रक नियुक्त केली आहे?",
      },
    },
  ],
  "arrival-eta": [
    {
      id: "when-arrive",
      label: {
        en: "When will the truck arrive?",
        hi: "ट्रक कब आएगी?",
        mr: "ट्रक कधी येईल?",
      },
    },
    {
      id: "time-remaining",
      label: {
        en: "How much time is remaining?",
        hi: "कितना समय बाकी है?",
        mr: "किती वेळ उरली आहे?",
      },
    },
    {
      id: "current-eta",
      label: {
        en: "What is current ETA?",
        hi: "वर्तमान ETA क्या है?",
        mr: "सद्य ETA काय आहे?",
      },
    },
  ],
  "truck-status": [
    {
      id: "is-online",
      label: {
        en: "Is my truck online?",
        hi: "क्या मेरी ट्रक ऑनलाइन है?",
        mr: "माझी ट्रक ऑनलाइन आहे का?",
      },
    },
    {
      id: "collection-started",
      label: {
        en: "Is garbage collection started?",
        hi: "क्या कचरा संग्रह शुरू हुआ?",
        mr: "कचरा संकलन सुरू झाले आहे का?",
      },
    },
    {
      id: "driver-active",
      label: {
        en: "Is driver active?",
        hi: "क्या ड्राइवर सक्रिय है?",
        mr: "चालक सक्रिय आहे का?",
      },
    },
  ],
  notifications: [
    {
      id: "enable-alert",
      label: {
        en: "Enable truck arrival alert",
        hi: "ट्रक आगमन अलर्ट सक्षम करें",
        mr: "ट्रक आगमन सतर्कता सक्षम करा",
      },
    },
    {
      id: "change-distance",
      label: {
        en: "Change alert distance",
        hi: "अलर्ट दूरी बदलें",
        mr: "सतर्कता दूरी बदला",
      },
    },
    {
      id: "no-notification",
      label: {
        en: "Why I didn't receive notification?",
        hi: "मुझे सूचना क्यों नहीं मिली?",
        mr: "मला सूचना का मिली नाही?",
      },
    },
  ],
  "big-dustbin": [
    {
      id: "how-to-book",
      label: {
        en: "How to book big dustbin?",
        hi: "बड़े कचरे के डिब्बे की बुकिंग कैसे करें?",
        mr: "मोठ्या कचराकुंडी बुकिंग कशी करायची?",
      },
    },
    {
      id: "booking-cost",
      label: {
        en: "What is the cost?",
        hi: "लागत क्या है?",
        mr: "खर्च काय आहे?",
      },
    },
  ],
  "profile-help": [
    {
      id: "edit-profile",
      label: {
        en: "How to edit my profile?",
        hi: "अपनी प्रोफाइल को कैसे संपादित करें?",
        mr: "माझी प्रोफाइल कशी संपादित करायची?",
      },
    },
    {
      id: "change-language",
      label: {
        en: "How to change language?",
        hi: "भाषा कैसे बदलें?",
        mr: "भाषा कशी बदलायची?",
      },
    },
  ],
  "general-help": [
    {
      id: "about-app",
      label: {
        en: "About CleanTrack",
        hi: "क्लीनट्रैक के बारे में",
        mr: "क्लीनट्रॅकबद्दल",
      },
    },
    {
      id: "report-issue",
      label: {
        en: "Report an issue",
        hi: "एक समस्या की रिपोर्ट करें",
        mr: "समस्येचा अहवाल द्या",
      },
    },
  ],
};

// Greeting messages
export const GREETINGS = {
  en: "Hello 👋 How can I help you?",
  hi: "नमस्ते 👋 मैं आपकी कैसे मदद कर सकता हूँ?",
  mr: "नमस्कार 👋 मी तुमची कशी मदत करू शकतो?",
};

// Helper to get label by language
export function getLabel(labels: Record<Lang, string>, lang: Lang): string {
  return labels[lang] || labels.en;
}

// Format distance
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

// Format time
export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
