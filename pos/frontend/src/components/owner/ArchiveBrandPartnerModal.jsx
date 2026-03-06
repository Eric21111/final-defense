import { useState } from 'react';
import { FaArchive, FaUndo } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const ArchiveBrandPartnerModal = ({ isOpen, onClose, onSuccess, brandPartner }) => {
    const { theme } = useTheme();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !brandPartner) return null;

    const isArchived = brandPartner.status === 'archived';

    const handleToggleStatus = async () => {
        setProcessing(true);
        setError('');

        try {
            const response = await fetch(`http://localhost:5000/api/brand-partners/${brandPartner._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: isArchived ? 'active' : 'archived'
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || `Failed to ${isArchived ? 'unarchive' : 'archive'} brand partner.`);
            }

            onSuccess?.(data.data);
            onClose();
        } catch (err) {
            console.error(`Failed to ${isArchived ? 'unarchive' : 'archive'} brand partner:`, err);
            setError(err.message || `Failed to ${isArchived ? 'unarchive' : 'archive'} brand partner.`);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`rounded-xl w-full max-w-md relative shadow-2xl p-6 flex flex-col items-center text-center ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isArchived ? 'bg-green-100' : 'bg-orange-100'}`}>
                    {isArchived ? (
                        <FaUndo className="w-8 h-8 text-green-600" />
                    ) : (
                        <FaArchive className="w-8 h-8 text-orange-600" />
                    )}
                </div>

                <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {isArchived ? 'Unarchive Brand Partner?' : 'Archive Brand Partner?'}
                </h2>

                <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {isArchived
                        ? <span>Are you sure you want to restore <strong>{brandPartner.brandName}</strong>? This will make the brand active again.</span>
                        : <span>Are you sure you want to archive <strong>{brandPartner.brandName}</strong>? This will hide the brand from active lists.</span>
                    }
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
                        disabled={processing}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleToggleStatus}
                        disabled={processing}
                        className={`flex-1 py-2.5 rounded-lg text-white font-medium transition-colors disabled:opacity-70 ${isArchived ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'
                            }`}
                    >
                        {processing ? (isArchived ? 'Unarchiving...' : 'Archiving...') : (isArchived ? 'Unarchive' : 'Archive')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArchiveBrandPartnerModal;
