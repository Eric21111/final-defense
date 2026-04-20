import React, { useState, useEffect, useCallback } from 'react';
import { FaPrint } from 'react-icons/fa';
import { MdRefresh } from 'react-icons/md';
import PrintingModal from './PrintingModal';
import PrintCompleteModal from './PrintCompleteModal';
import '../../styles/print.css';
import { sendReceiptToPrinter } from '../../utils/printBridge';
import { getReceiptBranding } from '../../utils/receiptProfile';
import { formatReceiptVariantSizeLine } from '../../utils/transactionDisplay';
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

  const branding = getReceiptBranding();
  const tinDisplay = receipt.birTinSnapshot ?? branding.storeTin;
  const ptuDisplay = receipt.birPtuSnapshot ?? branding.ptuNumber;
  const showBirHeader =
    (receipt.birCompliantEnabled ?? branding.birCompliantEnabled) &&
    (tinDisplay || ptuDisplay);
  const showBirVat =
    receipt.netOfVat != null &&
    receipt.vatAmount != null;
  const totalPay = Number(receipt.total ?? receipt.totalAmount ?? 0);
  const netOfVatAmount = Number(receipt.netOfVat ?? 0);
  const vatAmount = Number(receipt.vatAmount ?? 0);
  const vatExemptSales = Math.max(0, totalPay - netOfVatAmount - vatAmount);

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




    if (disableAutoPrint) return;


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
          padding: '10px',
          fontFamily: 'Arial, sans-serif'
        }}>
        
        {}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold', color: '#1a365d' }}>{branding.storeName}</h2>
          {branding.receiptTagline ?
          <p style={{ fontSize: '9px', margin: '2px 0', color: '#718096' }}>{branding.receiptTagline}</p> :
          null}
          <p style={{ fontSize: '10px', margin: '2px 0', color: '#4a5568' }}>{branding.location}</p>
          {showBirHeader ?
          <div style={{ marginTop: '6px', fontSize: '9px', color: '#4a5568' }}>
            {tinDisplay ? <div>TIN: {tinDisplay}</div> : null}
            {ptuDisplay ? <div>PTU: {ptuDisplay}</div> : null}
          </div> :
          null}
        </div>
        <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>

        {}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <p style={{ fontSize: '10px', margin: '2px 0', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px' }}>Receipt</p>
          <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '2px 0', color: '#2d3748' }}>#{receipt.receiptNo}</p>
        </div>

        {}
        <div style={{ fontSize: '11px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: '#4a5568' }}>Date:</span>
            <span style={{ color: '#1a202c' }}>{receipt.date}, {receipt.time}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: '#4a5568' }}>Cashier:</span>
            <span style={{ color: '#1a202c' }}>{receipt.cashierName || 'Staff'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: '#4a5568' }}>Payment:</span>
            <span style={{ color: '#1a202c' }}>{receipt.paymentMethod || 'Cash'}</span>
          </div>
        </div>
        <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>

        {}
        <div style={{ marginBottom: '10px' }}>
          {receipt.items && receipt.items.map((item, index) =>
          <div key={index} style={{ marginBottom: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', margin: '0', color: '#1a202c' }}>{item.name}</p>
              <p style={{ fontSize: '10px', margin: '2px 0', color: '#718096' }}>{item.qty} x PHP {item.price.toFixed(2)}</p>
            </div>
          )}
        </div>
        <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>

        {}
        <div style={{ fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: '#4a5568' }}>Subtotal:</span>
            <span style={{ color: '#1a202c' }}>PHP {receipt.subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: '#4a5568' }}>Discount:</span>
            <span style={{ color: '#1a202c' }}>PHP {receipt.discount.toFixed(2)}</span>
          </div>
          {showBirVat ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', paddingTop: '6px' }}>
                <span style={{ color: '#4a5568' }}>Net (vatable) sales:</span>
                <span style={{ color: '#1a202c' }}>PHP {Number(receipt.netOfVat).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                <span style={{ color: '#4a5568' }}>VAT {Number(receipt.vatRateApplied ?? branding.vatRatePercent)}%:</span>
                <span style={{ color: '#1a202c' }}>PHP {Number(receipt.vatAmount).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', paddingTop: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#1a365d', fontSize: '13px' }}>Total (incl. VAT):</span>
                <span style={{ fontWeight: 'bold', color: '#1a365d', fontSize: '13px' }}>PHP {totalPay.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', paddingTop: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#1a365d', fontSize: '13px' }}>Total:</span>
              <span style={{ fontWeight: 'bold', color: '#1a365d', fontSize: '13px' }}>PHP {receipt.total.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: '#4a5568' }}>Amount Received:</span>
            <span style={{ color: '#1a202c' }}>PHP {receipt.cash.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: '#4a5568' }}>Change:</span>
            <span style={{ color: '#1a202c' }}>PHP {receipt.change.toFixed(2)}</span>
          </div>
        </div>
        <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px', marginTop: '10px' }}></div>

        {}
        <div style={{ textAlign: 'center', paddingTop: '5px' }}>
          <p style={{ fontSize: '11px', color: '#4a5568', margin: '2px 0' }}>{branding.thankYouMessage}</p>
          <p style={{ fontSize: '10px', color: '#a0aec0', margin: '2px 0' }}>{branding.disclaimer}</p>
        </div>
      </div>

      {}
      <div
        className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4 no-print">
        
        <div className={`rounded-2xl w-full max-w-md relative shadow-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
          <div className="p-6">
            {}
            <div className="text-center mb-4">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1a365d]'}`}>{branding.storeName}</h2>
              {branding.receiptTagline ?
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{branding.receiptTagline}</p> :
              null}
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{branding.location}</p>
              {showBirHeader ?
              <div className={`text-xs mt-2 space-y-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                {tinDisplay ? <p>TIN: {tinDisplay}</p> : null}
                {ptuDisplay ? <p>PTU: {ptuDisplay}</p> : null}
              </div> :

              null}
            </div>

            {}
            <div className={`border-t border-b border-dashed py-4 mb-4 text-center ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
              <p className={`text-xs uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Receipt</p>
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-[#2d3748]'}`}>#{receipt.receiptNo}</p>
            </div>

            {}
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Date:</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{receipt.date}, {receipt.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Cashier:</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{receipt.cashierName || 'Staff'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Payment:</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{receipt.paymentMethod || 'Cash'}</span>
              </div>
            </div>

            {}
            <div className={`border-t pt-4 mb-4 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              {receipt.items && receipt.items.length > 0 ?
              receipt.items.map((item, index) => {
                const variantSizeLine = formatReceiptVariantSizeLine(item);
                return (
              <div key={index} className="mb-3">
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{item.name}</p>
                    {variantSizeLine &&
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{variantSizeLine}</p>
                    }
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{item.qty} x PHP {item.price.toFixed(2)}</p>
                  </div>
                );
              }) :

              <p className="text-center text-gray-500 py-4">No items in this transaction</p>
              }
            </div>

            {}
            <div className={`border-t pt-4 space-y-2 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Subtotal:</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP {receipt.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Discount:</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP {receipt.discount.toFixed(2)}</span>
              </div>
              {showBirVat ? (
                <>
                  <div className="flex justify-between text-sm pt-2">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Net (vatable) sales:</span>
                    <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP {netOfVatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>VAT {Number(receipt.vatRateApplied ?? branding.vatRatePercent)}%:</span>
                    <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP {vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>VAT Exempt Sales:</span>
                    <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP {vatExemptSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Zero-Sales:</span>
                    <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP 0.00</span>
                  </div>
                  <div className={`flex justify-between pt-3 mt-2 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1a365d]'}`}>Total (incl. VAT):</span>
                    <span className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-[#1a365d]'}`}>PHP {totalPay.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className={`flex justify-between pt-3 mt-2 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-[#1a365d]'}`}>Total:</span>
                  <span className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-[#1a365d]'}`}>PHP {receipt.total.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Amount Received:</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP {receipt.cash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Change:</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>PHP {receipt.change.toFixed(2)}</span>
              </div>
            </div>

            {}
            <div className={`text-center py-6 mt-4 border-t border-dashed ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{branding.thankYouMessage}</p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{branding.disclaimer}</p>
            </div>

            {}
            <div className="space-y-3">
              <button
                onClick={handlePrint}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
                
                <FaPrint />
                {printError ? 'Print Again' : 'Print Receipt'}
              </button>
              <button
                onClick={onNewTransaction}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-green-500 hover:bg-green-600 transition-all flex items-center justify-center gap-2">
                
                <MdRefresh />
                New Transaction
              </button>
            </div>
          </div>
        </div>

        {}
        <PrintingModal isOpen={isPrinting} />

        {}
        <PrintCompleteModal
          isOpen={showPrintComplete}
          onConfirm={handlePrintSuccess}
          onRetry={handlePrintRetry}
          error={printError} />
        
      </div>
    </>);

};

export default ReceiptModal;