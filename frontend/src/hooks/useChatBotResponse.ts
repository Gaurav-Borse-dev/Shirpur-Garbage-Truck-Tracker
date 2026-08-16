import { useEffect, useRef } from "react";
import { useChatBot } from "@/store/chatbot";
import { useI18n } from "@/store/i18n";

export function useChatBotResponse() {
  const { selectedQuestion, setLoading, addMessage } = useChatBot();
  const lang = useI18n((s) => s.lang);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!selectedQuestion || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setLoading(true);

    const handleResponse = async () => {
      try {
        // Get response based on question and language
        const response = getResponseForQuestion(selectedQuestion, lang);

        // Wait 1 second to simulate fetching
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Add message to state
        addMessage({
          id: `${selectedQuestion}-${Date.now()}`,
          type: "bot",
          content: response,
          timestamp: new Date(),
        });

        setLoading(false);
      } catch (error) {
        console.error("Error:", error);
        setLoading(false);
      }
    };

    handleResponse();

    return () => {
      isProcessingRef.current = false;
    };
  }, [selectedQuestion, lang, setLoading, addMessage]);
}

function getResponseForQuestion(questionId: string, lang: string): string {
  const responses: Record<string, Record<string, string>> = {
    "where-is-truck": {
      en: "🚛 Tipper Truck 01\n📍 Distance: 1.4 km\n⏱️ ETA: 4 minutes\n🚦 Status: Collecting",
      hi: "🚛 टिपर ट्रक 01\n📍 दूरी: 1.4 किमी\n⏱️ ETA: 4 मिनट\n🚦 स्थिति: एकत्रित कर रहा है",
      mr: "🚛 टिपर ट्रक 01\n📍 अंतर: 1.4 किमी\n⏱️ ETA: 4 मिनिटे\n🚦 स्थिती: गोळा करत आहे",
    },
    "how-far": {
      en: "The nearest garbage truck is 1.4 km away.",
      hi: "निकटतम कचरा ट्रक 1.4 किमी दूर है।",
      mr: "सर्वात जवळचा कचरा ट्रक 1.4 किमी दूर आहे।",
    },
    "show-nearby": {
      en: "📍 Trucks near you:\n🚛 Truck 01 - 1.4 km\n🚛 Truck 02 - 2.8 km",
      hi: "📍 आपके पास ट्रकें:\n🚛 ट्रक 01 - 1.4 किमी\n🚛 ट्रक 02 - 2.8 किमी",
      mr: "📍 तुमच्या जवळ ट्रकस:\n🚛 ट्रक 01 - 1.4 किमी\n🚛 ट्रक 02 - 2.8 किमी",
    },
    "assigned-truck": {
      en: "🚛 Truck 01 (GBR-01) is assigned to Shirpur Ward 1.",
      hi: "🚛 ट्रक 01 (GBR-01) शिरपुर वार्ड 1 को सौंपा गया है।",
      mr: "🚛 ट्रक 01 (GBR-01) शिरपुर वार्ड 1 ला नियुक्त केले आहे।",
    },
    "when-arrive": {
      en: "The truck should arrive in 4 minutes.",
      hi: "ट्रक 4 मिनट में आना चाहिए।",
      mr: "ट्रक 4 मिनिटात आले पाहिजे।",
    },
    "time-remaining": {
      en: "⏱️ Time remaining: 4 minutes",
      hi: "⏱️ शेष समय: 4 मिनट",
      mr: "⏱️ शेष वेळ: 4 मिनिटे",
    },
    "current-eta": {
      en: "🚛 ETA: 4 minutes | 📍 Distance: 1.4 km",
      hi: "🚛 ETA: 4 मिनट | 📍 दूरी: 1.4 किमी",
      mr: "🚛 ETA: 4 मिनिटे | 📍 अंतर: 1.4 किमी",
    },
    "is-online": {
      en: "✅ Your truck is online and active.",
      hi: "✅ आपकी ट्रक ऑनलाइन और सक्रिय है।",
      mr: "✅ तुमचा ट्रक ऑनलाइन आणि सक्रिय आहे।",
    },
    "collection-started": {
      en: "✅ Yes, garbage collection has started.",
      hi: "✅ हां, कचरा संग्रह शुरू हो गया है।",
      mr: "✅ होय, कचरा संकलन सुरू झाले आहे।",
    },
    "driver-active": {
      en: "✅ Yes, the driver is active.",
      hi: "✅ हां, ड्राइवर सक्रिय है।",
      mr: "✅ होय, चालक सक्रिय आहे।",
    },
    "enable-alert": {
      en: "🔔 Alerts are now enabled.",
      hi: "🔔 अलर्ट अब सक्षम हैं।",
      mr: "🔔 सतर्कता आता सक्षम आहेत.",
    },
    "change-distance": {
      en: "Change alert distance in Profile settings.",
      hi: "प्रोफ़ाइल सेटिंग्स में दूरी बदलें।",
      mr: "प्रोफाइल सेटिंग्समध्ये अंतर बदला.",
    },
    "no-notification": {
      en: "Check if notifications are enabled.",
      hi: "जांचें कि अधिसूचनाएं सक्षम हैं।",
      mr: "सूचना सक्षम आहे की नाही तपासा.",
    },
    "how-to-book": {
      en: "Go to 'Book a Big Dustbin' and select date.",
      hi: "'बुकिंग' पर जाएं और तारीख चुनें।",
      mr: "'बुकिंग' वर जा आणि तारीख निवडा.",
    },
    "booking-cost": {
      en: "Costs vary by duration. Check booking page.",
      hi: "लागत अवधि के आधार पर भिन्न है।",
      mr: "खर्च अवधीनुसार वेगळा आहे.",
    },
    "edit-profile": {
      en: "Go to Profile → Edit Profile.",
      hi: "प्रोफ़ाइल → संपादित करें पर जाएं।",
      mr: "प्रोफाइल → संपादित करा वर जा.",
    },
    "change-language": {
      en: "Use Language Switcher (top-right).",
      hi: "भाषा स्विचर का उपयोग करें।",
      mr: "भाषा स्विचर वापरा.",
    },
    "about-app": {
      en: "CleanTrack tracks garbage trucks in real-time.",
      hi: "CleanTrack रीयल-टाइम में ट्रकों को ट्रैक करता है।",
      mr: "CleanTrack रीअल-टाइममध्ये ट्रकचा ट्रॅक करते.",
    },
    "report-issue": {
      en: "Go to Profile → Help & Support.",
      hi: "प्रोफ़ाइल → मदद पर जाएं।",
      mr: "प्रोफाइल → मदत वर जा.",
    },
  };

  return responses[questionId]?.[lang] || responses[questionId]?.en || "How can I help?";
}
