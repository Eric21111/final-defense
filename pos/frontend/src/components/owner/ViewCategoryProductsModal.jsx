import { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const ViewCategoryProductsModal = ({ isOpen, onClose, categoryName }) => {
  const { theme } = useTheme();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && categoryName) {
      fetchCategoryProducts();
    }
  }, [isOpen, categoryName]);

  const fetchCategoryProducts = async () => {
    if (!categoryName) return;

    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/products');
      const data = await response.json();

      if (data.success) {
        const categoryProducts = data.data.filter(product =>
          product.category === categoryName
        );
        setProducts(categoryProducts);
      }
    } catch (error) {
      console.error('Error fetching category products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !categoryName) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm">
      <div className={`rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'}`}>


        <div className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Products in {categoryName}</h2>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{products.length} product(s) found</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">Loading products...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">No products found in this category.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr
                    className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-[#3A3734] text-gray-200' : 'bg-[#EAE0D5] text-[#4A403A]'}`}
                  >
                    <th className="px-6 py-4 text-center font-bold">Image</th>
                    <th className="px-6 py-4 text-center font-bold">SKU</th>
                    <th className="px-6 py-4 text-left font-bold">Item Name</th>
                    <th className="px-6 py-4 text-center font-bold">Brand</th>
                    <th className="px-6 py-4 text-center font-bold">Variant</th>
                    <th className="px-6 py-4 text-center font-bold">Price</th>
                    <th className="px-6 py-4 text-center font-bold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product._id} className={`border-b transition-colors ${theme === 'dark' ? 'border-gray-800 hover:bg-[#2A2724]' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          {product.itemImage ? (
                            <img
                              src={product.itemImage}
                              alt={product.itemName}
                              className="w-12 h-12 object-cover rounded-lg shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs font-medium">
                              No img
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-center font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{product.sku}</td>
                      <td className={`px-6 py-4 text-left font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{product.itemName}</td>
                      <td className={`px-6 py-4 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{product.brandName || '-'}</td>
                      <td className={`px-6 py-4 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{product.variant || '-'}</td>
                      <td className={`px-6 py-4 text-center font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>PHP {(product.itemPrice || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <span
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold shadow-sm ${product.currentStock === 0
                              ? 'bg-[#FCA5A5] text-red-900'
                              : product.currentStock <= (product.reorderNumber || 10)
                                ? 'bg-[#FED7AA] text-orange-900'
                                : 'bg-[#86EFAC] text-green-900'
                              }`}
                          >
                            {product.currentStock || 0}
                          </span>
                        </div>
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

export default ViewCategoryProductsModal;
