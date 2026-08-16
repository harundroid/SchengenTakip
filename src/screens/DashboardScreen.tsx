import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Platform, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AdBanner } from '../components/AdBanner';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { parseISO, isBefore, isSameDay, addDays, differenceInDays } from 'date-fns';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTripStore } from '../store/useTripStore';
import { calculate90180Rule, calculateMainDestination, calculateDaysForTrip } from '../utils/rules';
import { scheduleVisaExpiringNotification } from '../utils/notifications';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../i18n';
import { showCompletedFlowInterstitial } from '../config/ads';
import { ALL_COUNTRIES, SCHENGEN_ONLY_COUNTRIES, NON_SCHENGEN_COUNTRIES, isSchengenCountry, isSameCountry, getCountryCode } from '../constants/countries';
import { Picker } from '@react-native-picker/picker';
import { useAppTheme } from '../theme/ThemeContext';
import { TrackingMode } from '../types';

// Configure LocaleConfig for react-native-calendars
LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  monthNamesShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  dayNames: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  today: 'Bugün'
};

LocaleConfig.locales['en'] = {
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  today: 'Today'
};

LocaleConfig.locales['bg'] = {
  monthNames: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
  monthNamesShort: ['Яну', 'Фев', 'Мар', 'Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек'],
  dayNames: ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'],
  dayNamesShort: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  today: 'Днес'
};

LocaleConfig.locales['el'] = {
  monthNames: ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'],
  monthNamesShort: ['Ιαν', 'Φεβ', 'Μάρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ'],
  dayNames: ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'],
  dayNamesShort: ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'],
  today: 'Σήμερα'
};

LocaleConfig.locales['mk'] = {
  monthNames: ['Јануари', 'Февруари', 'Март', 'Април', 'Мај', 'Јуни', 'Јули', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
  monthNamesShort: ['Јан', 'Фев', 'Мар', 'Апр', 'Мај', 'Јун', 'Јул', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек'],
  dayNames: ['Недела', 'Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота'],
  dayNamesShort: ['Нед', 'Πон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб'],
  today: 'Денес'
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export interface SubZone {
  id: string;
  name: string;
  trackingMode: 'SCHENGEN' | 'SINGLE_COUNTRY';
  targetCountry?: string;
}

const getDatesRangeArray = (startDateStr: string, endDateStr: string): string[] => {
  try {
    const dates: string[] = [];
    const [y1, m1, d1] = startDateStr.split('-').map(Number);
    const [y2, m2, d2] = endDateStr.split('-').map(Number);

    const start = new Date(Date.UTC(y1, m1 - 1, d1));
    const end = new Date(Date.UTC(y2, m2 - 1, d2));

    const curr = new Date(start);
    while (curr <= end) {
      const yyyy = curr.getUTCFullYear();
      const mm = String(curr.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(curr.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return dates;
  } catch {
    return [startDateStr];
  }
};

const formatLocalISO = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const DashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { colors, isDark, themeMode, setThemeMode } = useAppTheme();

  useEffect(() => {
    if (LocaleConfig.locales[currentLang]) {
      LocaleConfig.defaultLocale = currentLang;
    } else {
      LocaleConfig.defaultLocale = 'en';
    }
  }, [currentLang]);

  const persons = useTripStore(state => state.persons);
  const activePersonId = useTripStore(state => state.activePersonId);
  const addPerson = useTripStore(state => state.addPerson);
  const switchPerson = useTripStore(state => state.switchPerson);
  const removePerson = useTripStore(state => state.removePerson);
  const updatePerson = useTripStore(state => state.updatePerson);
  const updateTrip = useTripStore(state => state.updateTrip);
  const closeTripGroup = useTripStore(state => state.closeTripGroup);

  const activePerson = persons.find(p => p.id === activePersonId);
  const trips = activePerson?.trips || [];
  const visaDetails = activePerson?.visaDetails;

  // Active ongoing trip
  const ongoingTrip = useMemo(() => {
    return trips.find(t => t.isOngoing);
  }, [trips]);

  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Initial Profile Name Prompt if no profile exists
  const [initialProfileName, setInitialProfileName] = useState('');
  const isNoProfile = persons.length === 0;

  // For Add Person inline prompt
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  // For Edit Person inline prompt
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editPersonName, setEditPersonName] = useState('');

  const updatePersonZones = useTripStore(state => state.updatePersonZones);

  const [customZones, setCustomZones] = useState<SubZone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('schengen');
  const [isAddZoneModalOpen, setIsAddZoneModalOpen] = useState(false);
  const [selectedNewCountry, setSelectedNewCountry] = useState(NON_SCHENGEN_COUNTRIES[0]);

  // Sync customZones with activePerson.zones or language default
  useEffect(() => {
    if (activePerson?.zones && activePerson.zones.length > 0) {
      setCustomZones(activePerson.zones as SubZone[]);
      if (!activePerson.zones.some(z => z.id === activeZoneId)) {
        setActiveZoneId(activePerson.zones[0].id);
      }
    } else {
      const isTr = i18n.language === 'tr';
      const defaultInitialZones: SubZone[] = isTr
        ? [
            { id: 'schengen', name: '🇪🇺 Schengen Zone', trackingMode: 'SCHENGEN' },
            { id: 'TR', name: '🇹🇷 Türkiye', trackingMode: 'SINGLE_COUNTRY', targetCountry: 'TR' }
          ]
        : [
            { id: 'TR', name: '🇹🇷 Türkiye', trackingMode: 'SINGLE_COUNTRY', targetCountry: 'TR' },
            { id: 'schengen', name: '🇪🇺 Schengen Zone', trackingMode: 'SCHENGEN' }
          ];
      setCustomZones(defaultInitialZones);
      setActiveZoneId(defaultInitialZones[0].id);
    }
  }, [activePerson?.id, activePerson?.zones, i18n.language]);

  const currentZone = customZones.find(z => z.id === activeZoneId) || customZones[0] || {
    id: 'schengen',
    name: '🇪🇺 Schengen Zone',
    trackingMode: 'SCHENGEN' as TrackingMode,
  };

  // Dynamic visaDetails passed to rule calculation engine
  const activeVisaConfig = useMemo(() => {
    const zoneVisa = activePerson?.zoneVisaDetails?.[currentZone.id] || visaDetails;
    return {
      trackingMode: currentZone.trackingMode,
      targetCountry: currentZone.targetCountry || zoneVisa?.targetCountry,
      country: zoneVisa?.country || 'Germany',
      validFrom: zoneVisa?.validFrom || '',
      validUntil: zoneVisa?.validUntil || '',
      maxDays: zoneVisa?.maxDays || 90,
      isVisaExempt: zoneVisa?.isVisaExempt || false,
    };
  }, [currentZone, activePerson, visaDetails]);

  // Filter trips strictly for current active zone using multi-language country normalizers
  const zoneFilteredTrips = useMemo(() => {
    if (currentZone.trackingMode === 'SINGLE_COUNTRY' && currentZone.targetCountry) {
      return trips.filter(trip => {
        if (trip.segments && trip.segments.length > 0) {
          return trip.segments.some(s => isSameCountry(s.country, currentZone.targetCountry));
        }
        return isSameCountry(trip.entryCountry || trip.country, currentZone.targetCountry) ||
          isSameCountry(trip.exitCountry || trip.country, currentZone.targetCountry);
      });
    } else {
      // SCHENGEN Mode: Filter ONLY trips matching Schengen countries
      return trips.filter(trip => {
        if (trip.segments && trip.segments.length > 0) {
          return trip.segments.some(s => isSchengenCountry(s.country));
        }
        return isSchengenCountry(trip.entryCountry || trip.country) ||
          isSchengenCountry(trip.exitCountry || trip.country);
      });
    }
  }, [trips, currentZone]);

  const rule90180 = calculate90180Rule(zoneFilteredTrips, activeVisaConfig);
  const mainDestination = calculateMainDestination(zoneFilteredTrips, visaDetails?.country || '');

  // Trigger local push notification when visa is expiring soon (within 20 days)
  useEffect(() => {
    if (rule90180.isVisaExpiringSoon && rule90180.daysUntilVisaExpires !== null && rule90180.daysUntilVisaExpires <= 20 && rule90180.daysUntilVisaExpires >= 0) {
      scheduleVisaExpiringNotification(
        t('dashboard.notificationVisaExpiringTitle'),
        t('dashboard.notificationVisaExpiringBody', {
          days: rule90180.daysUntilVisaExpires,
          allowed: rule90180.daysRemaining,
        })
      );
    }
  }, [rule90180.isVisaExpiringSoon, rule90180.daysUntilVisaExpires, rule90180.daysRemaining, t]);

  const handleCreateInitialProfile = () => {
    const name = initialProfileName.trim() || 'My Profile';
    addPerson(name, i18n.language);
    setInitialProfileName('');
    navigation.navigate('VisaSettings');
  };

  const handleAddCustomZone = () => {
    const code = getCountryCode(selectedNewCountry);
    if (!code) return;

    const existing = customZones.find(z => isSameCountry(z.targetCountry, code));
    if (existing) {
      setActiveZoneId(existing.id);
      setIsAddZoneModalOpen(false);
      return;
    }

    const newZone: SubZone = {
      id: code.toLowerCase(),
      name: `🌐 ${t(`countries.${code}`, { defaultValue: code })}`,
      trackingMode: 'SINGLE_COUNTRY',
      targetCountry: code,
    };

    const nextZones = [...customZones, newZone];
    setCustomZones(nextZones);
    if (activePerson?.id) {
      updatePersonZones(activePerson.id, nextZones as any);
    }
    setActiveZoneId(newZone.id);
    setIsAddZoneModalOpen(false);
  };

  const handleDeleteZone = (id: string, name: string) => {
    const doDelete = () => {
      let nextZones = customZones.filter(z => z.id !== id);
      if (nextZones.length === 0) {
        // Fallback default zone if all deleted
        nextZones = [{ id: 'schengen', name: '🇪🇺 Schengen Zone', trackingMode: 'SCHENGEN' }];
      }

      setCustomZones(nextZones);
      if (activePerson?.id) {
        updatePersonZones(activePerson.id, nextZones as any);

        // Also clean up zoneVisaDetails
        const remainingVisa = { ...(activePerson.zoneVisaDetails || {}) };
        delete remainingVisa[id];
        useTripStore.setState((state) => ({
          persons: state.persons.map(p => p.id === activePerson.id ? { ...p, zoneVisaDetails: remainingVisa } : p)
        }));
      }

      if (activeZoneId === id) {
        setActiveZoneId(nextZones[0].id);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`"${name}" bölgesini ve vizesini silmek istediğinizden emin misiniz?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Bölgeyi Sil / Remove Zone',
        `"${name}" bölgesini ve vize takibini silmek istediğinizden emin misiniz?`,
        [
          { text: 'İptal / Cancel', style: 'cancel' },
          { text: 'Sil / Remove', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  const onDayPress = (day: any) => {
    if (!selectedStartDate) {
      setSelectedStartDate(day.dateString);
    } else {
      const start = parseISO(selectedStartDate);
      const end = parseISO(day.dateString);

      if (isBefore(start, end) || isSameDay(start, end)) {
        navigation.navigate('AddTrip', {
          startDate: selectedStartDate,
          endDate: day.dateString,
          trackingMode: currentZone.trackingMode,
          targetCountry: currentZone.targetCountry,
        });
        setSelectedStartDate(null);
      } else {
        setSelectedStartDate(day.dateString);
      }
    }
  };

  const markedDates = useMemo(() => {
    const result: Record<string, any> = {};

    if (selectedStartDate) {
      result[selectedStartDate] = {
        startingDay: true,
        endingDay: true,
        color: colors.bauhausYellow,
        textColor: colors.text,
      };
    }

    const sortedTrips = [...zoneFilteredTrips].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

    sortedTrips.forEach(trip => {
      try {
        const todayStr = formatLocalISO(new Date());
        const endDateStr = trip.isOngoing
          ? (isBefore(parseISO(trip.entryDate), new Date()) ? todayStr : trip.entryDate)
          : trip.exitDate;

        const dateList = getDatesRangeArray(trip.entryDate, endDateStr);

        const entryC = (trip.entryCountry || trip.country || '').trim();
        const exitC = (trip.exitCountry || trip.country || '').trim();

        const isOngoing = trip.isOngoing;

        dateList.forEach((dateStr, idx) => {
          const isStart = idx === 0;
          const isEnd = idx === dateList.length - 1;

          // Check if this date exceeds 90/180 max allowed stay within zoneFilteredTrips
          let isOverstay = false;
          try {
            const targetDate = parseISO(dateStr);
            const windowStart = addDays(targetDate, -179);
            let daysInWindow = 0;
            zoneFilteredTrips.forEach(t => {
              const tStart = parseISO(t.entryDate);
              const tEnd = t.isOngoing ? targetDate : parseISO(t.exitDate);
              const overlapStart = isBefore(tStart, windowStart) ? windowStart : tStart;
              const overlapEnd = isBefore(targetDate, tEnd) ? targetDate : tEnd;
              if (isBefore(overlapStart, overlapEnd) || isSameDay(overlapStart, overlapEnd)) {
                daysInWindow += differenceInDays(overlapEnd, overlapStart) + 1;
              }
            });
            isOverstay = daysInWindow > (activeVisaConfig.maxDays || 90);
          } catch { }

          const dayColor = isOverstay
            ? colors.danger
            : isOngoing
              ? colors.bauhausBlue
              : colors.success;

          result[dateStr] = {
            startingDay: isStart,
            endingDay: isEnd,
            color: dayColor,
            textColor: '#FFFFFF',
          };
        });
      } catch (e) {
        console.warn('Error marking trip dates:', e);
      }
    });

    return result;
  }, [zoneFilteredTrips, selectedStartDate, currentZone, activeVisaConfig, visaDetails, colors, isDark]);

  const latestTripDate = useMemo(() => {
    if (trips.length === 0) return undefined;
    const sorted = [...trips].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    return sorted[sorted.length - 1].entryDate;
  }, [trips]);

  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      addPerson(newPersonName.trim(), i18n.language);
      setNewPersonName('');
      setShowAddPerson(false);
    }
  };

  const handleEditPerson = (id: string, name: string) => {
    setEditingPersonId(id);
    setEditPersonName(name);
  };

  const handleSaveEditPerson = (id: string) => {
    if (editPersonName.trim()) {
      updatePerson(id, editPersonName.trim());
    }
    setEditingPersonId(null);
  };

  const dynamicStyles = getStyles(colors, isDark);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {/* INITIAL PROFILE SETUP MODAL */}
      <Modal visible={isNoProfile} animationType="slide" transparent>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.initialModalCard}>
            <Text style={dynamicStyles.initialModalTitle}>👋 Hoş Geldiniz / Welcome!</Text>
            <Text style={dynamicStyles.initialModalSub}>Lütfen profil isminizi girin (Örn: Harun, Ahmet, Ben):</Text>
            <TextInput
              style={dynamicStyles.initialInput}
              placeholder="Profil İsmi / Name"
              placeholderTextColor={colors.textSecondary}
              value={initialProfileName}
              onChangeText={setInitialProfileName}
              autoFocus
            />
            <TouchableOpacity style={dynamicStyles.initialBtn} onPress={handleCreateInitialProfile}>
              <Text style={dynamicStyles.initialBtnText}>Başla / Start 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADD ZONE MODAL */}
      <Modal visible={isAddZoneModalOpen} animationType="fade" transparent>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.initialModalCard}>
            <Text style={dynamicStyles.initialModalTitle}>➕ {t('dashboard.addZone')}</Text>
            <Text style={dynamicStyles.initialModalSub}>Takip etmek istediğiniz hedef ülkeyi seçin:</Text>
            <View style={dynamicStyles.pickerWrapper}>
              <Picker
                selectedValue={selectedNewCountry}
                onValueChange={(val) => setSelectedNewCountry(val)}
                itemStyle={{ fontSize: 18, color: colors.text, height: 120 }}
              >
                {NON_SCHENGEN_COUNTRIES.map(c => (
                  <Picker.Item key={c} label={t(`countries.${c}`, { defaultValue: c })} value={c} color={colors.text} />
                ))}
              </Picker>
            </View>
            <View style={dynamicStyles.modalActionsRow}>
              <TouchableOpacity style={[dynamicStyles.modalCancelBtn]} onPress={() => setIsAddZoneModalOpen(false)}>
                <Text style={dynamicStyles.modalCancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[dynamicStyles.initialBtn, { flex: 1, marginLeft: 8 }]} onPress={handleAddCustomZone}>
                <Text style={dynamicStyles.initialBtnText}>{t('dashboard.addZone')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={dynamicStyles.header}>
        <View>
          <Text style={dynamicStyles.title}>{t('dashboard.title')}</Text>
          <Text style={dynamicStyles.profileText}>{t('common.profile')}: {activePerson?.name || '-'}</Text>
        </View>
        <TouchableOpacity onPress={() => setIsMenuOpen(true)} style={dynamicStyles.menuBtn}>
          <Text style={dynamicStyles.menuBtnText}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* SUB-PROFILES ZONE TAB BAR */}
      <View style={dynamicStyles.zoneBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.zoneScroll}>
          {customZones.map((z) => {
            const displayName = z.targetCountry
              ? `🌐 ${t(`countries.${z.targetCountry}`, { defaultValue: z.targetCountry })}`
              : z.name;

            return (
              <View key={z.id} style={dynamicStyles.zonePillWrapper}>
                <TouchableOpacity
                  style={[dynamicStyles.zonePill, activeZoneId === z.id && dynamicStyles.zonePillActive]}
                  onPress={() => setActiveZoneId(z.id)}
                >
                  <Text style={[dynamicStyles.zonePillText, activeZoneId === z.id && dynamicStyles.zonePillTextActive]}>
                    {displayName}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dynamicStyles.deleteZoneBtn}
                  onPress={() => handleDeleteZone(z.id, displayName)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={dynamicStyles.deleteZoneBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <TouchableOpacity style={dynamicStyles.addZonePill} onPress={() => setIsAddZoneModalOpen(true)}>
            <Text style={dynamicStyles.addZonePillText}>{t('dashboard.addZone')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={dynamicStyles.mainContent}>
        {/* VISA EXPIRED ALERT BANNER */}
        {rule90180.isVisaExpired && (
          <View style={[dynamicStyles.visaAlertBanner, { backgroundColor: isDark ? '#451A1A' : '#FEF2F2', borderColor: '#EF4444' }]}>
            <Text style={[dynamicStyles.visaAlertTitle, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
              {t('dashboard.visaExpiredAlertTitle')}
            </Text>
            <Text style={[dynamicStyles.visaAlertDesc, { color: isDark ? '#FEE2E2' : '#B91C1C' }]}>
              {t('dashboard.visaExpiredAlertDesc')}
            </Text>
          </View>
        )}

        {/* VISA EXPIRING SOON ALERT BANNER */}
        {!rule90180.isVisaExpired && rule90180.isVisaExpiringSoon && rule90180.daysUntilVisaExpires !== null && (
          <View style={[dynamicStyles.visaAlertBanner, { backgroundColor: isDark ? '#3E2A14' : '#FFFBEB', borderColor: '#F59E0B' }]}>
            <Text style={[dynamicStyles.visaAlertTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
              {t('dashboard.visaExpiringSoonTitle')}
            </Text>
            <Text style={[dynamicStyles.visaAlertDesc, { color: isDark ? '#FEF3C7' : '#B45309' }]}>
              {t('dashboard.visaExpiringSoonDesc', {
                days: rule90180.daysUntilVisaExpires,
                allowed: rule90180.daysRemaining
              })}
            </Text>
          </View>
        )}

        {/* MAIN REMAINING DAYS CARD */}
        <View style={[dynamicStyles.card, rule90180.isViolated && { borderColor: colors.danger, borderWidth: 2 }]}>
          <View style={dynamicStyles.cardHeaderRow}>
            <Text style={dynamicStyles.cardLabel}>{t('dashboard.remainingDays')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[dynamicStyles.activeZoneBadgeLabel, { marginLeft: 6 }]}>{currentZone.name}</Text>
            </View>
          </View>
          <Text style={[dynamicStyles.bigNumber, { color: rule90180.isViolated ? colors.danger : rule90180.daysRemaining < 10 ? colors.warning : colors.text }]}>
            {rule90180.daysRemaining}
          </Text>
          <Text style={dynamicStyles.cardSubtext}>
            {t('dashboard.daysUsed')}: {rule90180.daysSpent} / {rule90180.maxDaysAllowed}
          </Text>
          {rule90180.isViolated && (
            <Text style={dynamicStyles.errorText}>{t('dashboard.statusOverstay', { maxDays: rule90180.maxDaysAllowed })}</Text>
          )}

          {rule90180.nextAvailableDate && (
            <View style={dynamicStyles.nextAvailableContainer}>
              <Text style={dynamicStyles.nextAvailableTitle}>🚀 {t('dashboard.nextAvailableTitle')}</Text>
              <Text style={dynamicStyles.nextAvailableDateVal}>{rule90180.nextAvailableDate}</Text>
              <Text style={dynamicStyles.nextAvailableSubVal}>
                ({rule90180.freedDays} {t('dashboard.nextAvailableSub')})
              </Text>
            </View>
          )}
        </View>

        {/* ONGOING TRIP CARD */}
        {ongoingTrip && (
          <View style={dynamicStyles.ongoingCard}>
            <View style={dynamicStyles.ongoingHeaderRow}>
              <View style={dynamicStyles.ongoingBadge}>
                <Text style={dynamicStyles.ongoingBadgeText}>🔵 {t('dashboard.ongoingTrip').toUpperCase()}</Text>
              </View>
              <Text style={dynamicStyles.ongoingDaysCount}>
                {calculateDaysForTrip(ongoingTrip.entryDate, ongoingTrip.exitDate, true)} {t('common.days')}
              </Text>
            </View>

            <Text style={dynamicStyles.ongoingCountryText}>
              📍 {t(`countries.${ongoingTrip.entryCountry || ongoingTrip.country}`, { defaultValue: ongoingTrip.entryCountry || ongoingTrip.country })}
            </Text>

            <Text style={dynamicStyles.ongoingDatesText}>
              {t('dashboard.entry')}: {ongoingTrip.entryDate} ➔ {t('dashboard.ongoing')}
            </Text>

            <TouchableOpacity
              style={dynamicStyles.closeOngoingBtn}
              onPress={() => {
                const exitDate = formatLocalISO(new Date());
                const hasGroup = ongoingTrip.groupId && persons.some(p =>
                  p.id !== activePersonId && p.trips.some(t => t.groupId === ongoingTrip.groupId && t.isOngoing)
                );

                if (hasGroup) {
                  if (Platform.OS === 'web') {
                    const closeAll = window.confirm('Other profiles also have this ongoing trip. Close for EVERYONE?');
                    if (closeAll) {
                      closeTripGroup(ongoingTrip.groupId!, exitDate);
                    } else {
                      updateTrip(ongoingTrip.id, { isOngoing: false, exitDate });
                    }
                  } else {
                    Alert.alert(
                      t('tripsList.closeOngoing'),
                      'Other profiles also have this ongoing trip. Close it for everyone?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Just Me', onPress: () => updateTrip(ongoingTrip.id, { isOngoing: false, exitDate }) },
                        { text: 'Everyone', onPress: () => closeTripGroup(ongoingTrip.groupId!, exitDate), style: 'destructive' }
                      ]
                    );
                  }
                } else {
                  updateTrip(ongoingTrip.id, { isOngoing: false, exitDate });
                }
              }}
            >
              <Text style={dynamicStyles.closeOngoingBtnText}>✓ {t('tripsList.closeOngoing')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ROW 2: Visa Destination (For Schengen Zone) */}
        {currentZone.trackingMode === 'SCHENGEN' && (
          visaDetails?.country && trips.length > 0 ? (
            <View style={[dynamicStyles.thinCard, !mainDestination.isValid && { borderColor: colors.warning, borderWidth: 2 }]}>
              <Text style={dynamicStyles.thinCardLabel}>
                {t('dashboard.visaDest')} ({t(`countries.${visaDetails.country}`, { defaultValue: visaDetails.country })})
              </Text>
              <View style={dynamicStyles.thinCardRight}>
                <Text style={[dynamicStyles.thinCardNumber, { color: colors.bauhausBlue }]}>
                  {mainDestination.visaCountryDays}
                </Text>
                <Text style={dynamicStyles.thinCardSubtext}> {t('common.days')}</Text>
              </View>
            </View>
          ) : (
            (!visaDetails || !visaDetails.country) && (
              <TouchableOpacity
                style={[dynamicStyles.thinCard, dynamicStyles.missingVisaCard]}
                onPress={() => navigation.navigate('VisaSettings', {
                  zoneId: currentZone.id,
                  zoneName: currentZone.name,
                  trackingMode: currentZone.trackingMode,
                  targetCountry: currentZone.targetCountry,
                })}
              >
                <Text style={dynamicStyles.missingVisaText}>{t('dashboard.visaSettings')} ➔</Text>
              </TouchableOpacity>
            )
          )
        )}

        {/* Legend */}
        <View style={dynamicStyles.legendContainer}>
          <View style={dynamicStyles.legendItem}><View style={[dynamicStyles.legendDot, { backgroundColor: colors.success }]} /><Text style={dynamicStyles.legendText}>{t('dashboard.legendAllowed')}</Text></View>
          <View style={dynamicStyles.legendItem}><View style={[dynamicStyles.legendDot, { backgroundColor: colors.danger }]} /><Text style={dynamicStyles.legendText}>{t('dashboard.legendViolation')}</Text></View>
          <View style={dynamicStyles.legendItem}><View style={[dynamicStyles.legendDot, { backgroundColor: colors.bauhausYellow }]} /><Text style={dynamicStyles.legendText}>{t('dashboard.legendMulti')}</Text></View>
        </View>

        <Text style={dynamicStyles.calendarHint}>
          {!selectedStartDate
            ? t('dashboard.hintSelectEntry')
            : t('dashboard.hintSelectExit')}
        </Text>

        <View style={dynamicStyles.calendarContainer}>
          <Calendar
            key={`${latestTripDate || 'default'}-${currentLang}`}
            current={latestTripDate}
            markingType={'period'}
            markedDates={markedDates}
            onDayPress={onDayPress}
            theme={{
              calendarBackground: colors.surface,
              backgroundColor: colors.surface,
              todayTextColor: colors.bauhausRed,
              dayTextColor: colors.text,
              monthTextColor: colors.text,
              arrowColor: colors.bauhausBlue,
              indicatorColor: colors.bauhausBlue,
              textDayFontWeight: '600',
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '600',
              textSectionTitleColor: colors.textSecondary,
            }}
          />
        </View>

        <TouchableOpacity
          style={dynamicStyles.actionBtn}
          onPress={() => navigation.navigate('AddTrip', {
            trackingMode: currentZone.trackingMode,
            targetCountry: currentZone.targetCountry,
          })}
        >
          <Text style={dynamicStyles.actionBtnText}>{t('dashboard.addTripManually')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* SIDE MENU MODAL */}
      <Modal visible={isMenuOpen} animationType="slide" transparent>
        <View style={dynamicStyles.menuOverlay}>
          <TouchableOpacity style={dynamicStyles.menuBackdrop} onPress={() => setIsMenuOpen(false)} />
          <View style={dynamicStyles.menuDrawer}>
            <View style={dynamicStyles.menuHeader}>
              <Text style={dynamicStyles.menuTitle}>{t('dashboard.menuTitle')}</Text>
              <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
                <Text style={dynamicStyles.closeMenuBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.profilesSection}>
              <Text style={dynamicStyles.sectionHeader}>{t('dashboard.profilesTitle').toUpperCase()} ({persons.length})</Text>
              {persons.map((p) => (
                <View key={p.id} style={[dynamicStyles.profileItem, activePersonId === p.id && dynamicStyles.activeProfileItem]}>
                  {editingPersonId === p.id ? (
                    <View style={dynamicStyles.editPersonRow}>
                      <TextInput
                        style={dynamicStyles.editPersonInput}
                        value={editPersonName}
                        onChangeText={setEditPersonName}
                        autoFocus
                      />
                      <TouchableOpacity style={dynamicStyles.saveEditBtn} onPress={() => handleSaveEditPerson(p.id)}>
                        <Text style={dynamicStyles.saveEditBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={dynamicStyles.cancelEditBtn} onPress={() => setEditingPersonId(null)}>
                        <Text style={dynamicStyles.cancelEditBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={dynamicStyles.profileBtnClickable}
                        onPress={() => {
                          switchPerson(p.id);
                          showCompletedFlowInterstitial();
                        }}
                      >
                        <Text style={[dynamicStyles.profileBtnText, activePersonId === p.id && dynamicStyles.activeProfileBtnText]}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                      <View style={dynamicStyles.profileActions}>
                        <TouchableOpacity style={dynamicStyles.iconBtn} onPress={() => handleEditPerson(p.id, p.name)}>
                          <Text style={dynamicStyles.iconBtnText}>✎</Text>
                        </TouchableOpacity>
                        {persons.length > 1 && (
                          <TouchableOpacity style={dynamicStyles.iconBtn} onPress={() => removePerson(p.id)}>
                            <Text style={dynamicStyles.iconBtnTextDanger}>🗑️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </View>
              ))}

              {!showAddPerson && !editingPersonId ? (
                <TouchableOpacity style={dynamicStyles.addPersonBtn} onPress={() => setShowAddPerson(true)}>
                  <Text style={dynamicStyles.addPersonBtnText}>{t('dashboard.addPerson')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={dynamicStyles.addPersonRow}>
                  <TextInput
                    style={dynamicStyles.addPersonInput}
                    placeholder="Name"
                    placeholderTextColor={colors.textSecondary}
                    value={newPersonName}
                    onChangeText={setNewPersonName}
                    autoFocus
                  />
                  <TouchableOpacity style={dynamicStyles.savePersonBtn} onPress={handleAddPerson}>
                    <Text style={dynamicStyles.savePersonBtnText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={dynamicStyles.divider} />

            <TouchableOpacity
              style={dynamicStyles.menuItemBtn}
              onPress={() => {
                setIsMenuOpen(false);
                (navigation as any).navigate('AddTrip', {
                  trackingMode: currentZone.trackingMode,
                  targetCountry: currentZone.targetCountry,
                });
              }}
            >
              <Text style={dynamicStyles.menuItemBtnText}>➕ {t('dashboard.addTripBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={dynamicStyles.menuItemBtn}
              onPress={() => {
                setIsMenuOpen(false);
                (navigation as any).navigate('TripsList');
              }}
            >
              <Text style={dynamicStyles.menuItemBtnText}>{t('dashboard.myTrips')} ({trips.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={dynamicStyles.menuItemBtn}
              onPress={() => {
                setIsMenuOpen(false);
                navigation.navigate('VisaSettings', {
                  zoneId: currentZone.id,
                  zoneName: currentZone.name,
                  trackingMode: currentZone.trackingMode,
                  targetCountry: currentZone.targetCountry,
                });
              }}
            >
              <Text style={dynamicStyles.menuItemBtnText}>{t('dashboard.visaSettings')}</Text>
            </TouchableOpacity>

            {/* DYNAMIC LANGUAGE COMBOBOX / PICKER IN SIDE MENU */}
            <View style={dynamicStyles.langSection}>
              <Text style={dynamicStyles.sectionHeader}>DİL / LANGUAGE</Text>
              <View style={dynamicStyles.pickerWrapper}>
                <Picker
                  selectedValue={currentLang}
                  onValueChange={(val) => changeAppLanguage(val as any)}
                  itemStyle={{ fontSize: 16, color: colors.text, height: 100 }}
                >
                  {[
                    { code: 'tr', label: '🇹🇷 Türkçe' },
                    { code: 'en', label: '🇬🇧 English' },
                    { code: 'bg', label: '🇧🇬 Български' },
                    { code: 'el', label: '🇬🇷 Ελληνικά' },
                    { code: 'mk', label: '🇲🇰 Македонски' },
                  ].map((lang) => (
                    <Picker.Item
                      key={lang.code}
                      label={lang.label}
                      value={lang.code}
                      color={colors.text}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* THEME SELECTION IN SIDE MENU */}
            <View style={dynamicStyles.themeSection}>
              <Text style={dynamicStyles.sectionHeader}>TEMA / THEME</Text>
              <View style={dynamicStyles.themeRow}>
                <TouchableOpacity
                  style={[dynamicStyles.themeBtn, themeMode === 'light' && dynamicStyles.themeBtnActive]}
                  onPress={() => setThemeMode('light')}
                >
                  <Text style={[dynamicStyles.themeBtnText, themeMode === 'light' && dynamicStyles.themeBtnTextActive]}>☀️ Aydınlık</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[dynamicStyles.themeBtn, themeMode === 'dark' && dynamicStyles.themeBtnActive]}
                  onPress={() => setThemeMode('dark')}
                >
                  <Text style={[dynamicStyles.themeBtnText, themeMode === 'dark' && dynamicStyles.themeBtnTextActive]}>🌙 Koyu</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[dynamicStyles.themeBtn, themeMode === 'system' && dynamicStyles.themeBtnActive]}
                  onPress={() => setThemeMode('system')}
                >
                  <Text style={[dynamicStyles.themeBtnText, themeMode === 'system' && dynamicStyles.themeBtnTextActive]}>📱 Sistem</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* GITHUB REPO LINK IN SIDE MENU */}
            <View style={dynamicStyles.githubSection}>
              <TouchableOpacity
                style={dynamicStyles.githubBtn}
                onPress={() => {
                  Linking.openURL('https://github.com/harundroid/SchengenTakip').catch(() => {});
                }}
              >
                <Text style={dynamicStyles.githubBtnText}>
                  🐙 {t('dashboard.githubLink', { defaultValue: 'Kaynak Kodları İnceleyin (GitHub)' })} ➔
                </Text>
              </TouchableOpacity>
            </View>

            {/* POWERED BY BRANDING FOOTER */}
            <View style={dynamicStyles.poweredByContainer}>
              <Text style={dynamicStyles.poweredByText}>POWERED BY</Text>
              <Image
                source={require('../../assets/logo.png')}
                style={dynamicStyles.poweredByLogo}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      </Modal>

      <AdBanner />
    </SafeAreaView>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  profileText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  menuBtn: { padding: 8, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  menuBtnText: { fontSize: 20, color: colors.text },

  // Zone Scroll Bar
  visaAlertBanner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  visaAlertTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  visaAlertDesc: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  zoneBarContainer: { paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  zoneScroll: { paddingHorizontal: 16, alignItems: 'center' },
  zonePillWrapper: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  zonePill: { backgroundColor: colors.background, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  zonePillActive: { backgroundColor: colors.bauhausBlue, borderColor: colors.bauhausBlue },
  zonePillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  zonePillTextActive: { color: colors.white, fontWeight: '800' },
  deleteZoneBtn: { backgroundColor: colors.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: -6, marginTop: -12, zIndex: 10 },
  deleteZoneBtnText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  addZonePill: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.bauhausBlue, borderStyle: 'dashed' },
  addZonePillText: { fontSize: 13, fontWeight: '700', color: colors.bauhausBlue },

  mainContent: { padding: 16, paddingBottom: 60 },
  card: { backgroundColor: colors.surface, padding: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardLabel: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  editVisaDirectBtn: { backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  editVisaDirectBtnText: { fontSize: 12, fontWeight: '700', color: colors.bauhausBlue },
  activeZoneBadgeLabel: { fontSize: 12, fontWeight: '700', color: colors.bauhausBlue, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  bigNumber: { fontSize: 54, fontWeight: '900', marginVertical: 4 },
  cardSubtext: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  errorText: { color: colors.danger, fontWeight: 'bold', marginTop: 8 },

  // Next Available Date Sub-Container
  nextAvailableContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-start',
  },
  nextAvailableTitle: { fontSize: 13, fontWeight: '700', color: colors.bauhausBlue, marginBottom: 4 },
  nextAvailableDateVal: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 2 },
  nextAvailableSubVal: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  // Ongoing Trip Card
  ongoingCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.bauhausBlue,
  },
  ongoingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ongoingBadge: { backgroundColor: colors.bauhausBlue, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  ongoingBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  ongoingDaysCount: { fontSize: 18, fontWeight: '900', color: colors.bauhausBlue },
  ongoingCountryText: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  ongoingDatesText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 12 },
  closeOngoingBtn: { backgroundColor: colors.bauhausBlue, padding: 12, borderRadius: 10, alignItems: 'center' },
  closeOngoingBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 14 },

  thinCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  thinCardLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  thinCardRight: { flexDirection: 'row', alignItems: 'baseline' },
  thinCardNumber: { fontSize: 20, fontWeight: '800' },
  thinCardSubtext: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  missingVisaCard: { justifyContent: 'center', backgroundColor: colors.background, borderStyle: 'dashed' },
  missingVisaText: { color: colors.bauhausBlue, fontWeight: '700', fontSize: 14 },

  legendContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8, backgroundColor: colors.surface, padding: 10, borderRadius: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  calendarHint: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginVertical: 6 },
  calendarContainer: { backgroundColor: colors.surface, borderRadius: 16, padding: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  actionBtn: { backgroundColor: colors.bauhausYellow, padding: 16, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: colors.text, fontWeight: '800', fontSize: 16 },

  // Initial & Add Zone Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  initialModalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border },
  initialModalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' },
  initialModalSub: { fontSize: 14, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' },
  initialInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, marginBottom: 16 },
  initialBtn: { backgroundColor: colors.bauhausBlue, borderRadius: 12, padding: 16, alignItems: 'center' },
  initialBtnText: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
  pickerWrapper: { backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
  modalActionsRow: { flexDirection: 'row', alignItems: 'center' },
  modalCancelBtn: { backgroundColor: colors.background, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  modalCancelBtnText: { color: colors.text, fontWeight: '600' },

  // Side Menu Drawer
  menuOverlay: { flex: 1, flexDirection: 'row' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  menuDrawer: { width: '82%', backgroundColor: colors.surface, padding: 20, paddingTop: 60 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  menuTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  closeMenuBtn: { fontSize: 24, color: colors.textSecondary, padding: 4 },
  profilesSection: { marginBottom: 16 },
  sectionHeader: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 },
  profileItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 6, backgroundColor: colors.background },
  activeProfileItem: { borderWidth: 1, borderColor: colors.bauhausBlue, backgroundColor: colors.surface },
  profileBtnClickable: { flex: 1 },
  profileBtnText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  activeProfileBtnText: { color: colors.bauhausBlue, fontWeight: '800' },
  profileActions: { flexDirection: 'row' },
  iconBtn: { padding: 6, marginLeft: 4 },
  iconBtnText: { fontSize: 16, color: colors.bauhausBlue },
  iconBtnTextDanger: { fontSize: 16 },
  addPersonBtn: { padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 8, marginTop: 8 },
  addPersonBtnText: { color: colors.bauhausBlue, fontWeight: 'bold', fontSize: 14 },
  addPersonRow: { flexDirection: 'row', marginTop: 8 },
  addPersonInput: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, color: colors.text },
  savePersonBtn: { backgroundColor: colors.bauhausBlue, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8, marginLeft: 8 },
  savePersonBtnText: { color: colors.white, fontWeight: 'bold' },
  editPersonRow: { flexDirection: 'row', flex: 1, alignItems: 'center' },
  editPersonInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 6, fontSize: 14, color: colors.text },
  saveEditBtn: { padding: 8, backgroundColor: colors.success, borderRadius: 6, marginLeft: 4 },
  saveEditBtnText: { color: colors.white, fontWeight: 'bold' },
  cancelEditBtn: { padding: 8, backgroundColor: colors.danger, borderRadius: 6, marginLeft: 4 },
  cancelEditBtnText: { color: colors.white, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  menuItemBtn: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.background },
  menuItemBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  // Language section in side menu
  langSection: { marginTop: 16 },
  langRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  langBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginHorizontal: 3 },
  langBtnActive: { backgroundColor: colors.bauhausBlue, borderColor: colors.bauhausBlue },
  langBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  langBtnTextActive: { color: colors.white, fontWeight: '800' },

  // Theme section in side menu
  themeSection: { marginTop: 16 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  themeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginHorizontal: 3 },
  themeBtnActive: { backgroundColor: colors.bauhausBlue, borderColor: colors.bauhausBlue },
  themeBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  themeBtnTextActive: { color: colors.white, fontWeight: '800' },

  // GitHub section in side menu
  githubSection: { marginTop: 20 },
  githubBtn: { backgroundColor: colors.surface, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  githubBtnText: { fontSize: 13, fontWeight: '700', color: colors.bauhausBlue },

  // Powered By Logo Footer
  poweredByContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  poweredByText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  poweredByLogo: {
    width: 120,
    height: 36,
  },
});
