export const SUPPORTED_LANGUAGES = [
  "en",
  "te",
  "hi",
  "ta",
  "kn",
] as const;

export type SupportedLanguage =
  (typeof SUPPORTED_LANGUAGES)[number];

export type LanguageConfig = {
  code: SupportedLanguage;
  name: string;
  locale: string;
  digestTitle: string;
  topicsLabel: string;
  sourceLabel: string;
  fallbackNotice: string;
  footer: string;
};

const LANGUAGE_CONFIGS: Record<
  SupportedLanguage,
  LanguageConfig
> = {
  en: {
    code: "en",
    name: "English",
    locale: "en-IN",
    digestTitle:
      "📰 Daily Intelligence",
    topicsLabel:
      "Topics",
    sourceLabel:
      "Source",
    fallbackNotice:
      "⚠️ Translation unavailable; showing original-language headlines.",
    footer:
      "Generated from trusted RSS sources.",
  },

  te: {
    code: "te",
    name: "Telugu",
    locale: "te-IN",
    digestTitle:
      "📰 డైలీ ఇంటెలిజెన్స్",
    topicsLabel:
      "మీ ఆసక్తులు",
    sourceLabel:
      "మూలం",
    fallbackNotice:
      "⚠️ అనువాద సేవ అందుబాటులో లేదు; వార్తలు మూల భాషలో చూపబడుతున్నాయి.",
    footer:
      "నమ్మదగిన RSS మూలాల నుండి రూపొందించబడింది.",
  },

  hi: {
    code: "hi",
    name: "Hindi",
    locale: "hi-IN",
    digestTitle:
      "📰 डेली इंटेलिजेंस",
    topicsLabel:
      "आपकी रुचियाँ",
    sourceLabel:
      "स्रोत",
    fallbackNotice:
      "⚠️ अनुवाद सेवा उपलब्ध नहीं है; समाचार मूल भाषा में दिखाए जा रहे हैं।",
    footer:
      "विश्वसनीय RSS स्रोतों से तैयार किया गया।",
  },

  ta: {
    code: "ta",
    name: "Tamil",
    locale: "ta-IN",
    digestTitle:
      "📰 தினசரி இன்டெலிஜென்ஸ்",
    topicsLabel:
      "உங்கள் விருப்பங்கள்",
    sourceLabel:
      "மூலம்",
    fallbackNotice:
      "⚠️ மொழிபெயர்ப்பு சேவை கிடைக்கவில்லை; செய்திகள் மூல மொழியில் காட்டப்படுகின்றன.",
    footer:
      "நம்பகமான RSS மூலங்களிலிருந்து உருவாக்கப்பட்டது.",
  },

  kn: {
    code: "kn",
    name: "Kannada",
    locale: "kn-IN",
    digestTitle:
      "📰 ಡೈಲಿ ಇಂಟೆಲಿಜೆನ್ಸ್",
    topicsLabel:
      "ನಿಮ್ಮ ಆಸಕ್ತಿಗಳು",
    sourceLabel:
      "ಮೂಲ",
    fallbackNotice:
      "⚠️ ಅನುವಾದ ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ; ಸುದ್ದಿಗಳನ್ನು ಮೂಲ ಭಾಷೆಯಲ್ಲಿ ತೋರಿಸಲಾಗುತ್ತಿದೆ.",
    footer:
      "ವಿಶ್ವಾಸಾರ್ಹ RSS ಮೂಲಗಳಿಂದ ರಚಿಸಲಾಗಿದೆ.",
  },
};

export function normalizeLanguage(
  value:
    | string
    | null
    | undefined,
): SupportedLanguage {
  const normalized =
    value
      ?.trim()
      .toLowerCase();

  if (
    normalized &&
    (
      SUPPORTED_LANGUAGES as readonly string[]
    ).includes(normalized)
  ) {
    return normalized as
      SupportedLanguage;
  }

  return "en";
}

export function getLanguageConfig(
  value:
    | string
    | null
    | undefined,
): LanguageConfig {
  return LANGUAGE_CONFIGS[
    normalizeLanguage(value)
  ];
}
