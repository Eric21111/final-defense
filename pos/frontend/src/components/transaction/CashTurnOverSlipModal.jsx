import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPrint, FaCheck } from "react-icons/fa";

// The DENOMINATIONS array is passed from RemittanceModal or defined here
const DENOMINATIONS = [
    { key: "p1000", label: "₱1,000" },
    { key: "p500", label: "₱500" },
    { key: "p200", label: "₱200" },
    { key: "p100", label: "₱100" },
    { key: "p50", label: "₱50" },
    { key: "p20", label: "₱20" },
    { key: "p10", label: "₱10" },
    { key: "p5", label: "₱5" },
    { key: "p1", label: "₱1" },
    { key: "c25", label: "25¢" },
    { key: "c10", label: "10¢" },
    { key: "c5", label: "5¢" }
];

const formatCurrency = (val) => {
    const abs = Math.abs(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `-₱${abs}` : `₱${abs}`;
};

const formatAbs = (val) =>
    `₱${Math.abs(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CashTurnOverSlipModal = ({
    isOpen,
    onClose,
    summary,
    denominations,
    totalCashOnHand,
    openingFloat,
    cashToRemit,
    variance,
    employeeName,
    receivedBy,
    slipNo = "CTS-2PQ5T", // In a real app, this should come from the backend response
    storeName = "Santos General Merchandise" // Can come from merchant settings later
}) => {
    const printRef = useRef(null);

    const handlePrint = () => {
        // Implement printing logic here
        // For example, open a new window and print the contents of printRef.current
        const printContent = printRef.current.innerHTML;
        const printWindow = window.open("", "", "width=800,height=900");
        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Cash Turn-Over Slip</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        /* Add more styles to match the React components for printing */
                        .print-container { max-width: 600px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        ${printContent}
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    const varianceLabel = variance === 0 ? "BALANCED" : variance > 0 ? "OVER" : "SHORT";
    const varianceColorClass = variance === 0 ? "text-green-600 bg-green-50" : variance > 0 ? "text-blue-600 bg-blue-50" : "text-red-500 bg-red-50";

    // Filter out denominations with zero qty
    const nonZeroDenominations = DENOMINATIONS.map(d => ({
        ...d,
        qty: denominations[d.key] || 0,
        amount: (denominations[d.key] || 0) * (
            d.key.startsWith('p') ? parseInt(d.key.slice(1)) : parseInt(d.key.slice(1)) / 100
        )
    })).filter(d => d.qty > 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 flex flex-col items-center justify-center z-[200] p-4 sm:p-6 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto cursor-pointer"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-full overflow-hidden relative z-10 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Scrollable Content */}
                        <div className="overflow-y-auto flex-1 p-0" ref={printRef}>
                            {/* Header */}
                            <div className="bg-[#1A3A5C] text-white p-6 text-center">
                                <p className="text-[10px] font-semibold tracking-widest text-blue-200 uppercase mb-2">
                                    Official Document
                                </p>
                                <h2 className="text-xl font-serif font-bold mb-1">Cash Turn-Over Slip</h2>
                                <p className="text-xs text-blue-100 font-medium">{storeName}</p>
                            </div>

                            <div className="p-6 bg-[#FaFaFa]">
                                {/* Meta Info */}
                                <div className="grid grid-cols-2 gap-y-4 mb-6">
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Slip No.</p>
                                        <p className="text-sm font-semibold text-gray-800">{slipNo}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Date</p>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {new Date(summary.shiftDate || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Time</p>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Cashier</p>
                                        <p className="text-sm font-semibold text-gray-800">{employeeName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Float</p>
                                        <p className="text-sm font-semibold text-gray-800">{formatCurrency(openingFloat)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Type</p>
                                        <p className="text-sm font-semibold text-gray-800">Regular</p>
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-gray-300 mb-6"></div>

                                {/* Z-Reading */}
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                                    <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-3">Z-Reading (Machine Reading)</p>

                                    <div className="flex justify-between items-center mb-1 text-sm text-gray-700">
                                        <span>Gross Sales</span>
                                        <span className="font-semibold text-gray-800">{formatCurrency(summary.grossSales)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-3 text-sm text-gray-600">
                                        <span>Less: Returns</span>
                                        <span className="font-semibold text-red-500">({formatAbs(summary.returns)})</span>
                                    </div>

                                    <div className="border-t border-blue-200 my-3"></div>

                                    <div className="flex justify-between items-center text-sm font-bold text-blue-900">
                                        <span>Net Z-Reading</span>
                                        <span>{formatCurrency(summary.netSales)}</span>
                                    </div>
                                </div>

                                {/* Cash Count Breakdown */}
                                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Cash Count Breakdown</p>

                                    {nonZeroDenominations.length > 0 ? (
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                                            {nonZeroDenominations.map(d => (
                                                <div key={d.key} className="flex gap-2 w-[calc(50%-8px)]">
                                                    <span className="text-gray-400 w-12">{d.label}×{d.qty}</span>
                                                    <span className="font-bold text-gray-700">{formatCurrency(d.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : totalCashOnHand > 0 ? (
                                        <p className="text-xs text-gray-600">
                                            Quick total: <span className="font-semibold">{formatCurrency(totalCashOnHand)}</span>
                                            {" "}(no per-denomination breakdown).
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">No cash counted.</p>
                                    )}
                                </div>

                                {/* Remittance Computation */}
                                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Remittance Computation</p>

                                    <div className="flex justify-between items-center mb-1 text-sm text-gray-700">
                                        <span>Total Cash in Drawer</span>
                                        <span className="font-semibold text-gray-800">{formatCurrency(totalCashOnHand)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-3 text-sm text-gray-600">
                                        <span>Less: Opening Float</span>
                                        <span className="font-semibold text-red-500">({formatAbs(openingFloat)})</span>
                                    </div>

                                    <div className="border-t-2 border-gray-800 my-3"></div>

                                    <div className="flex justify-between items-center font-bold text-gray-900 mb-4">
                                        <span className="uppercase tracking-wide text-sm">Cash to Remit</span>
                                        <span className="text-lg">{formatCurrency(cashToRemit)}</span>
                                    </div>

                                    <div className={`flex justify-between items-center p-3 rounded-md text-sm font-bold ${varianceColorClass}`}>
                                        <span className="uppercase tracking-widest text-[10px]">Variance</span>
                                        <span>
                                            {variance < 0 ? "-" : variance > 0 ? "+" : ""}{formatAbs(variance)} — {varianceLabel}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-gray-300 mb-8"></div>

                                {/* Signatures */}
                                <div className="flex justify-between gap-6 mb-6">
                                    <div className="flex-1 text-center">
                                        <p className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{employeeName}</p>
                                        <div className="border-t border-gray-400 mb-1 w-full"></div>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Prepared & Counted By</p>
                                    </div>
                                    <div className="flex-1 text-center">
                                        <p className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{receivedBy || "Pending"}</p>
                                        <div className="border-t border-gray-400 mb-1 w-full"></div>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Received & Verified By</p>
                                    </div>
                                </div>

                                <p className="text-center text-[10px] text-gray-400">
                                    Official Cash Turn-Over Slip — Keep for your records
                                </p>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={handlePrint}
                                className="flex items-center justify-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-white transition-colors cursor-pointer"
                            >
                                <FaPrint className="text-gray-500" />
                                Print
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[#1A3A5C] text-white font-bold rounded-lg hover:bg-[#11263d] transition-colors shadow-md cursor-pointer"
                            >
                                <FaCheck />
                                Done
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CashTurnOverSlipModal;
