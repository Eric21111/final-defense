import { FaTimes, FaTrash } from 'react-icons/fa';

const DeleteEmployeeModal = ({ isOpen, onClose, onConfirm, employee }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10003] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <FaTimes className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <FaTrash className="w-10 h-10 text-red-600" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
            Are you sure you want to delete Account?
          </h2>

          <p className="text-sm text-gray-500 text-center mb-8">
            This action can not be undone
          </p>

          <div className="flex gap-4">
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-all shadow-md"
              style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}
            >
              Confirm
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all font-medium shadow-md"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteEmployeeModal;

