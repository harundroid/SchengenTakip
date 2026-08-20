import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { parseISO } from 'date-fns';
import { useTripStore } from '../store/useTripStore';
import { useTranslation } from 'react-i18next';
import { ALL_COUNTRIES, SCHENGEN_ONLY_COUNTRIES, NON_SCHENGEN_COUNTRIES, getCountryCode, isSchengenCountry, getSortedCountryOptions } from '../constants/countries';
import { TrackingMode, VisaDetails, VisaZoneConfig } from '../types';
import { AdBanner } from '../components/AdBanner';
import { useAppTheme } from '../theme/ThemeContext';

const safeParseDate = (d?: string | Date | null): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
  try {
    const parsed = parseISO(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
};

const formatLocal = (date?: Date | null) => {
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const VisaSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useAppTheme();

  const initialZoneId = route.params?.zoneId || 'schengen';

  const setZoneVisaDetails = useTripStore(state => state.setZoneVisaDetails);
  const updatePersonZones = useTripStore(state => state.updatePersonZones);
  const activePerson = useTripStore(state => state.persons.find(p => p.id === state.activePersonId));

  // Build dynamic list of available zones/countries to configure visa for based on user's active zones
  const availableZones = useMemo(() => {
    const list: Array<{ id: string; name: string; trackingMode: TrackingMode; defaultTarget?: string }> = [];

    if (activePerson?.zones && activePerson.zones.length > 0) {
      activePerson.zones.forEach(z => {
        const countryCode = z.targetCountry || z.country || z.name;
        list.push({
          id: z.id,
          name: z.id === 'schengen' ? '🇪🇺 Schengen Zone' : `🌐 ${t(`countries.${countryCode}`, { defaultValue: countryCode })}`,
          trackingMode: z.trackingMode,
          defaultTarget: countryCode,
        });
      });
    }

    if (activePerson?.zoneVisaDetails) {
      Object.keys(activePerson.zoneVisaDetails).forEach(zId => {
        if (!list.some(item => item.id === zId)) {
          const v = activePerson.zoneVisaDetails![zId];
          const countryCode = v.targetCountry || v.country || zId;
          list.push({
            id: zId,
            name: zId === 'schengen' ? '🇪🇺 Schengen Zone' : `🌐 ${t(`countries.${countryCode}`, { defaultValue: countryCode })}`,
            trackingMode: v.trackingMode,
            defaultTarget: countryCode,
          });
        }
      });
    }

    // Default fallback if empty
    if (list.length === 0) {
      list.push({ id: 'schengen', name: '🇪🇺 Schengen Zone', trackingMode: 'SCHENGEN' });
    }

    return list;
  }, [activePerson, t]);

  // Alphabetically sorted country lists by active language label
  const sortedSchengenCountries = useMemo(() => {
    return getSortedCountryOptions(SCHENGEN_ONLY_COUNTRIES, t, i18n.language);
  }, [t, i18n.language]);

  const sortedNonSchengenCountries = useMemo(() => {
    return getSortedCountryOptions(NON_SCHENGEN_COUNTRIES, t, i18n.language);
  }, [t, i18n.language]);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(initialZoneId);
  const [selectedNewCountryZone, setSelectedNewCountryZone] = useState<string>(NON_SCHENGEN_COUNTRIES[0]);
  const [showAddZoneInput, setShowAddZoneInput] = useState<boolean>(false);

  // Form State
  const [isVisaExempt, setIsVisaExempt] = useState<boolean>(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('SCHENGEN');
  const [targetCountry, setTargetCountry] = useState<string>('MK');
  const [country, setCountry] = useState<string>(SCHENGEN_ONLY_COUNTRIES[0]);
  const [validFromDate, setValidFromDate] = useState<Date>(new Date());
  const [validUntilDate, setValidUntilDate] = useState<Date>(new Date());
  const [maxDays, setMaxDays] = useState<string>('90');

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showUntilPicker, setShowUntilPicker] = useState(false);

  // Sync selectedZoneId if current selection is invalid
  useEffect(() => {
    if (!availableZones.some(z => z.id === selectedZoneId) && availableZones.length > 0) {
      setSelectedZoneId(availableZones[0].id);
    }
  }, [availableZones, selectedZoneId]);

  // Complete form state reset when top zone pill changes
  useEffect(() => {
    const targetZone = availableZones.find(z => z.id === selectedZoneId);
    const isSchengenZonePill = selectedZoneId === 'schengen';
    const savedDetails = activePerson?.zoneVisaDetails?.[selectedZoneId];

    if (savedDetails) {
      setIsVisaExempt(savedDetails.isVisaExempt || false);
      setTrackingMode(savedDetails.trackingMode || (isSchengenZonePill ? 'SCHENGEN' : 'SINGLE_COUNTRY'));
      setTargetCountry(savedDetails.targetCountry || targetZone?.defaultTarget || 'MK');
      setCountry((isSchengenZonePill && (!savedDetails.country || !isSchengenCountry(savedDetails.country))) ? SCHENGEN_ONLY_COUNTRIES[0] : (savedDetails.country || SCHENGEN_ONLY_COUNTRIES[0]));
      setValidFromDate(safeParseDate(savedDetails.validFrom));
      setValidUntilDate(safeParseDate(savedDetails.validUntil));
      setMaxDays(savedDetails.maxDays?.toString() || '90');
    } else {
      // Clean state reset based strictly on active top zone pill
      if (isSchengenZonePill) {
        setTrackingMode('SCHENGEN');
        setCountry(SCHENGEN_ONLY_COUNTRIES[0]);
      } else {
        setTrackingMode('SINGLE_COUNTRY');
        setTargetCountry(targetZone?.defaultTarget || 'MK');
      }
      setIsVisaExempt(false);
      setValidFromDate(new Date());
      setValidUntilDate(new Date());
      setMaxDays('90');
    }
  }, [selectedZoneId, activePerson, availableZones]);

  const onFromChange = (event: any, selectedDate?: Date) => {
    setShowFromPicker(false);
    if (selectedDate) setValidFromDate(selectedDate);
  };

  const onUntilChange = (event: any, selectedDate?: Date) => {
    setShowUntilPicker(false);
    if (selectedDate) setValidUntilDate(selectedDate);
  };

  const handleAddZoneFromPicker = () => {
    try {
      if (selectedNewCountryZone === 'schengen') {
        const newZone: VisaZoneConfig = {
          id: 'schengen',
          name: '🇪🇺 Schengen Zone',
          trackingMode: 'SCHENGEN',
          maxDays: 90,
        };

        if (activePerson?.id) {
          const existingZones = activePerson.zones || [];
          if (!existingZones.some(z => z.id === 'schengen')) {
            updatePersonZones(activePerson.id, [newZone, ...existingZones]);
          }
        }

        setSelectedZoneId('schengen');
        setTrackingMode('SCHENGEN');
        setShowAddZoneInput(false);
        return;
      }

      const code = getCountryCode(selectedNewCountryZone);
      if (!code) {
        setShowAddZoneInput(false);
        return;
      }
      const zoneId = code.toLowerCase();
      
      // Add to active person's zones list
      const newZone: VisaZoneConfig = {
        id: zoneId,
        name: `🌐 ${t(`countries.${code}`, { defaultValue: code })}`,
        trackingMode: 'SINGLE_COUNTRY',
        targetCountry: code,
        maxDays: 90,
      };

      if (activePerson?.id) {
        const existingZones = activePerson.zones || [];
        if (!existingZones.some(z => z.id === zoneId)) {
          updatePersonZones(activePerson.id, [...existingZones, newZone]);
        }
      }

      setSelectedZoneId(zoneId);
      setTargetCountry(code);
      setTrackingMode('SINGLE_COUNTRY');
      setShowAddZoneInput(false);
    } catch (e) {
      console.warn('handleAddZoneFromPicker error:', e);
      setShowAddZoneInput(false);
    }
  };

  const handleDeleteZoneDetails = (zId: string, zName: string) => {
    const doDelete = () => {
      if (activePerson?.id) {
        // Clear zoneVisaDetails
        const remainingVisa = { ...(activePerson.zoneVisaDetails || {}) };
        delete remainingVisa[zId];

        // Clear zone from zones list
        const remainingZones = (activePerson.zones || []).filter(z => z.id !== zId);

        useTripStore.setState((state) => ({
          persons: state.persons.map(p => p.id === activePerson.id ? {
            ...p,
            zoneVisaDetails: remainingVisa,
            zones: remainingZones,
          } : p)
        }));
      }

      const remainingAvailable = availableZones.filter(z => z.id !== zId);
      setSelectedZoneId(remainingAvailable[0]?.id || 'schengen');
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`"${zName}" vize ayarlarını ve bölgesini silmek istediğinizden emin misiniz?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Vize Ayarını Sil / Remove Visa',
        `"${zName}" vize ayarlarını ve bölgesini silmek istediğinizden emin misiniz?`,
        [
          { text: 'İptal / Cancel', style: 'cancel' },
          { text: 'Sil / Remove', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  const handleSave = () => {
    const isSchengen = selectedZoneId === 'schengen' || trackingMode === 'SCHENGEN';
    const effectiveCountry = isSchengen 
      ? (country && isSchengenCountry(country) ? country : SCHENGEN_ONLY_COUNTRIES[0]) 
      : (targetCountry || selectedZoneId);

    const details: VisaDetails = {
      trackingMode: isSchengen ? 'SCHENGEN' : 'SINGLE_COUNTRY',
      targetCountry: !isSchengen ? (targetCountry || selectedZoneId) : undefined,
      country: effectiveCountry,
      validFrom: isVisaExempt ? '2000-01-01' : formatLocal(validFromDate),
      validUntil: isVisaExempt ? '2099-12-31' : formatLocal(validUntilDate),
      maxDays: parseInt(maxDays, 10) || 90,
      isVisaExempt,
    };

    setZoneVisaDetails(selectedZoneId, details);
    navigation.goBack();
  };

  const isSchengenPillSelected = selectedZoneId === 'schengen';

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
        <Text style={dynamicStyles.title}>{t('visa.title')}</Text>
        <View style={dynamicStyles.placeholder} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={dynamicStyles.scroll}>
          {/* ZONE SELECTION BAR INSIDE VISA SETTINGS */}
          <Text style={dynamicStyles.sectionHeader}>{t('visa.selectRegionHeader', { defaultValue: 'Hangi Bölge/Ülke İçin Vize Ayarlıyorsunuz?' })}</Text>
          <View style={dynamicStyles.zoneSelectBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
              {availableZones.map((z) => (
                <View key={z.id} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                  <TouchableOpacity
                    style={[dynamicStyles.zoneTabPill, selectedZoneId === z.id && dynamicStyles.zoneTabPillActive]}
                    onPress={() => setSelectedZoneId(z.id)}
                  >
                    <Text style={[dynamicStyles.zoneTabPillText, selectedZoneId === z.id && dynamicStyles.zoneTabPillTextActive]}>
                      {z.name}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.danger, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginLeft: -6, marginTop: -12, zIndex: 10 }}
                    onPress={() => handleDeleteZoneDetails(z.id, z.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={dynamicStyles.addZoneTabPill} onPress={() => setShowAddZoneInput(!showAddZoneInput)}>
                <Text style={dynamicStyles.addZoneTabPillText}>{t('visa.addAnotherRegion', { defaultValue: '+ Başka Ülke Vizesi Ekle' })}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* ADD OTHER COUNTRY VISA PICKER */}
          {showAddZoneInput && (
            <View style={dynamicStyles.addCountryCard}>
              <Text style={dynamicStyles.addCountryTitle}>{t('visa.selectCountryToAdd', { defaultValue: 'Eklenecek Ülke Vizesini Seçin:' })}</Text>
              <View style={dynamicStyles.pickerContainer}>
                <Picker
                  selectedValue={selectedNewCountryZone}
                  onValueChange={(val) => setSelectedNewCountryZone(val)}
                  itemStyle={dynamicStyles.pickerItem}
                >
                  <Picker.Item label="🇪🇺 Schengen Zone" value="schengen" color={colors.text} />
                  {sortedNonSchengenCountries.map(c => (
                    <Picker.Item key={c.code} label={c.label} value={c.code} color={colors.text} />
                  ))}
                </Picker>
              </View>
              <TouchableOpacity style={dynamicStyles.addCountryConfirmBtn} onPress={handleAddZoneFromPicker}>
                <Text style={dynamicStyles.addCountryConfirmBtnText}>{t('visa.configureVisa', { defaultValue: 'Vizesini Ayarla ➔' })}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* COUNTRY / ZONE CONTEXT DISPLAY */}
          {isSchengenPillSelected ? (
            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.label}>{t('visa.issuingCountry', { defaultValue: 'Schengen Vizesini Veren Ülke' })}</Text>
              <View style={dynamicStyles.pickerContainer}>
                <Picker
                  selectedValue={country}
                  onValueChange={(itemValue) => setCountry(itemValue)}
                  itemStyle={dynamicStyles.pickerItem}
                >
                  {sortedSchengenCountries.map((c) => (
                    <Picker.Item key={c.code} label={c.label} value={c.code} color={colors.text} />
                  ))}
                </Picker>
              </View>
            </View>
          ) : (
            <View style={dynamicStyles.activeCountryBanner}>
              <Text style={dynamicStyles.activeCountryBannerTitle}>
                🌐 {t(`countries.${targetCountry}`, { defaultValue: targetCountry })} ({t('visa.singleCountryTracking', { defaultValue: 'Bağımsız Ülke Takibi' })})
              </Text>
              <Text style={dynamicStyles.activeCountryBannerSub}>
                {t('visa.singleCountryBannerSub', { maxDays: maxDays || '90', defaultValue: `Bu ülkeye özel ${maxDays || '90'}/180 gün kuralı ve vize detayları takip edilir.` })}
              </Text>
            </View>
          )}

          {/* VISA EXEMPTION TOGGLE */}
          <View style={dynamicStyles.exemptionContainer}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={dynamicStyles.exemptionTitle}>{t('visa.exemptionTitle', { defaultValue: '🔰 Vize Muafiyeti' })}</Text>
              <Text style={dynamicStyles.exemptionDesc}>{t('visa.exemptionDesc', { defaultValue: 'Yeşil Pasaport, Vizesiz Giriş veya AB Vatandaşlığı' })}</Text>
            </View>
            <Switch
              value={isVisaExempt}
              onValueChange={setIsVisaExempt}
              trackColor={{ false: colors.border, true: colors.bauhausBlue }}
            />
          </View>

          {/* CONDITIONAL VISA DATES & DURATION: Completely hidden when isVisaExempt is TRUE */}
          {!isVisaExempt && (
            <>
              <View style={dynamicStyles.row}>
                <View style={[dynamicStyles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <Text style={dynamicStyles.label} numberOfLines={1}>{t('visa.validFrom')}</Text>
                  {Platform.OS === 'ios' ? (
                    <View style={dynamicStyles.compactDateWrapper}>
                      <DateTimePicker
                        value={validFromDate}
                        mode="date"
                        display="compact"
                        locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) setValidFromDate(selectedDate);
                        }}
                        themeVariant={isDark ? 'dark' : 'light'}
                        textColor={colors.text}
                      />
                    </View>
                  ) : Platform.OS === 'web' ? (
                    React.createElement('input', {
                      type: 'date',
                      value: formatLocal(validFromDate),
                      onChange: (e: any) => {
                        if (e.target.value) setValidFromDate(parseISO(e.target.value));
                      },
                      style: { padding: '16px', fontSize: '16px', borderRadius: '12px', border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.surface, color: colors.text }
                    })
                  ) : (
                    <TouchableOpacity style={dynamicStyles.dateButton} onPress={() => setShowFromPicker(true)}>
                      <Text style={dynamicStyles.dateButtonText}>{formatLocal(validFromDate)}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[dynamicStyles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <Text style={dynamicStyles.label} numberOfLines={1}>{t('visa.validUntil')}</Text>
                  {Platform.OS === 'ios' ? (
                    <View style={dynamicStyles.compactDateWrapper}>
                      <DateTimePicker
                        value={validUntilDate}
                        mode="date"
                        display="compact"
                        minimumDate={validFromDate}
                        locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) setValidUntilDate(selectedDate);
                        }}
                        themeVariant={isDark ? 'dark' : 'light'}
                        textColor={colors.text}
                      />
                    </View>
                  ) : Platform.OS === 'web' ? (
                    React.createElement('input', {
                      type: 'date',
                      value: formatLocal(validUntilDate),
                      min: formatLocal(validFromDate),
                      onChange: (e: any) => {
                        if (e.target.value) setValidUntilDate(parseISO(e.target.value));
                      },
                      style: { padding: '16px', fontSize: '16px', borderRadius: '12px', border: `1px solid ${colors.border}`, width: '100%', boxSizing: 'border-box', backgroundColor: colors.surface, color: colors.text }
                    })
                  ) : (
                    <TouchableOpacity style={dynamicStyles.dateButton} onPress={() => setShowUntilPicker(true)}>
                      <Text style={dynamicStyles.dateButtonText}>{formatLocal(validUntilDate)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Android Picker Modals */}
              {showFromPicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={validFromDate}
                  mode="date"
                  display="default"
                  locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
                  onChange={onFromChange}
                />
              )}

              {showUntilPicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={validUntilDate}
                  mode="date"
                  display="default"
                  minimumDate={validFromDate}
                  locale={i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'bg' ? 'bg-BG' : i18n.language === 'el' ? 'el-GR' : i18n.language === 'mk' ? 'mk-MK' : 'en-US'}
                  onChange={onUntilChange}
                />
              )}
            </>
          )}

          {/* Duration of Stay Input: Always visible (Supports 90/180, 30/180, etc. for visa-exempt & visa holders) */}
          <View style={dynamicStyles.inputContainer}>
            <Text style={dynamicStyles.label}>{t('visa.durationOfStay')}</Text>
            <TextInput
              style={dynamicStyles.input}
              value={maxDays}
              onChangeText={setMaxDays}
              keyboardType="numeric"
              placeholder="90"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleSave}>
            <Text style={dynamicStyles.saveBtnText}>{t('visa.saveSettings')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <AdBanner />
    </SafeAreaView>
  );
};

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  scroll: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  zoneSelectBar: {
    marginBottom: 20,
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneTabPill: {
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneTabPillActive: {
    backgroundColor: colors.bauhausBlue,
    borderColor: colors.bauhausBlue,
  },
  zoneTabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  zoneTabPillTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  addZoneTabPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.bauhausBlue,
    borderStyle: 'dashed',
  },
  addZoneTabPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.bauhausBlue,
  },
  addCountryCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addCountryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  addCountryConfirmBtn: {
    backgroundColor: colors.bauhausBlue,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  addCountryConfirmBtnText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  activeCountryBanner: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.bauhausBlue,
  },
  activeCountryBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  activeCountryBannerSub: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  exemptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exemptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  exemptionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modeContainer: {
    marginBottom: 20,
  },
  modeBtn: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  modeBtnActive: {
    borderColor: colors.bauhausBlue,
    backgroundColor: colors.surface,
  },
  modeBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeBtnTextActive: {
    color: colors.bauhausBlue,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerItem: {
    color: colors.text,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactDateWrapper: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  dateButton: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dateButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: colors.bauhausBlue,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
