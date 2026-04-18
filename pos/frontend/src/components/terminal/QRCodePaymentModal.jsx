














import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaRedo,
  FaSpinner,
  FaTimes,
  FaTimesCircle } from
"react-icons/fa";
import gcashHeader from "../../assets/gcashHeader.png";
import { API_BASE_URL as API_BASE, WS_BASE_URL as WS_BASE } from "../../config/api";
import { useTheme } from "../../context/ThemeContext";
import { sendReceiptToPrinter } from "../../utils/printBridge";
import { getReceiptProfile } from "../../utils/receiptProfile";
import { getTerminalId } from "../../utils/terminalIdentity";
import PrintingModal from "./PrintingModal";
import ReceiptModal from "./ReceiptModal";
import SuccessModal from "./SuccessModal";
const POLL_INTERVAL = 3000;


const STATUS = {
  IDLE: "IDLE",
  CREATING: "CREATING",
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED"
};

const QRCodePaymentModal = ({
  isOpen,
  onClose,
  totalAmount,
  subtotalAmount = 0,
  discountAmount = 0,
  selectedDiscounts = [],
  cartItems = [],
  userId,
  performedById,
  performedByName,
  onTransactionComplete
}) => {
  const { theme } = useTheme();


  const [paymentStatus, setPaymentStatus] = useState(STATUS.IDLE);
  const [merchantOrderId, setMerchantOrderId] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [receiptNo, setReceiptNo] = useState(null);
  const [gcashReference, setGcashReference] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");


  const [showSuccess, setShowSuccess] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [printError, setPrintError] = useState(null);


  const wsRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const isMountedRef = useRef(true);


  const cartSnapshotRef = useRef([]);
  const paymentAmountsRef = useRef({ subtotal: 0, discount: 0, total: 0 });




  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      resetState();
    }
  }, [isOpen]);

  const cleanup = useCallback(() => {

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setPaymentStatus(STATUS.IDLE);
    setMerchantOrderId(null);
    setCheckoutUrl(null);
    setReceiptNo(null);
    setGcashReference(null);
    setExpiresAt(null);
    setTimeRemaining(null);
    setErrorMessage("");
    setShowSuccess(false);
    setShowReceipt(false);
    setReceiptData(null);
    setIsAutoPrinting(false);
    setPrintError(null);

    cartSnapshotRef.current = [];
    paymentAmountsRef.current = { subtotal: 0, discount: 0, total: 0 };
  }, []);




  const initiatePayment = useCallback(async () => {
    if (paymentStatus !== STATUS.IDLE) return;

    const profile = getReceiptProfile();
    if (profile.birCompliantEnabled && !getTerminalId()) {
      setPaymentStatus(STATUS.FAILED);
      setErrorMessage(
        "Terminal ID is required when BIR-compliant receipts are on. Set it under Settings → Receipt on this device."
      );
      return;
    }

    setPaymentStatus(STATUS.CREATING);
    setErrorMessage("");


    cartSnapshotRef.current = cartItems.map((item) => ({
      name: item.itemName || item.name || 'Item',
      itemName: item.itemName || item.name || 'Item',
      qty: item.quantity || 1,
      quantity: item.quantity || 1,
      price: item.itemPrice || item.price || 0,
      itemPrice: item.itemPrice || item.price || 0,
      total: (item.itemPrice || item.price || 0) * (item.quantity || 1),
      selectedSize: item.selectedSize || item.size || '',
      size: item.selectedSize || item.size || '',
      selectedVariation: item.selectedVariation || item.variant || '',
      variant: item.selectedVariation || item.variant || ''
    }));
    paymentAmountsRef.current = {
      subtotal: subtotalAmount || totalAmount + discountAmount,
      discount: discountAmount,
      total: totalAmount
    };

    try {
      const response = await fetch(`${API_BASE}/api/payments/gcash/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.productId || item._id,
            itemName: item.itemName,
            sku: item.sku,
            variant: item.variant,
            selectedSize: item.selectedSize,
            quantity: item.quantity || 1,
            price: item.itemPrice || item.price || 0,
            itemImage: item.itemImage || ""
          })),
          totalAmount,
          subtotal: subtotalAmount || totalAmount + discountAmount,
          discount: discountAmount,
          userId: userId || performedById || "system",
          performedById: performedById || "",
          performedByName: performedByName || "",
          appliedDiscountIds: selectedDiscounts.map((d) => d._id),
          terminalId: getTerminalId() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create payment");
      }

      if (!isMountedRef.current) return;

      const {
        merchantOrderId: orderId,
        receiptNo: receipt,
        checkoutUrl: url,
        expiresAt: expiry
      } = data.data;

      setMerchantOrderId(orderId);
      setCheckoutUrl(url);
      setReceiptNo(receipt);
      setExpiresAt(expiry);
      setPaymentStatus(STATUS.PENDING);


      startCountdown(new Date(expiry));


      connectWebSocket(orderId);


      startPolling(orderId);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("[GCash] Payment creation error:", error);
      setPaymentStatus(STATUS.FAILED);
      setErrorMessage(
        error.message || "Failed to create payment. Please try again."
      );
    }
  }, [
  paymentStatus,
  cartItems,
  totalAmount,
  subtotalAmount,
  discountAmount,
  userId,
  performedById,
  performedByName,
  selectedDiscounts]
  );


  useEffect(() => {
    if (
    isOpen &&
    paymentStatus === STATUS.IDLE &&
    cartItems.length > 0 &&
    totalAmount > 0)
    {
      const timer = setTimeout(() => initiatePayment(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, paymentStatus, cartItems.length, totalAmount]);




  const connectWebSocket = useCallback((orderId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(
        `${WS_BASE}/ws/payments?orderId=${encodeURIComponent(orderId)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected for order:", orderId);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log("[WS] Message received:", msg);

          if (msg.type === "PAYMENT_UPDATE") {
            handlePaymentStatusChange(msg);
          }
        } catch (err) {
          console.error("[WS] Error parsing message:", err);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Connection closed for order:", orderId);
      };

      ws.onerror = (error) => {
        console.warn("[WS] WebSocket error, falling back to polling:", error);
      };
    } catch (error) {
      console.warn("[WS] Failed to connect, using polling only:", error);
    }
  }, []);




  const startPolling = useCallback((orderId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/payments/gcash/status/${encodeURIComponent(orderId)}`
        );
        const data = await response.json();

        if (!isMountedRef.current) return;

        if (data.success && data.data) {
          const {
            status,
            paidAt,
            gcashReference: ref,
            receiptNo: receipt,
            netOfVat,
            vatAmount,
            vatRateApplied,
            birTinSnapshot,
            birPtuSnapshot,
            terminalId
          } = data.data;

          if (status === "PAID") {
            handlePaymentStatusChange({
              status: "PAID",
              paidAt,
              gcashReference: ref,
              receiptNo: receipt,
              netOfVat,
              vatAmount,
              vatRateApplied,
              birTinSnapshot,
              birPtuSnapshot,
              terminalId
            });
          } else if (status === "EXPIRED") {
            handlePaymentStatusChange({ status: "EXPIRED" });
          } else if (status === "FAILED") {
            handlePaymentStatusChange({ status: "FAILED" });
          }
        }
      } catch (error) {
        console.warn("[Poll] Error checking status:", error);
      }
    }, POLL_INTERVAL);
  }, []);




  const handlePaymentStatusChange = useCallback(
    (data) => {
      if (!isMountedRef.current) return;

      const { status, gcashReference: ref, receiptNo: receipt } = data;

      switch (status) {
        case "PAID":
          cleanup();
          setPaymentStatus(STATUS.PAID);
          if (ref) setGcashReference(ref);
          if (receipt) setReceiptNo(receipt);
          handlePaymentSuccess(ref, receipt, data);
          break;

        case "EXPIRED":
          cleanup();
          setPaymentStatus(STATUS.EXPIRED);
          setErrorMessage("Payment has expired. Please try again.");
          break;

        case "FAILED":
          cleanup();
          setPaymentStatus(STATUS.FAILED);
          setErrorMessage("Payment failed. Please try again.");
          break;

        default:
          break;
      }
    },
    [cleanup]
  );




  const handlePaymentSuccess = useCallback(
    (ref, receipt, birData = {}) => {
      setShowSuccess(true);


      const snapshotItems = cartSnapshotRef.current;
      const snapshotAmounts = paymentAmountsRef.current;
      const profile = getReceiptProfile();

      const receiptInfo = {
        receiptNo: receipt || receiptNo || "------",
        items: snapshotItems.length > 0 ? snapshotItems : cartItems.map((item) => ({
          name: item.itemName || item.name || "Item",
          qty: item.quantity || 1,
          price: item.itemPrice || item.price || 0,
          total: (item.itemPrice || item.price || 0) * (item.quantity || 1),
          selectedSize: item.selectedSize || item.size || "",
          size: item.selectedSize || item.size || "",
          selectedVariation: item.selectedVariation || item.variant || "",
          variant: item.selectedVariation || item.variant || ""
        })),
        paymentMethod: "GCASH",
        subtotal: snapshotAmounts.subtotal || subtotalAmount || totalAmount + discountAmount,
        discount: snapshotAmounts.discount || discountAmount,
        discounts: selectedDiscounts.map((d) => ({
          title: d.title,
          value: d.discountValue
        })),
        total: snapshotAmounts.total || totalAmount,
        totalAmount: snapshotAmounts.total || totalAmount,
        cash: snapshotAmounts.total || totalAmount,
        change: 0,
        referenceNo: ref || gcashReference || "",
        cashierName: performedByName || "Staff",
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        birCompliantEnabled: profile.birCompliantEnabled,
        netOfVat: birData.netOfVat,
        vatAmount: birData.vatAmount,
        vatRateApplied: birData.vatRateApplied,
        birTinSnapshot: birData.birTinSnapshot,
        birPtuSnapshot: birData.birPtuSnapshot,
        terminalId: birData.terminalId
      };

      setReceiptData(receiptInfo);


      if (onTransactionComplete) {
        onTransactionComplete({
          merchantOrderId,
          receiptNo: receipt || receiptNo,
          gcashReference: ref || gcashReference,
          totalAmount: snapshotAmounts.total || totalAmount
        });
      }


      setTimeout(() => {
        if (!isMountedRef.current) return;
        setShowSuccess(false);
        attemptAutoPrint(receiptInfo);
      }, 1500);
    },
    [
    cartItems,
    totalAmount,
    subtotalAmount,
    discountAmount,
    selectedDiscounts,
    performedByName,
    receiptNo,
    gcashReference,
    merchantOrderId,
    onTransactionComplete]

  );




  const startCountdown = useCallback((expiryDate) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = expiryDate - now;

      if (diff <= 0) {
        setTimeRemaining("0:00");
        clearInterval(countdownRef.current);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor(diff % 60000 / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
  }, []);




  const handleCancel = useCallback(async () => {
    cleanup();

    if (merchantOrderId && paymentStatus === STATUS.PENDING) {
      try {
        await fetch(
          `${API_BASE}/api/payments/gcash/cancel/${encodeURIComponent(merchantOrderId)}`,
          {
            method: "POST"
          }
        );
      } catch (error) {
        console.warn("[GCash] Error cancelling payment:", error);
      }
    }

    setPaymentStatus(STATUS.CANCELLED);
    onClose();
  }, [merchantOrderId, paymentStatus, cleanup, onClose]);




  const handleRetry = useCallback(() => {
    cleanup();
    resetState();
  }, [cleanup, resetState]);




  const attemptAutoPrint = async (receipt) => {
    setIsAutoPrinting(true);
    setPrintError(null);
    try {
      await sendReceiptToPrinter(receipt);
      setIsAutoPrinting(false);
      onClose();
    } catch (error) {
      setIsAutoPrinting(false);
      setPrintError(error.message || "Unable to reach the printer.");
      setShowReceipt(true);
    }
  };

  const handleNewTransaction = () => {
    setShowReceipt(false);
    onClose();
  };




  if (!isOpen) return null;

  const isDark = theme === "dark";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4">
        <div
          className={`rounded-2xl w-full max-w-md relative shadow-2xl ${isDark ? "bg-[#1E1B18]" : "bg-white"}`}>
          
          {}
          <div
            className={`px-6 py-4 border-b relative ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            
            <button
              onClick={handleCancel}
              className={`absolute top-4 right-4 transition-colors ${isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}>
              
              <FaTimes className="w-5 h-5" />
            </button>
            <h2
              className={`text-xl font-semibold text-center ${isDark ? "text-white" : "text-gray-900"}`}>
              
              GCash Payment
            </h2>
          </div>

          {}
          <div className="p-6">
            {}
            {paymentStatus === STATUS.CREATING &&
            <div className="flex flex-col items-center py-12">
                <FaSpinner className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p
                className={`text-lg font-medium ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                
                  Creating payment...
                </p>
                <p
                className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                
                  Connecting to GCash gateway
                </p>
              </div>
            }

            {}
            {paymentStatus === STATUS.PENDING && checkoutUrl &&
            <>
                {}
                <div className="mb-4 text-center">
                  <img
                  src={gcashHeader}
                  alt="GCash"
                  className="mx-auto h-14 object-contain" />
                
                </div>

                {}
                <div className="flex justify-center mb-4">
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
                      excavate: true
                    }} />
                  
                  </div>
                </div>

                {}
                <div className="text-center mb-4">
                  <p
                  className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  
                    Amount to Pay
                  </p>
                  <p className="text-3xl font-bold text-orange-500">
                    ₱{totalAmount.toFixed(2)}
                  </p>
                </div>

                {}
                {timeRemaining &&
              <div className="text-center mb-4">
                    <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  isDark ?
                  "bg-yellow-900/30 text-yellow-400" :
                  "bg-yellow-50 text-yellow-700"}`
                  }>
                  
                      <span className="text-sm font-medium">
                        ⏱ Expires in {timeRemaining}
                      </span>
                    </div>
                  </div>
              }

                {}
                <div className="text-center mb-6">
                  <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  isDark ? "bg-blue-900/30" : "bg-blue-50"}`
                  }>
                  
                    <FaSpinner className="w-4 h-4 text-blue-500 animate-spin" />
                    <span
                    className={`text-sm font-medium ${isDark ? "text-blue-400" : "text-blue-700"}`}>
                    
                      Waiting for payment...
                    </span>
                  </div>
                </div>

                {}
                <div
                className={`rounded-lg p-3 mb-6 ${isDark ? "bg-[#2A2724]" : "bg-gray-50"}`}>
                
                  <p
                  className={`text-xs font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  
                    How to pay:
                  </p>
                  <ol
                  className={`text-xs space-y-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  
                    <li>1. Open GCash app on your phone</li>
                    <li>2. Tap &quot;Scan QR&quot; and scan the code above</li>
                    <li>3. Confirm the amount and complete payment</li>
                    <li>4. Payment will be confirmed automatically</li>
                  </ol>
                </div>

                {}
                <button
                onClick={handleCancel}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                isDark ?
                "bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]" :
                "text-gray-700 bg-gray-200 hover:bg-gray-300"}`
                }>
                
                  Cancel Payment
                </button>
              </>
            }

            {}
            {paymentStatus === STATUS.PAID &&
            !showSuccess &&
            !showReceipt &&
            !isAutoPrinting &&
            <div className="flex flex-col items-center py-8">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <FaCheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                  <p
                className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                
                    Payment Confirmed!
                  </p>
                  <p className="text-3xl font-bold text-green-500 mb-2">
                    ₱{totalAmount.toFixed(2)}
                  </p>
                  {gcashReference &&
              <p
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                
                      Ref: {gcashReference}
                    </p>
              }
                </div>
            }

            {}
            {paymentStatus === STATUS.FAILED &&
            <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <FaTimesCircle className="w-12 h-12 text-red-500" />
                </div>
                <p
                className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                
                  Payment Failed
                </p>
                <p
                className={`text-sm text-center mb-6 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                
                  {errorMessage || "Something went wrong. Please try again."}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                  onClick={handleCancel}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                  isDark ?
                  "bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]" :
                  "text-gray-700 bg-gray-200 hover:bg-gray-300"}`
                  }>
                  
                    Cancel
                  </button>
                  <button
                  onClick={handleRetry}
                  className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-[#8B7355] hover:bg-[#6d5a43] transition-all flex items-center justify-center gap-2">
                  
                    <FaRedo className="w-4 h-4" /> Retry
                  </button>
                </div>
              </div>
            }

            {}
            {paymentStatus === STATUS.EXPIRED &&
            <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                  <FaExclamationTriangle className="w-12 h-12 text-yellow-500" />
                </div>
                <p
                className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                
                  Payment Expired
                </p>
                <p
                className={`text-sm text-center mb-6 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                
                  The QR code has expired. Please generate a new one.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                  onClick={handleCancel}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                  isDark ?
                  "bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]" :
                  "text-gray-700 bg-gray-200 hover:bg-gray-300"}`
                  }>
                  
                    Cancel
                  </button>
                  <button
                  onClick={handleRetry}
                  className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-[#8B7355] hover:bg-[#6d5a43] transition-all flex items-center justify-center gap-2">
                  
                    <FaRedo className="w-4 h-4" /> New QR
                  </button>
                </div>
              </div>
            }

            {}
            {paymentStatus === STATUS.IDLE &&
            <div className="flex flex-col items-center py-12">
                <img
                src={gcashHeader}
                alt="GCash"
                className="mx-auto h-16 object-contain mb-6" />
              
                <p className="text-3xl font-bold text-orange-500 mb-6">
                  ₱{totalAmount.toFixed(2)}
                </p>
                <button
                onClick={initiatePayment}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-[#007DFE] hover:bg-[#0066CC] transition-all">
                
                  Generate QR Code
                </button>
              </div>
            }
          </div>
        </div>
      </div>

      {}
      <SuccessModal
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)} />
      

      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        receiptData={receiptData}
        onNewTransaction={handleNewTransaction}
        initialPrintError={printError}
        onPrintSuccess={handleNewTransaction}
        disableAutoPrint={true} />
      

      <PrintingModal isOpen={isAutoPrinting} />
    </>);

};

export default QRCodePaymentModal;