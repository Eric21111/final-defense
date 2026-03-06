import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const { theme } = useTheme();

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-center mt-6">
      <div className={`rounded-lg shadow-md px-6 py-3 flex items-center gap-4 ${theme === 'dark' ? 'bg-[#2A2724] border border-[#4A4037]' : 'bg-white'}`}>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`transition-colors ${currentPage === 1
            ? (theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
            : (theme === 'dark' ? 'text-gray-400 hover:text-white cursor-pointer' : 'text-gray-700 hover:text-gray-900 cursor-pointer')
            }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>


        <div className="flex items-center gap-3">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-900'}>
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`${currentPage === page
                  ? (theme === 'dark' ? 'bg-[#AD7F65] text-white shadow-md' : 'bg-[#DDC9BC] text-gray-900 rounded shadow-sm')
                  : (theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-900 hover:text-gray-700')
                  } w-8 h-8 flex items-center justify-center font-medium rounded transition-colors`}
              >
                {page}
              </button>
            );
          })}
        </div>


        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`transition-colors ${currentPage === totalPages
            ? (theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
            : (theme === 'dark' ? 'text-gray-400 hover:text-white cursor-pointer' : 'text-gray-700 hover:text-gray-900 cursor-pointer')
            }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
