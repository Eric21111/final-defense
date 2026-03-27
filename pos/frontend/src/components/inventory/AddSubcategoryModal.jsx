import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

const AddSubcategoryModal = ({ show, parentCategory, onClose, onAdd }) => {
  const { theme } = useTheme();
  const [newSubcategory, setNewSubcategory] = useState('');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newSubcategory.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newSubcategory,
          type: 'subcategory',
          parentCategory: parentCategory
        })
      });

      const data = await response.json();

      if (data.success) {
        onAdd(newSubcategory);
        setNewSubcategory('');
        onClose();
      } else {
        alert(data.message || 'Failed to add subcategory');
      }
    } catch (error) {
      console.error('Error adding subcategory:', error);
      alert('Failed to add subcategory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-10000 p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
            <div className={`rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100 opacity-100 ${theme === 'dark' ? 'bg-[#2A2724] text-white' : 'bg-white'}`}>
                <h2 className="text-2xl font-bold mb-6">Add Subcategory</h2>

                {parentCategory && (
                  <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Parent Category: <span className="font-semibold">{parentCategory}</span>
                  </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            Subcategory Name
                        </label>
                        <input
              type="text"
              value={newSubcategory}
              onChange={(e) => setNewSubcategory(e.target.value)}
              placeholder="Enter subcategory name"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent transition-all ${theme === 'dark' ?
              'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300' :
              'border-gray-300'}`}
              autoFocus />
            
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${theme === 'dark' ?
              'bg-gray-700 text-gray-300 hover:bg-gray-600' :
              'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              
                            Cancel
                        </button>
                        <button
              type="submit"
              disabled={loading || !newSubcategory.trim()}
              className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg">
              
                            {loading ? 'Adding...' : 'Add Subcategory'}
                        </button>
                    </div>
                </form>
            </div>
        </div>);

};

export default AddSubcategoryModal;
