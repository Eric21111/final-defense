import { useEffect, useState } from 'react';
import { FaEye, FaTimes } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const ViewBrandProductsModal = ({ isOpen, onClose, brandPartner, onEdit, onDelete }) => {
  const { theme } = useTheme();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && brandPartner) {
      fetchBrandProducts();
    }
  }, [isOpen, brandPartner]);

  const fetchBrandProducts = async () => {
    if (!brandPartner?.brandName) return;

    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/products');
      const data = await response.json();

      if (data.success) {
        // Filter products by brand name (matching brandName or supplierName)
        const brandProducts = data.data.filter(product =>
          product.brandName === brandPartner.brandName ||
          product.supplierName === brandPartner.brandName
        );
        setProducts(brandProducts);
      }
    } catch (error) {
      console.error('Error fetching brand products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !brandPartner) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm bg-black/30">
      <div className={`rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>

        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-[#8B5E3C]' : 'bg-[#AD7F65]'} text-white`}>
              <FaEye className="w-5 h-5" />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>View Products</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Brand Info Section */}
        <div className="px-8 pb-6 flex items-start gap-6">
          <div className="w-32 h-32 shrink-0">
            <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {brandPartner.logo ? (
                <img
                  src={brandPartner.logo}
                  alt={brandPartner.brandName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 text-4xl font-bold">
                  {brandPartner.brandName.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 pt-2">
            <h3 className={`text-3xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              {brandPartner.brandName}
            </h3>
            <div className={`space-y-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <div>Email: {brandPartner.email}</div>
              <div>Contact Person: {brandPartner.contactPerson}</div>
              <div>Contact Number: {brandPartner.contactNumber}</div>
            </div>
          </div>


        </div>

        {/* Product Table */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">Loading products...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">No products found for this brand.</div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className={`${theme === 'dark' ? 'bg-[#3A3734]' : 'bg-[#EADBC8]'}`}>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800 w-24">SKU</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">Item Name</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">Category</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">Variant</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">Item Price</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800 w-24">Stock</th>
                  </tr>
                </thead>
                <tbody className={`${theme === 'dark' ? 'bg-[#2A2724] divide-[#3A3734]' : 'bg-white divide-gray-100'} divide-y`}>
                  {products.map((product) => (
                    <tr key={product._id} className={`${theme === 'dark' ? 'hover:bg-[#3A3734]/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
                            {product.itemImage ? (
                              <img src={product.itemImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Img</div>
                            )}
                          </div>
                          <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{product.sku || '234TYP'}</span>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                        {product.itemName}
                      </td>
                      <td className={`px-6 py-4 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {product.category}
                      </td>
                      <td className={`px-6 py-4 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {product.variant || '-'}
                      </td>
                      <td className={`px-6 py-4 text-center text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                        PHP {(product.itemPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-bold ${(product.currentStock || 0) === 0
                            ? 'bg-red-200 text-red-800'
                            : (product.currentStock || 0) <= 10
                              ? 'bg-[#FCD8B6] text-[#C05621]'
                              : 'bg-green-100 text-green-800'
                            }`}
                        >
                          {product.currentStock || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewBrandProductsModal;

