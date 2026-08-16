# ✈️ Visa & Schengen Rule Tracker

A modern, privacy-first mobile application built with **React Native** and **Expo** to track Schengen 90/180-day visa rules, multi-zone travel allowances, and visa expiration alerts across multiple user profiles.

---

## 🔒 100% Privacy First & Zero Data Collection

> **Your data belongs exclusively to you.** 

- **Zero Remote Storage / Zero Tracking:** We do **NOT** collect, track, transmit, or store any personal data, trip dates, entry/exit logs, passport numbers, or location history on external servers.
- **100% Local Storage:** All profile information and travel logs remain securely stored **on your device** using local state persistence.
- **Offline P2P Sync:** Device synchronization operates entirely offline via direct Peer-to-Peer (P2P) QR code scanning—no cloud databases, backend accounts, or user registrations required.

---

## ✨ Key Features

### 📅 Automatic 90/180 Rule Engine
- **Sliding 180-Day Window Calculation:** Calculates exact days spent in the Schengen area over any sliding 180-day reference period.
- **Visa Expiration & Remaining Days Locking:** Automatically caps allowed stay according to your visa's validity date (`validUntil`). Locks remaining days to `0` once the visa expires.
- **Next Available Travel Date:** Computes when and how many days will free up for your next trip.

### 🌐 Multi-Zone & Custom Tracking
- **Schengen Zone Tracking:** Built-in automatic calculation for all 29 Schengen member countries.
- **Custom Non-Schengen Zones:** Create dedicated tracking zones for specific countries (e.g., Bulgaria, UK, Cyprus, USA) with custom maximum allowed days.

### 👥 Multi-Profile Management
- Manage multiple family members or travel companions under a single app instance.
- Track individual visa validity dates, custom zones, and ongoing/past trips per profile.

### 🔔 Visa Expiration Alerts & Local Notifications
- **Status Banners:** Clear visual warning cards on the dashboard when your visa is expiring soon or expired.
- **Local Push Notifications:** Automated local notifications alert you 20 days prior to visa expiration without external network calls.

### 🎨 Modern Bauhaus UI & Multi-Language Support
- **Clean Bauhaus Aesthetics:** Styled with a curated palette supporting **Light**, **Dark**, and **System** theme modes.
- **Localized Display & Content:** Native support for 5 languages:
  - 🇹🇷 Turkish (*Schengen Takip*)
  - 🇬🇧 English (*Visa Rule Tracker*)
  - 🇧🇬 Bulgarian (*Виза Тракер*)
  - 🇬🇷 Greek (*Visa Rule Tracker*)
  - 🇲🇰 Macedonian (*Виза Тракер*)

---

## 🛠️ Technology Stack

- **Framework:** React Native, Expo (SDK 57)
- **Language:** TypeScript
- **State Management:** Zustand with local persistence
- **Localization:** `i18next`, `react-i18next`, `expo-localization`
- **UI & Components:** React Native Calendars, React Navigation v6, Lucide Icons
- **Monetization:** Google Mobile Ads (`react-native-google-mobile-ads`) with `__DEV__` test guard

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm / yarn / pnpm
- Expo CLI (`npx expo`)
- Android Studio (for Android builds) or Xcode (for iOS builds)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/daimac/SchengenTakip.git
   cd SchengenTakip/SchengenApp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory (refer to `.env.example` for required variables):
   ```env
   ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
   ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_BANNER_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   ```

4. **Run the application:**

   - **Android Development:**
     ```bash
     npx expo run:android
     ```

   - **iOS Development:**
     ```bash
     npx expo run:ios
     ```

   - **Production Release Build (Android):**
     ```bash
     export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
     export ANDROID_HOME="$HOME/Library/Android/sdk"
     ./android/gradlew -p android assembleRelease
     ```

---

## 📄 License

Copyright © 2026. All rights reserved.
