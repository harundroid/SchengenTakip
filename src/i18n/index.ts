import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tr from './locales/tr.json';
import en from './locales/en.json';
import bg from './locales/bg.json';
import el from './locales/el.json';
import mk from './locales/mk.json';

const LANGUAGE_KEY = 'user_selected_language';

export type AppLanguage = 'tr' | 'en' | 'bg' | 'el' | 'mk';

const getDeviceLanguage = (): AppLanguage => {
  try {
    if (Localization && typeof Localization.getLocales === 'function') {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        const code = locales[0]?.languageCode;
        if (code === 'tr') return 'tr';
        if (code === 'bg') return 'bg';
        if (code === 'el') return 'el';
        if (code === 'mk') return 'mk';
      }
    }
  } catch (e) {
    // Native module optional fallback
  }

  try {
    const locale = Intl?.DateTimeFormat?.().resolvedOptions?.().locale || '';
    if (locale.toLowerCase().startsWith('tr')) return 'tr';
    if (locale.toLowerCase().startsWith('bg')) return 'bg';
    if (locale.toLowerCase().startsWith('el')) return 'el';
    if (locale.toLowerCase().startsWith('mk')) return 'mk';
  } catch (e) {}

  return 'en';
};

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  bg: { translation: bg },
  el: { translation: el },
  mk: { translation: mk },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v3',
  });

// Load saved language asynchronously
AsyncStorage.getItem(LANGUAGE_KEY).then((savedLang) => {
  if (savedLang && ['tr', 'en', 'bg', 'el', 'mk'].includes(savedLang)) {
    i18n.changeLanguage(savedLang as AppLanguage);
  }
}).catch(() => {});

export const changeAppLanguage = async (lang: AppLanguage) => {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
};

export default i18n;
