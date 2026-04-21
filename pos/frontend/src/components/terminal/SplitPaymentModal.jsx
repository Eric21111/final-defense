import { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { API_BASE_URL } from "../../config/api";
import { useTheme } from "../../context/ThemeContext";
import { sendReceiptToPrinter } from "../../utils/printBridge";
import { getReceiptProfile } from "../../utils/receiptProfile";
import { getTerminalId } from "../../utils/terminalIdentity";
import CheckoutConfirmationModal from "./CheckoutConfirmationModal";
import PrintingModal from "./PrintingModal";
import ReceiptModal from "./ReceiptModal";
import SuccessModal from "./SuccessModal";
import gcashHeader from "../../assets/gcashHeader.png";

const toAmount = (value) => {
  const parsed = parseFloat(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const SplitPaymentModal = ({
  isOpen,
  onClose,
  totalAmount,
  subtotalAmount = 0,
  discountAmount = 0,
  selectedDiscounts = [],
  onProceed,
  onTransactionDone,
  cartItems = [],
  cashierName = "",
}) => {
  const { theme } = useTheme();
  const [cashAmount, setCashAmount] = useState("");
  const [gcashAmount, setGcashAmount] = useState("");
  const [change, setChange] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [printError, setPrintError] = useState(null);
  const [amountError, setAmountError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const cashValue = useMemo(() => toAmount(cashAmount), [cashAmount]);
  const gcashValue = useMemo(() => toAmount(gcashAmount), [gcashAmount]);
  const totalReceived = cashValue + gcashValue;

  useEffect(() => {
    const nextChange = totalReceived - totalAmount;
    setChange(nextChange >= 0 ? nextChange : 0);
  }, [totalReceived, totalAmount]);

  useEffect(() => {
    if (!isOpen) {
      setCashAmount("");
      setGcashAmount("");
      setChange(0);
      setShowConfirmation(false);
      setShowSuccess(false);
      setShowReceipt(false);
      setReceiptData(null);
      setIsAutoPrinting(false);
      setPrintError(null);
      setAmountError("");
      setCheckoutUrl("");
      setIsGeneratingQr(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerateQr = async () => {
    if (gcashValue <= 0) {
      setAmountError("Enter a valid GCash amount before generating QR.");
      return;
    }

    setAmountError("");
    setIsGeneratingQr(true);
    setCheckoutUrl("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/gcash/create-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: gcashValue,
          description: "Split payment QR",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success || !data?.data?.checkoutUrl) {
        throw new Error(data?.message || "Failed to generate GCash QR code.");
      }

      setCheckoutUrl(data.data.checkoutUrl);
    } catch (error) {
      setAmountError(error.message || "Failed to generate GCash QR code.");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleProceed = () => {
    if (cashValue < 0 || gcashValue < 0) {
      setAmountError("Cash and GCash amounts cannot be negative.");
      return;
    }
    if (totalReceived <= 0) {
      setAmountError("Please enter a valid split amount.");
      return;
    }
    if (totalReceived < totalAmount) {
      setAmountError("Combined split amount must be equal to or greater than the total.");
      return;
    }

    setAmountError("");
    setShowConfirmation(true);
  };

  const handleNewTransaction = () => {
    setShowReceipt(false);
    onClose();
    if (onTransactionDone) onTransactionDone();
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

  const handleConfirmCheckout = async () => {
    setShowConfirmation(false);

    const profile = getReceiptProfile();
    if (profile.birCompliantEnabled && !getTerminalId()) {
      alert(
        "BIR-compliant receipts are on. Set a Terminal ID under Settings → Receipt on this device before checking out."
      );
      return;
    }

    setShowSuccess(true);

    try {
      const savedTransaction = await onProceed({
        cashAmount: cashValue,
        gcashAmount: gcashValue,
      });

      const actualReceiptNo = savedTransaction?.receiptNo || "000000";

      const receipt = {
        receiptNo: actualReceiptNo,
        items: cartItems.map((item) => ({
          name: item.itemName || item.name || "Item",
          qty: item.quantity || 1,
          price: item.itemPrice || item.price || 0,
          total: (item.itemPrice || item.price || 0) * (item.quantity || 1),
          selectedSize: item.selectedSize || item.size || "",
          size: item.selectedSize || item.size || "",
          selectedVariation: item.selectedVariation || item.variant || "",
          variant: item.selectedVariation || item.variant || "",
        })),
        paymentMethod: "SPLIT PAYMENT",
        cashierName: cashierName || "Staff",
        subtotal: subtotalAmount || totalAmount + discountAmount,
        discount: discountAmount,
        discounts: selectedDiscounts.map((d) => ({
          title: d.title,
          value: d.discountValue,
          discountCategory: d.discountCategory,
        })),
        total: totalAmount,
        totalAmount,
        cash: totalReceived,
        change,
        splitPayment: {
          cash: cashValue,
          gcash: gcashValue,
        },
        gcash: gcashValue,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      };

      if (savedTransaction) {
        receipt.netOfVat = savedTransaction.netOfVat;
        receipt.vatAmount = savedTransaction.vatAmount;
        receipt.vatRateApplied = savedTransaction.vatRateApplied;
        receipt.birTinSnapshot = savedTransaction.birTinSnapshot;
        receipt.birPtuSnapshot = savedTransaction.birPtuSnapshot;
        receipt.birCompliantEnabled = profile.birCompliantEnabled;
        receipt.terminalId = savedTransaction.terminalId;
      }

      setReceiptData(receipt);
      setShowSuccess(false);

      requestAnimationFrame(() => {
        attemptAutoPrint(receipt);
      });
    } catch (error) {
      setShowSuccess(false);
      setShowReceipt(false);
      console.error("Error saving split transaction:", error);
      alert("Failed to save transaction. Please try again.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4">
        <div className={`rounded-2xl w-full max-w-md relative shadow-2xl ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}>
          <div className={`px-6 py-4 border-b relative ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
            <h2 className={`text-xl font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              Split Payment
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
                <label className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                  Total:
                </label>
              </div>
              <div className="text-4xl font-bold text-orange-500">₱{totalAmount.toFixed(2)}</div>
            </div>

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                Cash Amount:
              </label>
              <input
                type="text"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full px-4 py-3 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "border-gray-300 bg-white text-gray-900"}`}
              />
            </div>

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                GCash Amount:
              </label>
              <input
                type="text"
                value={gcashAmount}
                onChange={(e) => setGcashAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full px-4 py-3 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "border-gray-300 bg-white text-gray-900"}`}
              />
              <button
                type="button"
                onClick={handleGenerateQr}
                disabled={isGeneratingQr}
                className={`mt-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${theme === "dark" ? "border-gray-600 bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]" : "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
              >
                {isGeneratingQr ? "Generating..." : "Generate QR Code (Optional)"}
              </button>
            </div>

            {checkoutUrl && (
              <div className="rounded-lg border border-dashed border-[#AD7F65] p-3 mb-4 flex flex-col items-center gap-2">
                <div className="bg-white p-4 border-2 border-blue-200 rounded-xl shadow-sm">
                  <QRCodeSVG
                    value={checkoutUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: gcashHeader,
                      height: 24,
                      width: 60,
                      excavate: true,
                    }}
                  />
                </div>
                <p className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  QR uses the same GCash payment generation flow.
                </p>
              </div>
            )}

            <div className={`rounded-lg px-3 py-2 text-sm mb-4 ${theme === "dark" ? "bg-[#2A2724] text-gray-200" : "bg-gray-50 text-gray-700"}`}>
              <div className="flex justify-between">
                <span>Total Due</span>
                <span>PHP {Number(totalAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Entered Split</span>
                <span>PHP {totalReceived.toFixed(2)}</span>
              </div>
            </div>

            <div className="mb-8">
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                Change:
              </label>
              <div className={`rounded-lg p-4 text-center ${theme === "dark" ? "bg-green-900/30" : "bg-green-100"}`}>
                <span className={`text-2xl font-bold ${theme === "dark" ? "text-green-400" : "text-green-700"}`}>
                  PHP {change.toFixed(2)}
                </span>
              </div>
            </div>

            {amountError && <p className="mb-4 text-sm text-red-600">{amountError}</p>}

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
                style={{ background: "linear-gradient(135deg, #AD7F65 0%, #76462B 100%)" }}
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

export default SplitPaymentModal;
