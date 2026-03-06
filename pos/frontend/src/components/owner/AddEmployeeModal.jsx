import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaCheck, FaSpinner, FaTimes, FaUserPlus } from 'react-icons/fa';
import cameraIcon from '../../assets/owner/camera.svg';
import circleIcon from '../../assets/owner/circle.svg';

const getDisplayDate = () =>
  new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

const getTodayISO = () => new Date().toISOString().split('T')[0];

const ROLE_ACCESS_RECOMMENDATIONS = {
  Cashier: {
    posTerminal: true,
    inventory: false,
    viewTransactions: true,
    generateReports: false,
  },
  Manager: {
    posTerminal: true,
    inventory: true,
    viewTransactions: true,
    generateReports: true,
  },
  'Sub-Cashier': {
    posTerminal: true,
    inventory: false,
    viewTransactions: false,
    generateReports: false,
  },
  'Stock Manager': {
    posTerminal: false,
    inventory: true,
    viewTransactions: true,
    generateReports: false,
  },
};

const AddEmployeeModal = ({ isOpen, onClose, onEmployeeAdded, onEmployeeCreated }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contactNo: '',
    email: '',
    role: 'Cashier',
    dateCreated: getDisplayDate(),
    dateJoined: getTodayISO(),
  });
  const [accessControl, setAccessControl] = useState({
    posTerminal: true,
    inventory: false,
    viewTransactions: true,
    generateReports: false,
  });
  const [profilePreview, setProfilePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Email Verification State
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [showCodeSentCheck, setShowCodeSentCheck] = useState(false);

  // Generate random 6-digit PIN
  const generateRandomPin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        firstName: '',
        lastName: '',
        contactNo: '',
        email: '',
        role: 'Cashier',
        dateCreated: getDisplayDate(),
        dateJoined: getTodayISO(),
      });
      setAccessControl({
        posTerminal: true,
        inventory: false,
        viewTransactions: true,
        generateReports: false,
      });
      setProfilePreview('');
      setVerificationCode('');
      setIsCodeSent(false);
      setIsEmailVerified(false);
      setVerificationTimer(0);
      setError('');
    }
  }, [isOpen]);

  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'role') {
      const recommendedPermissions = ROLE_ACCESS_RECOMMENDATIONS[value];
      if (recommendedPermissions) {
        setAccessControl((prev) => ({
          ...prev,
          ...recommendedPermissions,
        }));
      }
    }
  };

  const handleAccessControlToggle = (key) => {
    setAccessControl((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSendCode = async () => {
    if (!formData.email) {
      setError('Please enter an email address first');
      return;
    }

    setEmailLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/verification/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await response.json();

      if (data.success) {
        setShowCodeSentCheck(true);
        setTimeout(() => {
          setIsCodeSent(true);
          setShowCodeSentCheck(false);
          setVerificationTimer(60); // 60 seconds cooldown
        }, 1000);
        setError('');
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
      setEmailLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    setEmailLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/verification/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: verificationCode
        })
      });
      const data = await response.json();

      if (data.success) {
        setIsEmailVerified(true);
        setIsCodeSent(false);
        setError('');
      } else {
        setError(data.message || 'Invalid verification code');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    // Validate form
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.contactNo || !formData.dateJoined) {
      setError('Please fill in all required fields');
      return;
    }

    if (!isEmailVerified) {
      setError('Please verify the email address first');
      return;
    }

    setError('');
    setLoading(true);

    // Generate random temporary PIN
    const tempPin = generateRandomPin();

    try {
      const response = await fetch('http://localhost:5000/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          contactNo: formData.contactNo,
          email: formData.email,
          role: formData.role,
          pin: tempPin,
          dateJoined: new Date(formData.dateCreated),
          dateJoinedActual: new Date(formData.dateJoined),
          profileImage: profilePreview,
          permissions: accessControl,
          requiresPinReset: true
        })
      });

      const data = await response.json();

      if (data.success) {
        const employeeName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          contactNo: '',
          email: '',
          role: 'Cashier',
          dateCreated: getDisplayDate(),
          dateJoined: getTodayISO(),
        });
        setAccessControl({
          posTerminal: true,
          inventory: false,
          viewTransactions: true,
          generateReports: false,
        });
        setProfilePreview('');

        // Close add modal
        onClose();

        // Notify parent to show temporary PIN modal
        if (onEmployeeCreated) {
          onEmployeeCreated(employeeName, tempPin);
        }

        // Refresh employee list
        if (onEmployeeAdded) {
          onEmployeeAdded();
        }
      } else {
        setError(data.message || 'Failed to add employee');
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      setError('Failed to connect to server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm bg-black/20">
      <div className="bg-white w-full max-w-xl relative shadow-2xl overflow-hidden animate-fadeIn" style={{ borderRadius: '24px' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
              <FaUserPlus className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Add Employee Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">

          {/* Centered Avatar Upload */}
          <div className="flex justify-center mb-8">
            <button
              type="button"
              onClick={handleImageSelect}
              className="w-40 h-40 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center relative focus:outline-none group hover:opacity-90 transition-opacity"
            >
              {profilePreview ? (
                <>
                  <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <FaCamera className="text-white w-8 h-8" />
                  </div>
                </>
              ) : (
                <>
                  <img src={circleIcon} alt="Circle background" className="w-full h-full object-cover" />
                  <img src={cameraIcon} alt="Camera" className="absolute w-16 h-16 opacity-80" />
                </>
              )}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
              />
            </button>
          </div>

          {/* Personal Details */}
          <h4 className="text-base font-bold text-gray-800 mb-4">Personal Details</h4>
          <div className="space-y-4 mb-8">
            {/* First Name and Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="First Name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#AD7F65] text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Last Name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#AD7F65] text-sm"
                />
              </div>
            </div>

            {/* Email with Send Code */}
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => {
                    handleInputChange(e);
                    if (isEmailVerified) setIsEmailVerified(false);
                    if (isCodeSent) setIsCodeSent(false);
                  }}
                  placeholder="user@example.com"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#AD7F65] text-sm ${isEmailVerified ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}
                  readOnly={isEmailVerified}
                />
                {!isEmailVerified && !isCodeSent && (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={emailLoading || !formData.email || verificationTimer > 0 || showCodeSentCheck}
                    className="px-6 py-2 bg-[#C2A68C] text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all whitespace-nowrap font-medium"
                  >
                    {emailLoading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : showCodeSentCheck ? (
                      <>
                        <FaCheck className="animate-pulse" />
                        <span>Sent!</span>
                      </>
                    ) : verificationTimer > 0 ? (
                      `Resend (${verificationTimer}s)`
                    ) : (
                      'Send Code'
                    )}
                  </button>
                )}
                {isEmailVerified && (
                  <div className="px-6 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                    <FaCheck /> Verified
                  </div>
                )}
              </div>
              {isCodeSent && !isEmailVerified && (
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#AD7F65] text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={emailLoading || !verificationCode}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50 font-medium"
                  >
                    Verify
                  </button>
                </div>
              )}
            </div>

            {/* Contact Number and Date Joined */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Contact number</label>
                <input
                  type="text"
                  name="contactNo"
                  value={formData.contactNo}
                  onChange={handleInputChange}
                  placeholder="09123456789"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#AD7F65] text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Date Joined</label>
                <input
                  type="date"
                  name="dateJoined"
                  value={formData.dateJoined}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#AD7F65] text-sm bg-white"
                />
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Position</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#AD7F65] text-sm bg-white"
              >
                <option value="Cashier">Cashier</option>
                <option value="Manager">Manager</option>
                <option value="Sub-Cashier">Sub-Cashier</option>
                <option value="Stock Manager">Stock Manager</option>
              </select>
            </div>
          </div>

          {/* Permissions */}
          <h4 className="text-base font-bold text-gray-800 mb-4">Permissions</h4>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: 'POS Terminal', desc: 'Access to Point of Sale Terminal', key: 'posTerminal' },
              { label: 'Inventory', desc: 'Add, Edit, Delete Products', key: 'inventory' },
              { label: 'View Transactions', desc: 'View Sales History', key: 'viewTransactions' },
              { label: 'Generate Reports', desc: 'Create and Download Business Reports', key: 'generateReports' },
            ].map(({ label, desc, key }) => (
              <div key={key} className="border border-gray-200 rounded-xl p-3 flex items-center justify-between hover:border-[#AD7F65] transition-colors bg-white">
                <div>
                  <p className="font-bold text-gray-800 text-xs">{label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={accessControl[key]}
                    onChange={() => handleAccessControlToggle(key)}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#AD7F65] peer-focus:ring-2 peer-focus:ring-[#AD7F65]/20 transition-all"></div>
                  <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                </label>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-gray-200 font-bold text-gray-700 hover:bg-gray-300 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddEmployee}
              disabled={loading || emailLoading || !isEmailVerified}
              className="px-8 py-2.5 rounded-lg text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed bg-[#10B981]"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AddEmployeeModal;
