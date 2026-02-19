import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resources from "./site-copy.json";

const ns = ["common", "metadata", "home", "pray", "prayers", "rosary", "map"] as const;

i18n.use(initReactI18next).init({
  resources: resources as Record<string, Record<string, Record<string, string>>>,
  lng: "en",
  fallbackLng: "en",
  ns: [...ns],
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
