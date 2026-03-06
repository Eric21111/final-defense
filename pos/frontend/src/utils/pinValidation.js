/**
 * Validates PIN security rules
 * @param {string} pin - The PIN to validate
 * @returns {{ isValid: boolean, error: string }} - Validation result
 */
export const validatePinSecurity = (pin) => {
  if (!pin || pin.length !== 6) {
    return { isValid: false, error: 'PIN must be exactly 6 digits' };
  }

  // Rule 1: No digit may appear 3 times
  const digitCounts = {};
  for (const digit of pin) {
    digitCounts[digit] = (digitCounts[digit] || 0) + 1;
    if (digitCounts[digit] >= 3) {
      return {
        isValid: false,
        error: 'No digit may appear 3 times or more (e.g., 121212, 111222)'
      };
    }
  }

  // Rule 2: No sequences (ascending or descending)
  const isSequence = (str) => {
    const digits = str.split('').map(Number);
    
    // Check ascending sequence (e.g., 123456, 234567)
    let isAscending = true;
    for (let i = 1; i < digits.length; i++) {
      if (digits[i] !== digits[i - 1] + 1) {
        isAscending = false;
        break;
      }
    }
    
    // Check descending sequence (e.g., 987654, 654321)
    let isDescending = true;
    for (let i = 1; i < digits.length; i++) {
      if (digits[i] !== digits[i - 1] - 1) {
        isDescending = false;
        break;
      }
    }
    
    return isAscending || isDescending;
  };

  if (isSequence(pin)) {
    return {
      isValid: false,
      error: 'No sequences allowed (e.g., 123456, 234567, 987654)'
    };
  }

  // Rule 3: No all-same PINs (e.g., 000000, 111111)
  const firstDigit = pin[0];
  const allSame = pin.split('').every(digit => digit === firstDigit);
  if (allSame) {
    return {
      isValid: false,
      error: 'No all-same PINs allowed (e.g., 000000, 111111)'
    };
  }

  return { isValid: true, error: '' };
};

