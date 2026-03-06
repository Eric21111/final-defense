import React from 'react';
import { FaTimes, FaCheck } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const SuccessModal = ({ isOpen, onClose, message = "The item was added successfully!" }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10001] p-4 backdrop-blur-sm">
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
                backgroundColor: '#D4EDDA',
                boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
              }}
            >
              <FaCheck
                className="text-4xl text-green-600"
                style={{
                  animation: 'checkmarkAnimation 0.6s ease-out'
                }}
              />
              <style>{`
                @keyframes checkmarkAnimation {
                  0% {
                    opacity: 0;
                    transform: scale(0) rotate(-45deg);
                  }
                  50% {
                    opacity: 1;
                    transform: scale(1.2) rotate(5deg);
                  }
                  100% {
                    opacity: 1;
                    transform: scale(1) rotate(0deg);
                  }
                }
              `}</style>
            </div>
          </div>

          <h3 className={`text-2xl font-bold text-center mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            Success!
          </h3>

          <p className={`text-sm text-center mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            {message}
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 px-6 rounded-lg font-bold text-white transition-all shadow-md hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)'
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;

