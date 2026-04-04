import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaClipboardList, FaCoins, FaFileAlt, FaTimes, FaCheck, FaChevronDown } from "react-icons/fa";
import { API_ENDPOINTS } from "../../config/api";
import CashTurnOverSlipModal from "./CashTurnOverSlipModal";


const DENOMINATIONS = [
    { key: "p1000", label: "₱1000", value: 1000, bg: "#DBEAFE", text: "#1E40AF" },
    { key: "p500", label: "₱500", value: 500, bg: "#FEF9C3", text: "#CA8A04" },
    { key: "p200", label: "₱200", value: 200, bg: "#DCFCE7", text: "#166534" },
    { key: "p100", label: "₱100", value: 100, bg: "#EDE9FE", text: "#6B21A8" },
    { key: "p50", label: "₱50", value: 50, bg: "#FCE7F3", text: "#BE185D" },
    { key: "p20", label: "₱20", value: 20, bg: "#FFEDD5", text: "#C2410C" },
    { key: "p10", label: "₱10", value: 10, bg: "#FAFAF9", text: "#171717" },
    { key: "p5", label: "₱5", value: 5, bg: "#FAFAF9", text: "#171717" },
    { key: "p1", label: "₱1", value: 1, bg: "#FAFAF9", text: "#171717" },
    { key: "c25", label: "25¢", value: 0.25, bg: "#F3F4F6", text: "#111827" },
    { key: "c10", label: "10¢", value: 0.10, bg: "#F3F4F6", text: "#111827" },
    { key: "c5", label: "5¢", value: 0.05, bg: "#F3F4F6", text: "#111827" },
];

const formatCurrency = (val) => {
    const abs = Math.abs(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `-₱${abs}` : `₱${abs}`;
};

// For values displayed inside parentheses (deductions) — always show positive
const formatAbs = (val) =>
    `₱${Math.abs(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StepIndicator = ({ currentStep }) => {
    const steps = [
        { num: 1, label: "Summary" },
        { num: 2, label: "Cash Drawer" },
        { num: 3, label: "Remittance Report" },
    ];

    return (
        <div className="flex items-center justify-center gap-0 mb-6">
            {steps.map((step, i) => (
                <React.Fragment key={step.num}>
                    <div className="flex flex-col items-center">
                        <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${currentStep >= step.num
                                ? "bg-[#22C55E] text-white shadow-md"
                                : "bg-gray-200 text-gray-400"
                                }`}
                        >
                            {currentStep > step.num ? <FaCheck className="text-xs" /> : step.num}
                        </div>
                        <span
                            className={`text-[10px] mt-1 font-medium ${currentStep >= step.num ? "text-[#22C55E]" : "text-gray-400"
                                }`}
                        >
                            {step.label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div
                            className={`w-16 h-0.5 mb-4 mx-1 rounded ${currentStep > step.num ? "bg-[#22C55E]" : "bg-gray-200"
                                }`}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const RemittanceModal = ({ isOpen, onClose, employeeId, employeeName }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [summary, setSummary] = useState({
        shiftDate: new Date(),
        grossSales: 0,
        returns: 0,
        netSales: 0,
        noOfSales: 0,
        alreadyRemittedToday: false,
        remittedAmountToday: 0,
        remittedAtToday: null,
    });
    const [denominations, setDenominations] = useState(
        DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.key]: 0 }), {})
    );
    const [remarks, setRemarks] = useState("");
    const [receivedBy, setReceivedBy] = useState("");
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [showSlip, setShowSlip] = useState(false);
    const [openingFloat, setOpeningFloat] = useState(2000);
    const [quickTotalOpen, setQuickTotalOpen] = useState(true);
    const [manualTotalInput, setManualTotalInput] = useState("");

    const totalFromDenominations = React.useMemo(
        () =>
            DENOMINATIONS.reduce(
                (sum, d) => sum + (denominations[d.key] || 0) * d.value,
                0
            ),
        [denominations]
    );

    const parsedManualTotal = React.useMemo(() => {
        const t = manualTotalInput.trim().replace(/,/g, "");
        if (t === "") return null;
        const n = parseFloat(t);
        return Number.isFinite(n) && n >= 0 ? n : null;
    }, [manualTotalInput]);

    const useManualTotal = parsedManualTotal !== null;
    const totalCashOnHand = useManualTotal ? parsedManualTotal : totalFromDenominations;
    const cashToRemit = totalCashOnHand - openingFloat;
    const variance = cashToRemit - summary.netSales;

    const fetchGlobalFloat = useCallback(async () => {
        try {
            const res = await fetch(API_ENDPOINTS.globalSettings);
            const data = await res.json();
            if (data.success && data.data) {
                setOpeningFloat(data.data.openingFloat || 2000);
            }
        } catch (err) {
            console.error("Error fetching global settings:", err);
        }
    }, []);

    const fetchSummary = useCallback(async () => {
        if (!employeeId) return;
        setLoading(true);
        try {
            const res = await fetch(
                `${API_ENDPOINTS.remittanceSummary}?employeeId=${employeeId}`
            );
            const data = await res.json();
            if (data.success) {
                setSummary(data.data);
            }
        } catch (err) {
            console.error("Error fetching remittance summary:", err);
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setDenominations(
                DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.key]: 0 }), {})
            );
            setRemarks("");
            setReceivedBy("");
            setSubmitSuccess(false);
            setShowSlip(false);
            setQuickTotalOpen(true);
            setManualTotalInput("");
            fetchSummary();
            fetchGlobalFloat();
        }
    }, [isOpen, fetchSummary, fetchGlobalFloat]);

    const handleDenominationChange = (key, value) => {
        const num = parseInt(value) || 0;
        setDenominations((prev) => ({ ...prev, [key]: Math.max(0, num) }));
    };

    const handleSubmit = async () => {
        if (summary.alreadyRemittedToday) {
            alert(`You already remitted today.\nAmount remitted: ${formatCurrency(summary.remittedAmountToday || 0)}`);
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(API_ENDPOINTS.remittances, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId,
                    employeeName,
                    shiftDate: summary.shiftDate,
                    grossSales: summary.grossSales,
                    returns: summary.returns,
                    netSales: summary.netSales,
                    noOfSales: summary.noOfSales,
                    denominations,
                    totalCashOnHand,
                    openingFloat,
                    cashToRemit,
                    expectedCash: summary.netSales,
                    variance,
                    remarks,
                    receivedBy,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSubmitSuccess(true);
                setTimeout(() => {
                    setShowSlip(true);
                }, 1000); // Shorter delay so it pops up faster
            } else {
                if (data.code === "ALREADY_REMITTED_TODAY") {
                    const amount = data?.data?.amountRemitted;
                    const amountText = typeof amount === "number" ? formatCurrency(amount) : null;
                    alert(
                        amountText
                            ? `You already remitted today.\nAmount remitted: ${amountText}`
                            : (data.message || "You already remitted today.")
                    );
                    return;
                }

                alert("Failed to submit remittance: " + (data.message || "Unknown error"));
            }
        } catch (err) {
            console.error("Error submitting remittance:", err);
            alert("Failed to submit remittance. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const varianceLabel =
        variance === 0
            ? "BALANCED"
            : variance > 0
                ? "OVER"
                : "SHORT";
    const varianceColor =
        variance === 0
            ? "text-green-600"
            : variance > 0
                ? "text-blue-600"
                : "text-red-600";

    return (
        <AnimatePresence>
            {isOpen && showSlip && (
                <CashTurnOverSlipModal
                    isOpen={true}
                    onClose={onClose}
                    summary={summary}
                    denominations={denominations}
                    totalCashOnHand={totalCashOnHand}
                    openingFloat={openingFloat}
                    cashToRemit={cashToRemit}
                    variance={variance}
                    employeeName={employeeName}
                    receivedBy={receivedBy}
                />
            )}

            {isOpen && !showSlip && (
                <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-10 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                {step === 1 && <FaClipboardList className="text-[#22C55E] text-lg" />}
                                {step === 2 && <FaCoins className="text-[#22C55E] text-lg" />}
                                {step === 3 && <FaFileAlt className="text-[#22C55E] text-lg" />}
                                <h2 className="text-lg font-bold text-gray-800">
                                    {step === 1 && "Cash Remittance"}
                                    {step === 2 && "Count Your Cash Drawer"}
                                    {step === 3 && "Cash Remittance"}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {step === 2 && (
                            <p className="text-xs text-gray-500 px-6 pt-2">
                                Count all cash in your drawer (including the float). Use{" "}
                                <span className="font-semibold text-gray-700">Quick entry</span> below to type one total,{" "}
                                <span className="font-semibold text-gray-700">or</span> enter quantity per denomination.
                            </p>
                        )}

                        <div className="p-6">
                            <StepIndicator currentStep={step} />

                            {/* Success overlay */}
                            {submitSuccess && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center py-12"
                                >
                                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                        <FaCheck className="text-green-600 text-2xl" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">Remittance Submitted!</h3>
                                    <p className="text-sm text-gray-500">Your remittance has been recorded successfully.</p>
                                </motion.div>
                            )}

                            {/* Step 1: Review Your Sales */}
                            {step === 1 && !submitSuccess && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">Review Your Sales</h3>

                                    {loading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22C55E]" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                                <p className="text-xs text-gray-500 mb-3 font-medium">
                                                    Summary — {new Date(summary.shiftDate).toLocaleDateString("en-US", {
                                                        month: "long",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </p>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Gross Sales</span>
                                                        <span className="font-semibold text-gray-800">
                                                            {formatCurrency(summary.grossSales)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Less: (Returns/Refunds)</span>
                                                        <span className="font-semibold text-red-500">
                                                            ({formatAbs(summary.returns)})
                                                        </span>
                                                    </div>

                                                    <div className="border-t border-gray-200 my-2" />

                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-700 font-semibold">Net Sales</span>
                                                        <span className="font-bold text-gray-800">
                                                            {formatCurrency(summary.netSales)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">No. of Sales</span>
                                                        <span className="font-semibold text-gray-800">{summary.noOfSales}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {summary.alreadyRemittedToday ? (
                                                <div className="bg-black/60 backdrop-blur-sm border border-white/20 rounded-xl p-4 mb-3">
                                                    <p className="text-sm font-semibold text-red-300">
                                                        You already remitted today.
                                                    </p>
                                                    <p className="text-xs text-gray-200 mt-1">
                                                        Exact amount remitted:
                                                    </p>
                                                    <p className="text-lg font-extrabold text-white mt-1">
                                                        {formatCurrency(summary.remittedAmountToday || 0)}
                                                    </p>
                                                    {summary.remittedAtToday && (
                                                        <p className="text-[11px] text-gray-300 mt-2">
                                                            Submitted at {new Date(summary.remittedAtToday).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-6">
                                                    <p className="text-xs text-blue-700">
                                                        💡 This is your machine reading. You will now count the physical cash in your
                                                        drawer and remit the difference after deducting your opening float of{" "}
                                                        {formatCurrency(openingFloat)}.
                                                    </p>
                                                </div>
                                            )}

                                            {!summary.alreadyRemittedToday && (
                                                <button
                                                    onClick={() => setStep(2)}
                                                    className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
                                                >
                                                    Proceed
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Step 2: Count Your Cash Drawer */}
                            {step === 2 && !submitSuccess && (
                                <div>
                                    <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setQuickTotalOpen((o) => !o)}
                                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                                        >
                                            <span className="flex items-center gap-2 flex-wrap">
                                                Quick entry — total cash counted
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-[#16A34A] bg-green-100 px-1.5 py-0.5 rounded">
                                                    Optional
                                                </span>
                                            </span>
                                            <FaChevronDown
                                                className={`text-gray-400 shrink-0 transition-transform ${quickTotalOpen ? "rotate-180" : ""}`}
                                            />
                                        </button>
                                        {quickTotalOpen && (
                                            <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-white">
                                                <p className="text-[11px] text-gray-500 mb-2">
                                                    Enter the full amount you counted. Leave empty to use denomination quantities
                                                    below.
                                                </p>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-sm text-gray-600 shrink-0">₱</span>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={manualTotalInput}
                                                        onChange={(e) => setManualTotalInput(e.target.value)}
                                                        placeholder="e.g. 6520.50"
                                                        className="flex-1 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/30"
                                                    />
                                                    {manualTotalInput.trim() !== "" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setManualTotalInput("")}
                                                            className="text-xs font-medium text-[#22C55E] hover:underline shrink-0"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                                {useManualTotal && (
                                                    <p className="text-[11px] text-amber-700 mt-2 bg-amber-50 rounded-lg px-2 py-1.5">
                                                        Using this total. Denomination fields are disabled — clear quick entry to
                                                        count by bill/coin.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {!quickTotalOpen && (
                                        <p className="text-[11px] text-[#16A34A] mb-2 -mt-1 px-0.5">
                                            Tip: open <span className="font-semibold">Quick entry</span> above to type the total instead of counting each bill.
                                        </p>
                                    )}

                                    <p className="text-[11px] font-semibold text-gray-500 mb-2 mt-1">
                                        {useManualTotal ? "Denomination breakdown (disabled while using quick entry)" : "Or count by denomination"}
                                    </p>
                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                        {DENOMINATIONS.map((d) => (
                                            <div key={d.key} className="flex flex-col items-center">
                                                <div
                                                    className="w-full text-center text-xs font-bold py-1.5 rounded-lg mb-1 border border-black/5"
                                                    style={{ backgroundColor: d.bg, color: d.text }}
                                                >
                                                    {d.label}
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    disabled={useManualTotal}
                                                    value={denominations[d.key] || ""}
                                                    onChange={(e) =>
                                                        handleDenominationChange(d.key, e.target.value)
                                                    }
                                                    placeholder="0"
                                                    className={`w-full text-center border border-gray-200 rounded-lg py-1.5 text-sm focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/30 ${useManualTotal ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                                                />
                                                <span className="text-[10px] text-gray-400 mt-0.5">
                                                    {formatCurrency((denominations[d.key] || 0) * d.value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Totals */}
                                    <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-3">
                                        <div className="flex justify-between items-center gap-2">
                                            <div>
                                                <span className="text-sm font-semibold text-green-700">Total Counted</span>
                                                {useManualTotal && (
                                                    <span className="ml-2 text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                                        Quick entry
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-lg font-bold text-green-700">
                                                {formatCurrency(totalCashOnHand)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 mb-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total Cash on Hand</span>
                                            <span className="font-semibold">{formatCurrency(totalCashOnHand)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Less: Opening Float</span>
                                            <span className="font-semibold text-red-500">
                                                ({formatAbs(openingFloat)})
                                            </span>
                                        </div>

                                        <div className="border-t border-gray-200 my-1" />

                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700 font-semibold">Cash to Remit</span>
                                            <span className="text-xl font-bold text-gray-800">
                                                {formatCurrency(cashToRemit)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Variance</span>
                                            <span className={`font-semibold ${varianceColor}`}>
                                                {variance > 0 ? "+" : ""}{formatCurrency(variance)} — {varianceLabel} {variance === 0 && "✓"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-4">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={() => setStep(3)}
                                            className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
                                        >
                                            Review & Confirm
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Confirm & Submit */}
                            {step === 3 && !submitSuccess && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">Confirm and Submit</h3>

                                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                        <p className="text-xs text-gray-500 font-medium mb-3">Remittance Summary</p>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Net Sales</span>
                                                <span className="font-semibold">{formatCurrency(summary.netSales)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Total Cash on Hand</span>
                                                <span className="font-semibold">{formatCurrency(totalCashOnHand)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Less Opening Float</span>
                                                <span className="font-semibold text-red-500">
                                                    ({formatAbs(openingFloat)})
                                                </span>
                                            </div>

                                            <div className="border-t border-gray-200 my-2" />

                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-gray-700">Cash to Remit</span>
                                                <span className="text-xl font-bold text-gray-800">
                                                    {formatCurrency(cashToRemit)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Variance</span>
                                                <span className={`font-semibold ${varianceColor}`}>
                                                    {variance > 0 ? "+" : ""}{formatCurrency(variance)} — {varianceLabel}{" "}
                                                    {variance === 0 && "✓"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remarks */}
                                    <div className="mb-3">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Remarks / Explanation for Variance
                                        </label>
                                        <textarea
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            placeholder="eg. Reason for shortage or overage..."
                                            rows={3}
                                            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/30 resize-none"
                                        />
                                    </div>

                                    {/* Received By */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Received by (Owner / Manager)
                                        </label>
                                        <input
                                            type="text"
                                            value={receivedBy}
                                            onChange={(e) => setReceivedBy(e.target.value)}
                                            placeholder="Full Name"
                                            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/30"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep(2)}
                                            className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                            className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                            {submitting ? "Submitting..." : "Confirm"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default RemittanceModal;
