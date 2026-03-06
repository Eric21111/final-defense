import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import bgImage from "../assets/bg.png";
import defaultAvatar from "../assets/default.jpeg";
import logo from "../assets/logo.png";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";

const PinEntry = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleNumberClick = (number) => {
    if (pin.length < 6) {
      setPin(pin + number);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const redirectAfterLogin = (employeeData) => {
    if (
      employeeData.role === "Owner" ||
      employeeData.name === "owner" ||
      employeeData.id === 3
    ) {
      navigate("/dashboard");
    } else if (employeeData.permissions?.posTerminal) {
      navigate("/terminal");
    } else if (employeeData.permissions?.inventory) {
      navigate("/inventory");
    } else if (employeeData.permissions?.viewTransactions) {
      navigate("/transactions");
    } else if (employeeData.permissions?.generateReports) {
      navigate("/reports");
    } else {
      navigate("/settings");
    }
  };

  const rememberPendingTempPin = (employeeData, pinValue) => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        "pendingTempPin",
        JSON.stringify({
          employeeId: employeeData._id,
          pin: pinValue,
        }),
      );
    } catch (storageError) {
      console.warn("Unable to cache temporary PIN", storageError);
    }
  };

  const clearPendingTempPin = () => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem("pendingTempPin");
    } catch (storageError) {
      console.warn("Unable to clear cached temporary PIN", storageError);
    }
  };

  const handleLogin = async () => {
    if (pin.length !== 6) {
      setError("Please enter a 6-digit PIN");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Verify PIN with backend (PIN-only login, no email required)
      const response = await fetch(
        `${API_BASE_URL}/api/employees/verify-pin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pin: pin,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        // Store user info with permissions in auth context
        const employeeData = {
          ...data.data,
          id: data.data._id,
          image: data.data.profileImage || defaultAvatar,
        };

        login(employeeData);

        if (employeeData.requiresPinReset) {
          rememberPendingTempPin(employeeData, pin);
          navigate("/set-pin", {
            state: { employee: employeeData, tempPin: pin },
          });
        } else {
          clearPendingTempPin();
          redirectAfterLogin(employeeData);
        }
        setPin("");
      } else {
        setError(data.message || "Invalid PIN. Please try again.");
        setPin(""); // Clear PIN on error
      }
    } catch (error) {
      console.error("Error verifying PIN:", error);
      setError(
        "Failed to connect to server. Please make sure the backend is running.",
      );
      setPin(""); // Clear PIN on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key >= "0" && event.key <= "9") {
        handleNumberClick(event.key);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        handleBackspace();
      } else if (event.key === "Enter") {
        handleLogin();
      }
    };

    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [pin]);

  return (
    <div className="flex w-screen h-screen overflow-hidden flex-col lg:flex-row">
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

          <div
            className={`flex items-start gap-12 transition-all duration-500 ${showKeypad ? "justify-center" : "justify-center"}`}
          >
            <div
              className={`flex flex-col items-center transition-all duration-500 ${showKeypad ? "mt-10" : "mt-0"}`}
            >
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden mb-4 bg-gray-200 flex items-center justify-center">
                <img
                  src={defaultAvatar}
                  alt="Employee"
                  className="w-full h-full object-cover"
                />
              </div>
              <p
                className="text-xl font-semibold text-gray-800 mb-1"
                style={{ fontFamily: "sans-serif" }}
              >
                Enter Your PIN
              </p>
              <p
                className="text-sm text-gray-600 mb-2"
                style={{ fontFamily: "sans-serif" }}
              >
                Please enter your 6-digit PIN to continue
              </p>
              {error && (
                <p
                  className="text-xs text-red-600 mb-4 text-center max-w-xs"
                  style={{ fontFamily: "sans-serif" }}
                >
                  {error}
                </p>
              )}
              <p
                className="text-sm text-gray-600 mb-6"
                style={{ fontFamily: "sans-serif" }}
              >
                PIN
              </p>

              <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className="w-12 h-12 rounded-xl bg-white border-2 border-gray-300 flex items-center justify-center shadow-sm"
                  >
                    {index < pin.length && (
                      <div className="w-3 h-3 rounded-full bg-gray-800"></div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowKeypad(!showKeypad)}
                className="text-[#8B7355] text-sm font-semibold cursor-pointer hover:text-[#6d5a43] transition-colors duration-200 mb-4"
                style={{ fontFamily: "sans-serif" }}
              >
                {showKeypad ? "Hide Keypad" : "Show Keypad"}
              </button>
            </div>

            <div
              className={`flex flex-col items-center transition-all duration-500 overflow-hidden ${showKeypad ? "opacity-100 max-w-[280px]" : "opacity-0 max-w-0"}`}
            >
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((number) => (
                  <button
                    key={number}
                    onClick={() => handleNumberClick(number.toString())}
                    className="w-16 h-16 rounded-full bg-white text-gray-900 text-2xl font-semibold cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg hover:bg-gray-50 active:scale-95"
                    style={{ fontFamily: "sans-serif" }}
                  >
                    {number}
                  </button>
                ))}
                <div className="w-16 h-16"></div>
                <button
                  onClick={() => handleNumberClick("0")}
                  className="w-16 h-16 rounded-full bg-white text-gray-900 text-2xl font-semibold cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg hover:bg-gray-50 active:scale-95"
                  style={{ fontFamily: "sans-serif" }}
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="w-16 h-16 rounded-full bg-white text-gray-900 cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg hover:bg-gray-50 active:scale-95 flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {showKeypad && (
                <button
                  className="bg-[#8B7355] text-white border-none rounded-full px-20 py-3 text-lg font-semibold cursor-pointer transition-all duration-300 uppercase shadow-md hover:bg-[#6d5a43] hover:shadow-lg active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleLogin}
                  disabled={loading || pin.length !== 6}
                  style={{ fontFamily: "sans-serif" }}
                >
                  {loading ? "VERIFYING..." : "LOGIN"}
                </button>
              )}
            </div>
          </div>

          {!showKeypad && (
            <div className="text-center mt-8">
              <button
                className="bg-[#8B7355] text-white border-none rounded-[10px] px-12 py-3 text-lg font-semibold cursor-pointer transition-all duration-300 uppercase shadow-md hover:bg-[#6d5a43] hover:shadow-lg active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed -translate-x-5"
                onClick={handleLogin}
                disabled={loading || pin.length !== 6}
                style={{ fontFamily: "sans-serif" }}
              >
                {loading ? "VERIFYING..." : "LOGIN"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(PinEntry);
