/**
 * Canonical ISO Country Code System for Schengen App
 * Standard 2-letter ISO 3166-1 alpha-2 codes used as underlying ValueMember.
 */
export interface CountryOption {
  code: string; // ISO 2-letter code (e.g. 'DE', 'TR', 'MK')
  name: string; // Standard English name key for i18n fallback
  isSchengen: boolean;
}

export const COUNTRY_LIST: CountryOption[] = [
  // Schengen Zone Members (29)
  { code: 'AT', name: 'Austria', isSchengen: true },
  { code: 'BE', name: 'Belgium', isSchengen: true },
  { code: 'BG', name: 'Bulgaria', isSchengen: true },
  { code: 'HR', name: 'Croatia', isSchengen: true },
  { code: 'CZ', name: 'Czech Republic', isSchengen: true },
  { code: 'DK', name: 'Denmark', isSchengen: true },
  { code: 'EE', name: 'Estonia', isSchengen: true },
  { code: 'FI', name: 'Finland', isSchengen: true },
  { code: 'FR', name: 'France', isSchengen: true },
  { code: 'DE', name: 'Germany', isSchengen: true },
  { code: 'GR', name: 'Greece', isSchengen: true },
  { code: 'HU', name: 'Hungary', isSchengen: true },
  { code: 'IS', name: 'Iceland', isSchengen: true },
  { code: 'IT', name: 'Italy', isSchengen: true },
  { code: 'LV', name: 'Latvia', isSchengen: true },
  { code: 'LI', name: 'Liechtenstein', isSchengen: true },
  { code: 'LT', name: 'Lithuania', isSchengen: true },
  { code: 'LU', name: 'Luxembourg', isSchengen: true },
  { code: 'MT', name: 'Malta', isSchengen: true },
  { code: 'NL', name: 'Netherlands', isSchengen: true },
  { code: 'NO', name: 'Norway', isSchengen: true },
  { code: 'PL', name: 'Poland', isSchengen: true },
  { code: 'PT', name: 'Portugal', isSchengen: true },
  { code: 'RO', name: 'Romania', isSchengen: true },
  { code: 'SK', name: 'Slovakia', isSchengen: true },
  { code: 'SI', name: 'Slovenia', isSchengen: true },
  { code: 'ES', name: 'Spain', isSchengen: true },
  { code: 'SE', name: 'Sweden', isSchengen: true },
  { code: 'CH', name: 'Switzerland', isSchengen: true },

  // Non-Schengen Independent Countries
  { code: 'TR', name: 'Turkey', isSchengen: false },
  { code: 'MK', name: 'North Macedonia', isSchengen: false },
  { code: 'XK', name: 'Kosovo', isSchengen: false },
  { code: 'AZ', name: 'Azerbaijan', isSchengen: false },
  { code: 'GE', name: 'Georgia', isSchengen: false },
  { code: 'RS', name: 'Serbia', isSchengen: false },
  { code: 'ME', name: 'Montenegro', isSchengen: false },
  { code: 'BA', name: 'Bosnia & Herzegovina', isSchengen: false },
  { code: 'AL', name: 'Albania', isSchengen: false },
  { code: 'GB', name: 'United Kingdom', isSchengen: false },
  { code: 'US', name: 'United States', isSchengen: false },
  { code: 'AE', name: 'United Arab Emirates', isSchengen: false },
  { code: 'CY', name: 'Cyprus', isSchengen: false },
  { code: 'EG', name: 'Egypt', isSchengen: false },
  { code: 'MD', name: 'Moldova', isSchengen: false },
  { code: 'UA', name: 'Ukraine', isSchengen: false },
  { code: 'AM', name: 'Armenia', isSchengen: false },
  { code: 'QA', name: 'Qatar', isSchengen: false },
  { code: 'SA', name: 'Saudi Arabia', isSchengen: false },
  { code: 'JP', name: 'Japan', isSchengen: false },
  { code: 'KR', name: 'South Korea', isSchengen: false },
  { code: 'TH', name: 'Thailand', isSchengen: false },
  { code: 'CA', name: 'Canada', isSchengen: false },
  { code: 'AU', name: 'Australia', isSchengen: false },
  { code: 'MX', name: 'Mexico', isSchengen: false },
  { code: 'BR', name: 'Brazil', isSchengen: false },
  { code: 'MA', name: 'Morocco', isSchengen: false },
  { code: 'TN', name: 'Tunisia', isSchengen: false },
];

export const SCHENGEN_ONLY_COUNTRIES = COUNTRY_LIST.filter(c => c.isSchengen).map(c => c.code);
export const NON_SCHENGEN_COUNTRIES = COUNTRY_LIST.filter(c => !c.isSchengen).map(c => c.code);
export const ALL_COUNTRIES = COUNTRY_LIST.map(c => c.code);
export const SCHENGEN_SET = new Set(SCHENGEN_ONLY_COUNTRIES);

/**
 * Resolves any string (ISO code 'MK' or English name 'North Macedonia')
 * to its official 2-letter ISO Country Code ('MK').
 */
export const getCountryCode = (input?: string): string => {
  if (!input) return '';
  const clean = input.trim();
  if (clean.length === 2 && COUNTRY_LIST.some(c => c.code === clean.toUpperCase())) {
    return clean.toUpperCase();
  }

  const found = COUNTRY_LIST.find(c =>
    c.code.toLowerCase() === clean.toLowerCase() ||
    c.name.toLowerCase() === clean.toLowerCase()
  );
  return found ? found.code : clean.toUpperCase();
};

/**
 * Checks if a country (by ISO code or English name) belongs to the Schengen zone
 */
export const isSchengenCountry = (input?: string): boolean => {
  if (!input) return false;
  return SCHENGEN_SET.has(getCountryCode(input));
};

/**
 * Compares two country values (ISO code or English name)
 * and returns true if they represent the same canonical country code.
 */
export const isSameCountry = (a?: string, b?: string): boolean => {
  if (!a || !b) return false;
  const codeA = getCountryCode(a);
  const codeB = getCountryCode(b);
  return codeA === codeB;
};

/**
 * Returns a sorted array of country objects { code, label } 
 * alphabetically sorted by the displayed label (LabelMember) in the active language.
 */
export const getSortedCountryOptions = (
  countryCodes: string[],
  t: (key: string, options?: any) => string,
  currentLanguage: string = 'en'
): Array<{ code: string; label: string }> => {
  return countryCodes
    .map(code => ({
      code,
      label: t(`countries.${code}`, { defaultValue: code }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, currentLanguage, { sensitivity: 'base' }));
};
