import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, VisaDetails, Person, VisaZoneConfig } from '../types';

interface TripState {
  persons: Person[];
  activePersonId: string | null;

  // Person actions
  addPerson: (name: string, lang?: string) => void;
  switchPerson: (id: string) => void;
  removePerson: (id: string) => void;
  updatePerson: (id: string, name: string) => void;
  updatePersonZones: (personId: string, zones: VisaZoneConfig[]) => void;

  // Active Person trip actions
  addTrip: (trip: Trip) => void;
  removeTrip: (id: string) => void;
  updateTrip: (id: string, trip: Partial<Trip>) => void;
  setVisaDetails: (details: VisaDetails) => void;
  setZoneVisaDetails: (zoneId: string, details: VisaDetails) => void;

  // Multi-person actions
  addTripToMultiple: (trip: Trip, personIds: string[]) => void;
  closeTripGroup: (groupId: string, exitDate: string) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      persons: [],
      activePersonId: null,

      addPerson: (name, lang = 'tr') => set((state) => {
        const isTr = lang === 'tr';
        const defaultTrVisa: VisaDetails = {
          country: 'TR',
          targetCountry: 'TR',
          trackingMode: 'SINGLE_COUNTRY',
          validFrom: '',
          validUntil: '',
          maxDays: 90,
          isVisaExempt: true,
        };

        const initialZones: VisaZoneConfig[] = isTr
          ? [
              { id: 'schengen', name: '🇪🇺 Schengen Zone', trackingMode: 'SCHENGEN', maxDays: 90 },
              { id: 'TR', name: '🇹🇷 Türkiye', trackingMode: 'SINGLE_COUNTRY', targetCountry: 'TR', maxDays: 90 }
            ]
          : [
              { id: 'TR', name: '🇹🇷 Türkiye', trackingMode: 'SINGLE_COUNTRY', targetCountry: 'TR', maxDays: 90 },
              { id: 'schengen', name: '🇪🇺 Schengen Zone', trackingMode: 'SCHENGEN', maxDays: 90 }
            ];

        const newPerson: Person = {
          id: Math.random().toString(36).substring(2, 9),
          name,
          trips: [],
          visaDetails: isTr ? null : defaultTrVisa,
          zoneVisaDetails: {
            TR: defaultTrVisa,
          },
          zones: initialZones,
        };
        return {
          persons: [...state.persons, newPerson],
          activePersonId: state.activePersonId || newPerson.id
        };
      }),

      switchPerson: (id) => set({ activePersonId: id }),

      removePerson: (id) => set((state) => {
        const remaining = state.persons.filter(p => p.id !== id);
        return {
          persons: remaining,
          activePersonId: state.activePersonId === id ? (remaining[0]?.id || null) : state.activePersonId
        };
      }),

      updatePerson: (id, name) => set((state) => ({
        persons: state.persons.map(p => p.id === id ? { ...p, name } : p)
      })),

      updatePersonZones: (personId, zones) => set((state) => ({
        persons: state.persons.map(p => p.id === personId ? { ...p, zones } : p)
      })),

      addTrip: (trip) => set((state) => {
        if (!state.activePersonId) return state;
        return {
          persons: state.persons.map(p => 
            p.id === state.activePersonId ? { ...p, trips: [...p.trips, trip] } : p
          )
        };
      }),

      removeTrip: (id) => set((state) => {
        if (!state.activePersonId) return state;
        return {
          persons: state.persons.map(p =>
            p.id === state.activePersonId ? { ...p, trips: p.trips.filter(t => t.id !== id) } : p
          )
        };
      }),

      updateTrip: (id, updatedTrip) => set((state) => {
        if (!state.activePersonId) return state;
        return {
          persons: state.persons.map(p =>
            p.id === state.activePersonId ? {
              ...p,
              trips: p.trips.map(t => t.id === id ? { ...t, ...updatedTrip } : t)
            } : p
          )
        };
      }),

      setVisaDetails: (details) => set((state) => {
        if (!state.activePersonId) return state;
        return {
          persons: state.persons.map(p =>
            p.id === state.activePersonId ? { ...p, visaDetails: details } : p
          )
        };
      }),

      setZoneVisaDetails: (zoneId, details) => set((state) => {
        if (!state.activePersonId) return state;
        return {
          persons: state.persons.map(p => {
            if (p.id === state.activePersonId) {
              const zoneVisaDetails = { ...(p.zoneVisaDetails || {}), [zoneId]: details };
              // Only update root visaDetails if this is specifically the Schengen zone or Schengen tracking mode
              const isSchengen = zoneId === 'schengen' || details.trackingMode === 'SCHENGEN';
              const updatedRootVisaDetails = isSchengen ? details : (p.visaDetails?.trackingMode !== 'SINGLE_COUNTRY' ? p.visaDetails : null);
              return { ...p, visaDetails: updatedRootVisaDetails, zoneVisaDetails };
            }
            return p;
          })
        };
      }),

      addTripToMultiple: (trip, personIds) => set((state) => {
        return {
          persons: state.persons.map(p => {
            if (personIds.includes(p.id)) {
              // Ensure each person gets a unique ID for the trip copy to maintain independent editing later
              const copiedTrip = { ...trip, id: Math.random().toString(36).substring(2, 9) };
              return { ...p, trips: [...p.trips, copiedTrip] };
            }
            return p;
          })
        };
      }),

      closeTripGroup: (groupId, exitDate) => set((state) => {
        return {
          persons: state.persons.map(p => ({
            ...p,
            trips: p.trips.map(t => t.groupId === groupId && t.isOngoing ? { ...t, isOngoing: false, exitDate } : t)
          }))
        };
      }),
    }),
    {
      name: 'trip-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
