import { memo, useEffect, useState } from "react";
import {
  FaEdit,
  FaEllipsisV,
  FaPlus,
  FaSearch,
  FaTrash,
  FaUndo } from
"react-icons/fa";
import defaultAvatar from "../../assets/default.jpeg";
import Pagination from "../../components/inventory/Pagination";
import SuccessModal from "../../components/inventory/SuccessModal";
import AddEmployeeModal from "../../components/owner/AddEmployeeModal";
import DeleteEmployeeModal from "../../components/owner/DeleteEmployeeModal";
import DisableAccountModal from "../../components/owner/DisableAccountModal";
import EditEmployeeModal from "../../components/owner/EditEmployeeModal";
import ResetPinConfirmModal from "../../components/owner/ResetPinConfirmModal";
import TemporaryPinModal from "../../components/owner/TemporaryPinModal";
import ViewEmployeeModal from "../../components/owner/ViewEmployeeModal";
import Header from "../../components/shared/header";
import { useTheme } from "../../context/ThemeContext";

const ManageEmployees = () => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("All");
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [togglingEmployee, setTogglingEmployee] = useState(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [toggleAction, setToggleAction] = useState("disable");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [resettingEmployee, setResettingEmployee] = useState(null);
  const [showTempPinModal, setShowTempPinModal] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeePin, setNewEmployeePin] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest(".dropdown-container")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineEmployeeIds, setOnlineEmployeeIds] = useState(new Set());
  const itemsPerPage = 12;


  const fetchOnlineEmployees = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/employees/online");
      const data = await response.json();

      if (data?.success && Array.isArray(data?.data)) {
        setOnlineEmployeeIds(new Set(data.data.map((emp) => emp._id)));
        return;
      }

      // Fallback if backend returns a plain array
      if (Array.isArray(data)) {
        setOnlineEmployeeIds(new Set(data.map((emp) => emp._id)));
      }
    } catch (err) {
      // Non-blocking; online status is best-effort UI only
      console.error("Error fetching online employees:", err);
      setOnlineEmployeeIds(new Set());
    }
  };

  const fetchEmployees = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await fetch("http://localhost:5000/api/employees");
      const data = await response.json();

      if (data.success) {

        const timestamp = new Date().getTime();
        const employeesWithImages = data.data.map((emp) => ({
          ...emp,
          image: `http://localhost:5000/api/employees/${emp._id}/image?t=${timestamp}`,
          id: emp._id,
          contactNumber: emp.contactNo || emp.contactNumber || ''
        }));
        setEmployees(employeesWithImages);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      alert(
        "Failed to fetch employees. Make sure the backend server is running."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchOnlineEmployees();
    const t = setInterval(fetchOnlineEmployees, 30000);
    return () => clearInterval(t);
  }, []);

  const filteredEmployees = employees.filter((employee) => {

    const matchesSearch =
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.role &&
    employee.role.toLowerCase().includes(searchQuery.toLowerCase());


    let matchesStatus = true;
    if (filterStatus === "Active") matchesStatus = employee.status === "Active";
    if (filterStatus === "Archived")
    matchesStatus = employee.status === "Inactive";

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleViewEmployee = (employee) => {
    setViewingEmployee(employee);
    setShowViewModal(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowEditModal(true);
  };

  const generateRandomPin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleResetPin = (employee) => {
    setResettingEmployee(employee);
    setShowResetPinModal(true);
  };

  const confirmResetPin = async () => {
    if (!resettingEmployee) return;

    setShowResetPinModal(false);

    try {

      const response = await fetch(
        `http://localhost:5000/api/employees/${resettingEmployee._id || resettingEmployee.id}/send-temporary-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      );

      const data = await response.json();

      if (data.success) {
        setResettingEmployee(null);
        if (data.emailSent) {
          setSuccessMessage(
            `A new temporary PIN has been emailed to ${resettingEmployee.email}.`
          );
        } else {
          setSuccessMessage(
            `Temporary PIN generated: ${data.tempPin}. Email could not be sent - please share this PIN manually.`
          );
        }
        setShowSuccessModal(true);

        fetchEmployees(false);
      } else {
        alert(data.message || "Failed to reset PIN");
      }
    } catch (error) {
      console.error("Error resetting PIN:", error);
      alert("Failed to reset PIN. Please try again.");
    }
  };

  const handleToggleStatus = (employee) => {
    setTogglingEmployee(employee);
    const action = employee.status === "Active" ? "disable" : "enable";
    setToggleAction(action);
    setShowDisableModal(true);
  };

  const confirmToggleStatus = async () => {
    if (!togglingEmployee) return;

    const newStatus =
    togglingEmployee.status === "Active" ? "Inactive" : "Active";
    const employeeName = togglingEmployee.name;

    try {
      const response = await fetch(
        `http://localhost:5000/api/employees/${togglingEmployee._id || togglingEmployee.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        }
      );

      const data = await response.json();

      if (data.success) {
        setShowDisableModal(false);
        setTogglingEmployee(null);


        const actionPastTense =
        toggleAction === "disable" ? "disabled" : "enabled";
        setSuccessMessage(
          `${employeeName}'s account has been ${actionPastTense} successfully!`
        );
        setShowSuccessModal(true);

        fetchEmployees(false);
      } else {
        alert(data.message || `Failed to ${toggleAction} account`);
      }
    } catch (error) {
      console.error(`Error ${toggleAction}ing account:`, error);
      alert(`Failed to ${toggleAction} account. Please try again.`);
    }
  };

  const handleDeleteEmployee = (employee) => {
    setDeletingEmployee(employee);
    setShowDeleteModal(true);
  };

  const confirmDeleteEmployee = async () => {
    if (!deletingEmployee) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/employees/${deletingEmployee._id || deletingEmployee.id}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (data.success) {

        fetchEmployees(false);
        setShowDeleteModal(false);
        setDeletingEmployee(null);
      } else {
        alert(data.message || "Failed to delete employee");
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("Failed to delete employee. Please try again.");
    }
  };

  return (
    <div className="p-8 min-h-screen">
      <Header
        pageName="Manage Employees"
        profileBackground="bg-gray-100"
        showBorder={false} />
      

      <div className="mt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative" style={{ width: "450px" }}>
              <div
                className="absolute left-1 top-1/2 transform -translate-y-1/2 w-12 h-9 flex items-center justify-center text-white rounded-lg"
                style={{
                  background:
                  "linear-gradient(135deg, #AD7F65 0%, #76462B 100%)"
                }}>
                
                <FaSearch className="text-sm" />
              </div>
              <input
                type="text"
                placeholder="Search For..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-10 pl-16 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ?
                "bg-[#2A2724] border-[#4A4037] text-white placeholder-gray-500" :
                "bg-white border-gray-300 text-gray-900"}`
                } />
              
            </div>

            <div className="flex gap-3 ml-4">
              <button
                onClick={() => setFilterStatus("All")}
                className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === "All" ?
                "bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]" :
                "bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50"}`
                }>
                
                All
              </button>
              <button
                onClick={() => setFilterStatus("Active")}
                className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === "Active" ?
                "bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]" :
                "bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50"}`
                }>
                
                Active
              </button>
              <button
                onClick={() => setFilterStatus("Archived")}
                className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === "Archived" ?
                "bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]" :
                "bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50"}`
                }>
                
                Archived
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)"
            }}>
            
            <FaPlus className="w-4 h-4" />
            Add Employee
          </button>
        </div>

        {loading ?
        <div className="flex justify-center items-center py-12">
            <div
            className={theme === "dark" ? "text-gray-400" : "text-gray-500"}>
            
              Loading employees...
            </div>
          </div> :
        employees.length === 0 ?
        <div
          className={`flex flex-col items-center justify-center py-20 rounded-2xl shadow-inner border border-dashed ${theme === "dark" ?
          "bg-[#2A2724] border-gray-600" :
          "bg-white border-gray-300"}`
          }>
          
            <p
            className={`text-2xl font-semibold mb-3 ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`
            }>
            
              No accounts yet
            </p>
            <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md"
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)"
            }}>
            
              + Add Your First Employee
            </button>
          </div> :

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-4">
            {paginatedEmployees.map((employee) =>
          <div
            key={employee.id}
            className={`rounded-xl shadow-md p-4 flex gap-4 items-center relative transition-all ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"} ${employee.status !== "Active" ? "opacity-50 grayscale" : ""}`}>
            
                {}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200">
                    <img
                  src={employee.image}
                  alt={employee.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = defaultAvatar;
                  }}
                  className="w-full h-full object-cover" />
                
                  </div>
                  <div
                className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white ${
                  employee.status !== "Active"
                    ? "bg-gray-400"
                    : employee.role === "Owner"
                      ? employee.isOnline
                        ? "bg-green-500"
                        : "bg-red-500"
                      : onlineEmployeeIds.has(employee.id)
                        ? "bg-green-500"
                        : "bg-red-500"
                }`
                }>
              </div>
                </div>

                {}
                {employee.role !== "Owner" &&
            <div className="absolute top-2 right-2 dropdown-container">
                    <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(
                    openDropdown === employee.id ? null : employee.id
                  );
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shadow-sm ${theme === "dark" ? "bg-[#3A3734] text-gray-300 hover:bg-[#4A4744]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                title="More Options">
                
                      <FaEllipsisV className="w-3.5 h-3.5" />
                    </button>

                    {openDropdown === employee.id &&
              <div
                className={`absolute right-0 top-full mt-1 w-32 rounded-lg shadow-lg border z-20 ${theme === "dark" ? "bg-[#2A2724] border-gray-600" : "bg-white border-gray-200"}`}>
                
                        <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetPin(employee);
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 transition-colors ${theme === "dark" ? "text-gray-300 hover:bg-white" : "text-gray-700 hover:bg-black"}`}>
                  
                          Reset PIN
                        </button>
                      </div>
              }
                  </div>
            }

                {}
                <div className="flex-1 min-w-0 flex flex-col justify-between h-full gap-2">
                  <div>
                    <h3
                  className={`font-bold text-lg leading-tight truncate ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  
                      {employee.name}
                    </h3>
                    <p
                  className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  
                      {employee.role}
                    </p>
                    {employee.contactNumber &&
                <p
                  className={`text-xs mt-1 flex items-center gap-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                  
                        📞 {employee.contactNumber}
                      </p>
                }
                    {(employee.dateJoinedActual ||
                employee.dateJoined ||
                employee.createdAt) &&
                <p
                  className={`text-xs flex items-center gap-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                  
                          📅{" "}
                          {new Date(
                    employee.dateJoinedActual ||
                    employee.dateJoined ||
                    employee.createdAt
                  ).toLocaleDateString()}
                        </p>
                }
                  </div>

                  {employee.role !== "Owner" &&
              <div className="flex items-center gap-2 mt-1 dropdown-container relative">
                      {}
                      <button
                  onClick={() => handleViewEmployee(employee)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm flex-1 text-center bg-gray-200 text-gray-700 hover:bg-gray-300`}>
                  
                        View
                      </button>

                      {}
                      <button
                  onClick={() => handleEditEmployee(employee)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#007AFF] text-white hover:bg-blue-600 transition-colors shadow-sm"
                  title="Edit Details">
                  
                        <FaEdit className="w-3.5 h-3.5" />
                      </button>

                      {}
                      <button
                  onClick={() => handleToggleStatus(employee)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-white hover:opacity-90 transition-colors shadow-sm ${employee.status === "Active" ?
                  "bg-[#FFA500]" :
                  "bg-[#10B981]"}`
                  }
                  title={
                  employee.status === "Active" ?
                  "Disable Account" :
                  "Enable Account"
                  }>
                  
                        {employee.status === "Active" ?
                  <FaTrash className="w-3.5 h-3.5" /> :

                  <FaUndo className="w-3.5 h-3.5" />
                  }
                      </button>
                    </div>
              }

                  {employee.role === "Owner" &&
              <div className="mt-2">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                        Owner Access
                      </span>
                    </div>
              }
                </div>
              </div>
          )}
          </div>
        }

        {totalPages > 1 &&
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage} />

        }
      </div>

      <ViewEmployeeModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingEmployee(null);
        }}
        employee={viewingEmployee}
        onEdit={() => {
          setShowViewModal(false);
          handleEditEmployee(viewingEmployee);
        }}
        onResetPin={() => {
          setShowViewModal(false);
          handleResetPin(viewingEmployee);
        }}
        onToggleStatus={() => {
          setShowViewModal(false);
          handleToggleStatus(viewingEmployee);
        }} />
      

      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEmployee(null);
        }}
        employee={editingEmployee}
        onEmployeeUpdated={() => fetchEmployees(false)} />
      

      <DeleteEmployeeModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingEmployee(null);
        }}
        onConfirm={confirmDeleteEmployee}
        employee={deletingEmployee} />
      

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
        }}
        onEmployeeAdded={() => fetchEmployees(false)}
        onEmployeeCreated={(name, pin) => {
          setNewEmployeeName(name);
          setNewEmployeePin(pin);
          setShowTempPinModal(true);
        }} />
      

      <DisableAccountModal
        isOpen={showDisableModal}
        onClose={() => {
          setShowDisableModal(false);
          setTogglingEmployee(null);
        }}
        onConfirm={confirmToggleStatus}
        employee={togglingEmployee}
        action={toggleAction} />
      

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage} />
      

      <ResetPinConfirmModal
        isOpen={showResetPinModal}
        onClose={() => {
          setShowResetPinModal(false);
          setResettingEmployee(null);
        }}
        onConfirm={confirmResetPin}
        employeeName={resettingEmployee?.name || ""} />
      

      <TemporaryPinModal
        isOpen={showTempPinModal}
        onClose={() => {
          setShowTempPinModal(false);
          setNewEmployeeName("");
          setNewEmployeePin("");
        }}
        employeeName={newEmployeeName}
        temporaryPin={newEmployeePin} />
      
    </div>);

};

export default memo(ManageEmployees);