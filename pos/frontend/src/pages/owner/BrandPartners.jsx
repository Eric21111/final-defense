import { memo, useEffect, useState } from 'react';
import { FaArchive, FaEdit, FaPlus, FaSearch, FaUndo } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import AddBrandPartnerModal from '../../components/owner/AddBrandPartnerModal';
import ArchiveBrandPartnerModal from '../../components/owner/ArchiveBrandPartnerModal';
import EditBrandPartnerModal from '../../components/owner/EditBrandPartnerModal';
import ViewBrandProductsModal from '../../components/owner/ViewBrandProductsModal';
import Header from '../../components/shared/header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const BrandPartners = () => {
  const { isOwner } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [brandPartners, setBrandPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchBrandPartners = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/brand-partners');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load brand partners.');
      }

      setBrandPartners(data.data || []);
      setFetchError('');
    } catch (error) {
      console.error('Error fetching brand partners:', error);
      setFetchError(error.message || 'Failed to load brand partners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrandPartners();
  }, []);

  const filteredBrandPartners = brandPartners.filter(brand => {
    const matchesSearch = brand.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && brand.status === filterStatus;
  });

  return (
    <div className={`p-8 min-h-screen ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-50'}`}>
      <Header pageName="Brand Partners" showBorder={false} />

      <div className="flex items-center justify-between mb-6 mt-10">
        <div className="flex items-center gap-4">
          <div className="relative" style={{ width: '450px' }}>
            <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-12 h-9 flex items-center justify-center text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
              <FaSearch className="text-sm" />
            </div>
            <input
              type="text"
              placeholder="Search For..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-10 pl-16 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === 'dark'
                ? 'bg-[#2A2724] border-[#4A4037] text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900'
                }`}
            />
          </div>

          <div className="flex gap-3 ml-4">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'all'
                ? 'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]'
                : 'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'active'
                ? 'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]'
                : 'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('archived')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'archived'
                ? 'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]'
                : 'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'
                }`}
            >
              Archived
            </button>
          </div>

        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
        >
          <FaPlus className="w-4 h-4" />
          Add Brand Partner
        </button>
      </div>

      {fetchError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-100 text-sm">
          {fetchError}
        </div>
      )}

      {loading && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-white shadow text-gray-500">
          Loading brand partners...
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {!loading && filteredBrandPartners.length === 0 && (
          <div className="col-span-3">
            <div className={`rounded-2xl border border-dashed p-10 text-center ${theme === 'dark'
              ? 'bg-[#2A2724] border-[#4A4037] text-gray-400'
              : 'bg-white border-gray-200 text-gray-500'
              }`}>
              No brand partners found. Add your first brand partner to get started.
            </div>
          </div>
        )}

        {filteredBrandPartners.map((brand) => (
          <div
            key={brand._id || brand.id}
            className={`rounded-xl shadow-md p-4 flex flex-col justify-between relative ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'} ${brand.status === 'archived' ? 'grayscale opacity-70' : ''}`}
            style={{ minHeight: 'auto' }}
          >


            <div className="flex items-start gap-3">
              <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden bg-gray-200">
                {brand.logo ? (
                  <img
                    src={brand.logo}
                    alt={brand.brandName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#AD7F65] to-[#76462B] text-white text-xl font-bold">
                    {brand.brandName.charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex-1 pt-1">
                <h3 className={`text-lg font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {brand.brandName}
                </h3>
                <div className={`space-y-0.5 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  <div><span className="opacity-70">Email:</span> {brand.email}</div>
                  <div><span className="opacity-70">Contact Person:</span> {brand.contactPerson || '-'}</div>
                  <div><span className="opacity-70">Contact Number:</span> {brand.contactNumber || '-'}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 justify-end">
              <button
                onClick={() => {
                  setSelectedBrand(brand);
                  setShowViewModal(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
              >
                View Products
              </button>

              <button
                onClick={() => {
                  setSelectedBrand(brand);
                  setShowEditModal(true);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#007AFF] text-white hover:bg-blue-600 transition-colors shadow-sm"
              >
                <FaEdit className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setSelectedBrand(brand);
                  setShowArchiveModal(true);
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-white transition-colors shadow-sm ${brand.status === 'archived'
                  ? 'bg-[#10B981] hover:bg-green-600'
                  : 'bg-[#FFA500] hover:bg-orange-500'
                  }`}
                title={brand.status === 'archived' ? 'Unarchive' : 'Archive'}
              >
                {brand.status === 'archived' ? <FaUndo className="w-3.5 h-3.5" /> : <FaArchive className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ViewBrandProductsModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedBrand(null);
        }}
        brandPartner={selectedBrand}
        onEdit={(brand) => {
          setSelectedBrand(brand);
          // Keep View Modal open or close it? Depending on UX.
          // Let's close View Modal for now to avoid z-index issues or clutter
          // Or keep it open if we want to return to it.
          // For simplicity, let's close view modal to edit.
          setShowViewModal(false);
          setShowEditModal(true);
        }}
        onDelete={(brand) => {
          setSelectedBrand(brand);
          setShowViewModal(false);
          setShowArchiveModal(true);
        }}
      />
      <AddBrandPartnerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(newBrand) => {
          setBrandPartners((prev) => [newBrand, ...prev]);
        }}
      />
      <EditBrandPartnerModal
        isOpen={showEditModal}
        brandPartner={selectedBrand}
        onClose={() => {
          setShowEditModal(false);
          setSelectedBrand(null);
        }}
        onSuccess={(updatedBrand) => {
          setBrandPartners((prev) =>
            prev.map(b => b._id === updatedBrand._id ? updatedBrand : b)
          );
          // Optionally reopen view modal with updated data
          setSelectedBrand(updatedBrand);
          setShowViewModal(true);
        }}
      />
      <ArchiveBrandPartnerModal
        isOpen={showArchiveModal}
        brandPartner={selectedBrand}
        onClose={() => {
          setShowArchiveModal(false);
          setSelectedBrand(null);
        }}
        onSuccess={(updatedBrand) => {
          // Update the brand in the list instead of removing it
          setBrandPartners((prev) =>
            prev.map(b => b._id === updatedBrand._id ? updatedBrand : b)
          );
        }}
      />
    </div>
  );
};

export default memo(BrandPartners);

