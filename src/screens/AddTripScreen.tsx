import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTripStore } from '../store/useTripStore';
import { RootStackParamList } from '../navigation/AppNavigator';
import { TripSegment } from '../types';
import { differenceInDays, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { showCompletedFlowInterstitial } from '../config/ads';
import { AdBanner } from '../components/AdBanner';
import { useAppTheme } from '../theme/ThemeContext';
import { validateTripForm } from '../utils/validation';
import { SCHENGEN_ONLY_COUNTRIES, getCountryCode } from '../constants/countries';

const formatLocal = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

type AddTripRouteProp = RouteProp<RootStackParamList, 'AddTrip'>;

export const AddTripScreen = () => {
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

  const visaDetails = activePerson?.visaDetails;
  
  // Determine tracking mode and target country from route params or active profile visa details
  const trackingMode = route.params?.trackingMode || visaDetails?.trackingMode || (i18n.language === 'bg' ? 'SINGLE_COUNTRY' : 'SCHENGEN');
  const rawTargetCountry = route.params?.targetCountry || visaDetails?.targetCountry || (i18n.language === 'bg' ? 'TR' : 'AT');
  const targetCountry = getCountryCode(rawTargetCountry);

  const isSingleCountryMode = trackingMode === 'SINGLE_COUNTRY' && Boolean(targetCountry);

  const initialStart = route.params?.startDate ? parseISO(route.params.startDate) : (existingTrip ? parseISO(existingTrip.entryDate) : new Date());
  const initialEnd = route.params?.endDate ? parseISO(route.params.endDate) : (existingTrip ? parseISO(existingTrip.exitDate) : new Date());

  const [isOngoing, setIsOngoing] = useState(existingTrip?.isOngoing || false);
  const [entryDate, setEntryDate] = useState<Date>(initialStart);
  const [exitDate, setExitDate] = useState<Date>(initialEnd);
  const [showEntryPicker, setShowEntryPicker] = useState(false);
  const [showExitPicker, setShowExitPicker] = useState(false);
  
  // For Schengen mode: default to Schengen country list; For Single Country mode: fixed to targetCountry
  const defaultSchengenCountry = existingTrip?.entryCountry ? getCountryCode(existingTrip.entryCountry) : SCHENGEN_ONLY_COUNTRIES[0];

  const [entryCountry, setEntryCountry] = useState(isSingleCountryMode ? targetCountry : defaultSchengenCountry);
  const [exitCountry, setExitCountry] = useState(isSingleCountryMode ? targetCountry : defaultSchengenCountry);

  const [segments, setSegments] = useState<TripSegment[]>(existingTrip?.segments || []);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([activePersonId || '']);

  useEffect(() => {
    if (isSingleCountryMode) {
      setEntryCountry(targetCountry);
      setExitCountry(targetCountry);
    }
  }, [isSingleCountryMode, targetCountry]);



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

    // Validate using utility
    const val = validateTripForm({
      isVisaExempt: visaDetails?.isVisaExempt || false,
      isOngoing,
      tripEntryDate: finalEntryDate,
      tripExitDate: finalExitDate,
      visaStartDate: visaDetails?.validFrom,
      visaEndDate: visaDetails?.validUntil,
    });

    if (!val.isValid) {
      const errorMsg = Object.values(val.errors).filter(Boolean).join('\n');
      Alert.alert(t('common.error'), errorMsg || 'Geçersiz seyahat verisi');
      return;
    }

    const tripData = {
      id: existingTrip ? existingTrip.id : Math.random().toString(36).substring(2, 9),
      country: entryCountry,
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
    <SafeAreaView style={dynamicStyles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={dynamicStyles.scroll}>
          <Text style={dynamicStyles.title}>
            {existingTrip ? t('addTrip.titleEdit') : t('addTrip.titleAdd')}
          </Text>

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
                {t(`countries.${targetCountry}`, { defaultValue: targetCountry })} ({visaDetails?.maxDays || 90}/180 Rule)
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
  scroll: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, marginBottom: 24 },
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
