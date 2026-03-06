import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function CategoryButtons({
  categories = [],
  selectedCategory,
  onSelect,
  size = 'md'
}) {
  const { theme } = useTheme();

  return (
    <div className="flex gap-3 flex-wrap">
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.name;
        return (
          <button
            key={cat.name}
            onClick={() => onSelect(cat.name)}
            className={`px-4 py-2 rounded-lg transition-all font-medium text-sm ${isActive
              ? 'text-white shadow-md'
              : theme === 'dark'
                ? 'bg-[#1E1B18] text-gray-300 hover:bg-[#2A2724] border border-gray-700'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)'
                : undefined
            }}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}


