import React from 'react';
import { FaTimes, FaTrash } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm">
      <div
        className={`rounded-2xl w-full max-w-md relative shadow-2xl ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 transition-colors z-10 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <FaTimes className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center relative"
              style={{
                backgroundColor: '#FFE5E5',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
              }}
            >
              <FaTrash
                className="text-3xl text-red-600"
                style={{
                  animation: 'trashShake 0.5s ease-out'
                }}
              />
              <style>{`
                @keyframes trashShake {
                  0% {
                    opacity: 0;
                    transform: scale(0) rotate(-10deg);
                  }
                  50% {
                    opacity: 1;
                    transform: scale(1.1) rotate(5deg);
                  }
                  100% {
                    opacity: 1;
                    transform: scale(1) rotate(0deg);
                  }
                }
              `}</style>
            </div>
          </div>

          <h3 className={`text-xl font-bold text-center mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            Are you sure you want to delete this item?
          </h3>

          <p className={`text-sm text-center mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            This action will be apply to the inventory.
          </p>

          <div className="flex gap-4">
            <button
              onClick={onConfirm}
              className="flex-1 py-3 px-6 rounded-lg font-bold text-white transition-all shadow-md hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #D4A59A 0%, #AD7F65 50%, #76462B 100%)'
              }}
            >
              Confirm
            </button>
            <button
              onClick={onClose}
              className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all shadow-sm ${theme === 'dark'
                ? 'bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]'
                : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;

