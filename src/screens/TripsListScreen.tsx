import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AdBanner } from '../components/AdBanner';
import { useTripStore } from '../store/useTripStore';
import { calculateDaysForTrip } from '../utils/rules';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { SCHENGEN_ONLY_COUNTRIES } from '../constants/countries';

export const TripsListScreen = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();

  const removeTrip = useTripStore(state => state.removeTrip);
  const updateTrip = useTripStore(state => state.updateTrip);
  const closeTripGroup = useTripStore(state => state.closeTripGroup);
  const persons = useTripStore(state => state.persons);
  const activePersonId = useTripStore(state => state.activePersonId);
  const activePerson = persons.find(p => p.id === activePersonId);
  const trips = activePerson?.trips || [];

  const [activeFilterId, setActiveFilterId] = useState<string>('all');

  // Extract unique non-Schengen target countries present in trips
  const uniqueNonSchengenCountries = useMemo(() => {
    const set = new Set<string>();
    trips.forEach(t => {
      const isOldTrip = !!t.country;
      if (isOldTrip) {
        if (t.country && !SCHENGEN_ONLY_COUNTRIES.includes(t.country)) {
          set.add(t.country);
        }
      } else {
        if (t.entryCountry && !SCHENGEN_ONLY_COUNTRIES.includes(t.entryCountry)) {
          set.add(t.entryCountry);
        }
        if (t.exitCountry && !SCHENGEN_ONLY_COUNTRIES.includes(t.exitCountry)) {
          set.add(t.exitCountry);
        }
        if (t.segments) {
          t.segments.forEach(s => {
            if (s.country && !SCHENGEN_ONLY_COUNTRIES.includes(s.country)) {
              set.add(s.country);
            }
          });
        }
      }
    });
    return Array.from(set);
  }, [trips]);

  // Compute trip counts per zone filter
  const schengenTripCount = useMemo(() => {
    return trips.filter(t => {
      const entryIn = SCHENGEN_ONLY_COUNTRIES.includes(t.entryCountry || t.country || '');
      const exitIn = SCHENGEN_ONLY_COUNTRIES.includes(t.exitCountry || t.country || '');
      const segmentIn = t.segments && t.segments.some(s => SCHENGEN_ONLY_COUNTRIES.includes(s.country));
      return entryIn || exitIn || segmentIn;
    }).length;
  }, [trips]);

  const filterTabs = useMemo(() => {
    const tabs = [
      { id: 'all', label: `🌐 ${t('common.all') || 'Tümü'} (${trips.length})` },
      { id: 'schengen', label: `🇪🇺 Schengen Zone (${schengenTripCount})` },
    ];

    uniqueNonSchengenCountries.forEach(c => {
      const cCount = trips.filter(t => {
        const entryMatch = (t.entryCountry || t.country || '').trim().toLowerCase() === c.trim().toLowerCase();
        const exitMatch = (t.exitCountry || t.country || '').trim().toLowerCase() === c.trim().toLowerCase();
        const segMatch = t.segments && t.segments.some(s => s.country.trim().toLowerCase() === c.trim().toLowerCase());
        return entryMatch || exitMatch || segMatch;
      }).length;

      const translatedName = t(`countries.${c}`, { defaultValue: c });
      tabs.push({
        id: `country_${c}`,
        label: `📍 ${translatedName} (${cCount})`,
      });
    });

    return tabs;
  }, [trips, schengenTripCount, uniqueNonSchengenCountries, t]);

  // Filtered trips list based on active zone tab
  const filteredTrips = useMemo(() => {
    if (activeFilterId === 'all') return trips;
    if (activeFilterId === 'schengen') {
      return trips.filter(t => {
        const entryIn = SCHENGEN_ONLY_COUNTRIES.includes(t.entryCountry || t.country || '');
        const exitIn = SCHENGEN_ONLY_COUNTRIES.includes(t.exitCountry || t.country || '');
        const segmentIn = t.segments && t.segments.some(s => SCHENGEN_ONLY_COUNTRIES.includes(s.country));
        return entryIn || exitIn || segmentIn;
      });
    }
    if (activeFilterId.startsWith('country_')) {
      const targetC = activeFilterId.replace('country_', '').trim().toLowerCase();
      return trips.filter(t => {
        const entryMatch = (t.entryCountry || t.country || '').trim().toLowerCase() === targetC;
        const exitMatch = (t.exitCountry || t.country || '').trim().toLowerCase() === targetC;
        const segMatch = t.segments && t.segments.some(s => s.country.trim().toLowerCase() === targetC);
        return entryMatch || exitMatch || segMatch;
      });
    }
    return trips;
  }, [trips, activeFilterId]);

  const dynamicStyles = getStyles(colors, isDark);

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* HEADER */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity 
          style={dynamicStyles.backBtn} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Text style={dynamicStyles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.title}>{t('tripsList.title')}</Text>
        <View style={dynamicStyles.placeholder} />
      </View>

      {/* ZONE FILTER TAB BAR */}
      <View style={dynamicStyles.filterBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dynamicStyles.filterScroll}>
          {filterTabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[dynamicStyles.filterPill, activeFilterId === tab.id && dynamicStyles.filterPillActive]}
              onPress={() => setActiveFilterId(tab.id)}
            >
              <Text style={[dynamicStyles.filterPillText, activeFilterId === tab.id && dynamicStyles.filterPillTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* TRIPS LIST */}
      <ScrollView contentContainerStyle={dynamicStyles.scroll}>
        <TouchableOpacity 
          style={dynamicStyles.addBtn} 
          onPress={() => navigation.navigate('AddTrip')}
        >
          <Text style={dynamicStyles.addBtnText}>{t('tripsList.addManually')}</Text>
        </TouchableOpacity>

        {filteredTrips.length === 0 ? (
          <Text style={dynamicStyles.emptyText}>{t('tripsList.empty')}</Text>
        ) : (
          filteredTrips.map(trip => {
            const days = calculateDaysForTrip(trip.entryDate, trip.exitDate, trip.isOngoing);
            const isMulti = !trip.isOngoing && trip.entryCountry !== trip.exitCountry;
            const hasSegments = trip.segments && trip.segments.length > 0;
            const entryName = t(`countries.${trip.entryCountry}`, { defaultValue: trip.entryCountry });
            const exitName = t(`countries.${trip.exitCountry}`, { defaultValue: trip.exitCountry });
            const singleName = t(`countries.${trip.country || trip.entryCountry}`, { defaultValue: trip.country || trip.entryCountry });

            const mainLabel = isMulti ? `${entryName} ➔ ${exitName}` : singleName;

            const formatLocal = (date: Date) => {
              const yyyy = date.getFullYear();
              const mm = String(date.getMonth() + 1).padStart(2, '0');
              const dd = String(date.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            };

            const handleCloseTrip = () => {
              const exitDate = formatLocal(new Date());

              const hasGroup = trip.groupId && persons.some(p => 
                p.id !== activePersonId && p.trips.some(t => t.groupId === trip.groupId && t.isOngoing)
              );

              if (hasGroup) {
                if (Platform.OS === 'web') {
                  const closeAll = window.confirm('Other profiles also have this ongoing trip. Close for EVERYONE? (Cancel = Just me)');
                  if (closeAll) {
                    closeTripGroup(trip.groupId!, exitDate);
                  } else {
                    updateTrip(trip.id, { isOngoing: false, exitDate });
                  }
                } else {
                  Alert.alert(
                    'Close Trip',
                    'Other profiles also have this ongoing trip. Close it for everyone?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Just Me', onPress: () => updateTrip(trip.id, { isOngoing: false, exitDate }) },
                      { text: 'Everyone', onPress: () => closeTripGroup(trip.groupId!, exitDate), style: 'destructive' }
                    ]
                  );
                }
              } else {
                updateTrip(trip.id, { isOngoing: false, exitDate });
              }
            };

            return (
              <View key={trip.id} style={[dynamicStyles.tripItem, trip.isOngoing && { borderColor: colors.bauhausBlue, borderWidth: 2 }]}>
                <View style={dynamicStyles.tripHeaderRow}>
                  <View style={{flex: 1}}>
                    <Text style={dynamicStyles.tripCountry}>{mainLabel} {trip.isOngoing && <Text style={{color: colors.bauhausBlue, fontSize: 12}}> (Ongoing)</Text>}</Text>
                    <Text style={dynamicStyles.tripDates}>{trip.entryDate} to {trip.isOngoing ? 'Ongoing' : trip.exitDate}</Text>
                  </View>
                  <View style={dynamicStyles.tripRight}>
                    <Text style={dynamicStyles.tripDays}>{days}d</Text>
                    {trip.isOngoing && (
                      <TouchableOpacity onPress={handleCloseTrip} style={dynamicStyles.closeBtn}>
                        <Text style={dynamicStyles.closeBtnText}>Close</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => (navigation as any).navigate('AddTrip', { tripId: trip.id })} style={dynamicStyles.editBtn}>
                      <Text style={dynamicStyles.editBtnText}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeTrip(trip.id)} style={dynamicStyles.deleteBtn}>
                      <Text style={dynamicStyles.deleteBtnText}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isMulti && hasSegments && (
                  <View style={dynamicStyles.segmentsContainer}>
                    <Text style={dynamicStyles.segmentsTitle}>Breakdown:</Text>
                    {trip.segments!.map((seg, idx) => (
                      <Text key={idx} style={dynamicStyles.segmentText}>
                        • {t(`countries.${seg.country}`, { defaultValue: seg.country })}: {seg.days} days
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

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
    paddingTop: Platform.OS === 'ios' ? 24 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },

  // Zone Filter Bar
  filterBarContainer: {
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterPill: {
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: colors.bauhausBlue,
    borderColor: colors.bauhausBlue,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.white,
    fontWeight: '800',
  },

  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  addBtn: {
    backgroundColor: colors.bauhausBlue,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  addBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  tripItem: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripCountry: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  tripDates: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tripRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripDays: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.bauhausBlue,
    marginRight: 16,
  },
  closeBtn: {
    backgroundColor: colors.bauhausBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
  },
  closeBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  editBtn: {
    backgroundColor: colors.bauhausYellow,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  editBtnText: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteBtn: {
    backgroundColor: colors.danger,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  segmentsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  segmentsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  segmentText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
});
