import React, { useState, useEffect, useCallback } from 'react';
import { FaPrint } from 'react-icons/fa';
import { MdRefresh } from 'react-icons/md';
import PrintingModal from './PrintingModal';
import PrintCompleteModal from './PrintCompleteModal';
import '../../styles/print.css';
import { sendReceiptToPrinter } from '../../utils/printBridge';
import { useTheme } from '../../context/ThemeContext';

const ReceiptModal = ({
  isOpen,
  onClose,
  receiptData,
  onNewTransaction,
  initialPrintError = null,
  onPrintSuccess = null,
  disableAutoPrint = false
}) => {
  const { theme } = useTheme();
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPrintComplete, setShowPrintComplete] = useState(false);
  const [printAttempts, setPrintAttempts] = useState(0);
  const [printError, setPrintError] = useState(null);

  const receipt = receiptData || {
    receiptNo: '000000',
    items: [],
    reference: '',
    paymentMethod: '',
    subtotal: 0.00,
    discount: 0.00,
    total: 0.00,
    cash: 0.00,
    change: 0.00,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString()
  };

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    setPrintAttempts((prev) => prev + 1);
    setPrintError(null);

    try {
      await sendReceiptToPrinter(receipt);
      if (onPrintSuccess) {
        onPrintSuccess();
      }
    } catch (error) {
      setPrintError(error.message || 'Unable to open print dialog. Please allow pop-ups.');
      setShowPrintComplete(true);
    } finally {
      setIsPrinting(false);
    }
  }, [receipt]);

  useEffect(() => {
    if (!isOpen) {
      setIsPrinting(false);
      setShowPrintComplete(false);
      setPrintAttempts(0);
      setPrintError(null);
      return;
    }

    setPrintError(initialPrintError);

    // Auto-print only when explicitly allowed. When this modal is
    // opened from payment flows that already attempted to print,
    // we skip the extra automatic print and let the user decide.
    if (disableAutoPrint) return;

    // Start printing immediately with minimal delay for UI rendering
    const autoPrintTimer = setTimeout(() => {
      handlePrint();
    }, 100);

    return () => clearTimeout(autoPrintTimer);
  }, [isOpen, disableAutoPrint, handlePrint]);

  useEffect(() => {
    if (printError && showPrintComplete) {
      const timer = setTimeout(() => {
        setShowPrintComplete(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [printError, showPrintComplete]);

  if (!isOpen) return null;

  const handlePrintSuccess = () => {
    setShowPrintComplete(false);
    setPrintError(null);
    if (onPrintSuccess) {
      onPrintSuccess();
    }
  };

  const handlePrintRetry = () => {
    setShowPrintComplete(false);
    setPrintError(null);
    handlePrint();
  };


  return (
    <>

      <div
        className="receipt-print-content"
        id="receipt-to-print"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '0',
          width: '58mm',
          background: 'white',
          padding: '10px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold' }}>Create Your Style</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '5px 0' }}>
            <span>{receipt.time || '12:00PM'}</span>
            <span>{receipt.contactNumber || '+631112224444'}</span>
          </div>
          <p style={{ fontSize: '10px', margin: '2px 0' }}>Pasonanca, Zamboanga City</p>
        </div>

        <div style={{ textAlign: 'center', margin: '10px 0', border: '1px dashed #000', padding: '8px 5px' }}>
          <p style={{ fontSize: '10px', margin: '2px 0' }}>Receipt No:</p>
          <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '2px 0' }}>#{receipt.receiptNo}</p>
        </div>

        <table style={{ width: '100%', fontSize: '10px', marginBottom: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '2px' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '2px' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '2px' }}>Price</th>
              <th style={{ textAlign: 'right', padding: '2px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items && receipt.items.map((item, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '2px', fontSize: '9px' }}>{item.name}</td>
                <td style={{ textAlign: 'center', padding: '2px' }}>{item.qty}</td>
                <td style={{ textAlign: 'right', padding: '2px' }}>₱{item.price.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '2px' }}>₱{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', paddingTop: '5px', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
            <span>Transaction/Reference:</span>
            <span>{receipt.referenceNo || receipt.reference || '-'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
            <span>Payment Method:</span>
            <span>{receipt.paymentMethod || 'CASH'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
            <span>Subtotal:</span>
            <span>PHP {receipt.subtotal.toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '5px 0', paddingTop: '5px' }}>
            {receipt.discounts && receipt.discounts.length > 0 ? (
              <>
                {receipt.discounts.map((d, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: '9px' }}>
                    <span>{d.title}</span>
                    <span>{d.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span>Total Discount:</span>
                  <span>PHP {receipt.discount.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Discount:</span>
                <span>PHP {receipt.discount.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontWeight: 'bold', fontSize: '12px' }}>
            <span>Total:</span>
            <span>PHP {receipt.total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
            <span>Cash:</span>
            <span>PHP {receipt.cash.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
            <span>Change:</span>
            <span>PHP {receipt.change.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '10px', fontWeight: 'bold' }}>
          <p>This is not an official receipt</p>
        </div>
      </div>

      {/* Regular modal view */}
      <div
        className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4 no-print"
      >
        <div className={`rounded-2xl w-full max-w-md relative shadow-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-4">
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Create Your Style</h2>
              <div className={`flex justify-between text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <span>{receipt.time || '12:00PM'}</span>
                <span>{receipt.contactNumber || '+631112224444'}</span>
              </div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Pasonanca, Zamboanga City</p>
            </div>

            {/* Receipt Number */}
            <div className={`border-2 border-dashed rounded-lg p-3 mb-4 text-center ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
              <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Receipt No:</p>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>#{receipt.receiptNo}</p>
            </div>

            {/* Items Table */}
            <div className="mb-4">
              {receipt.items && receipt.items.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Item</th>
                      <th className={`text-center py-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Qty</th>
                      <th className={`text-right py-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Price</th>
                      <th className={`text-right py-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item, index) => (
                      <tr key={index} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className={`py-2 text-left ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{item.name}</td>
                        <td className={`py-2 text-center ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{item.qty}</td>
                        <td className={`py-2 text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>PHP {item.price.toFixed(2)}</td>
                        <td className={`py-2 text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>PHP {item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500 py-4">No items in this transaction</p>
              )}
            </div>

            {/* Transaction Details */}
            <div className={`border-t border-dashed pt-3 mb-4 space-y-1 text-sm ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Transaction/Reference</span>
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>{receipt.referenceNo || receipt.reference || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Payment Method</span>
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>{receipt.paymentMethod || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Subtotal</span>
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>PHP {receipt.subtotal.toFixed(2)}</span>
              </div>
              <div className={`border-t border-dashed pt-2 mt-2 ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                {receipt.discounts && receipt.discounts.length > 0 ? (
                  <>
                    {receipt.discounts.map((d, idx) => (
                      <div key={idx} className={`flex justify-between text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        <span>{d.title}</span>
                        <span>{d.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between mt-1">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Total Discount</span>
                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>PHP {receipt.discount.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Discount</span>
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>PHP {receipt.discount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className={`flex justify-between font-bold text-base pt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <span>Total</span>
                <span>PHP {receipt.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Cash</span>
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>PHP {receipt.cash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Change</span>
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}>PHP {receipt.change.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer Message */}
            <div className="text-center py-4 mb-4">
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>This is not an official receipt</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {printError && (
                <div className={`p-3 rounded-lg text-sm ${theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
                  {printError}
                </div>
              )}
              <button
                onClick={handlePrint}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
              >
                <FaPrint />
                {printError ? 'Print Again' : 'Print Receipt'}
              </button>
              <button
                onClick={onNewTransaction}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-green-500 hover:bg-green-600 transition-all flex items-center justify-center gap-2"
              >
                <MdRefresh />
                New Transaction
              </button>
            </div>
          </div>
        </div>

        {/* Printing Animation Modal */}
        <PrintingModal isOpen={isPrinting} />

        {/* Print Completion Confirmation */}
        <PrintCompleteModal
          isOpen={showPrintComplete}
          onConfirm={handlePrintSuccess}
          onRetry={handlePrintRetry}
          error={printError}
        />
      </div>
    </>
  );
};

export default ReceiptModal;
