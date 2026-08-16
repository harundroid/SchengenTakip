/**
 * Validation Logic and Schema for Trip Entry Form with Visa Exemption Conditional Logic
 */

export interface TripFormValues {
  isVisaExempt: boolean;
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
    visaStartDate?: string;
    visaEndDate?: string;
  };
}

/**
 * Validates trip form entries against conditional visa exemption rules and ongoing trip status:
 * 
 * 1. When isOngoing is TRUE:
 *    - Skips tripExitDate validation checks
 * 
 * 2. When isVisaExempt is TRUE:
 *    - Ignores visaStartDate and visaEndDate
 * 
 * 3. When isVisaExempt is FALSE (Default):
 *    - Requires visaStartDate and visaEndDate
 *    - Ensures tripEntryDate >= visaStartDate
 *    - Ensures tripExitDate <= visaEndDate (if not ongoing)
 */
export const validateTripForm = (values: TripFormValues): ValidationResult => {
  const errors: ValidationResult['errors'] = {};

  if (!values.tripEntryDate) {
    errors.tripEntryDate = 'Giriş tarihi gereklidir / Entry date is required';
  }

  if (!values.isOngoing) {
    if (!values.tripExitDate) {
      errors.tripExitDate = 'Çıkış tarihi gereklidir / Exit date is required';
    }

    // Always validate tripExitDate >= tripEntryDate when not ongoing
    if (values.tripEntryDate && values.tripExitDate && values.tripExitDate < values.tripEntryDate) {
      errors.tripExitDate = 'Çıkış tarihi, giriş tarihinden sonra olmalıdır / Exit date must be after entry date';
    }
  }

  // Behavior when isVisaExempt is FALSE (Default):
  if (!values.isVisaExempt) {
    if (!values.visaStartDate) {
      errors.visaStartDate = 'Vize başlangıç tarihi gereklidir / Visa start date is required';
    } else if (values.tripEntryDate && values.tripEntryDate < values.visaStartDate) {
      errors.tripEntryDate = `Giriş tarihi (${values.tripEntryDate}), vize başlangıç tarihinden (${values.visaStartDate}) önce olamaz! / Entry date must be >= visa start date`;
    }

    if (!values.isOngoing) {
      if (!values.visaEndDate) {
        errors.visaEndDate = 'Vize bitiş tarihi gereklidir / Visa end date is required';
      } else if (values.tripExitDate && values.tripExitDate > values.visaEndDate) {
        errors.tripExitDate = `Çıkış tarihi (${values.tripExitDate}), vize bitiş tarihinden (${values.visaEndDate}) sonra olamaz! / Exit date must be <= visa end date`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
