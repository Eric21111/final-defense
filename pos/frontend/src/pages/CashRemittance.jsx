import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { API_ENDPOINTS } from "../config/api";
import {
    FaMoneyBillWave, FaSearch, FaFileInvoiceDollar, FaCheckCircle,
    FaExclamationTriangle, FaChartLine, FaHandHoldingUsd,
    FaBalanceScale, FaClock, FaTimes, FaPrint
} from "react-icons/fa";

const DENOMINATIONS = [
    { key: "p1000", label: "₱1,000", value: 1000 },
    { key: "p500", label: "₱500", value: 500 },
    { key: "p200", label: "₱200", value: 200 },
    { key: "p100", label: "₱100", value: 100 },
    { key: "p50", label: "₱50", value: 50 },
    { key: "p20", label: "₱20", value: 20 },
    { key: "p10", label: "₱10", value: 10 },
    { key: "p5", label: "₱5", value: 5 },
    { key: "p1", label: "₱1", value: 1 },
    { key: "c25", label: "25¢", value: 0.25 },
    { key: "c10", label: "10¢", value: 0.10 },
    { key: "c5", label: "5¢", value: 0.05 },
];

const formatCurrency = (val) => {
    const abs = Math.abs(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `-₱${abs}` : `₱${abs}`;
};

const formatAbs = (val) =>
    `₱${Math.abs(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── KPI Card ────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, color, subtext }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="text-white text-sm" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">{label}</span>
        </div>
        <p className="text-xl font-extrabold text-gray-800 truncate">{value}</p>
        {subtext && <p className="text-[10px] text-gray-400 truncate">{subtext}</p>}
    </div>
);

// ─── Receipt Side Panel ──────────────────────────────────────
const ReceiptPanel = ({ remit, onClose }) => {
    if (!remit) {
        return (
            <div className="w-full lg:w-[380px] flex-shrink-0">
                {/* Opening Float placeholder */}
                <div className="bg-gradient-to-r from-[#1A3A5C] to-[#2A5A8C] rounded-2xl p-4 mb-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-blue-200 uppercase tracking-wider font-bold">Global Opening Float</p>
                            <p className="text-2xl font-extrabold text-white mt-1">{formatCurrency(2000)}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <FaMoneyBillWave className="text-white text-lg" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800">Cash Turn-Over Slip</h3>
                    </div>
                    <div className="p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
                        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
                            <FaFileInvoiceDollar className="text-gray-300 text-2xl" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-400 mb-1">No Slip Selected</h4>
                        <p className="text-xs text-gray-400">Click a remittance row to view its receipt here.</p>
                    </div>
                </div>
            </div>
        );
    }

    const denoms = remit.denominations || {};
    const denomEntries = DENOMINATIONS
        .map(d => ({ ...d, qty: denoms[d.key] || 0 }))
        .filter(d => d.qty > 0);

    const handlePrint = () => {
        const printContent = document.getElementById("receipt-print-area");
        if (!printContent) return;
        const win = window.open("", "_blank", "width=400,height=700");
        win.document.write(`
            <html><head><title>Cash Turn-Over Slip</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 20px; font-size: 12px; }
                .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                .row { display: flex; justify-content: space-between; padding: 2px 0; }
                .section { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; }
                .bold { font-weight: bold; }
                .big { font-size: 16px; }
            </style></head><body>${printContent.innerHTML}</body></html>
        `);
        win.document.close();
        win.print();
    };

    return (
        <div className="w-full lg:w-[380px] flex-shrink-0">
            {/* Opening Float */}
            <div className="bg-gradient-to-r from-[#1A3A5C] to-[#2A5A8C] rounded-2xl p-4 mb-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-blue-200 uppercase tracking-wider font-bold">Global Opening Float</p>
                        <p className="text-2xl font-extrabold text-white mt-1">{formatCurrency(remit.openingFloat || 2000)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <FaMoneyBillWave className="text-white text-lg" />
                    </div>
                </div>
            </div>

            {/* Receipt Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Receipt Header Actions */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800">Cash Turn-Over Slip</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" title="Print">
                            <FaPrint className="text-sm" />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" title="Close">
                            <FaTimes className="text-sm" />
                        </button>
                    </div>
                </div>

                <div id="receipt-print-area" className="p-5 space-y-4 max-h-[calc(100vh-340px)] overflow-y-auto">
                    {/* Official Header */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
                        <p className="text-[9px] text-amber-600 uppercase tracking-[3px] font-bold">Official Document</p>
                        <h4 className="text-base font-extrabold text-gray-800 mt-1">Cash Turn-Over Slip</h4>
                    </div>

                    {/* Slip Details */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Slip No.</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5 font-mono">CTS-{remit._id.slice(-6).toUpperCase()}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Date</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5">
                                {new Date(remit.shiftDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                            </p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Time</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5">
                                {new Date(remit.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Cashier</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5">{remit.employeeName}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Float</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5">{formatCurrency(remit.openingFloat || 2000)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Received By</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5">{remit.receivedBy || "—"}</p>
                        </div>
                    </div>

                    {/* Z-Reading Section */}
                    <div className="border border-gray-200 rounded-xl p-3">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-2">Z-Reading (Machine Reading)</p>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Gross Sales</span>
                                <span className="font-bold text-gray-700">{formatCurrency(remit.grossSales)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Less: Returns</span>
                                <span className="font-bold text-red-500">({formatAbs(remit.returns)})</span>
                            </div>
                            <div className="border-t border-dashed border-gray-200 pt-1.5 flex justify-between text-xs">
                                <span className="font-bold text-gray-700">Net Z-Reading</span>
                                <span className="font-extrabold text-gray-800">{formatCurrency(remit.netSales)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Cash Count Breakdown */}
                    {denomEntries.length > 0 && (
                        <div className="border border-gray-200 rounded-xl p-3">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-2">Cash Count Breakdown</p>
                            <div className="space-y-1">
                                {denomEntries.map(d => (
                                    <div key={d.key} className="flex justify-between text-xs">
                                        <span className="text-gray-500">{d.label} × {d.qty}</span>
                                        <span className="font-medium text-gray-700">{formatCurrency(d.qty * d.value)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-dashed border-gray-200 pt-1.5 flex justify-between text-xs">
                                    <span className="font-bold text-gray-700">Total Cash on Hand</span>
                                    <span className="font-extrabold text-gray-800">{formatCurrency(remit.totalCashOnHand)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Remittance Computation */}
                    <div className="border border-gray-200 rounded-xl p-3">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-2">Remittance Computation</p>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Total Cash in Drawer</span>
                                <span className="font-bold text-gray-700">{formatCurrency(remit.totalCashOnHand)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Less: Opening Float</span>
                                <span className="font-bold text-red-500">({formatAbs(remit.openingFloat || 2000)})</span>
                            </div>
                            <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between items-center">
                                <span className="text-sm font-extrabold text-gray-800">CASH TO REMIT</span>
                                <span className="text-lg font-extrabold text-gray-900">{formatCurrency(remit.cashToRemit)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Variance Badge */}
                    <div className={`rounded-xl p-3 text-center ${remit.variance === 0 ? 'bg-green-50 border border-green-200' :
                        remit.variance > 0 ? 'bg-blue-50 border border-blue-200' :
                            'bg-red-50 border border-red-200'
                        }`}>
                        <p className="text-[9px] uppercase tracking-wider font-bold mb-1 text-gray-400">Variance</p>
                        <p className={`text-xl font-extrabold ${remit.variance === 0 ? 'text-green-600' :
                            remit.variance > 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                            {remit.variance > 0 ? '+' : ''}{formatCurrency(remit.variance)}
                            <span className="text-xs ml-2 font-bold">
                                — {remit.variance === 0 ? 'BALANCED' : remit.variance > 0 ? 'OVER' : 'SHORT'}
                            </span>
                        </p>
                    </div>

                    {/* Remarks */}
                    {remit.remarks && (
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-1">Remarks</p>
                            <p className="text-xs text-gray-600">{remit.remarks}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main Page ───────────────────────────────────────────────
const CashRemittance = () => {
    const { isOwner, hasPermission } = useAuth();
    const [remittances, setRemittances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedRemittance, setSelectedRemittance] = useState(null);

    const fetchRemittances = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(API_ENDPOINTS.remittances);
            const data = await res.json();
            if (data.success) {
                setRemittances(data.data);
            } else {
                setError(data.message || "Failed to load remittances.");
            }
        } catch (err) {
            console.error("Error fetching remittances:", err);
            setError("Unable to connect to the server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRemittances(); }, []);

    // Auto-select first remittance when data loads
    useEffect(() => {
        if (remittances.length > 0 && !selectedRemittance) {
            setSelectedRemittance(remittances[0]);
        }
    }, [remittances]);

    // ─── Compute KPIs from today's remittances ──────────────
    const kpis = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayRemittances = remittances.filter(r => {
            const d = new Date(r.shiftDate);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
        });

        const totalNetSales = todayRemittances.reduce((sum, r) => sum + (r.netSales || 0), 0);
        const totalRemitted = todayRemittances.reduce((sum, r) => sum + (r.cashToRemit || 0), 0);
        const totalVariance = todayRemittances.reduce((sum, r) => sum + (r.variance || 0), 0);
        const unremittedCash = totalNetSales - totalRemitted;

        return {
            totalNetSales,
            totalRemitted,
            totalVariance,
            unremittedCash: unremittedCash > 0 ? unremittedCash : 0,
            count: todayRemittances.length
        };
    }, [remittances]);

    const filteredRemittances = remittances.filter(remit => {
        const matchesSearch = remit.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            remit._id.slice(-6).includes(searchTerm);

        const variance = remit.variance || 0;
        let matchesStatus = true;
        if (statusFilter === "BALANCED") matchesStatus = variance === 0;
        if (statusFilter === "OVER") matchesStatus = variance > 0;
        if (statusFilter === "SHORT") matchesStatus = variance < 0;

        return matchesSearch && matchesStatus;
    });

    if (!isOwner() && !hasPermission("viewTransactions")) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="text-center p-8 bg-red-50 rounded-2xl max-w-sm border border-red-100">
                    <FaFileInvoiceDollar className="mx-auto text-4xl text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-red-700 mb-2">Access Denied</h2>
                    <p className="text-red-500 text-sm">You do not have permission to view cash remittances.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <FaMoneyBillWave className="text-[#22C55E]" />
                        Cash Remittances
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Review end-of-shift reports and drawer variances.
                    </p>
                </div>
                <button
                    onClick={fetchRemittances}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-800 transition-colors shadow-sm text-sm font-medium cursor-pointer"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* ─── KPI Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard
                    icon={FaChartLine}
                    label="Total Net Sales"
                    value={formatCurrency(kpis.totalNetSales)}
                    color="bg-gradient-to-br from-emerald-500 to-green-600"
                    subtext="Today's revenue"
                />
                <KpiCard
                    icon={FaHandHoldingUsd}
                    label="Total Remitted"
                    value={formatCurrency(kpis.totalRemitted)}
                    color="bg-gradient-to-br from-blue-500 to-indigo-600"
                    subtext={`${kpis.count} remittance${kpis.count !== 1 ? 's' : ''} today`}
                />
                <KpiCard
                    icon={FaBalanceScale}
                    label="Total Variance"
                    value={`${kpis.totalVariance > 0 ? '+' : ''}${formatCurrency(kpis.totalVariance)}`}
                    color={kpis.totalVariance === 0 ? "bg-gradient-to-br from-green-500 to-emerald-600" : kpis.totalVariance > 0 ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-gradient-to-br from-red-500 to-rose-600"}
                    subtext={kpis.totalVariance === 0 ? "All balanced ✓" : kpis.totalVariance < 0 ? "⚠ Cash shortage" : "Cash over"}
                />
                <KpiCard
                    icon={FaClock}
                    label="Unremitted Cash"
                    value={formatCurrency(kpis.unremittedCash)}
                    color="bg-gradient-to-br from-amber-500 to-orange-600"
                    subtext="Outstanding today"
                />
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Cashier Name or Ref ID..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1">
                    {['ALL', 'BALANCED', 'OVER', 'SHORT'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === status
                                ? status === 'BALANCED' ? 'bg-green-100 text-green-700 shadow-sm'
                                    : status === 'OVER' ? 'bg-blue-100 text-blue-700 shadow-sm'
                                        : status === 'SHORT' ? 'bg-red-100 text-red-700 shadow-sm'
                                            : 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Split Layout: Table + Receipt ──────────────── */}
            <div className="flex gap-6 items-start">
                {/* Data Table */}
                <div className={`flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="py-4 px-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Date & Time</th>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Cashier</th>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Net Sales</th>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Cash to Remit</th>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Variance</th>
                                    <th className="py-4 px-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center">
                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#22C55E]"></div>
                                            <p className="mt-2 text-sm text-gray-500">Loading remittances...</p>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center">
                                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-3">
                                                <FaExclamationTriangle className="text-red-500 text-xl" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-800">Error loading data</p>
                                            <p className="text-xs text-red-500 mt-1">{error}</p>
                                        </td>
                                    </tr>
                                ) : filteredRemittances.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-16 text-center">
                                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 border border-gray-100">
                                                <FaFileInvoiceDollar className="text-gray-300 text-2xl" />
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-800 mb-1">No Remittances Found</h3>
                                            <p className="text-xs text-gray-500">
                                                {searchTerm || statusFilter !== 'ALL'
                                                    ? "Try adjusting your filters."
                                                    : "No cash remittances have been submitted yet."}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRemittances.map((remit) => (
                                        <tr
                                            key={remit._id}
                                            onClick={() => setSelectedRemittance(remit)}
                                            className={`transition-colors group cursor-pointer ${selectedRemittance?._id === remit._id
                                                ? 'bg-green-50/50 border-l-[3px] border-l-[#22C55E]'
                                                : 'hover:bg-gray-50/50'
                                                }`}
                                        >
                                            <td className="py-4 px-5">
                                                <p className="text-sm font-semibold text-gray-800">
                                                    {new Date(remit.shiftDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {new Date(remit.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </td>
                                            <td className="py-4 px-5">
                                                <p className="text-sm font-semibold text-gray-800">{remit.employeeName}</p>
                                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                    #{remit._id.slice(-6).toUpperCase()}
                                                </p>
                                            </td>
                                            <td className="py-4 px-5 text-right">
                                                <span className="text-sm font-medium text-gray-600">
                                                    {formatCurrency(remit.netSales)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-5 text-right">
                                                <span className="text-sm font-bold text-gray-800">
                                                    {formatCurrency(remit.cashToRemit)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-5 text-right">
                                                <span className={`text-sm font-bold ${remit.variance === 0 ? 'text-green-600' :
                                                    remit.variance > 0 ? 'text-blue-600' : 'text-red-600'
                                                    }`}>
                                                    {remit.variance > 0 ? '+' : ''}{formatCurrency(remit.variance)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${remit.variance === 0 ? 'bg-green-100 text-green-700' :
                                                    remit.variance > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {remit.variance === 0 ? <FaCheckCircle /> : <FaExclamationTriangle />}
                                                    {remit.variance === 0 ? 'Balanced' : remit.variance > 0 ? 'Over' : 'Short'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Receipt Side Panel — always visible */}
                <ReceiptPanel
                    remit={selectedRemittance}
                    onClose={() => setSelectedRemittance(null)}
                />
            </div>

            <div className="mt-4 text-center">
                <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                    Remittances are automatically recorded here when cashiers submit their end-of-shift reports.
                </p>
            </div>
        </div>
    );
};

export default CashRemittance;
