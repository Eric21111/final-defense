import {
  FaArchive,
  FaCalendar,
  FaEdit,
  FaEnvelope,
  FaPhone,
  FaTimes,
  FaUndo,
  FaUser } from
"react-icons/fa";
import defaultAvatar from "../../assets/default.jpeg";

const ViewEmployeeModal = ({
  isOpen,
  onClose,
  employee,
  onEdit,
  onResetPin,
  onToggleStatus
}) => {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm bg-black/20">
      <div
        className="bg-white w-full max-w-2xl relative shadow-2xl overflow-hidden animate-fadeIn"
        style={{ borderRadius: "24px" }}>
        
        {}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
              <FaUser className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Employee Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full">
            
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          {}
          <div className="flex items-start gap-8 mb-10">
            <div className="shrink-0 relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                <img
                  src={employee.image || defaultAvatar}
                  alt={employee.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = defaultAvatar;
                  }} />
                
              </div>
            </div>

            <div className="flex-1 pt-2">
              <h3 className="text-3xl font-bold text-gray-900 mb-1">
                {employee.name}
              </h3>
              <p className="text-[#AD7F65] font-medium mb-4">{employee.role}</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Permissions:
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {employee.permissions?.posTerminal &&
                    <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        POS Terminal
                      </span>
                    }
                    {employee.permissions?.inventory &&
                    <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        Inventory
                      </span>
                    }
                    {employee.permissions?.viewTransactions &&
                    <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        View Transactions
                      </span>
                    }
                    {employee.permissions?.generateReports &&
                    <span className="px-3 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] text-gray-600 bg-gray-50">
                        Generate Reports
                      </span>
                    }
                    {!employee.permissions?.posTerminal && !employee.permissions?.inventory && !employee.permissions?.viewTransactions && !employee.permissions?.generateReports &&
                    <span className="text-xs text-gray-400 italic">No active permissions</span>
                    }
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Status:
                  </label>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    employee.status === "Active" ?
                    "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-700"}`
                    }>
                    
                    {employee.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {}
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 mb-10">
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">Name</p>
              <p className="text-lg font-bold text-gray-800">{employee.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">
                Contact number
              </p>
              <div className="flex items-center gap-2 text-gray-800 font-bold text-lg">
                <FaPhone className="w-4 h-4 text-gray-400" />
                {employee.contactNumber || "N/A"}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">Email</p>
              <div className="flex items-center gap-2 text-gray-800 font-bold text-lg truncate">
                <FaEnvelope className="w-4 h-4 text-gray-400" />
                {employee.email || "N/A"}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">
                Date Joined
              </p>
              <div className="flex items-center gap-2 text-gray-800 font-bold text-lg">
                <FaCalendar className="w-4 h-4 text-gray-400" />
                {(() => {
                  const dateValue =
                  employee.dateJoinedActual ||
                  employee.dateJoined ||
                  employee.createdAt;
                  return dateValue ?
                  new Date(dateValue).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric"
                  }) :
                  "N/A";
                })()}
              </div>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-medium text-gray-400 mb-1">Position</p>
              <p className="text-lg font-bold text-gray-800">
                Employee - {employee.role}
              </p>
            </div>
          </div>

          {}
          <div className="flex justify-end items-center gap-3 pt-6 border-t border-gray-100">
            {employee.role !== "Owner" &&
            <>
                <button
                onClick={onResetPin}
                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-bold text-sm hover:bg-blue-200 transition-colors">
                
                  Reset PIN
                </button>
                <button
                onClick={onEdit}
                className="w-10 h-10 flex items-center justify-center bg-[#007AFF] text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                title="Edit">
                
                  <FaEdit className="w-4 h-4" />
                </button>
                <button
                onClick={onToggleStatus}
                className={`w-10 h-10 flex items-center justify-center rounded-lg text-white hover:opacity-90 transition-colors shadow-sm ${employee.status === "Active" ? "bg-[#FFA500]" : "bg-[#10B981]"}`}
                title={employee.status === "Active" ? "Archive" : "Restore"}>
                
                  {employee.status === "Active" ?
                <FaArchive className="w-4 h-4" /> :

                <FaUndo className="w-4 h-4" />
                }
                </button>
              </>
            }
          </div>
        </div>
      </div>
    </div>);

};

export default ViewEmployeeModal;