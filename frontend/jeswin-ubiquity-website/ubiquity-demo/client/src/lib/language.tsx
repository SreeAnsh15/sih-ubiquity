import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type LanguageCode = "en" | "ta" | "te";

type Copy = { greeting: string; citizen: string; worker: string; admin: string; customerWorkspace: string; trustedHelp: string; trustedBody: string; services: string; serviceNetwork: string; findWorker: string; search: string; liveResults: string; matches: string; emergency: string; activeWard: string; future: string; home: string; language: string };

const COPY: Record<LanguageCode, Copy> = {
  en: { greeting: "Good morning", citizen: "Citizen View", worker: "Worker Passbook", admin: "PACS Admin", customerWorkspace: "Customer workspace · Gandhipuram", trustedHelp: "Trusted help, close to home.", trustedBody: "Choose a service to see live PACS-verified workers, transparent fair pricing, and their location on the cooperative map.", services: "What can we help with?", serviceNetwork: "Cooperative service network", findWorker: "Find a verified worker for", search: "Search live roster", liveResults: "Live results", matches: "cooperative matches", emergency: "Emergency Service", activeWard: "Live in your ward", future: "Phase 2 expansion", home: "Home", language: "Language" },
  ta: { greeting: "காலை வணக்கம்", citizen: "குடிமக்கள் பார்வை", worker: "தொழிலாளர் பாஸ்புக்", admin: "PACS நிர்வாகம்", customerWorkspace: "வாடிக்கையாளர் பணியிடம் · காந்திபுரம்", trustedHelp: "உங்கள் வீட்டிற்கு அருகில் நம்பகமான உதவி.", trustedBody: "நேரடி PACS சரிபார்க்கப்பட்ட தொழிலாளர்கள், வெளிப்படையான நியாய விலை மற்றும் வரைபட இருப்பிடத்தைப் பார்க்க சேவையைத் தேர்ந்தெடுக்கவும்.", services: "எவ்வாறு உதவலாம்?", serviceNetwork: "கூட்டுறவு சேவை வலையமைப்பு", findWorker: "சரிபார்க்கப்பட்ட தொழிலாளரைத் தேடுங்கள்", search: "நேரடி பட்டியலைத் தேடுங்கள்", liveResults: "நேரடி முடிவுகள்", matches: "கூட்டுறவு பொருத்தங்கள்", emergency: "அவசர சேவை", activeWard: "உங்கள் வார்டில் உள்ளது", future: "கட்டம் 2 விரிவாக்கம்", home: "முகப்பு", language: "மொழி" },
  te: { greeting: "శుభోదయం", citizen: "పౌరుల వీక్షణ", worker: "కార్మిక పాస్‌బుక్", admin: "PACS నిర్వాహకుడు", customerWorkspace: "కస్టమర్ వర్క్‌స్పేస్ · గాంధీపురం", trustedHelp: "మీ ఇంటికి దగ్గరగా నమ్మకమైన సహాయం.", trustedBody: "PACS ధృవీకరించిన కార్మికులు, పారదర్శక ధరలు మరియు మ్యాప్ స్థానాలను చూడటానికి సేవను ఎంచుకోండి.", services: "మేము ఎలా సహాయపడగలం?", serviceNetwork: "సహకార సేవా నెట్‌వర్క్", findWorker: "ధృవీకరించిన కార్మికుడిని కనుగొనండి", search: "లైవ్ రోస్టర్ శోధన", liveResults: "లైవ్ ఫలితాలు", matches: "సహకార సరిపోలికలు", emergency: "అత్యవసర సేవ", activeWard: "మీ వార్డులో అందుబాటులో ఉంది", future: "దశ 2 విస్తరణ", home: "హోమ్", language: "భాష" },
};

const TRADE_LABELS: Record<LanguageCode, Record<string, string>> = {
  en: { Plumbing: "Plumbing", Electrical: "Electrical", "House Cleaning": "Cleaning", Carpentry: "Carpentry", "AC Repair": "AC Repair", Masonry: "Masonry" },
  ta: { Plumbing: "பிளம்பிங்", Electrical: "மின்சாரம்", "House Cleaning": "சுத்தம்", Carpentry: "தச்சு", "AC Repair": "ஏசி பழுது", Masonry: "கட்டிடம்" },
  te: { Plumbing: "ప్లంబింగ్", Electrical: "ఎలక్ట్రికల్", "House Cleaning": "క్లీనింగ్", Carpentry: "వడ్రంగి", "AC Repair": "ఏసీ రిపేర్", Masonry: "మేసన్రీ" },
};

const LanguageContext = createContext<{ language: LanguageCode; setLanguage: (language: LanguageCode) => void; t: Copy; trade: (service: string) => string } | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) { const [language, setLanguage] = useState<LanguageCode>(() => (sessionStorage.getItem("ubiquity.language") as LanguageCode) || "en"); const update = (next: LanguageCode) => { setLanguage(next); sessionStorage.setItem("ubiquity.language", next); }; const value = useMemo(() => ({ language, setLanguage: update, t: COPY[language], trade: (service: string) => TRADE_LABELS[language][service] || service }), [language]); return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>; }
export function useLanguage() { const value = useContext(LanguageContext); if (!value) throw new Error("useLanguage must be used inside LanguageProvider"); return value; }
