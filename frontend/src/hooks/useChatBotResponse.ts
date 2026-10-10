import { useEffect, useRef } from "react";
import { useChatBot } from "@/store/chatbot";
import { useLang } from "@/lib/i18n";

export function useChatBotResponse() {
  const { selectedQuestion, setLoading, addMessage } = useChatBot();
  const lang = useLang();
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

import { useTrucks } from "@/store/trucks";

function getResponseForQuestion(questionId: string, lang: string): string {
  const trucks = Object.values(useTrucks.getState().trucks);
  const onlineTrucks = trucks.filter((t) => t.status !== "offline");

  switch (questionId) {
    case "where-is-truck":
    case "how-far":
    case "current-eta": {
      if (onlineTrucks.length === 0) {
        const msg = {
          en: "No collection trucks are currently active on your route. Collection runs daily in the morning.",
          hi: "वर्तमान में आपके मार्ग पर कोई कचरा गाड़ी सक्रिय नहीं है। संग्रह सुबह होता है।",
          mr: "सध्या तुमच्या मार्गावर कोणतीही कचरा गाडी सक्रिय नाही. संकलन सकाळी केले जाते.",
        };
        return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
      }
      const t = onlineTrucks[0];
      const speed = t.speedMps > 0 ? `${Math.round(t.speedMps * 3.6)} km/h` : "Collecting";
      const msg = {
        en: `🚛 ${t.truck.name || t.truck.id}\n📍 Ward: ${t.truck.wardName || "Shirpur"}\n🚦 Status: ${t.status === "collecting" ? "Collecting" : "Online"}\n⚡ Speed: ${speed}`,
        hi: `🚛 ${t.truck.name || t.truck.id}\n📍 प्रभाग: ${t.truck.wardName || "शिरपुर"}\n🚦 स्थिति: ${t.status === "collecting" ? "एकत्रित कर रहा है" : "ऑनलाइन"}\n⚡ गति: ${speed}`,
        mr: `🚛 ${t.truck.name || t.truck.id}\n📍 प्रभाग: ${t.truck.wardName || "शिरपूर"}\n🚦 स्थिती: ${t.status === "collecting" ? "गोळा करत आहे" : "ऑनलाइन"}\n⚡ वेग: ${speed}`,
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "show-nearby": {
      if (onlineTrucks.length === 0) {
        const msg = {
          en: "📍 No active collection trucks found near your location at this moment.",
          hi: "📍 इस समय आपके स्थान के पास कोई सक्रिय कचरा गाड़ी नहीं मिली।",
          mr: "📍 या वेळी तुमच्या स्थानाजवळ कोणतीही सक्रिय कचरा गाडी आढळली नाही.",
        };
        return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
      }
      const list = onlineTrucks
        .slice(0, 3)
        .map((t) => `🚛 ${t.truck.name || t.truck.id} — ${t.truck.wardName || "Shirpur"}`)
        .join("\n");
      const msg = {
        en: `📍 Active trucks in Shirpur:\n${list}`,
        hi: `📍 शिरपुर में सक्रिय ट्रकें:\n${list}`,
        mr: `📍 शिरपूरमधील सक्रिय ट्रक:\n${list}`,
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "assigned-truck": {
      const msg = {
        en: "Trucks are assigned dynamically to Shirpur wards. View the Live Map to check the truck assigned to your ward.",
        hi: "शिरपुर के वार्डों में गाड़ियां गतिशील रूप से तैनात की जाती हैं। लाइव मैप पर अपने वार्ड की गाड़ी देखें।",
        mr: "शिरपूरच्या प्रभागांना गाड्या गतिशीलपणे नियुक्त केल्या जातात. थेट नकाशावर आपल्या प्रभागाची गाडी पहा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "when-arrive":
    case "time-remaining": {
      if (onlineTrucks.length === 0) {
        const msg = {
          en: "Collection runs during morning hours. Please check the Live Map when trucks go on duty.",
          hi: "संग्रह सुबह के समय होता है। जब गाड़ियां ड्यूटी पर हों तो कृपया लाइव मैप देखें।",
          mr: "संकलन सकाळच्या वेळी चालते. गाड्या ड्युटीवर असताना कृपया थेट नकाशा तपासा.",
        };
        return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
      }
      const msg = {
        en: "Real-time ETA is calculated from the truck's live GPS navigation. Check the Resident Home screen for live tracking.",
        hi: "रीयल-टाइम ETA की गणना ट्रक के लाइव GPS से की जाती है। लाइव ट्रैकिंग के लिए होम स्क्रीन देखें।",
        mr: "थेट GPS वरून थेट ETA मोजला जातो. थेट ट्रॅकिंगसाठी होम स्क्रीन पहा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "is-online":
    case "driver-active": {
      const activeCount = onlineTrucks.length;
      if (activeCount > 0) {
        const msg = {
          en: `✅ ${activeCount} collection truck(s) currently online and on duty.`,
          hi: `✅ वर्तमान में ${activeCount} कचरा गाड़ी ऑनलाइन और ड्यूटी पर हैं।`,
          mr: `✅ सध्या ${activeCount} कचरा गाडी ऑनलाइन आणि ड्युटीवर आहेत.`,
        };
        return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
      }
      const msg = {
        en: "Collection fleet is currently off duty.",
        hi: "कचरा संग्रह फ्लीट वर्तमान में ऑफ-ड्यूटी है।",
        mr: "कचरा संकलन फ्लीट सध्या ऑफ-ड्युटी आहे.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "collection-started": {
      if (onlineTrucks.length > 0) {
        const msg = {
          en: "✅ Yes, municipal waste collection is currently in progress.",
          hi: "✅ हां, नगरपरिषद कचरा संग्रह वर्तमान में चालू है।",
          mr: "✅ होय, नगरपरिषद कचरा संकलन सध्या चालू आहे.",
        };
        return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
      }
      const msg = {
        en: "Collection starts in the morning. Check the Live Map for real-time progress.",
        hi: "कचरा संग्रह सुबह शुरू होता है। रीयल-टाइम स्थिति के लिए लाइव मैप देखें।",
        mr: "कचरा संकलन सकाळी सुरू होते. थेट स्थितीसाठी थेट नकाशा पहा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "enable-alert": {
      const msg = {
        en: "🔔 You can manage alert preferences and push notifications in Notification Settings.",
        hi: "🔔 आप अधिसूचना सेटिंग्स में अलर्ट प्राथमिकताएं प्रबंधित कर सकते हैं।",
        mr: "🔔 तुम्ही सूचना सेटिंग्जमध्ये सतर्कता प्राधान्ये व्यवस्थापित करू शकता.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "change-distance": {
      const msg = {
        en: "Change alert distance in Profile → Alert distance.",
        hi: "प्रोफ़ाइल → अलर्ट दूरी में जाकर दूरी बदलें।",
        mr: "प्रोफाइल → सतर्कता अंतर मध्ये जाऊन अंतर बदला.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "no-notification": {
      const msg = {
        en: "Ensure browser/device notification permissions are granted in Notification Settings.",
        hi: "सुनिश्चित करें कि अधिसूचना सेटिंग्स में सूचना अनुमतियां सक्षम हैं।",
        mr: "सूचना सेटिंग्जमध्ये सूचना परवानग्या सक्षम असल्याची खात्री करा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "how-to-book": {
      const msg = {
        en: "Go to 'Book a Big Dustbin' in your Profile to request a community dustbin for events.",
        hi: "कार्यक्रमों के लिए बड़ा डस्टबिन बुक करने के लिए प्रोफ़ाइल में 'बड़ा डस्टबिन बुक करें' पर जाएं।",
        mr: "कार्यक्रमांसाठी मोठा डस्टबिन मागवण्यासाठी प्रोफाइलमध्ये 'मोठा डस्टबिन बुक करा' वर जा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "booking-cost": {
      const msg = {
        en: "Community dustbin bookings are provided by Shirpur Municipal Council. Submit your request for review.",
        hi: "सामुदायिक डस्टबिन बुकिंग शिरपुर नगरपरिषद द्वारा प्रदान की जाती है। समीक्षा के लिए अपना अनुरोध सबमिट करें।",
        mr: "सामुदायिक डस्टबिन बुकिंग शिरपूर नगरपरिषदेद्वारे पुरवली जाते. पुनरावलोकनासाठी आपली विनंती सबमिट करा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "edit-profile": {
      const msg = {
        en: "Open the Profile tab to view and manage your account details.",
        hi: "अपने खाते के विवरण देखने और प्रबंधित करने के लिए प्रोफ़ाइल टैब खोलें।",
        mr: "आपल्या खात्याचा तपशील पाहण्यासाठी आणि व्यवस्थापित करण्यासाठी प्रोफाइल टॅब उघडा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "change-language": {
      const msg = {
        en: "Use the Language Switcher in the top-right corner to switch between English, Hindi, and Marathi.",
        hi: "अंग्रेजी, हिंदी और मराठी के बीच स्विच करने के लिए ऊपर दाईं ओर भाषा स्विचर का उपयोग करें।",
        mr: "इंग्रजी, हिंदी आणि मराठी दरम्यान स्विच करण्यासाठी वर उजव्या कोपऱ्यात भाषा स्विचर वापरा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "about-app": {
      const msg = {
        en: "CleanTrack is the official real-time waste collection tracking system for Shirpur-Warwade Municipal Corporation.",
        hi: "CleanTrack शिरपुर-वरवाड़े नगरपरिषद का आधिकारिक रीयल-टाइम कचरा संग्रह ट्रैकिंग सिस्टम है।",
        mr: "CleanTrack ही शिरपूर-वरवाडे नगरपरिषदेची अधिकृत रिअल-टाइम कचरा संकलन ट्रॅकिंग प्रणाली आहे.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    case "report-issue": {
      const msg = {
        en: "To report an issue or complaint, contact Shirpur Municipal Corporation support.",
        hi: "किसी समस्या या शिकायत की रिपोर्ट करने के लिए शिरपुर नगरपरिषद सहायता से संपर्क करें।",
        mr: "समस्या किंवा तक्रार नोंदवण्यासाठी शिरपूर नगरपरिषद समर्थनाशी संपर्क साधा.",
      };
      return msg[lang as "en" | "hi" | "mr"] ?? msg.en;
    }

    default:
      return "How can I help you with Shirpur Waste Collection?";
  }
}
