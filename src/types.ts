export type TrackingMode = 'SCHENGEN' | 'SINGLE_COUNTRY';

export interface TripSegment {
  country: string;
  days: number;
}

export interface Trip {
  id: string;
  entryDate: string; // ISO string YYYY-MM-DD
  exitDate: string; // ISO string YYYY-MM-DD
  entryCountry: string;
  exitCountry: string;
  segments?: TripSegment[];
  isOngoing?: boolean;
  groupId?: string; // Links trips created together for multiple persons
  
  // For backwards compatibility with old trips stored in device
  country?: string; 
}

export interface VisaZoneConfig {
  id: string;
  name: string; // e.g. "Schengen Zone", "Turkey", "United Kingdom"
  trackingMode: TrackingMode; // SCHENGEN or SINGLE_COUNTRY
  targetCountry?: string; // e.g. "Turkey", "United Kingdom", "Georgia"
  country?: string; // Issuing country for Schengen visa
  validFrom?: string; // ISO string YYYY-MM-DD
  validUntil?: string; // ISO string YYYY-MM-DD
  maxDays: number; // usually 90
  isVisaExempt?: boolean; // Visa exemption toggle
}

export interface VisaDetails {
  trackingMode: TrackingMode; // SCHENGEN or SINGLE_COUNTRY
  targetCountry?: string; // e.g. "Turkey" for Bulgarians, or "United Kingdom"
  country: string; // Issuing country for Schengen visa
  validFrom: string; // ISO string YYYY-MM-DD
  validUntil: string; // ISO string YYYY-MM-DD
  maxDays: number; // usually 90
  isVisaExempt?: boolean; // Visa exemption toggle
}

export interface Person {
  id: string;
  name: string;
  trips: Trip[];
  visaDetails: VisaDetails | null;
  zoneVisaDetails?: Record<string, VisaDetails>;
  zones?: VisaZoneConfig[];
  activeZoneId?: string;
}
