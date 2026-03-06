import { memo, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import bgImage from "../assets/bg.png";
import defaultAvatar from "../assets/default.jpeg";
import logo from "../assets/logo.png";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { validatePinSecurity } from "../utils/pinValidation";

const PIN_LENGTH = 6;
const EMPTY_PIN = Array(PIN_LENGTH).fill("");

const SetNewPin = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, login } = useAuth();
  const employee = location.state?.employee || currentUser;
  const [pendingTempData, setPendingTempData] = useState(() => {
    if (location.state?.tempPin && location.state?.employee?._id) {
      const payload = {
        pin: location.state.tempPin,
        employeeId: location.state.employee._id,
      };
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("pendingTempPin", JSON.stringify(payload));
        } catch (storageError) {
          console.warn("Unable to persist temporary PIN", storageError);
        }
      }
      return payload;
    }
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("pendingTempPin");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          sessionStorage.removeItem("pendingTempPin");
        }
      }
    }
    return null;
  });
  const pendingTempPin = pendingTempData?.pin || "";
  const pendingEmployeeId = pendingTempData?.employeeId || null;

  const [newPinDigits, setNewPinDigits] = useState(EMPTY_PIN);
  const [confirmPinDigits, setConfirmPinDigits] = useState(EMPTY_PIN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pinUpdated, setPinUpdated] = useState(false);

  const newPinRefs = useRef([]);
  const confirmPinRefs = useRef([]);

  useEffect(() => {
    if (!employee) {
      navigate("/");
    } else if (!employee.requiresPinReset) {
      navigate("/dashboard");
    }
  }, [employee, navigate]);

  useEffect(() => {
    if (location.state?.tempPin && location.state?.employee?._id) {
      const payload = {
        pin: location.state.tempPin,
        employeeId: location.state.employee._id,
      };
      setPendingTempData(payload);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("pendingTempPin", JSON.stringify(payload));
        } catch (storageError) {
          console.warn("Unable to persist temporary PIN", storageError);
        }
      }
    }
  }, [location.state]);

  if (!employee) {
    return null;
  }

  const redirectAfterLogin = (updatedEmployee) => {
    if (updatedEmployee.role === "Owner") {
      navigate("/dashboard");
    } else if (updatedEmployee.permissions?.posTerminal) {
      navigate("/terminal");
    } else if (updatedEmployee.permissions?.inventory) {
      navigate("/inventory");
    } else if (updatedEmployee.permissions?.viewTransactions) {
      navigate("/transactions");
    } else if (updatedEmployee.permissions?.generateReports) {
      navigate("/reports");
    } else {
      navigate("/settings");
    }
  };

  useEffect(() => {
    newPinRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (type, index, value) => {
    if (!/^\d?$/.test(value)) {
      return;
    }

    const setter = type === "new" ? setNewPinDigits : setConfirmPinDigits;
    const refs = type === "new" ? newPinRefs : confirmPinRefs;

    setter((prev) => {
      const updated = [...prev];
      updated[index] = value;

      // Real-time validation for new PIN when complete
      if (type === "new") {
        const pinString = updated.join("");
        if (pinString.length === PIN_LENGTH) {
          const pinValidation = validatePinSecurity(pinString);
          if (!pinValidation.isValid) {
            setError(pinValidation.error);
          } else {
            setError("");
          }
        } else if (updated.join("").length < PIN_LENGTH) {
          // Clear error if PIN is incomplete
          setError("");
        }
      }

      return updated;
    });

    if (value && index < PIN_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (type, index, event) => {
    if (event.key !== "Backspace") {
      return;
    }

    const values = type === "new" ? newPinDigits : confirmPinDigits;
    const refs = type === "new" ? newPinRefs : confirmPinRefs;

    if (!values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (type, event) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("Text")
      .replace(/\D/g, "")
      .slice(0, PIN_LENGTH);
    if (!pasted) {
      return;
    }

    const setter = type === "new" ? setNewPinDigits : setConfirmPinDigits;
    const refs = type === "new" ? newPinRefs : confirmPinRefs;
    const digits = pasted.split("");
    while (digits.length < PIN_LENGTH) {
      digits.push("");
    }
    setter(digits);
    const lastFilledIndex = Math.min(PIN_LENGTH - 1, pasted.length - 1);
    refs.current[lastFilledIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newPin = newPinDigits.join("");
    const confirmPin = confirmPinDigits.join("");

    // Get employee ID from employee object or pending data
    // Use explicit null checks to avoid accessing properties on undefined
    let employeeId = null;
    if (employee && typeof employee === "object") {
      employeeId = employee._id || employee.id;
    }
    if (!employeeId && pendingEmployeeId) {
      employeeId = pendingEmployeeId;
    }

    if (!employeeId) {
      setError("Session expired. Please log in again.");
      navigate("/");
      return;
    }

    if (!pendingTempPin || pendingTempPin.length !== PIN_LENGTH) {
      setError("Session expired. Please log in with your temporary PIN again.");
      return;
    }

    if (pendingEmployeeId && employeeId && pendingEmployeeId !== employeeId) {
      setError("Selected account mismatch. Please log in again.");
      return;
    }

    if (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
      setError("New PIN must have exactly 6 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("New PIN and confirmation do not match.");
      return;
    }

    if (!/^\d{6}$/.test(newPin)) {
      setError("PIN should contain numbers only.");
      return;
    }

    // Validate PIN security rules
    const pinValidation = validatePinSecurity(newPin);
    if (!pinValidation.isValid) {
      setError(pinValidation.error);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/${employeeId}/pin`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPin: pendingTempPin,
            newPin,
            requiresPinReset: false,
          }),
        },
      );

      const data = await response.json();

      if (data.success && data.data) {
        const updatedEmployee = {
          ...data.data,
          id: data.data._id || data.data.id,
          image: data.data.profileImage || employee?.image || defaultAvatar,
        };
        login(updatedEmployee);
        setPinUpdated(true);
        setNewPinDigits(EMPTY_PIN);
        setConfirmPinDigits(EMPTY_PIN);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pendingTempPin");
        }
        redirectAfterLogin(updatedEmployee);
      } else {
        setError(data.message || "Failed to update PIN. Please try again.");
      }
    } catch (err) {
      console.error("Error updating PIN:", err);
      setError("Unable to connect to the server. Please verify your network.");
    } finally {
      setLoading(false);
    }
  };

  const renderPinInputs = (label, digits, type, refs) => (
    <div>
      <p className="text-sm text-gray-500 mb-3">{label}</p>
      <div className="flex gap-3 justify-center">
        {digits.map((digit, index) => (
          <input
            key={`${label}-${index}`}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={digit}
            onChange={(event) =>
              handleDigitChange(type, index, event.target.value)
            }
            onKeyDown={(event) => handleKeyDown(type, index, event)}
            onPaste={(event) => handlePaste(type, event)}
            type="password"
            inputMode="numeric"
            maxLength={1}
            className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 text-center text-xl font-semibold text-[#2F1E12] shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] focus:border-[#B37A5C] focus:bg-white focus:outline-none"
            aria-label={`${label} digit ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div className="flex w-full h-full overflow-hidden flex-col lg:flex-row">
        <div
          className="flex-1 relative flex items-center justify-center p-8 min-h-[40vh] lg:min-h-full"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <div
            className="absolute inset-8 lg:inset-8 rounded-[20px] bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(rgba(139, 115, 85, 0.7), rgba(139, 115, 85, 0.7)), url(${bgImage})`,
            }}
          />
          <div className="relative z-10 text-center p-12 flex items-center justify-center">
            <img
              src={logo}
              alt="Create Your Style"
              className="max-w-[80%] lg:max-w-[70%] h-auto object-contain drop-shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
            />
          </div>
        </div>
        <div
          className="flex-1 flex items-center justify-center p-8 min-h-[60vh] lg:min-h-full"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <div className="w-full max-w-[600px]">
            <div className="text-center mb-12">
              <h2 className="text-5xl font-bold text-[#8B7355] mb-4 tracking-[8px]">
                CYSPOS
              </h2>
              <div className="w-full h-0 pb-6 border-b-[3px] border-[#8B7355]"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-50 flex items-center justify-center px-4 py-10 bg-black/20 backdrop-blur-sm">
        <div className="relative w-full max-w-md rounded-[32px] bg-white/95 shadow-[0px_25px_60px_rgba(0,0,0,0.25)] px-8 py-10">
          <div className="absolute -top-5 left-1/2 -translate-x-1/2">
            <div className="px-6 py-1 rounded-full bg-white/90 shadow text-xs font-semibold text-gray-500 uppercase tracking-[0.4em]">
              Loading...
            </div>
          </div>

          <button
            type="button"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => navigate(-1)}
            aria-label="Close"
          >
            ×
          </button>

          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-28 h-28 rounded-full bg-[#F4E6DD] flex items-center justify-center">
              <svg
                width="72"
                height="72"
                viewBox="0 0 54 54"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="9"
                  width="48"
                  height="40"
                  rx="12"
                  fill="#C7A086"
                />
                <path
                  d="M36 21H18C16.8954 21 16 21.8954 16 23V35C16 36.1046 16.8954 37 18 37H36C37.1046 37 38 36.1046 38 35V23C38 21.8954 37.1046 21 36 21Z"
                  stroke="#5E3B28"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M32 21V17C32 14.2386 29.7614 12 27 12C24.2386 12 22 14.2386 22 17V21"
                  stroke="#5E3B28"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#1F140E]">
                Set New PIN
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Please create your new PIN
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow">
                <img
                  src={employee.image || defaultAvatar}
                  alt={employee.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-base font-semibold text-[#2F1D13]">
                {employee.name}
              </p>
              <p className="text-xs text-gray-500">{employee.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm">
                {error}
              </div>
            )}
            {renderPinInputs("New PIN", newPinDigits, "new", newPinRefs)}
            {renderPinInputs(
              "Confirm PIN",
              confirmPinDigits,
              "confirm",
              confirmPinRefs,
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-[18px] text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #b37a5c 0%, #7a4b2e 100%)",
              }}
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <p className="text-center text-xs text-gray-500">
              {pinUpdated
                ? "PIN updated successfully."
                : "Temporary PIN verified. Please create a new one."}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default memo(SetNewPin);
