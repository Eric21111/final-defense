import { useEffect, useRef, useState } from 'react';
import { FaTimes, FaUserFriends } from 'react-icons/fa';
import cameraIcon from '../../assets/owner/camera.svg';
import { useTheme } from '../../context/ThemeContext';

const initialFormState = {
  brandName: '',
  email: '',
  contactNumber: '+63',
  contactPerson: '',
  logo: '',
};

const AddBrandPartnerModal = ({ isOpen, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        logo: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.brandName.trim()) {
      setError('Brand name is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/brand-partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          brandName: formData.brandName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to add brand partner.');
      }

      onSuccess?.(data.data);
      onClose();
    } catch (err) {
      console.error('Failed to add brand partner:', err);
      setError(err.message || 'Failed to add brand partner.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-3xl w-full max-w-lg relative shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close add brand partner modal"
        >
          <FaTimes className="w-5 h-5" />
        </button>

        <form onSubmit={handleSubmit} className="p-8 pt-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#E1D5CB' }}>
              <FaUserFriends className="text-[#76462B]" />
            </div>

            <div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Add Brand Partner</h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Create a new brand partner profile</p>
            </div>
          </div>

          <div
            className={`w-36 h-36 mx-auto rounded-full flex items-center justify-center cursor-pointer border border-dashed ${theme === 'dark'
              ? 'bg-gradient-to-b from-[#2A2724] to-[#1E1B18] border-gray-600 hover:border-[#AD7F65]'
              : 'bg-gradient-to-b from-gray-50 to-gray-200 border-gray-300 hover:border-[#AD7F65]'
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {formData.logo ? (
              <img src={formData.logo} alt="Brand logo preview" className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="flex flex-col items-center text-gray-400">
                <div className={`w-12 h-12 flex items-center justify-center mb-2 rounded-full shadow-inner ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                  <img src={cameraIcon} alt="Upload" className={`w-6 h-6 ${theme === 'dark' ? 'opacity-50 invert' : 'opacity-70'}`} />
                </div>
                <span className="text-xs font-medium text-gray-500">Upload Logo</span>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />

          <div className={`border rounded-2xl p-5 ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[#76462B] font-semibold text-sm">Brand Partner Information</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Brand</label>
                <input
                  type="text"
                  name="brandName"
                  placeholder="e.g., John Doe"
                  value={formData.brandName}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === 'dark'
                    ? 'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900'
                    }`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="yourname12345@gmail.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === 'dark'
                    ? 'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900'
                    }`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Contact No.</label>
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="+63"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === 'dark'
                    ? 'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900'
                    }`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Contact Person</label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="e.g., John Doe"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === 'dark'
                    ? 'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900'
                    }`}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2 rounded-[15px] text-sm font-medium transition-colors ${theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-[15px] text-white text-sm font-semibold shadow-lg disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1DB954 0%, #0A8A3E 100%)' }}
            >
              {submitting ? 'Adding...' : 'Add Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBrandPartnerModal;

