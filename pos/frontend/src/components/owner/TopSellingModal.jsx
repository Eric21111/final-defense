import { FaTimes } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const TopSellingModal = ({ isOpen, onClose, products, timeframe }) => {
    const { theme } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm">
            <div className={`rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'}`}>

                <div className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div>
                        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Top Selling Products</h2>
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            Top Performing items this {timeframe.toLowerCase()}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <FaTimes className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {products.length === 0 ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="text-gray-500">No top selling products found.</div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {products.map((product, index) => (
                                <div
                                    key={product.productId}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${theme === 'dark' ? 'bg-[#2A2724] border border-gray-700' : 'bg-gray-50 border border-gray-100'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-[#AD7F65] text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                                            {index + 1}
                                        </div>
                                        <div
                                            className={`w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                                        >
                                            {product.itemImage ? (
                                                <img
                                                    src={product.itemImage}
                                                    alt={product.itemName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                                                    img
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p
                                                className={`text-base font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}
                                            >
                                                {product.itemName}
                                            </p>
                                            <p className="text-sm font-medium text-[#AD7F65]">
                                                {product.totalQuantitySold} Sold
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-green-600">
                                            PHP {product.totalRevenue.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopSellingModal;
