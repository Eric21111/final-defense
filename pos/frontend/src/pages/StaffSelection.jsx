import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import bgImage from '../assets/bg.png';
import defaultAvatar from '../assets/default.jpeg';
import { FaUser } from 'react-icons/fa';
import { API_BASE_URL } from '../config/api';

const StaffSelection = () => {
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleProceed = async () => {
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Search for employee by first name
      const response = await fetch(`${API_BASE_URL}/api/employees/search/${encodeURIComponent(firstName)}`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        const firstNameLower = firstName.toLowerCase().trim();
        // Find employee by matching firstName or first word of name
        const employee = data.data.find((emp) => {
          const empFirstName = emp.firstName?.toLowerCase().trim();
          const nameFirstWord = emp.name?.toLowerCase().trim().split(/\s+/)[0];
          return empFirstName === firstNameLower || nameFirstWord === firstNameLower;
        });

        if (!employee) {
          setError('Employee not found. Please check your first name. Enter your registered first name');
          setLoading(false);
          return;
        }

        // Check if employee is active
        if (employee.status !== 'Active') {
          setError('Your account is inactive. Please contact administrator.');
          setLoading(false);
          return;
        }

        const staffInfo = {
          _id: employee._id,
          id: employee._id,
          name: employee.name,
          role: employee.role,
          image: employee.profileImage || defaultAvatar,
          permissions: employee.permissions
        };

        try {
          sessionStorage.setItem('selectedStaff', JSON.stringify(staffInfo));
        } catch (storageError) {
          console.warn('Unable to cache selected staff', storageError);
        }
        navigate('/pin', { state: { staff: staffInfo } });
      } else {
        // Fallback for owner login (if not in database)
        const firstNameLower = firstName.toLowerCase().trim();
        if (firstNameLower === 'owner' || firstNameLower.includes('owner')) {
          const ownerInfo = {
            id: 3,
            name: 'owner',
            email: 'owner',
            role: 'Owner',
            image: defaultAvatar,
            permissions: {
              posTerminal: true,
              inventory: true,
              viewTransactions: true,
              generateReports: true
            }
          };
          try {
            sessionStorage.setItem('selectedStaff', JSON.stringify(ownerInfo));
          } catch (storageError) {
            console.warn('Unable to cache selected staff', storageError);
          }
          navigate('/pin', { state: { staff: ownerInfo } });
        } else {
          setError('Employee not found. Please check your first name.');
        }
      }
    } catch (error) {
      console.error('Error searching for employee:', error);
      setError('Failed to connect to server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleProceed();
    }
  };

  const handleReturn = () => {
    navigate(-1);
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden flex-col lg:flex-row">

      <div className="flex-1 relative flex items-center justify-center p-8 bg-white min-h-[40vh] lg:min-h-full">

        <div
          className="absolute inset-8 lg:inset-8 rounded-[20px] bg-cover bg-center"
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


      <div className="flex-1 bg-white flex items-center justify-center p-8 min-h-[60vh] lg:min-h-full">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-[#333] mb-2">Welcome to CYSPOS!</h2>
            <div className="w-[100px] h-1 bg-[#8B7355] mx-auto"></div>
          </div>

          <div className="mb-8 flex justify-center">
            <div className="w-32 h-32 rounded-full bg-[#C8A882] flex items-center justify-center">
              <FaUser className="text-white text-6xl" />
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-gray-700 text-sm mb-2">
              Enter your first name
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <FaUser className="text-gray-400" />
              </div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="Username"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#8B7355] text-gray-700"
                autoFocus
              />
            </div>
            {error && (
              <div className="mt-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              Enter your registered first name
            </div>
          </div>

          <div>
            <button
              className="w-full bg-[#8B7355] text-white border-none rounded-lg py-3 text-lg font-semibold cursor-pointer transition-all duration-300 hover:bg-[#6d5a43] hover:shadow-[0_4px_12px_rgba(139,115,85,0.3)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleProceed}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Proceed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(StaffSelection);

