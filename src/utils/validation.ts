/**
 * Validation Logic and Schema for Trip Entry Form with Visa Exemption Conditional Logic
 */

export interface TripFormValues {
  isVisaExempt?: boolean;
  isOngoing?: boolean;
  tripEntryDate: string; // YYYY-MM-DD
  tripExitDate: string;  // YYYY-MM-DD
  visaStartDate?: string; // YYYY-MM-DD
  visaEndDate?: string;   // YYYY-MM-DD
}

export interface ValidationResult {
  isValid: boolean;
  errors: {
    tripEntryDate?: string;
    tripExitDate?: string;
  };
}

/**
 * Validates trip form entries:
 * 
 * 1. Requires valid tripEntryDate.
 * 2. If not ongoing, requires valid tripExitDate.
 * 3. Ensures tripExitDate >= tripEntryDate when trip is completed.
 * 
 * Note: Trips are NOT restricted to the current visa's validFrom/validUntil dates
 * so that users can freely log historical trips (from previous visas) and future planned trips.
 */
export const validateTripForm = (values: TripFormValues): ValidationResult => {
  const errors: ValidationResult['errors'] = {};

  if (!values.tripEntryDate) {
    errors.tripEntryDate = 'Giriş tarihi gereklidir / Entry date is required';
  }

  if (!values.isOngoing) {
    if (!values.tripExitDate) {
      errors.tripExitDate = 'Çıkış tarihi gereklidir / Exit date is required';
    } else if (values.tripEntryDate && values.tripExitDate < values.tripEntryDate) {
      errors.tripExitDate = 'Çıkış tarihi, giriş tarihinden önce olamaz / Exit date cannot be before entry date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
