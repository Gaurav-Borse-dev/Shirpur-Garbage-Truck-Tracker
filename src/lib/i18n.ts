import { useI18n, type Lang } from "@/store/i18n";

type Dict = Record<string, string>;

// Translation dictionaries. Keys use English as canonical.
// Missing keys fall back to the key itself (which reads as English).
const en: Dict = {};

const hi: Dict = {
  // Common
  "Live": "लाइव",
  "Reconnecting": "पुनः कनेक्ट हो रहा है",
  "Online": "ऑनलाइन",
  "Offline": "ऑफ़लाइन",
  "All systems live": "सभी सिस्टम लाइव",
  "Back": "वापस",
  "Menu": "मेनू",
  "Language": "भाषा",
  "English": "अंग्रेज़ी",
  "Hindi": "हिन्दी",
  "Marathi": "मराठी",

  // Role page
  "Choose your role": "अपनी भूमिका चुनें",
  "Who's signing in?": "कौन साइन इन कर रहा है?",
  "Pick the experience that fits you.": "अपने अनुरूप अनुभव चुनें।",
  "I'm a Resident": "मैं निवासी हूँ",
  "Track the truck near me": "मेरे पास के ट्रक को ट्रैक करें",
  "Truck Driver": "ट्रक चालक",
  "Share location, manage stops": "स्थान साझा करें, स्टॉप प्रबंधित करें",
  "Municipal Admin": "नगर प्रशासक",
  "Monitor the entire fleet": "पूरे बेड़े की निगरानी करें",

  // Admin dashboard
  "Fleet Dashboard": "फ्लीट डैशबोर्ड",
  "Shirpur Municipal Corporation · Live": "शिरपुर नगर निगम · लाइव",
  "Total Trucks": "कुल ट्रक",
  "Online Now": "अभी ऑनलाइन",
  "Stops Today": "आज के स्टॉप",
  "Residents Alerted": "सूचित निवासी",
  "Active trucks": "सक्रिय ट्रक",
  "Admin Live Dashboard": "एडमिन लाइव डैशबोर्ड",
  "Active Trucks": "सक्रिय ट्रक",
  "Completed Stops": "पूर्ण स्टॉप",
  "Pending Stops": "बाकी स्टॉप",
  "All Trucks": "सभी ट्रक",
  "all": "सभी",
  "online": "ऑनलाइन",
  "offline": "ऑफ़लाइन",
  "Complete": "पूर्ण",
  "On Route": "मार्ग पर",
  "View All": "सभी देखें",
  "shown": "दिखाए गए",
  "of": "में से",

  // Resident
  "Arriving in": "आगमन में",
  "away": "दूर",
  "Distance": "दूरी",
  "ETA": "अनुमानित समय",
  "Municipal waste collection service": "नगर निगम कचरा संग्रह सेवा",
  "Alert me when truck is near": "ट्रक पास आने पर मुझे सूचित करें",
  "I'm Coming": "मैं आ रहा हूँ",
  "Truck is": "ट्रक है",
  "Head outside soon": "जल्द बाहर आएं",
  "Truck nearby": "ट्रक पास में",
  "Truck is almost here!": "ट्रक लगभग यहाँ है!",
  "Go outside now": "अभी बाहर जाएं",
  "Truck arriving": "ट्रक आ रहा है",
  "Truck has passed": "ट्रक निकल चुका है",
  "Check schedule for next pickup": "अगले पिकअप के लिए शेड्यूल देखें",
  "En Route": "मार्ग पर",
  "Nearby": "पास में",
  "Arriving": "आ रहा है",
  "Leaving": "जा रहा है",
  "Route": "मार्ग",

  // Driver
  "Driver": "चालक",
  "You are": "आप हैं",
  "Residents can see your location.": "निवासी आपका स्थान देख सकते हैं।",
  "Go online to start broadcasting.": "प्रसारण शुरू करने के लिए ऑनलाइन जाएं।",
  "Stop": "स्टॉप",
  "Arrived": "पहुँच गए",
  "Completed": "पूर्ण हुआ",
  "Hide stops": "स्टॉप छिपाएं",
  "View all stops": "सभी स्टॉप देखें",
  "3 residents notified nearby": "पास के 3 निवासियों को सूचित किया गया",
};

const mr: Dict = {
  "Live": "थेट",
  "Reconnecting": "पुन्हा जोडत आहे",
  "Online": "ऑनलाइन",
  "Offline": "ऑफलाइन",
  "All systems live": "सर्व यंत्रणा कार्यरत",
  "Back": "मागे",
  "Menu": "मेनू",
  "Language": "भाषा",
  "English": "इंग्रजी",
  "Hindi": "हिंदी",
  "Marathi": "मराठी",

  "Choose your role": "आपली भूमिका निवडा",
  "Who's signing in?": "कोण साइन इन करत आहे?",
  "Pick the experience that fits you.": "तुम्हाला अनुरूप अनुभव निवडा.",
  "I'm a Resident": "मी रहिवासी आहे",
  "Track the truck near me": "जवळचा ट्रक ट्रॅक करा",
  "Truck Driver": "ट्रक चालक",
  "Share location, manage stops": "स्थान शेअर करा, थांबे व्यवस्थापित करा",
  "Municipal Admin": "नगरपालिका प्रशासक",
  "Monitor the entire fleet": "संपूर्ण ताफ्याचे निरीक्षण करा",

  "Fleet Dashboard": "फ्लीट डॅशबोर्ड",
  "Shirpur Municipal Corporation · Live": "शिरपूर नगरपालिका · थेट",
  "Total Trucks": "एकूण ट्रक",
  "Online Now": "आत्ता ऑनलाइन",
  "Stops Today": "आजचे थांबे",
  "Residents Alerted": "सूचित रहिवासी",
  "Active trucks": "सक्रिय ट्रक",
  "Admin Live Dashboard": "प्रशासक थेट डॅशबोर्ड",
  "Active Trucks": "सक्रिय ट्रक",
  "Completed Stops": "पूर्ण झालेले थांबे",
  "Pending Stops": "प्रलंबित थांबे",
  "All Trucks": "सर्व ट्रक",
  "all": "सर्व",
  "online": "ऑनलाइन",
  "offline": "ऑफलाइन",
  "Complete": "पूर्ण",
  "On Route": "मार्गावर",
  "View All": "सर्व पहा",
  "shown": "दाखवले",
  "of": "पैकी",

  "Arriving in": "पोहोचण्यास",
  "away": "दूर",
  "Distance": "अंतर",
  "ETA": "अंदाजे वेळ",
  "Municipal waste collection service": "नगरपालिका कचरा संकलन सेवा",
  "Alert me when truck is near": "ट्रक जवळ आल्यास मला सूचित करा",
  "I'm Coming": "मी येत आहे",
  "Truck is": "ट्रक आहे",
  "Head outside soon": "लवकर बाहेर या",
  "Truck nearby": "ट्रक जवळ आहे",
  "Truck is almost here!": "ट्रक जवळजवळ इथे आहे!",
  "Go outside now": "आत्ता बाहेर जा",
  "Truck arriving": "ट्रक येत आहे",
  "Truck has passed": "ट्रक निघून गेला",
  "Check schedule for next pickup": "पुढच्या पिकअपसाठी वेळापत्रक पहा",
  "En Route": "मार्गावर",
  "Nearby": "जवळ",
  "Arriving": "पोहोचत आहे",
  "Leaving": "जात आहे",
  "Route": "मार्ग",

  "Driver": "चालक",
  "You are": "तुम्ही आहात",
  "Residents can see your location.": "रहिवासी तुमचे स्थान पाहू शकतात.",
  "Go online to start broadcasting.": "प्रसारण सुरू करण्यासाठी ऑनलाइन व्हा.",
  "Stop": "थांबा",
  "Arrived": "पोहोचले",
  "Completed": "पूर्ण झाले",
  "Hide stops": "थांबे लपवा",
  "View all stops": "सर्व थांबे पहा",
  "3 residents notified nearby": "जवळील 3 रहिवाशांना सूचित केले",
};

const DICTS: Record<Lang, Dict> = { en, hi, mr };

export function translate(key: string, lang: Lang): string {
  if (lang === "en") return key;
  return DICTS[lang][key] ?? key;
}

export function useT() {
  const lang = useI18n((s) => s.lang);
  return (key: string) => translate(key, lang);
}

export function useLang() {
  return useI18n((s) => s.lang);
}