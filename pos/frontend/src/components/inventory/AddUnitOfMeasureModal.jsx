import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const AddUnitOfMeasureModal = ({ show, onClose, onAdd }) => {
  const { theme } = useTheme();
  const [newUnit, setNewUnit] = useState("");

  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = String(newUnit || "").trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewUnit("");
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
      <div className={`rounded-2xl w-full max-w-md p-6 shadow-2xl ${theme === "dark" ? "bg-[#2A2724] text-white" : "bg-white"}`}>
        <h2 className="text-2xl font-bold mb-6">Add Unit of Measure</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
              Unit Name
            </label>
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="e.g Tray, Set, Pair"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent transition-all ${
                theme === "dark"
                  ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300"
                  : "border-gray-300"
              }`}
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${
                theme === "dark"
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newUnit.trim()}
              className="px-6 py-2.5 rounded-xl bg-[#09A046] text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              Add Unit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUnitOfMeasureModal;
