import React from 'react';
import { FaTimes, FaArchive } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const ArchiveConfirmationModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm">
            <div
        className={`rounded-2xl w-full max-w-md relative shadow-2xl ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
                <button
          onClick={onClose}
          className={`absolute top-4 right-4 transition-colors z-10 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>
          
                    <FaTimes className="w-5 h-5" />
                </button>

                <div className="p-8">
                    <div className="flex justify-center mb-6">
                        <div
              className="w-20 h-20 rounded-full flex items-center justify-center relative"
              style={{
                backgroundColor: theme === 'dark' ? '#352F2A' : '#F3F4F6'
              }}>
              
                            <FaArchive
                className={`text-3xl ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} />
              
                        </div>
                    </div>

                    <h3 className={`text-xl font-bold text-center mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        Are you sure you want to archive this item?
                    </h3>

                    <p className={`text-sm text-center mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        This action will hide the item from the active inventory.
                        <br />
                        Item: <span className="font-semibold">{itemName}</span>
                    </p>

                    <div className="flex gap-4">
                        <button
              onClick={onConfirm}
              className="flex-1 py-2.5 px-6 rounded-lg font-bold text-white transition-all shadow-md hover:opacity-90 disabled:opacity-50"
              style={{
                background: '#F29800'
              }}>
              
                            Confirm
                        </button>
                        <button
              onClick={onClose}
              className={`flex-1 py-2.5 px-6 rounded-lg font-bold transition-all shadow-sm ${theme === 'dark' ?
              'bg-[#E6E6E6] text-gray-700 hover:opacity-90' :
              'text-gray-700 bg-[#E6E6E6] hover:opacity-90'}`
              }>
              
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>);

};

export default ArchiveConfirmationModal;