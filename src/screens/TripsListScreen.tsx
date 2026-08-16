import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AdBanner } from '../components/AdBanner';
import { useTripStore } from '../store/useTripStore';
import { calculateDaysForTrip } from '../utils/rules';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { isSchengenCountry, isSameCountry, getCountryCode } from '../constants/countries';
import { subDays } from 'date-fns';
import { Trip } from '../types';

const formatLocal = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const TripsListScreen = () => {
  const insets = useSafeAreaInsets();
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
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);

  // Extract unique non-Schengen target countries present in trips
  const uniqueNonSchengenCountries = useMemo(() => {
    const set = new Set<string>();
    trips.forEach(t => {
      if (t.entryCountry && !isSchengenCountry(t.entryCountry)) {
        set.add(t.entryCountry);
      }
      if (t.exitCountry && !isSchengenCountry(t.exitCountry)) {
        set.add(t.exitCountry);
      }
      if (t.segments) {
        t.segments.forEach(s => {
          if (s.country && !isSchengenCountry(s.country)) {
            set.add(s.country);
          }
        });
      }
    });
    return Array.from(set);
  }, [trips]);

  // Compute trip counts per zone filter
  const schengenTripCount = useMemo(() => {
    return trips.filter(t => {
      if (t.segments && t.segments.length > 0) {
        return t.segments.some(s => isSchengenCountry(s.country));
      }
      return isSchengenCountry(t.entryCountry) || isSchengenCountry(t.exitCountry);
    }).length;
  }, [trips]);

  const filterTabs = useMemo(() => {
    const tabs = [
      { id: 'all', label: `🌐 ${t('common.all') || 'Tümü'} (${trips.length})` },
      { id: 'schengen', label: `🇪🇺 Schengen Zone (${schengenTripCount})` },
    ];

    uniqueNonSchengenCountries.forEach(c => {
      const cCount = trips.filter(t => {
        if (t.segments && t.segments.length > 0) {
          return t.segments.some(s => isSameCountry(s.country, c));
        }
        return isSameCountry(t.entryCountry, c) || isSameCountry(t.exitCountry, c);
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
        if (t.segments && t.segments.length > 0) {
          return t.segments.some(s => isSchengenCountry(s.country));
        }
        return isSchengenCountry(t.entryCountry) || isSchengenCountry(t.exitCountry);
      });
    }
    if (activeFilterId.startsWith('country_')) {
      const targetC = activeFilterId.replace('country_', '');
      return trips.filter(t => {
        if (t.segments && t.segments.length > 0) {
          return t.segments.some(s => isSameCountry(s.country, targetC));
        }
        return isSameCountry(t.entryCountry, targetC) || isSameCountry(t.exitCountry, targetC);
      });
    }
    return trips;
  }, [trips, activeFilterId]);

  // Threshold for active 180-day window (today - 179 days)
  const minActiveDateISO = useMemo(() => {
    return formatLocal(subDays(new Date(), 179));
  }, []);

  // Sort chronologically (ongoing first, then newest to oldest) and split into Active vs Archived
  const { activeTrips, archivedTrips } = useMemo(() => {
    const sorted = [...filteredTrips].sort((a, b) => {
      if (a.isOngoing && !b.isOngoing) return -1;
      if (!a.isOngoing && b.isOngoing) return 1;
      return b.entryDate.localeCompare(a.entryDate);
    });

    const active: Trip[] = [];
    const archived: Trip[] = [];

    sorted.forEach(t => {
      if (t.isOngoing || t.exitDate >= minActiveDateISO) {
        active.push(t);
      } else {
        archived.push(t);
      }
    });

    return { activeTrips: active, archivedTrips: archived };
  }, [filteredTrips, minActiveDateISO]);

  const dynamicStyles = getStyles(colors, isDark);

  const renderTripItem = (trip: Trip, isArchived: boolean = false) => {
    const days = calculateDaysForTrip(trip.entryDate, trip.exitDate, trip.isOngoing);
    const isMulti = !trip.isOngoing && trip.entryCountry !== trip.exitCountry;
    const hasSegments = trip.segments && trip.segments.length > 0;
    const entryName = t(`countries.${trip.entryCountry}`, { defaultValue: trip.entryCountry });
    const exitName = t(`countries.${trip.exitCountry}`, { defaultValue: trip.exitCountry });
    const singleName = t(`countries.${trip.entryCountry}`, { defaultValue: trip.entryCountry });

    const mainLabel = isMulti ? `${entryName} ➔ ${exitName}` : singleName;

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
      <View
        key={trip.id}
        style={[
          dynamicStyles.tripItem,
          trip.isOngoing && { borderColor: colors.bauhausBlue, borderWidth: 2 },
          isArchived && dynamicStyles.tripItemArchived,
        ]}
      >
        <View style={dynamicStyles.tripHeaderRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={dynamicStyles.tripCountry}>{mainLabel}</Text>
              {trip.isOngoing && (
                <Text style={{ color: colors.bauhausBlue, fontSize: 12, fontWeight: '800', marginLeft: 6 }}>
                  (Ongoing)
                </Text>
              )}
              {isArchived && (
                <View style={dynamicStyles.archivedPill}>
                  <Text style={dynamicStyles.archivedPillText}>{t('tripsList.archivedBadge')}</Text>
                </View>
              )}
            </View>
            <Text style={dynamicStyles.tripDates}>
              {trip.entryDate} to {trip.isOngoing ? 'Ongoing' : trip.exitDate}
            </Text>
          </View>
          <View style={dynamicStyles.tripRight}>
            <Text style={[dynamicStyles.tripDays, isArchived && { color: colors.textSecondary }]}>{days}d</Text>
            {trip.isOngoing && (
              <TouchableOpacity onPress={handleCloseTrip} style={dynamicStyles.closeBtn}>
                <Text style={dynamicStyles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => {
                const tripMode = (isSchengenCountry(trip.entryCountry) || isSchengenCountry(trip.exitCountry))
                  ? 'SCHENGEN'
                  : 'SINGLE_COUNTRY';
                const tripTarget = tripMode === 'SINGLE_COUNTRY' ? getCountryCode(trip.entryCountry || trip.exitCountry) : undefined;
                navigation.navigate('AddTrip', { 
                  tripId: trip.id,
                  trackingMode: tripMode,
                  targetCountry: tripTarget,
                });
              }} 
              style={dynamicStyles.editBtn}
            >
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
  };

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
          onPress={() => {
            const addTripMode = activeFilterId === 'all' || activeFilterId === 'schengen'
              ? 'SCHENGEN'
              : 'SINGLE_COUNTRY';
            const addTripTarget = addTripMode === 'SINGLE_COUNTRY' ? activeFilterId : undefined;
            navigation.navigate('AddTrip', {
              trackingMode: addTripMode,
              targetCountry: addTripTarget,
            });
          }}
        >
          <Text style={dynamicStyles.addBtnText}>{t('tripsList.addManually')}</Text>
        </TouchableOpacity>

        {filteredTrips.length === 0 ? (
          <Text style={dynamicStyles.emptyText}>{t('tripsList.empty')}</Text>
        ) : (
          <>
            {/* ACTIVE TRIPS SECTION */}
            {activeTrips.map(trip => renderTripItem(trip, false))}

            {/* ARCHIVED TRIPS SECTION (>180 DAYS AGO) */}
            {archivedTrips.length > 0 && (
              <View style={dynamicStyles.archiveSection}>
                <TouchableOpacity
                  style={dynamicStyles.archiveHeaderRow}
                  activeOpacity={0.7}
                  onPress={() => setIsArchiveOpen(prev => !prev)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={dynamicStyles.archiveHeaderTitle}>📦 {t('tripsList.archiveSectionTitle')}</Text>
                    <View style={dynamicStyles.archiveCountBadge}>
                      <Text style={dynamicStyles.archiveCountText}>{archivedTrips.length}</Text>
                    </View>
                  </View>
                  <Text style={dynamicStyles.archiveChevron}>{isArchiveOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isArchiveOpen && (
                  <View style={{ marginTop: 8 }}>
                    {archivedTrips.map(trip => renderTripItem(trip, true))}
                  </View>
                )}
              </View>
            )}
          </>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
    minWidth: 60,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Archive Section Styles
  archiveSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
  },
  archiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  archiveHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  archiveCountBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  archiveCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tripItemArchived: {
    opacity: 0.82,
    borderStyle: 'dashed',
  },
  archivedPill: {
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archivedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  archiveChevron: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
    fontWeight: '800',
  },
});
