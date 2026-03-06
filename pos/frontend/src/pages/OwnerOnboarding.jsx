import { memo, useRef, useState } from 'react';
import { FaCheck, FaSpinner } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import bgImage from '../assets/bg.png';
import logo from '../assets/logo.png';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { validatePinSecurity } from '../utils/pinValidation';

const PIN_LENGTH = 6;
const EMPTY_PIN = Array(PIN_LENGTH).fill('');

const OwnerOnboarding = ({ onSetupComplete }) => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formValues, setFormValues] = useState(() => {
    const saved = localStorage.getItem('ownerOnboardingForm');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          firstName: '',
          lastName: '',
          email: '',
          contactNo: ''
        };
      }
    }
    return {
      firstName: '',
      lastName: '',
      email: '',
      contactNo: ''
    };
  });
  const [pinDigits, setPinDigits] = useState(() => {
    const saved = localStorage.getItem('ownerOnboardingPin');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return EMPTY_PIN;
      }
    }
    return EMPTY_PIN;
  });
  const [confirmPinDigits, setConfirmPinDigits] = useState(() => {
    const saved = localStorage.getItem('ownerOnboardingConfirmPin');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return EMPTY_PIN;
      }
    }
    return EMPTY_PIN;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    contactNo: '',
    pin: '',
    confirmPin: ''
  });
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    contactNo: false,
    pin: false,
    confirmPin: false,
    verificationCode: false
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [showCodeSentCheck, setShowCodeSentCheck] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const pinRefs = useRef([]);
  const confirmPinRefs = useRef([]);

  const handleInputChange = (field, value) => {
    setFormValues((prev) => {
      const updated = {
        ...prev,
        [field]: value
      };
      // Save to localStorage
      localStorage.setItem('ownerOnboardingForm', JSON.stringify(updated));
      return updated;
    });

    // Real-time validation
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === 'contactNo') {
      validateField(field, formValues[field]);
    } else if (field === 'email') {
      validateField(field, formValues[field]);
      // Reset verification if email changes
      if (isEmailVerified) {
        setIsEmailVerified(false);
        setIsCodeSent(false);
        setVerificationCode('');
      }
    } else if (field === 'firstName' || field === 'lastName') {
      validateField(field, formValues[field]);
    }
  };

  const validateField = (field, value) => {
    let errorMsg = '';

    switch (field) {
      case 'firstName':
        if (!value.trim()) {
          errorMsg = 'First name is required';
        }
        break;
      case 'lastName':
        if (!value.trim()) {
          errorMsg = 'Last name is required';
        }
        break;
      case 'email':
        if (!value.trim()) {
          errorMsg = 'Email is required';
        } else if (!value.includes('@')) {
          errorMsg = 'Please enter a valid email address';
        }
        break;
      case 'contactNo':
        if (!value.trim()) {
          errorMsg = 'Contact number is required';
        } else if (!validatePhilippineNumber(value)) {
          errorMsg = 'Invalid format. Use 09XXXXXXXXX or +639XXXXXXXXX';
        }
        break;
      case 'pin':
        const pin = typeof value === 'string' ? value : pinDigits.join('');
        if (pin.length > 0 && pin.length < PIN_LENGTH) {
          errorMsg = 'PIN must be exactly 6 digits';
        } else if (pin.length === PIN_LENGTH) {
          // Validate PIN security rules when complete
          const pinValidation = validatePinSecurity(pin);
          if (!pinValidation.isValid) {
            errorMsg = pinValidation.error;
          } else {
            errorMsg = '';
          }
        }
        break;
      case 'confirmPin':
        const confirmPin = typeof value === 'string' ? value : confirmPinDigits.join('');
        const mainPin = pinDigits.join('');
        if (confirmPin.length > 0 && confirmPin.length < PIN_LENGTH) {
          errorMsg = 'PIN must be exactly 6 digits';
        } else if (confirmPin.length === PIN_LENGTH && mainPin.length === PIN_LENGTH && confirmPin !== mainPin) {
          errorMsg = 'PINs do not match';
        }
        // Clear error if both PINs are complete and match
        if (confirmPin.length === PIN_LENGTH && mainPin.length === PIN_LENGTH && confirmPin === mainPin) {
          errorMsg = '';
        }
        break;
      default:
        break;
    }

    setFieldErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  const handleDigitChange = (type, index, value) => {
    if (!/^\d?$/.test(value)) {
      return;
    }
    const setter = type === 'pin' ? setPinDigits : setConfirmPinDigits;
    const refs = type === 'pin' ? pinRefs : confirmPinRefs;
    const field = type === 'pin' ? 'pin' : 'confirmPin';
    const storageKey = type === 'pin' ? 'ownerOnboardingPin' : 'ownerOnboardingConfirmPin';

    setter((prev) => {
      const updated = [...prev];
      updated[index] = value;

      // Save to localStorage
      localStorage.setItem(storageKey, JSON.stringify(updated));

      // Real-time PIN security validation when PIN is complete
      if (field === 'pin') {
        const pinString = updated.join('');
        if (pinString.length === PIN_LENGTH) {
          const pinValidation = validatePinSecurity(pinString);
          if (!pinValidation.isValid) {
            setFieldErrors((prev) => ({ ...prev, pin: pinValidation.error }));
          } else {
            setFieldErrors((prev) => ({ ...prev, pin: '' }));
          }
        }
      }

      // Validate after update
      if (touched[field]) {
        setTimeout(() => {
          validateField(field, updated.join(''));
        }, 0);
      }

      return updated;
    });

    if (value && index < PIN_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }

    // Mark as touched
    if (!touched[field]) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }
  };

  const handleKeyDown = (type, index, event) => {
    if (event.key !== 'Backspace') {
      return;
    }

    const values = type === 'pin' ? pinDigits : confirmPinDigits;
    const refs = type === 'pin' ? pinRefs : confirmPinRefs;

    if (!values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (type, event) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('Text').replace(/\D/g, '').slice(0, PIN_LENGTH).split('');
    if (!digits.length) {
      return;
    }

    while (digits.length < PIN_LENGTH) {
      digits.push('');
    }

    const setter = type === 'pin' ? setPinDigits : setConfirmPinDigits;
    const refs = type === 'pin' ? pinRefs : confirmPinRefs;
    setter(digits);

    let lastIndex = 0;
    digits.forEach((digit, idx) => {
      if (digit !== '') {
        lastIndex = idx;
      }
    });
    refs.current[lastIndex]?.focus();
  };

  const validatePhilippineNumber = (number) => {
    // Remove all spaces, dashes, and parentheses
    const cleaned = number.replace(/[\s\-()]/g, '');

    // Check for valid Philippine number formats:
    // 09XXXXXXXXX (11 digits starting with 09)
    // +639XXXXXXXXX (13 characters starting with +639)
    // 639XXXXXXXXX (12 digits starting with 639)
    const pattern09 = /^09\d{9}$/;
    const patternPlus63 = /^\+639\d{9}$/;
    const pattern63 = /^639\d{9}$/;

    return pattern09.test(cleaned) || patternPlus63.test(cleaned) || pattern63.test(cleaned);
  };

  const validateForm = () => {
    // Mark all fields as touched
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      contactNo: true,
      pin: true,
      confirmPin: true
    });

    // Validate all fields
    validateField('firstName', formValues.firstName);
    validateField('lastName', formValues.lastName);
    validateField('email', formValues.email);
    validateField('contactNo', formValues.contactNo);
    validateField('pin', pinDigits.join(''));
    validateField('confirmPin', confirmPinDigits.join(''));

    // Check if any errors exist
    const hasErrors =
      !formValues.firstName.trim() ||
      !formValues.lastName.trim() ||
      !formValues.email.trim() ||
      !formValues.email.includes('@') ||
      !formValues.contactNo.trim() ||
      !validatePhilippineNumber(formValues.contactNo) ||
      pinDigits.join('').length !== PIN_LENGTH ||
      confirmPinDigits.join('').length !== PIN_LENGTH ||
      pinDigits.join('') !== confirmPinDigits.join('');

    pinDigits.join('') !== confirmPinDigits.join('') ||
      !isEmailVerified;

    return !hasErrors;
  };

  const handleSendCode = async () => {
    if (!formValues.email || fieldErrors.email) {
      setTouched(prev => ({ ...prev, email: true }));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/verification/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formValues.email })
      });
      const data = await response.json();

      if (data.success) {
        setShowCodeSentCheck(true);
        setTimeout(() => {
          setIsCodeSent(true);
          setShowCodeSentCheck(false);
          setVerificationTimer(60); // 60 seconds cooldown
        }, 1000);
        const timer = setInterval(() => {
          setVerificationTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(data.message || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setFieldErrors(prev => ({ ...prev, verificationCode: 'Please enter the code' }));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/verification/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formValues.email,
          code: verificationCode
        })
      });
      const data = await response.json();

      if (data.success) {
        setIsEmailVerified(true);
        setFieldErrors(prev => ({ ...prev, verificationCode: '' }));
        setShowPinModal(true); // Open modal on success
      } else {
        setFieldErrors(prev => ({ ...prev, verificationCode: data.message || 'Invalid code' }));
      }
    } catch (err) {
      setFieldErrors(prev => ({ ...prev, verificationCode: 'Verification failed' }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const pin = pinDigits.join('');
    // Validate PIN security rules before submission
    const pinValidation = validatePinSecurity(pin);
    if (!pinValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, pin: pinValidation.error }));
      setTouched(prev => ({ ...prev, pin: true }));
      setError(pinValidation.error);
      return;
    }

    setLoading(true);

    const payload = {
      name: `${formValues.firstName.trim()} ${formValues.lastName.trim()}`.trim(),
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      contactNo: formValues.contactNo.trim(),
      email: formValues.email.trim(),
      role: 'Owner',
      pin: pinDigits.join(''),
      permissions: {
        posTerminal: true,
        inventory: true,
        viewTransactions: true,
        generateReports: true
      },
      requiresPinReset: false,
      status: 'Active',
      dateJoinedActual: new Date().toISOString()
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to create owner account.');
      }

      const ownerProfile = {
        ...data.data,
        id: data.data._id,
        permissions: payload.permissions,
        role: 'Owner'
      };

      login(ownerProfile);

      // Clear localStorage after successful account creation
      localStorage.removeItem('ownerOnboardingForm');
      localStorage.removeItem('ownerOnboardingPin');
      localStorage.removeItem('ownerOnboardingConfirmPin');

      onSetupComplete?.();
      navigate('/dashboard');
    } catch (submissionError) {
      console.error('Error creating owner account:', submissionError);
      setError(submissionError.message || 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPinRow = (label, digits, type, refs) => {
    const field = type === 'pin' ? 'pin' : 'confirmPin';
    const hasError = fieldErrors[field];

    return (
      <div>
        <label className="block text-base font-medium text-gray-700 mb-4">{label}</label>
        <div className="flex gap-3 justify-center">
          {digits.map((digit, index) => (
            <input
              key={`${label}-${index}`}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleDigitChange(type, index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(type, index, event)}
              onPaste={(event) => handlePaste(type, event)}
              className={`w-16 h-16 rounded-xl border-2 ${hasError ? 'border-red-500' : 'border-gray-300'
                } bg-white text-center text-2xl font-semibold text-[#2D2D2D] focus:border-[#8B7355] focus:outline-none`}
              aria-label={`${label} digit ${index + 1}`}
            />
          ))}
        </div>
        {hasError && (
          <p className="text-red-500 text-xs mt-2 text-center">{hasError}</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden flex-col lg:flex-row bg-white">
      <div className="flex-1 bg-white flex items-center justify-center px-6 py-10 lg:px-16">
        <div className="w-full max-w-[600px]">
          <div className="text-center mb-10">
            <h1 className="text-5xl lg:text-6xl font-bold mb-4">
              <span className="text-[#2D2D2D]">Welcome to </span>
              <span className="text-[#8B7355]">CYSPOS!</span>
            </h1>
            <div className="w-full max-w-md h-1 bg-[#C2A68C] mx-auto" />
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">First Name</label>
                <input
                  type="text"
                  className={`w-full px-4 py-3 rounded-xl border ${fieldErrors.firstName ? 'border-red-500' : 'border-gray-200'
                    } focus:outline-none focus:border-[#8B7355] bg-white`}
                  placeholder="John"
                  value={formValues.firstName}
                  onChange={(event) => handleInputChange('firstName', event.target.value)}
                  onBlur={() => handleBlur('firstName')}
                />
                {fieldErrors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.firstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Last Name</label>
                <input
                  type="text"
                  className={`w-full px-4 py-3 rounded-xl border ${fieldErrors.lastName ? 'border-red-500' : 'border-gray-200'
                    } focus:outline-none focus:border-[#8B7355] bg-white`}
                  placeholder="Doe"
                  value={formValues.lastName}
                  onChange={(event) => handleInputChange('lastName', event.target.value)}
                  onBlur={() => handleBlur('lastName')}
                />
                {fieldErrors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Contact Number</label>
              <input
                type="tel"
                className={`w-full px-4 py-3 rounded-xl border ${fieldErrors.contactNo ? 'border-red-500' : 'border-gray-200'
                  } focus:outline-none focus:border-[#8B7355] bg-white`}
                placeholder="+63 900 000 0000"
                value={formValues.contactNo}
                onChange={(event) => handleInputChange('contactNo', event.target.value)}
                onBlur={() => handleBlur('contactNo')}
              />
              {fieldErrors.contactNo && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.contactNo}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
              <div className="flex gap-0">
                <div className="flex items-center justify-center bg-[#8B7355] rounded-l-xl px-4">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="email"
                  className={`flex-1 px-4 py-3 rounded-r-xl border-l-0 border ${fieldErrors.email ? 'border-red-500' : 'border-gray-200'
                    } focus:outline-none focus:border-[#8B7355] bg-white`}
                  placeholder="Enter your Email..."
                  value={formValues.email}
                  onChange={(event) => handleInputChange('email', event.target.value)}
                  onBlur={() => handleBlur('email')}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Verification Code Section */}
            {!isEmailVerified && (
              <div className="space-y-3">
                {!isCodeSent ? (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading || !formValues.email || !!fieldErrors.email || verificationTimer > 0 || showCodeSentCheck}
                    className="w-full py-3 rounded-xl border border-[#8B7355] text-[#8B7355] font-medium hover:bg-[#8B7355] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : showCodeSentCheck ? (
                      <>
                        <FaCheck className="animate-pulse" />
                        <span>Code Sent!</span>
                      </>
                    ) : verificationTimer > 0 ? (
                      `Resend in ${verificationTimer}s`
                    ) : (
                      'Send Verification Code'
                    )}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        className={`w-full px-4 py-3 rounded-xl border ${fieldErrors.verificationCode ? 'border-red-500' : 'border-gray-200'
                          } focus:outline-none focus:border-[#8B7355] bg-white`}
                        placeholder="Enter 6-digit code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        maxLength={6}
                      />
                      {fieldErrors.verificationCode && (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors.verificationCode}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={loading}
                      className="px-6 py-3 rounded-xl bg-[#8B7355] text-white font-medium hover:bg-[#6d5a43] transition-colors disabled:opacity-50"
                    >
                      Verify
                    </button>
                  </div>
                )}
              </div>
            )}

            {isEmailVerified && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl border border-green-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Email Verified Successfully</span>
              </div>
            )}

            {isEmailVerified && !showPinModal && (
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="w-full bg-[#8B7355] text-white rounded-2xl px-8 py-4 text-lg font-semibold transition-all duration-300 hover:bg-[#6d5a43] hover:shadow-lg mt-4"
              >
                Continue to PIN Setup
              </button>
            )}

            {/* PIN Modal */}
            {showPinModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in duration-300">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <h2 className="text-2xl font-bold text-[#2D2D2D] mb-6 text-center">Secure your Account</h2>

                  <div className="space-y-8">
                    <div className="text-center">
                      {renderPinRow('Create PIN Code', pinDigits, 'pin', pinRefs)}
                    </div>
                    <div className="text-center">
                      {renderPinRow('Confirm PIN Code', confirmPinDigits, 'confirm', confirmPinRefs)}
                    </div>

                    <div className="flex flex-col gap-3 items-center">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#8B7355] text-white rounded-2xl px-8 py-4 text-lg font-semibold transition-all duration-300 hover:bg-[#6d5a43] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Creating Account...' : 'Complete Setup'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-8 bg-white min-h-[40vh] lg:min-h-full">
        <div
          className="absolute inset-8 rounded-[20px] bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(139, 115, 85, 0.7), rgba(139, 115, 85, 0.7)), url(${bgImage})`
          }}
        />

        <div className="relative z-10 text-center p-12 flex items-center justify-center">
          <img
            src={logo}
            alt="Create Your Style"
            className="max-w-[80%] lg:max-w-[70%] h-auto object-contain drop-shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
          />
        </div>
      </div>
    </div>
  );
};

export default memo(OwnerOnboarding);