import { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const DeleteBrandPartnerModal = ({ isOpen, onClose, onSuccess, brandPartner }) => {
    const { theme } = useTheme();
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !brandPartner) return null;

    const handleDelete = async () => {
        setDeleting(true);
        setError('');

        try {
            const response = await fetch(`http://localhost:5000/api/brand-partners/${brandPartner._id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to delete brand partner.');
            }

            onSuccess?.(brandPartner._id);
            onClose();
        } catch (err) {
            console.error('Failed to delete brand partner:', err);
            setError(err.message || 'Failed to delete brand partner.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`rounded-xl w-full max-w-md relative shadow-2xl p-6 flex flex-col items-center text-center ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <FaExclamationTriangle className="w-8 h-8 text-red-600" />
                </div>

                <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Delete Brand Partner?
                </h2>

                <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Are you sure you want to delete <strong>{brandPartner.brandName}</strong>? This action cannot be undone and will remove all associated products.
                </p>

                {error && (
                    <div className="w-full text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 w-full">
                    <button
                        onClick={onClose}
                        className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        disabled={deleting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2.5 rounded-lg text-white font-medium bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-70"
                    >
                        {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteBrandPartnerModal;
