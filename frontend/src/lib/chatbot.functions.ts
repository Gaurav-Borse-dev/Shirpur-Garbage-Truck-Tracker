// NO TanStack Start dependencies - Pure Supabase calls
import { supabaseAdmin } from "@/integrations/supabase/client.server";
export interface ChatbotResponse {
  text: string;
  data?: any;
}

// ============================================
// MULTILINGUAL TRANSLATIONS
// ============================================
const translations: Record<string, Record<string, string>> = {
  en: {
    "truck.location": "Your garbage truck is",
    "truck.at": "It is near",
    "truck.distance": "Distance",
    "truck.eta": "Estimated Time",
    "truck.status.moving": "Moving",
    "truck.status.stopped": "Stopped",
    "truck.status.completed": "Completed",
    "truck.route": "Route",
    "truck.not.found": "No truck assigned to your area",
    "truck.stops": "Stops",
    "truck.status": "Status",
    "truck.passed": "The truck has passed your location.",
    "truck.approaching": "The truck is approaching your location.",
    "error.generic": "Error processing your request. Please try again.",
    welcome: "Welcome to CleanTrack AI Assistant!",
    "select.category": "Select a category to get started",
    back: "← Back to categories",
  },
  hi: {
    "truck.location": "आपकी कचरा गाड़ी है",
    "truck.at": "यह निकट है",
    "truck.distance": "दूरी",
    "truck.eta": "अनुमानित समय",
    "truck.status.moving": "चल रही है",
    "truck.status.stopped": "रुकी हुई है",
    "truck.status.completed": "पूरी हुई",
    "truck.route": "मार्ग",
    "truck.not.found": "आपके क्षेत्र में कोई गाड़ी तैनात नहीं है",
    "truck.stops": "स्टॉप",
    "truck.status": "स्थिति",
    "truck.passed": "गाड़ी आपके स्थान से गुजर चुकी है।",
    "truck.approaching": "गाड़ी आपके स्थान के पास पहुंच रही है।",
    "error.generic": "आपके अनुरोध को संसाधित करने में त्रुटि। कृपया पुनः प्रयास करें।",
    welcome: "क्लीनट्रैक एआई असिस्टेंट में आपका स्वागत है!",
    "select.category": "शुरू करने के लिए एक श्रेणी चुनें",
    back: "← श्रेणियों पर वापस जाएं",
  },
  mr: {
    "truck.location": "तुमची कचरा गाडी आहे",
    "truck.at": "ती जवळ आहे",
    "truck.distance": "अंतर",
    "truck.eta": "अंदाजे वेळ",
    "truck.status.moving": "चालू आहे",
    "truck.status.stopped": "थांबलेली आहे",
    "truck.status.completed": "पूर्ण झाली",
    "truck.route": "मार्ग",
    "truck.not.found": "तुमच्या भागात कोणतीही गाडी तैनात नाही",
    "truck.stops": "स्टॉप",
    "truck.status": "स्थिती",
    "truck.passed": "गाडी तुमच्या स्थानावरून गेली आहे.",
    "truck.approaching": "गाडी तुमच्या स्थानाजवळ येत आहे.",
    "error.generic": "तुमची विनंती प्रक्रिया करण्यात त्रुटी. कृपया पुन्हा प्रयत्न करा.",
    welcome: "क्लीनट्रॅक एआय असिस्टंटमध्ये आपले स्वागत आहे!",
    "select.category": "प्रारंभ करण्यासाठी एक श्रेणी निवडा",
    back: "← श्रेणींवर परत जा",
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUserLanguage(userId: string): Promise<string> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("profiles")
      .select("language")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    if (error || !data) {
      console.error("Error fetching user language:", error);
      return "en";
    }

    return data.language || "en";
  } catch (error) {
    console.error("Error in getUserLanguage:", error);
    return "en";
  }
}

function getTranslation(key: string, language: string = "en"): string {
  const langMap = translations[language] || translations["en"];
  return langMap?.[key] || translations["en"][key] || key;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

export async function getTruckLocation(userId: string): Promise<ChatbotResponse> {
  try {
    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("language")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    const language = profile?.language || "en";

    // Query active trucks with actual schema columns
    const { data: trucks } = await (supabaseAdmin as any)
      .from("trucks")
      .select("id, truck_code, ward, status")
      .order("truck_code", { ascending: true });

    const activeTruck = (trucks || []).find((t: any) => t.status === "collecting") || trucks?.[0];

    if (!activeTruck) {
      return {
        text: getTranslation("truck.not.found", language),
        data: null,
      };
    }

    const statusKey = `truck.status.${activeTruck.status}`;
    const statusText = getTranslation(statusKey, language);

    let responseText = `${getTranslation("truck.location", language)} ${activeTruck.truck_code}.\n`;
    responseText += `${getTranslation("truck.at", language)} ${activeTruck.ward || "Shirpur"}.\n`;
    responseText += `${getTranslation("truck.status", language)}: ${statusText}`;

    return {
      text: responseText,
      data: {
        truckCode: activeTruck.truck_code,
        ward: activeTruck.ward,
        status: activeTruck.status,
      },
    };
  } catch (error) {
    console.error("Error fetching truck location:", error);
    return {
      text: getTranslation("error.generic", "en"),
      data: null,
    };
  }
}

export async function getTruckETA(userId: string): Promise<ChatbotResponse> {
  try {
    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("language")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    const language = profile?.language || "en";

    const { data: trucks } = await (supabaseAdmin as any)
      .from("trucks")
      .select("id, truck_code, ward, status")
      .eq("status", "collecting")
      .limit(1);

    const truck = trucks?.[0];
    if (!truck) {
      return {
        text: getTranslation("truck.not.found", language),
        data: null,
      };
    }

    const responseText = `${getTranslation("truck.approaching", language)}\n${getTranslation("truck.location", language)} ${truck.truck_code} (${truck.ward || "Shirpur"}).`;

    return {
      text: responseText,
      data: {
        truckCode: truck.truck_code,
        status: truck.status,
      },
    };
  } catch (error) {
    console.error("Error calculating ETA:", error);
    return {
      text: getTranslation("error.generic", "en"),
      data: null,
    };
  }
}

export async function getTruckStatus(userId: string): Promise<ChatbotResponse> {
  try {
    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("language")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    const language = profile?.language || "en";

    const { data: trucks } = await (supabaseAdmin as any)
      .from("trucks")
      .select("truck_code, status, ward")
      .limit(1);

    const truck = trucks?.[0];
    if (!truck) {
      return {
        text: getTranslation("truck.not.found", language),
        data: null,
      };
    }

    const statusKey = `truck.status.${truck.status}`;
    const statusText = getTranslation(statusKey, language);
    const responseText = `${truck.truck_code}: ${statusText} (${truck.ward || "Shirpur"})`;

    return {
      text: responseText,
      data: {
        truckCode: truck.truck_code,
        status: truck.status,
      },
    };
  } catch (error) {
    console.error("Error getting truck status:", error);
    return {
      text: getTranslation("error.generic", "en"),
      data: null,
    };
  }
}

export async function getTruckRoute(userId: string): Promise<ChatbotResponse> {
  try {
    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("language")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    const language = profile?.language || "en";

    const { data: routes } = await (supabaseAdmin as any)
      .from("routes")
      .select("name, ward, status")
      .limit(5);

    if (!routes || routes.length === 0) {
      return {
        text: getTranslation("truck.not.found", language),
        data: null,
      };
    }

    const routeNames = routes.map((r: any) => `${r.name} (${r.ward})`).join("\n• ");
    const responseText = `${getTranslation("truck.route", language)}:\n• ${routeNames}`;

    return {
      text: responseText,
      data: { routes },
    };
  } catch (error) {
    console.error("Error getting route:", error);
    return {
      text: getTranslation("error.generic", "en"),
      data: null,
    };
  }
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================

export async function getNearestTruck(userId: string): Promise<ChatbotResponse> {
  return await getTruckLocation(userId);
}
export default {
  getTruckLocation,
  getNearestTruck,
  getTruckETA,
  getTruckStatus,
  getTruckRoute,
};
