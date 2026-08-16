import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTripStore } from '../store/useTripStore';
import { RootStackParamList } from '../navigation/AppNavigator';
import { TripSegment, TrackingMode } from '../types';
import { differenceInDays, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { showCompletedFlowInterstitial } from '../config/ads';
import { AdBanner } from '../components/AdBanner';
import { useAppTheme } from '../theme/ThemeContext';
import { validateTripForm } from '../utils/validation';
import { SCHENGEN_ONLY_COUNTRIES, getCountryCode, isSchengenCountry } from '../constants/countries';

const formatLocal = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

type AddTripRouteProp = RouteProp<RootStackParamList, 'AddTrip'>;

export const AddTripScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<AddTripRouteProp>();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useAppTheme();

  const addTrip = useTripStore(state => state.addTrip);
  const updateTripStore = useTripStore(state => state.updateTrip);
  const addTripToMultiple = useTripStore(state => state.addTripToMultiple);
  const persons = useTripStore(state => state.persons);
  const activePersonId = useTripStore(state => state.activePersonId);

  const activePerson = persons.find(p => p.id === activePersonId);
  const existingTripId = route.params?.tripId;
  const existingTrip = activePerson?.trips.find(t => t.id === existingTripId);

  // 1. Gather all available tracking zones / visas for active person
  const availableZones = useMemo(() => {
    const list: Array<{ id: string; name: string; trackingMode: TrackingMode; targetCountry?: string }> = [];

    // Always include Schengen Zone
    list.push({
      id: 'schengen',
      name: '🇪🇺 Schengen Zone',
      trackingMode: 'SCHENGEN',
    });

    // Custom zones configured on person
    if (activePerson?.zones && activePerson.zones.length > 0) {
      activePerson.zones.forEach((z) => {
        if (z.id !== 'schengen' && !list.some((item) => item.id === z.id)) {
          const countryCode = z.targetCountry || z.id;
          list.push({
            id: z.id,
            name: z.name || t(`countries.${countryCode}`, { defaultValue: countryCode }),
            trackingMode: z.trackingMode,
            targetCountry: countryCode,
          });
        }
      });
    }

    // Any zoneVisaDetails keys that are non-Schengen
    if (activePerson?.zoneVisaDetails) {
      Object.keys(activePerson.zoneVisaDetails).forEach((key) => {
        if (key !== 'schengen' && !list.some((item) => item.id === key)) {
          const details = activePerson.zoneVisaDetails![key];
          const countryCode = details?.targetCountry || key;
          list.push({
            id: key,
            name: t(`countries.${countryCode}`, { defaultValue: countryCode }),
            trackingMode: 'SINGLE_COUNTRY',
            targetCountry: countryCode,
          });
        }
      });
    }

    return list;
  }, [activePerson, t]);

  // 2. Determine initial zone
  const initialZoneId = useMemo(() => {
    if (existingTrip) {
      const isSchengen = isSchengenCountry(existingTrip.entryCountry) ||
        isSchengenCountry(existingTrip.exitCountry) ||
        Boolean(existingTrip.segments && existingTrip.segments.some(s => isSchengenCountry(s.country)));

      if (isSchengen) return 'schengen';
      const c = getCountryCode(existingTrip.entryCountry || existingTrip.exitCountry);
      if (c && availableZones.some(z => z.id === c)) return c;
      return c || 'schengen';
    }

    if (route.params?.trackingMode === 'SINGLE_COUNTRY' && route.params?.targetCountry) {
      const c = getCountryCode(route.params.targetCountry);
      if (availableZones.some(z => z.id === c)) return c;
    }
    if (route.params?.trackingMode === 'SCHENGEN') {
      return 'schengen';
    }

    return availableZones[0]?.id || 'schengen';
  }, [existingTrip, route.params, availableZones]);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(initialZoneId);

  // Selected Zone Details
  const selectedZone = useMemo(() => {
    return availableZones.find(z => z.id === selectedZoneId) || availableZones[0] || {
      id: 'schengen',
      name: '🇪🇺 Schengen Zone',
      trackingMode: 'SCHENGEN' as TrackingMode,
    };
  }, [availableZones, selectedZoneId]);

  const isSingleCountryMode = selectedZone.trackingMode === 'SINGLE_COUNTRY' && Boolean(selectedZone.targetCountry || selectedZone.id);
  const targetCountry = isSingleCountryMode ? getCountryCode(selectedZone.targetCountry || selectedZone.id) : '';

  // Retrieve matching visa details
  const relevantVisaDetails = useMemo(() => {
    if (isSingleCountryMode && targetCountry) {
      return activePerson?.zoneVisaDetails?.[targetCountry] || 
        (activePerson?.visaDetails?.targetCountry === targetCountry ? activePerson?.visaDetails : null);
    }
    return activePerson?.zoneVisaDetails?.['schengen'] || 
      (activePerson?.visaDetails?.trackingMode !== 'SINGLE_COUNTRY' ? activePerson?.visaDetails : null);
  }, [activePerson, isSingleCountryMode, targetCountry]);

  const initialStart = route.params?.startDate ? parseISO(route.params.startDate) : (existingTrip ? parseISO(existingTrip.entryDate) : new Date());
  const initialEnd = route.params?.endDate ? parseISO(route.params.endDate) : (existingTrip ? parseISO(existingTrip.exitDate) : new Date());

  const [isOngoing, setIsOngoing] = useState(existingTrip?.isOngoing || false);
  const [entryDate, setEntryDate] = useState<Date>(initialStart);
  const [exitDate, setExitDate] = useState<Date>(initialEnd);
  const [showEntryPicker, setShowEntryPicker] = useState(false);
  const [showExitPicker, setShowExitPicker] = useState(false);
  
  const [entryCountry, setEntryCountry] = useState<string>(() => {
    if (existingTrip?.entryCountry) return getCountryCode(existingTrip.entryCountry);
    return isSingleCountryMode ? targetCountry : SCHENGEN_ONLY_COUNTRIES[0];
  });
  const [exitCountry, setExitCountry] = useState<string>(() => {
    if (existingTrip?.exitCountry) return getCountryCode(existingTrip.exitCountry);
    return isSingleCountryMode ? targetCountry : SCHENGEN_ONLY_COUNTRIES[0];
  });

  const [segments, setSegments] = useState<TripSegment[]>(existingTrip?.segments || []);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([activePersonId || '']);

  // Handle zone selection change
  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    const targetZone = availableZones.find(z => z.id === zoneId);
    if (targetZone?.trackingMode === 'SINGLE_COUNTRY') {
      const c = getCountryCode(targetZone.targetCountry || targetZone.id);
      setEntryCountry(c);
      setExitCountry(c);
    } else {
      if (!isSchengenCountry(entryCountry)) {
        setEntryCountry(SCHENGEN_ONLY_COUNTRIES[0]);
      }
      if (!isSchengenCountry(exitCountry)) {
        setExitCountry(SCHENGEN_ONLY_COUNTRIES[0]);
      }
    }
  };

  const onEntryChange = (event: any, selectedDate?: Date) => {
    setShowEntryPicker(false);
    if (selectedDate) setEntryDate(selectedDate);
  };

  const onExitChange = (event: any, selectedDate?: Date) => {
    setShowExitPicker(false);
    if (selectedDate) setExitDate(selectedDate);
  };

  const togglePersonSelection = (personId: string) => {
    if (selectedPersonIds.includes(personId)) {
      if (selectedPersonIds.length > 1) {
        setSelectedPersonIds(selectedPersonIds.filter(id => id !== personId));
      }
    } else {
      setSelectedPersonIds([...selectedPersonIds, personId]);
    }
  };

  const handleSave = () => {
    const finalEntryDate = formatLocal(entryDate);
    const finalExitDate = isOngoing ? finalEntryDate : formatLocal(exitDate);

    // Validate using utility and relevant visa details
    const val = validateTripForm({
      isVisaExempt: relevantVisaDetails?.isVisaExempt || false,
      isOngoing,
      tripEntryDate: finalEntryDate,
      tripExitDate: finalExitDate,
      visaStartDate: relevantVisaDetails?.validFrom,
      visaEndDate: relevantVisaDetails?.validUntil,
    });

    if (!val.isValid) {
      const errorMsg = Object.values(val.errors).filter(Boolean).join('\n');
      Alert.alert(t('common.error'), errorMsg || 'Geçersiz seyahat verisi');
      return;
    }

    const tripData = {
      id: existingTrip ? existingTrip.id : Math.random().toString(36).substring(2, 9),
      entryCountry,
      exitCountry: isOngoing ? entryCountry : exitCountry,
      entryDate: finalEntryDate,
      exitDate: finalExitDate,
      isOngoing,
      segments: segments.length > 0 ? segments : undefined,
    };

    if (existingTrip) {
      updateTripStore(existingTrip.id, tripData);
    } else if (selectedPersonIds.length > 1) {
      addTripToMultiple(tripData, selectedPersonIds);
    } else {
      addTrip(tripData);
    }

    showCompletedFlowInterstitial();
    navigation.goBack();
  };

  const dynamicStyles = getStyles(colors, isDark);

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['left', 'right', 'bottom']}>
      {/* HEADER */}
      <View style={[
        dynamicStyles.header,
        { paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, 20) + 8 : 16 }
      ]}>
        <TouchableOpacity 
          style={dynamicStyles.backBtn} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
          activeOpacity={0.7}
        >
          <Text style={dynamicStyles.backBtnText}>‹ {t('common.back') || 'Geri'}</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.title}>
          {existingTrip ? t('addTrip.titleEdit') : t('addTrip.titleAdd')}
        </Text>
        <View style={dynamicStyles.placeholder} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={dynamicStyles.scroll}>

          {/* VISA / TRACKING ZONE SELECTOR */}
          <View style={dynamicStyles.zoneSelectContainer}>
            <Text style={dynamicStyles.label}>
              🛂 {t('visaSettings.zoneSelectorTitle') || 'VİZE / TAKİP BÖLGESİ'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.zonePillsScroll}>
              {availableZones.map(zone => {
                const isActive = selectedZoneId === zone.id;
                return (
                  <TouchableOpacity
                    key={zone.id}
                    style={[dynamicStyles.zonePill, isActive && dynamicStyles.zonePillActive]}
                    onPress={() => handleSelectZone(zone.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[dynamicStyles.zonePillText, isActive && dynamicStyles.zonePillTextActive]}>
                      {zone.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ONGOING SWITCH */}
          <View style={dynamicStyles.ongoingContainer}>
            <View>
              <Text style={dynamicStyles.ongoingTitle}>{t('addTrip.ongoing')}</Text>
              <Text style={dynamicStyles.ongoingDesc}>{t('addTrip.ongoingDesc')}</Text>
            </View>
            <Switch
              value={isOngoing}
              onValueChange={setIsOngoing}
              trackColor={{ false: colors.border, true: colors.bauhausBlue }}
            />
          </View>

          {/* DATES ROW */}
          <View style={dynamicStyles.row}>
            <View style={[dynamicStyles.inputContainer, { flex: 1, marginRight: isOngoing ? 0 : 8 }]}>
              <Text style={dynamicStyles.label}>{t('addTrip.entryDate')}</Text>
              {Platform.OS === 'ios' ? (
                <View style={dynamicStyles.compactDateWrapper}>
                  <DateTimePicker
                    value={entryDate}
                    mode="date"
                    display="compact"
                    locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) setEntryDate(selectedDate);
                    }}
                    themeVariant={isDark ? 'dark' : 'light'}
                    textColor={colors.text}
                  />
                </View>
              ) : Platform.OS === 'web' ? (
                React.createElement('input', {
                  type: 'date',
                  value: formatLocal(entryDate),
                  onChange: (e: any) => {
                    if (e.target.value) setEntryDate(parseISO(e.target.value));
                  },
                  style: { padding: '16px', fontSize: '16px', borderRadius: '12px', border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.surface, color: colors.text }
                })
              ) : (
                <TouchableOpacity style={dynamicStyles.dateButton} onPress={() => setShowEntryPicker(true)}>
                  <Text style={dynamicStyles.dateButtonText}>{formatLocal(entryDate)}</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isOngoing && (
              <View style={[dynamicStyles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={dynamicStyles.label}>{t('addTrip.exitDate')}</Text>
                {Platform.OS === 'ios' ? (
                  <View style={dynamicStyles.compactDateWrapper}>
                    <DateTimePicker
                      value={exitDate}
                      mode="date"
                      display="compact"
                      minimumDate={entryDate}
                      locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) setExitDate(selectedDate);
                      }}
                      themeVariant={isDark ? 'dark' : 'light'}
                      textColor={colors.text}
                    />
                  </View>
                ) : Platform.OS === 'web' ? (
                  React.createElement('input', {
                    type: 'date',
                    value: formatLocal(exitDate),
                    min: formatLocal(entryDate),
                    onChange: (e: any) => {
                      if (e.target.value) setExitDate(parseISO(e.target.value));
                    },
                    style: { padding: '16px', fontSize: '16px', borderRadius: '12px', border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.surface, color: colors.text }
                  })
                ) : (
                  <TouchableOpacity style={dynamicStyles.dateButton} onPress={() => setShowExitPicker(true)}>
                    <Text style={dynamicStyles.dateButtonText}>{formatLocal(exitDate)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Android Fallbacks */}
          {Platform.OS === 'android' && showEntryPicker && (
            <DateTimePicker 
              value={entryDate} 
              mode="date" 
              display="default" 
              locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
              onChange={onEntryChange} 
            />
          )}
          {Platform.OS === 'android' && showExitPicker && (
            <DateTimePicker 
              value={exitDate} 
              mode="date" 
              display="default" 
              locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
              onChange={onExitChange} 
              minimumDate={entryDate} 
            />
          )}

          {/* COUNTRY SELECTION SECTION */}
          {isSingleCountryMode ? (
            <View style={dynamicStyles.singleCountryBanner}>
              <Text style={dynamicStyles.singleCountryBannerTitle}>📍 Hedef Ülke / Target Country</Text>
              <Text style={dynamicStyles.singleCountryBannerValue}>
                {t(`countries.${targetCountry}`, { defaultValue: targetCountry })} ({relevantVisaDetails?.maxDays || 90}/180 Rule)
              </Text>
            </View>
          ) : (
            <>
              {/* Schengen Member Countries Pickers Only */}
              <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.label}>{t('addTrip.entryCountry')} (Schengen)</Text>
                <View style={dynamicStyles.pickerContainer}>
                  <Picker
                    selectedValue={entryCountry}
                    onValueChange={(itemValue) => setEntryCountry(itemValue)}
                    itemStyle={dynamicStyles.pickerItem}
                  >
                    {SCHENGEN_ONLY_COUNTRIES.map((code) => (
                      <Picker.Item key={code} label={t(`countries.${code}`, { defaultValue: code })} value={code} color={colors.text} />
                    ))}
                  </Picker>
                </View>
              </View>

              {!isOngoing && (
                <View style={dynamicStyles.inputContainer}>
                  <Text style={dynamicStyles.label}>{t('addTrip.exitCountry')} (Schengen)</Text>
                  <View style={dynamicStyles.pickerContainer}>
                    <Picker
                      selectedValue={exitCountry}
                      onValueChange={(itemValue) => setExitCountry(itemValue)}
                      itemStyle={dynamicStyles.pickerItem}
                    >
                      {SCHENGEN_ONLY_COUNTRIES.map((code) => (
                        <Picker.Item key={code} label={t(`countries.${code}`, { defaultValue: code })} value={code} color={colors.text} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={dynamicStyles.button} onPress={handleSave}>
            <Text style={dynamicStyles.buttonText}>{existingTrip ? t('common.save') : t('addTrip.saveTrip')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <AdBanner />
    </SafeAreaView>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: 15,
    color: colors.bauhausBlue,
    fontWeight: '800',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  placeholder: { width: 60 },
  scroll: { padding: 24, paddingBottom: 60 },
  zoneSelectContainer: {
    marginBottom: 20,
  },
  zonePillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  zonePill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zonePillActive: {
    backgroundColor: colors.bauhausBlue,
    borderColor: colors.bauhausBlue,
  },
  zonePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  zonePillTextActive: {
    color: colors.white,
  },
  ongoingContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  ongoingTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  ongoingDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  pickerContainer: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  pickerItem: { color: colors.text, fontSize: 16 },
  compactDateWrapper: { backgroundColor: colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start', justifyContent: 'center' },
  dateButton: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  dateButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: colors.bauhausBlue, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
  singleCountryBanner: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.bauhausBlue },
  singleCountryBannerTitle: { fontSize: 12, fontWeight: '800', color: colors.bauhausBlue, textTransform: 'uppercase', marginBottom: 4 },
  singleCountryBannerValue: { fontSize: 18, fontWeight: '800', color: colors.text },
});
