import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import { sendReceiptToPrinter } from "../../utils/printBridge";
import CheckoutConfirmationModal from "./CheckoutConfirmationModal";
import PrintingModal from "./PrintingModal";
import ReceiptModal from "./ReceiptModal";
import SuccessModal from "./SuccessModal";

const CashPaymentModal = ({
  isOpen,
  onClose,
  totalAmount,
  subtotalAmount = 0,
  discountAmount = 0,
  selectedDiscounts = [],
  onProceed,
  cartItems = [],
}) => {
  const { theme } = useTheme();
  const [amountReceived, setAmountReceived] = useState("");
  const [change, setChange] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [printError, setPrintError] = useState(null);
  const [amountError, setAmountError] = useState("");

  useEffect(() => {
    if (amountReceived && !isNaN(parseFloat(amountReceived))) {
      const received = parseFloat(amountReceived);
      const changeAmount = received - totalAmount;
      setChange(changeAmount >= 0 ? changeAmount : 0);
      setAmountError("");
    } else {
      setChange(0);
      if (amountReceived) {
        setAmountError("Please enter a valid amount.");
      } else {
        setAmountError("");
      }
    }
  }, [amountReceived, totalAmount]);

  useEffect(() => {
    if (!isOpen) {
      setAmountReceived("");
      setChange(0);
      setShowConfirmation(false);
      setShowSuccess(false);
      setShowReceipt(false);
      setReceiptData(null);
      setIsAutoPrinting(false);
      setPrintError(null);
      setAmountError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const generateReceiptNumber = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleProceed = () => {
    const received = parseFloat(amountReceived);
    if (!amountReceived || isNaN(received) || received < totalAmount) {
      if (!amountReceived || isNaN(received)) {
        setAmountError("Please enter a valid amount.");
      } else if (received < totalAmount) {
        setAmountError("Amount must be equal to or greater than the total.");
      }
      return;
    }
    setAmountError("");
    setShowConfirmation(true);
  };

  const handleConfirmCheckout = async () => {
    const received = parseFloat(amountReceived);
    setShowConfirmation(false);
    setShowSuccess(true);

    try {
      // First, save the transaction and get the actual receipt number
      const generatedReceiptNo = generateReceiptNumber();
      const savedTransaction = await onProceed(
        received,
        change,
        generatedReceiptNo,
      );

      // Use the receipt number from the saved transaction (which is the actual one in the database)
      const actualReceiptNo = savedTransaction?.receiptNo || generatedReceiptNo;

      // Generate receipt data with the actual receipt number
      const receipt = {
        receiptNo: actualReceiptNo,
        items: cartItems.map((item) => ({
          name: item.itemName || item.name || "Item",
          qty: item.quantity || 1,
          price: item.itemPrice || item.price || 0,
          total: (item.itemPrice || item.price || 0) * (item.quantity || 1),
        })),
        paymentMethod: "CASH",
        subtotal: subtotalAmount || totalAmount + discountAmount,
        discount: discountAmount,
        discounts: selectedDiscounts.map((d) => ({
          title: d.title,
          value: d.discountValue,
        })),
        total: totalAmount,
        cash: received,
        change: change,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      };

      setReceiptData(receipt);

      // Start printing immediately - no delay needed
      setShowSuccess(false);
      // Use requestAnimationFrame to ensure UI updates before printing
      requestAnimationFrame(() => {
        attemptAutoPrint(receipt);
      });
    } catch (error) {
      setShowSuccess(false);
      setShowReceipt(false);
      console.error("Error saving transaction:", error);
      alert("Failed to save transaction. Please try again.");
    }
  };

  const handleNewTransaction = () => {
    setShowReceipt(false);
    // Transaction already saved, just close
  };

  const attemptAutoPrint = async (receipt) => {
    setIsAutoPrinting(true);
    setPrintError(null);
    try {
      await sendReceiptToPrinter(receipt);
      setIsAutoPrinting(false);
      handleNewTransaction();
    } catch (error) {
      setIsAutoPrinting(false);
      setPrintError(error.message || "Unable to reach the printer.");
      setShowReceipt(true);
    }
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmountReceived(value);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4">
        <div
          className={`rounded-2xl w-full max-w-md relative shadow-2xl ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
        >
          <div
            className={`px-6 py-4 border-b relative ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}
          >
            <h2
              className={`text-xl font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Cash Payment
            </h2>
            <button
              onClick={onClose}
              className={`absolute top-4 right-4 transition-colors ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <div className="mb-2">
                <label
                  className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                >
                  Total:
                </label>
              </div>
              <div className="text-4xl font-bold text-orange-500">
                ₱{totalAmount.toFixed(2)}
              </div>
            </div>

            <div className="mb-4">
              <label
                className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
              >
                Amount Received:
              </label>
              <input
                type="text"
                value={amountReceived}
                onChange={handleAmountChange}
                placeholder="0.00"
                className={`w-full px-4 py-3 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "border-gray-300 bg-white text-gray-900"}`}
                autoFocus
              />
              {amountError && (
                <p className="mt-2 text-sm text-red-600">{amountError}</p>
              )}
            </div>

            {/* Quick Amount Suggestions */}
            <div className="mb-6">
              <label
                className={`block text-xs font-medium mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                Quick Select:
              </label>
              <div className="flex flex-wrap gap-2">
                {/* Exact Amount Button */}
                <button
                  onClick={() => setAmountReceived(totalAmount.toString())}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${theme === "dark" ? "border-orange-600 bg-orange-900/30 text-orange-400 hover:bg-orange-900/50" : "border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100"}`}
                >
                  Exact ₱{totalAmount.toFixed(0)}
                </button>

                {/* Dynamic suggestions based on total amount */}
                {[20, 50, 100, 200, 500, 1000, 2000, 5000]
                  .filter((amount) => amount >= totalAmount)
                  .slice(0, 4)
                  .map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setAmountReceived(amount.toString())}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${theme === "dark" ? "border-gray-600 bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]" : "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
                    >
                      ₱{amount.toLocaleString()}
                    </button>
                  ))}
              </div>
            </div>

            <div className="mb-8">
              <label
                className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
              >
                Change:
              </label>
              <div
                className={`rounded-lg p-4 text-center ${theme === "dark" ? "bg-green-900/30" : "bg-green-100"}`}
              >
                <span
                  className={`text-2xl font-bold ${theme === "dark" ? "text-green-400" : "text-green-700"}`}
                >
                  PHP {change.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onClose}
                className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${theme === "dark" ? "bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]" : "text-gray-700 bg-gray-200 hover:bg-gray-300"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                className="flex-1 py-3 px-6 rounded-lg font-semibold text-white hover:opacity-90 transition-all"
                style={{
                  background:
                    "linear-gradient(135deg, #AD7F65 0%, #76462B 100%)",
                }}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      </div>

      <CheckoutConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmCheckout}
      />

      <SuccessModal
        isOpen={showSuccess}
        onClose={() => {
          setShowSuccess(false);
        }}
      />

      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        receiptData={receiptData}
        onNewTransaction={handleNewTransaction}
        initialPrintError={printError}
        onPrintSuccess={handleNewTransaction}
        disableAutoPrint={true}
      />

      <PrintingModal isOpen={isAutoPrinting} />
    </>
  );
};

export default CashPaymentModal;
