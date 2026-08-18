import { differenceInDays, parseISO, isAfter, isBefore, isSameDay, subDays, addDays, startOfDay } from 'date-fns';
import { Trip, VisaDetails } from '../types';
import { isSchengenCountry, isSameCountry } from '../constants/countries';

export const parseMidnight = (d?: string | Date | null): Date => {
  if (!d) return startOfDay(new Date());
  if (d instanceof Date) return isNaN(d.getTime()) ? startOfDay(new Date()) : startOfDay(d);
  try {
    const parsed = parseISO(d);
    return isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
  } catch {
    return startOfDay(new Date());
  }
};

/**
 * Belirli tek bir seyahatin (Giriş - Çıkış tarihleri arasında) toplam kaç takvim günü sürdüğünü hesaplar.
 * 
 * Kurallar:
 * 1. Schengen kuralına göre Giriş günü ve Çıkış günü her ikisi de tam gün sayılır (+1 gün kuralı).
 * 2. Eğer seyahat halen devam ediyorsa (isOngoing = true), bitiş tarihi olarak bugünün tarihi (new Date()) baz alınır.
 * 3. Geçersiz veya hatalı tarih girişlerinde NaN yerine güvenli şekilde 0 döner.
 * 
 * @param entry Giriş tarihi (ISO formatında string: 'YYYY-MM-DD')
 * @param exit Çıkış tarihi (ISO formatında string: 'YYYY-MM-DD')
 * @param isOngoing Seyahat halen devam ediyor mu? (Opsiyonel)
 * @returns Toplam gün sayısı (tam sayı, minimum 0)
 */
export const calculateDaysForTrip = (entry: string, exit: string, isOngoing?: boolean): number => {
  const start = parseMidnight(entry);
  const end = isOngoing ? parseMidnight(new Date()) : parseMidnight(exit);
  const days = differenceInDays(end, start) + 1;
  return isNaN(days) ? 0 : Math.max(0, days);
};

/**
 * Kullanıcının tüm seyahatlerini tarayarak ülke bazında harcanan toplam gün sayılarını hesaplar.
 * 
 * @param trips Kullanıcının kayıtlı tüm seyahat listesi
 * @returns Ülke kodlarına göre toplam gün sözlüğü. Örn: { "gr": 15, "de": 8, "bg": 4 }
 */
export const aggregateCountryDays = (trips: Trip[]): Record<string, number> => {
  const countryDays: Record<string, number> = {};

  trips.forEach(trip => {
    const hasSegments = trip.segments && trip.segments.length > 0;
    
    if (hasSegments) {
      trip.segments!.forEach(seg => {
        const c = seg.country.trim().toLowerCase();
        countryDays[c] = (countryDays[c] || 0) + seg.days;
      });
    } else {
      const days = calculateDaysForTrip(trip.entryDate, trip.exitDate, trip.isOngoing);
      const c = (trip.entryCountry || '').trim().toLowerCase();
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
  const todayMidnight = parseMidnight(referenceDate);

  // Check Visa Expiration Status if visa is defined and not visa exempt
  let isVisaExpired = false;
  let isVisaExpiringSoon = false;
  let daysUntilVisaExpires: number | null = null;

  if (visaDetails && !visaDetails.isVisaExempt && visaDetails.validUntil) {
    const visaEnd = parseMidnight(visaDetails.validUntil);
    const diff = differenceInDays(visaEnd, todayMidnight);

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
      if (trip.segments && trip.segments.length > 0) {
        return trip.segments.some(s => isSameCountry(s.country, targetCountry));
      }
      return isSameCountry(trip.entryCountry, targetCountry) || isSameCountry(trip.exitCountry, targetCountry);
    } else {
      if (trip.segments && trip.segments.length > 0) {
        return trip.segments.some(s => isSchengenCountry(s.country));
      }
      return isSchengenCountry(trip.entryCountry) || isSchengenCountry(trip.exitCountry);
    }
  };

  // Filter only trips matching zone AND strictly relevant to 180-day window
  const minActiveDate = subDays(todayMidnight, 179);

  const relevantTrips = trips.filter(trip => {
    if (!isTripMatchingZone(trip)) return false;
    if (trip.isOngoing) return true;
    const tExit = parseMidnight(trip.exitDate);
    // 180 günden daha eski bitmiş seyahatleri hesaba katma
    return !isBefore(tExit, minActiveDate);
  });

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

  /**
   * Belirli bir kontrol tarihi (checkDate) için geriye dönük 180 günlük hareketli pencereye
   * (ve varsa vize başlangıç tarihine) denk gelen toplam seyahat gün sayısını kesişim yöntemiyle hesaplar.
   * 
   * @param checkDate 180 günlük pencerenin son günü kabul edilen referans tarihi
   * @returns Bu pencereye düşen toplam kalış gün sayısı
   */
  const calculateDaysInWindowForDate = (checkDate: Date) => {
    const checkMidnight = parseMidnight(checkDate);
    const windowStart = subDays(checkMidnight, 179);

    let daysCount = 0;

    relevantTrips.forEach(t => {
      const tEntry = parseMidnight(t.entryDate);
      const tExit = t.isOngoing ? checkMidnight : parseMidnight(t.exitDate);

      // Seyahat pencerenin tamamen dışındaysa direkt atla
      if (isBefore(tExit, windowStart) || isAfter(tEntry, checkMidnight)) {
        return;
      }

      // Seyahat aralığı ile pencere aralığının ortak kesişimini bul
      const overlapStart = isBefore(tEntry, windowStart) ? windowStart : tEntry;
      const overlapEnd = isAfter(tExit, checkMidnight) ? checkMidnight : tExit;

      // Kesişim varsa (+1 gün kuralı ile) gün sayısını ekle
      if (isBefore(overlapStart, overlapEnd) || isSameDay(overlapStart, overlapEnd)) {
        const d = differenceInDays(overlapEnd, overlapStart) + 1;
        if (!isNaN(d) && d > 0) {
          daysCount += d;
        }
      }
    });

    return daysCount;
  };

  // 1. Calculate days spent in the 180-day window ending on referenceDate (Today)
  const daysSpentToday = calculateDaysInWindowForDate(todayMidnight);

  // 2. Evaluate peak days in 180-day window for future planned trips (from todayMidnight onwards)
  let peakFutureDaysInWindow = daysSpentToday;

  relevantTrips.forEach(t => {
    const tEntry = parseMidnight(t.entryDate);
    const tExit = t.isOngoing ? todayMidnight : parseMidnight(t.exitDate);

    // Only scan forward from todayMidnight (future dates)
    let curr = isBefore(tEntry, todayMidnight) ? todayMidnight : tEntry;
    while (isBefore(curr, tExit) || isSameDay(curr, tExit)) {
      const dSpent = calculateDaysInWindowForDate(curr);
      if (dSpent > peakFutureDaysInWindow) {
        peakFutureDaysInWindow = dSpent;
      }
      curr = addDays(curr, 1);
    }
  });

  // Today's effective days spent is strictly what's spent in today's 180-day window
  const effectiveDaysSpent = daysSpentToday;
  const isViolated = peakFutureDaysInWindow > maxDaysAllowed;

  const formatISO = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Geçmiş ve şu ana kadar harcanan günlerin havuzu (Gelecek planları bu serbest kalma hesabını bozmasın)
  const pastAndCurrentTrips = relevantTrips.filter(t => {
    const tEntry = parseMidnight(t.entryDate);
    return isBefore(tEntry, todayMidnight) || isSameDay(tEntry, todayMidnight);
  });

  const calculatePastDaysInWindow = (checkDate: Date) => {
    const checkMidnight = parseMidnight(checkDate);
    const windowStart = subDays(checkMidnight, 179);

    let count = 0;
    pastAndCurrentTrips.forEach(t => {
      const tEntry = parseMidnight(t.entryDate);
      const tExit = t.isOngoing ? todayMidnight : parseMidnight(t.exitDate);

      if (isBefore(tExit, windowStart) || isAfter(tEntry, checkMidnight)) return;

      const overlapStart = isBefore(tEntry, windowStart) ? windowStart : tEntry;
      const overlapEnd = isAfter(tExit, checkMidnight) ? checkMidnight : tExit;

      if (isBefore(overlapStart, overlapEnd) || isSameDay(overlapStart, overlapEnd)) {
        const d = differenceInDays(overlapEnd, overlapStart) + 1;
        if (!isNaN(d) && d > 0) count += d;
      }
    });
    return count;
  };

  let nextAvailableDate: string | null = null;
  let freedDays = 0;

  // Geçmişte harcanmış gün varsa, ilk ne zaman o günlerden biri 180 günlük pencereden düşüp hak genişleyecek?
  if (daysSpentToday > 0) {
    let searchDate = addDays(todayMidnight, 1);
    for (let i = 0; i < 180; i++) {
      const dInWindow = calculatePastDaysInWindow(searchDate);
      if (dInWindow < daysSpentToday) {
        nextAvailableDate = formatISO(searchDate);
        freedDays = daysSpentToday - dInWindow;
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
    isViolated,
    maxDaysAllowed,
    nextAvailableDate,
    freedDays,
    isVisaExpired: false,
    isVisaExpiringSoon,
    daysUntilVisaExpires,
  };
};

export const calculateMainDestination = (trips: Trip[], visaCountry: string, validFrom?: string) => {
  if (!visaCountry || !isSchengenCountry(visaCountry) || trips.length === 0) {
    return { isValid: true, stats: {} as Record<string, number>, visaCountryDays: 0, maxDays: 0 };
  }

  // Sadece mevcut vize süresine (validFrom sonrası) ait seyahatleri ana hedef ülke hesabına dahil et
  const currentVisaTrips = validFrom
    ? trips.filter(t => t.isOngoing || !isBefore(parseMidnight(t.exitDate), parseMidnight(validFrom)))
    : trips;

  const countryDays = aggregateCountryDays(currentVisaTrips);

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

export interface FutureTripQuotaResult {
  daysNeeded: number;
  daysSpentAtExit: number;
  remainingAtExit: number;
  overstayDays: number;
  status: 'SAFE' | 'TIGHT' | 'OVERSTAY' | 'VISA_EXPIRED';
  isVisaExpiredAtTrip: boolean;
}

/**
 * Geleceğe planlanmış belirli bir seyahatin dönüş tarihindeki 180 günlük hareketli pencereyi
 * simüle ederek, seyahat için yeterli vize kotası olup olmadığını ve dönüşte kaç gün kalacağını hesaplar.
 * 
 * @param targetTrip Değerlendirilecek gelecek seyahat
 * @param allRelevantTrips Bu bölgeye ait tüm seyahatler (geçmiş + planlanmış tüm geziler)
 * @param maxDaysAllowed Vize gün limiti (varsayılan 90)
 * @param visaValidUntil Vize son geçerlilik tarihi (opsiyonel)
 */
export const calculateFutureTripQuota = (
  targetTrip: Trip,
  allRelevantTrips: Trip[],
  maxDaysAllowed: number = 90,
  visaValidUntil?: string,
  visaValidFrom?: string
): FutureTripQuotaResult => {
  const tEntry = parseMidnight(targetTrip.entryDate);
  const tExit = parseMidnight(targetTrip.exitDate);
  const daysNeeded = Math.max(1, differenceInDays(tExit, tEntry) + 1);

  // Vize geçerlilik süresini aşıp aşmadığını kontrol et
  let isVisaExpiredAtTrip = false;
  if (visaValidUntil) {
    const vEnd = parseMidnight(visaValidUntil);
    if (isAfter(tExit, vEnd)) {
      isVisaExpiredAtTrip = true;
    }
  }

  const vStart = visaValidFrom ? parseMidnight(visaValidFrom) : null;

  // Seyahatin her bir günündeki 180 günlük pencerede maksimum harcanan günü bul
  let maxDaysDuringTrip = 0;
  let curr = tEntry;

  while (isBefore(curr, tExit) || isSameDay(curr, tExit)) {
    const windowStart = subDays(curr, 179);
    let count = 0;

    allRelevantTrips.forEach(t => {
      const e = parseMidnight(t.entryDate);
      const x = t.isOngoing ? curr : parseMidnight(t.exitDate);

      if (isBefore(x, windowStart) || isAfter(e, curr)) {
        return;
      }

      const overlapStart = isBefore(e, windowStart) ? windowStart : e;
      const overlapEnd = isAfter(x, curr) ? curr : x;

      if (isBefore(overlapStart, overlapEnd) || isSameDay(overlapStart, overlapEnd)) {
        const d = differenceInDays(overlapEnd, overlapStart) + 1;
        if (!isNaN(d) && d > 0) {
          count += d;
        }
      }
    });

    if (count > maxDaysDuringTrip) {
      maxDaysDuringTrip = count;
    }

    curr = addDays(curr, 1);
  }

  const remainingAtExit = Math.max(0, maxDaysAllowed - maxDaysDuringTrip);
  const overstayDays = Math.max(0, maxDaysDuringTrip - maxDaysAllowed);

  let status: FutureTripQuotaResult['status'] = 'SAFE';
  if (isVisaExpiredAtTrip) {
    status = 'VISA_EXPIRED';
  } else if (overstayDays > 0) {
    status = 'OVERSTAY';
  } else if (remainingAtExit <= 5) {
    status = 'TIGHT';
  }

  return {
    daysNeeded,
    daysSpentAtExit: maxDaysDuringTrip,
    remainingAtExit,
    overstayDays,
    status,
    isVisaExpiredAtTrip,
  };
};
