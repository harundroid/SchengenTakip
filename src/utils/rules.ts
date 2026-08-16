import { differenceInDays, parseISO, isAfter, isBefore, isSameDay, subDays, addDays } from 'date-fns';
import { Trip, VisaDetails } from '../types';
import { SCHENGEN_ONLY_COUNTRIES, isSameCountry } from '../constants/countries';

export const calculateDaysForTrip = (entry: string, exit: string, isOngoing?: boolean): number => {
  const start = parseISO(entry);
  const end = isOngoing ? new Date() : parseISO(exit);
  const days = differenceInDays(end, start) + 1;
  return isNaN(days) ? 0 : Math.max(0, days);
};

export const aggregateCountryDays = (trips: Trip[]): Record<string, number> => {
  const countryDays: Record<string, number> = {};

  trips.forEach(trip => {
    const isOldTrip = !!trip.country;
    const isMultiCountry = !isOldTrip && trip.entryCountry !== trip.exitCountry && trip.segments && trip.segments.length > 0;
    
    if (isMultiCountry && trip.segments) {
      trip.segments.forEach(seg => {
        const c = seg.country.trim().toLowerCase();
        countryDays[c] = (countryDays[c] || 0) + seg.days;
      });
    } else {
      const days = calculateDaysForTrip(trip.entryDate, trip.exitDate, trip.isOngoing);
      const c = (trip.country || trip.entryCountry || '').trim().toLowerCase();
      if (c) {
        countryDays[c] = (countryDays[c] || 0) + days;
      }
    }
  });

  return countryDays;
};

export const calculate90180Rule = (
  trips: Trip[], 
  visaDetails?: VisaDetails | null,
  referenceDate: Date = new Date()
) => {
  const maxDaysAllowed = visaDetails?.maxDays || 90;
  const isSingleCountryMode = visaDetails?.trackingMode === 'SINGLE_COUNTRY';
  const targetCountry = visaDetails?.targetCountry || visaDetails?.country || 'TR';

  // Check Visa Expiration Status if visa is defined and not visa exempt
  let isVisaExpired = false;
  let isVisaExpiringSoon = false;
  let daysUntilVisaExpires: number | null = null;

  if (visaDetails && !visaDetails.isVisaExempt && visaDetails.validUntil) {
    const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const visaEnd = parseISO(visaDetails.validUntil);
    const diff = differenceInDays(visaEnd, today);

    daysUntilVisaExpires = diff;
    if (diff < 0) {
      isVisaExpired = true;
    } else if (diff <= 30) {
      isVisaExpiringSoon = true;
    }
  }

  // Helper to check if a trip matches zone filter
  const isTripMatchingZone = (trip: Trip) => {
    if (isSingleCountryMode) {
      const hasSegments = trip.segments && trip.segments.length > 0;
      if (hasSegments) {
        return trip.segments!.some(s => isSameCountry(s.country, targetCountry));
      }
      const entryC = trip.entryCountry || trip.country || '';
      const exitC = trip.exitCountry || trip.country || '';
      return isSameCountry(entryC, targetCountry) || isSameCountry(exitC, targetCountry);
    } else {
      // SCHENGEN MODE: Only count trips involving Schengen member states!
      const entryC = trip.entryCountry || trip.country || '';
      const exitC = trip.exitCountry || trip.country || '';
      const entryIn = SCHENGEN_ONLY_COUNTRIES.some(sc => isSameCountry(sc, entryC));
      const exitIn = SCHENGEN_ONLY_COUNTRIES.some(sc => isSameCountry(sc, exitC));
      const segIn = trip.segments && trip.segments.some(s => SCHENGEN_ONLY_COUNTRIES.some(sc => isSameCountry(sc, s.country)));
      return entryIn || exitIn || segIn;
    }
  };

  const relevantTrips = trips.filter(isTripMatchingZone);

  if (isVisaExpired) {
    return {
      daysSpent: 0,
      daysRemaining: 0,
      isViolated: true,
      maxDaysAllowed,
      isVisaExpired: true,
      isVisaExpiringSoon: false,
      daysUntilVisaExpires,
      nextAvailableDate: null,
      freedDays: 0,
    };
  }

  if (relevantTrips.length === 0) {
    let initialRemaining = maxDaysAllowed;
    if (daysUntilVisaExpires !== null && daysUntilVisaExpires >= 0) {
      initialRemaining = Math.min(maxDaysAllowed, daysUntilVisaExpires + 1);
    }

    return {
      daysSpent: 0,
      daysRemaining: initialRemaining,
      isViolated: false,
      maxDaysAllowed,
      isVisaExpired: false,
      isVisaExpiringSoon,
      daysUntilVisaExpires,
      nextAvailableDate: null,
      freedDays: 0,
    };
  }

  // Calculate days spent in 180-day window for a given date D
  const calculateDaysInWindowForDate = (checkDate: Date) => {
    const windowStart = subDays(checkDate, 179);
    let daysCount = 0;

    relevantTrips.forEach(t => {
      const tEntry = parseISO(t.entryDate);
      const tExit = t.isOngoing ? checkDate : parseISO(t.exitDate);

      const overlapStart = isBefore(tEntry, windowStart) ? windowStart : tEntry;
      const overlapEnd = isAfter(tExit, checkDate) ? checkDate : tExit;

      if (isBefore(overlapStart, overlapEnd) || isSameDay(overlapStart, overlapEnd)) {
        const d = differenceInDays(overlapEnd, overlapStart) + 1;
        if (!isNaN(d) && d > 0) {
          daysCount += d;
        }
      }
    });

    return daysCount;
  };

  // Check today's days spent
  const daysSpentToday = calculateDaysInWindowForDate(referenceDate);

  // Evaluate peak days spent in 180-day window across all trip dates (including planned future dates)
  let maxDaysInAnyWindow = daysSpentToday;

  relevantTrips.forEach(t => {
    const tEntry = parseISO(t.entryDate);
    const tExit = t.isOngoing ? referenceDate : parseISO(t.exitDate);

    let curr = tEntry;
    while (isBefore(curr, tExit) || isSameDay(curr, tExit)) {
      const dSpent = calculateDaysInWindowForDate(curr);
      if (dSpent > maxDaysInAnyWindow) {
        maxDaysInAnyWindow = dSpent;
      }
      curr = addDays(curr, 1);
    }
  });

  const effectiveDaysSpent = maxDaysInAnyWindow;

  const formatISO = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  let nextAvailableDate: string | null = null;
  let freedDays = 0;

  if (effectiveDaysSpent >= maxDaysAllowed) {
    let searchStart = referenceDate;
    relevantTrips.forEach(t => {
      const tEnd = t.isOngoing ? referenceDate : parseISO(t.exitDate);
      if (isAfter(tEnd, searchStart)) {
        searchStart = tEnd;
      }
    });

    let searchDate = addDays(searchStart, 1);
    for (let i = 0; i < 365; i++) {
      const dInWindow = calculateDaysInWindowForDate(searchDate);
      if (dInWindow < maxDaysAllowed) {
        nextAvailableDate = formatISO(searchDate);
        freedDays = maxDaysAllowed - dInWindow;
        break;
      }
      searchDate = addDays(searchDate, 1);
    }
  }

  let calculatedRemaining = Math.max(0, maxDaysAllowed - effectiveDaysSpent);
  if (daysUntilVisaExpires !== null && daysUntilVisaExpires >= 0) {
    calculatedRemaining = Math.min(calculatedRemaining, daysUntilVisaExpires + 1);
  }

  return {
    daysSpent: effectiveDaysSpent,
    daysRemaining: calculatedRemaining,
    isViolated: effectiveDaysSpent > maxDaysAllowed,
    maxDaysAllowed,
    nextAvailableDate,
    freedDays,
    isVisaExpired: false,
    isVisaExpiringSoon,
    daysUntilVisaExpires,
  };
};

export const calculateMainDestination = (trips: Trip[], visaCountry: string) => {
  if (!visaCountry || trips.length === 0) return { isValid: true, stats: {} as Record<string, number>, visaCountryDays: 0, maxDays: 0 };

  const countryDays = aggregateCountryDays(trips);

  let maxDays = 0;
  for (const country in countryDays) {
    if (countryDays[country] > maxDays) {
      maxDays = countryDays[country];
    }
  }

  const normalizedVisaCountry = visaCountry.trim().toLowerCase();
  const visaCountryDays = countryDays[normalizedVisaCountry] || 0;
  
  const isValid = visaCountryDays >= maxDays;

  return {
    isValid,
    stats: countryDays,
    visaCountryDays,
    maxDays,
  };
};
