import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaTimes, FaUserEdit } from 'react-icons/fa';
import defaultAvatar from '../../assets/default.jpeg';

const EditEmployeeProfile = ({ isOpen, onClose, employee, onEmployeeUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    contactNo: '',
    email: '',
    role: '',
    dateJoined: ''
  });
  const [status, setStatus] = useState('Active');
  const [permissions, setPermissions] = useState({
    posTerminal: false,
    inventory: false,
    viewTransactions: false,
    generateReports: false
  });
  const [profilePreview, setProfilePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && employee) {
      setFormData({
        name: employee.name || '',
        contactNo: employee.contactNo || '',
        email: employee.email || '',
        role: employee.role || 'Sales Clerk',
        dateJoined: employee.dateJoinedActual
          ? new Date(employee.dateJoinedActual).toISOString().split('T')[0]
          : ''
      });
      setStatus(employee.status || 'Active');
      setPermissions({
        posTerminal: employee.permissions?.posTerminal ?? false,
        inventory: employee.permissions?.inventory ?? false,
        viewTransactions: employee.permissions?.viewTransactions ?? false,
        generateReports: employee.permissions?.generateReports ?? false
      });
      setProfilePreview(employee.profileImage || employee.image || defaultAvatar);
      setMessage('');
      setError('');
    }
  }, [isOpen, employee]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfilePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.contactNo) {
      setError('Name, email, and contact number are required.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`http://localhost:5000/api/employees/${employee._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status,
          permissions,
          profileImage: profilePreview,
          dateJoinedActual: formData.dateJoined
        })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update employee.');
      }

      setMessage('Employee updated successfully.');
      onEmployeeUpdated?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm bg-black/20">
      <div className="bg-white w-full max-w-2xl relative shadow-2xl overflow-hidden animate-fadeIn" style={{ borderRadius: '24px' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
              <FaUserEdit className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Edit Employee Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">

          {/* Profile Section */}
          <div className="flex items-start gap-8 mb-10">
            <div className="shrink-0 relative group cursor-pointer" onClick={handlePhotoClick}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg relative">
                <img
                  src={profilePreview}
                  alt={formData.name}
                  className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <FaCamera className="text-white w-8 h-8" />
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 pt-2">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{formData.name || 'Employee Name'}</h3>
              <p className="text-sm text-[#AD7F65] font-medium mb-4">{formData.role}</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Permissions:</label>
                  <div className="flex gap-2 flex-wrap">
                    {permissions.posTerminal && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        POS Terminal
                      </span>
                    )}
                    {permissions.inventory && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        Inventory
                      </span>
                    )}
                    {permissions.viewTransactions && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        View Transactions
                      </span>
                    )}
                    {permissions.generateReports && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        Generate Reports
                      </span>
                    )}
                    {!permissions.posTerminal && !permissions.inventory && !permissions.viewTransactions && !permissions.generateReports && (
                      <span className="text-xs text-gray-400 italic">No active permissions</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Status:</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border-none focus:ring-2 focus:ring-offset-1 focus:ring-[#AD7F65] cursor-pointer ${status === 'Active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                      }`}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Details Form */}
          <h4 className="text-base font-bold text-gray-800 mb-6">Personal Details</h4>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10">
            <div>
              <label className="text-sm font-medium text-gray-500 mb-1 block">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full text-base font-semibold text-gray-800 border-b border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 placeholder-gray-300"
                placeholder="Enter name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 mb-1 block">Contact number</label>
              <input
                type="text"
                name="contactNo"
                value={formData.contactNo}
                onChange={handleInputChange}
                className="w-full text-lg font-bold text-gray-800 border-b border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 placeholder-gray-300"
                placeholder="09123456789"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 mb-1 block">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full text-lg font-bold text-gray-800 border-b border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 placeholder-gray-300"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 mb-1 block">Date Joined</label>
              <input
                type="date"
                name="dateJoined"
                value={formData.dateJoined}
                onChange={handleInputChange}
                className="w-full text-lg font-bold text-gray-800 border-b border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-500 mb-1 block">Position</label>
              <div className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <span>Employee - </span>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="bg-transparent border-b border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 font-bold text-gray-800 cursor-pointer"
                >
                  {['Cashier', 'Sales Clerk', 'Manager', 'Supervisor'].map((role) => (
                    <option value={role} key={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Permissions Section */}
          <h4 className="text-base font-bold text-gray-800 mb-6">Permissions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[
              { label: 'POS Terminal', desc: 'Access to Point of Sale Terminal', key: 'posTerminal' },
              { label: 'Inventory', desc: 'Add, Edit, Delete Products', key: 'inventory' },
              { label: 'View Transactions', desc: 'View Sales History', key: 'viewTransactions' },
              { label: 'Generate Reports', desc: 'Create and Download Business Reports', key: 'generateReports' },
            ].map(({ label, desc, key }) => (
              <div key={key} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-[#AD7F65] transition-colors bg-white">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={permissions[key]}
                    onChange={() => handlePermissionToggle(key)}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#AD7F65] peer-focus:ring-2 peer-focus:ring-[#AD7F65]/20 transition-all"></div>
                  <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                </label>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {(error || message) && (
            <div
              className={`px-4 py-3 rounded-xl text-sm mb-6 ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}
            >
              {error || message}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-gray-200 font-bold text-gray-700 hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-8 py-2.5 rounded-lg text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                background: '#007AFF'
              }}
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EditEmployeeProfile;
