import React, { useState, useEffect, useMemo, forwardRef } from "react";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useAuth } from "../context/AuthContext";
import { API_ENDPOINTS } from "../config/api";
import Header from "../components/shared/header";
import {
    FaMoneyBillWave, FaSearch, FaFileInvoiceDollar, FaCheckCircle,
    FaExclamationTriangle, FaChartLine, FaHandHoldingUsd,
    FaBalanceScale, FaClock, FaTimes, FaPrint, FaPlus,
    FaCalendarAlt, FaUser
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

const formatFloatTimestamp = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const OPENING_FLOAT_ALLOWED_ROLES = new Set([
    "Cashier",
    "Subcashier",
    "Sub-Cashier",
    "Manager",
    "Owner",
]);

const isSameLocalDay = (left, right = new Date()) => {
    const a = new Date(left);
    const b = new Date(right);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
};

const weekOpts = { weekStartsOn: 1 };

const getPresetBounds = (preset) => {
    const now = new Date();
    switch (preset) {
        case "today": {
            const s = startOfDay(now);
            return { start: s, end: s };
        }
        case "yesterday": {
            const y = subDays(startOfDay(now), 1);
            return { start: y, end: y };
        }
        case "week": {
            return {
                start: startOfWeek(now, weekOpts),
                end: startOfDay(endOfWeek(now, weekOpts))
            };
        }
        case "month": {
            return {
                start: startOfMonth(now),
                end: startOfDay(endOfMonth(now))
            };
        }
        default:
            return null;
    }
};

const remitDay = (r) => startOfDay(new Date(r.shiftDate || r.createdAt));

const isWithinDayBounds = (r, start, end) => {
    const d = remitDay(r);
    return d >= start && d <= end;
};


const KpiCard = ({
    icon: Icon,
    label,
    value,
    barGradient = "linear-gradient(180deg, #2563EB 0%, #3B82F6 100%)",
    iconBg = "bg-blue-50",
    iconColor = "text-blue-500",
    textColor = "text-blue-500",
    valueColor = "text-gray-900"
}) => (
    <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 p-5 min-w-0 min-h-[88px] overflow-hidden">
        <div
            className="absolute left-0 top-0 bottom-0 w-2"
            style={{ backgroundImage: barGradient }}
        />
        <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <p className={`text-2xl lg:text-3xl font-black truncate tracking-tight ${valueColor}`}>{value}</p>
                <p className={`text-xs lg:text-sm font-bold truncate ${textColor}`}>{label}</p>
            </div>
            <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`text-xl ${iconColor}`} />
            </div>
        </div>
    </div>
);


const ReceiptContent = ({ remit }) => {
    if (!remit) {
        return (
            <div className="p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
                    <FaFileInvoiceDollar className="text-gray-300 text-2xl" />
                </div>
                <h4 className="text-sm font-bold text-gray-400 mb-1">No Slip Selected</h4>
                <p className="text-xs text-gray-400">Click a remittance row to view its receipt here.</p>
            </div>
        );
    }

    const denoms = remit.denominations || {};
    const denomEntries = DENOMINATIONS
        .map(d => ({ ...d, qty: denoms[d.key] || 0 }))
        .filter(d => d.qty > 0);

    return (
        <div>
            {/* ── Dark Navy Header ── */}
            <div className="bg-gradient-to-br from-[#1A2744] to-[#2A3F5F] px-4 py-3 text-center">
                <p className="text-[8px] text-gray-400 uppercase tracking-[3px] font-mono">Official Document</p>
                <h4 className="text-sm font-extrabold text-white mt-0.5 font-serif italic">Cash Turn-Over Slip</h4>
                <p className="text-[9px] text-gray-400 mt-0.5">Santos General Merchandise</p>
            </div>

            {/* ── Slip Details ── */}
            <div className="bg-gray-50 px-3 py-2.5 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                    <div>
                        <p className="text-[8px] text-gray-400 uppercase tracking-wider font-mono font-bold">Slip No.</p>
                        <p className="text-xs font-bold text-gray-800 font-mono">CTS-{remit._id.slice(-5).toUpperCase()}</p>
                    </div>
                    <div>
                        <p className="text-[8px] text-gray-400 uppercase tracking-wider font-mono font-bold">Date</p>
                        <p className="text-xs font-bold text-gray-800">
                            {new Date(remit.shiftDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                    </div>
                    <div>
                        <p className="text-[8px] text-gray-400 uppercase tracking-wider font-mono font-bold">Time</p>
                        <p className="text-xs font-bold text-gray-800">
                            {new Date(remit.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </div>
                    <div>
                        <p className="text-[8px] text-gray-400 uppercase tracking-wider font-mono font-bold">Cashier</p>
                        <p className="text-xs font-bold text-gray-800">{remit.employeeName}</p>
                    </div>
                    <div>
                        <p className="text-[8px] text-gray-400 uppercase tracking-wider font-mono font-bold">Float</p>
                        <p className="text-xs font-bold text-gray-800">{formatCurrency(remit.openingFloat || 2000)}</p>
                    </div>
                    <div>
                        <p className="text-[8px] text-gray-400 uppercase tracking-wider font-mono font-bold">Type</p>
                        <p className="text-xs font-bold text-gray-800">Regular</p>
                    </div>
                </div>
            </div>

            <div className="px-3 py-2 space-y-2">
                {/* ── Z-Reading Section ── */}
                <div className="border-l-3 border-blue-500 bg-blue-50/40 rounded-r-lg px-2.5 py-2">
                    <p className="text-[8px] text-gray-500 uppercase tracking-wider font-mono font-bold mb-1">Z-Reading (Machine Reading)</p>
                    <div className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">Gross Sales</span>
                            <span className="font-bold text-gray-800">{formatCurrency(remit.grossSales)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">Less: Returns</span>
                            <span className="font-bold text-red-500">({formatAbs(remit.returns)})</span>
                        </div>
                        <div className="border-t border-dashed border-gray-300 pt-1 flex justify-between text-xs">
                            <span className="font-bold text-gray-700">Net Z-Reading</span>
                            <span className="font-extrabold text-gray-900">{formatCurrency(remit.netSales)}</span>
                        </div>
                    </div>
                </div>

                {/* ── Cash Count Breakdown ── */}
                {denomEntries.length > 0 && (
                    <div className="border-l-3 border-blue-500 bg-blue-50/40 rounded-r-lg px-2.5 py-2">
                        <p className="text-[8px] text-gray-500 uppercase tracking-wider font-mono font-bold mb-1">Cash Count Breakdown</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {denomEntries.map(d => (
                                <span key={d.key} className="text-[10px] text-gray-700">
                                    <span className="font-mono text-gray-500">{d.label}×{d.qty}</span>
                                    {' '}
                                    <span className="font-bold">{formatCurrency(d.qty * d.value)}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Remittance Computation ── */}
                <div className="border-l-3 border-blue-500 bg-blue-50/40 rounded-r-lg px-2.5 py-2">
                    <p className="text-[8px] text-gray-500 uppercase tracking-wider font-mono font-bold mb-1">Remittance Computation</p>
                    <div className="space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">Total Cash in Drawer</span>
                            <span className="font-bold text-gray-800">{formatCurrency(remit.totalCashOnHand)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">Less: Opening Float</span>
                            <span className="font-bold text-gray-800">({formatAbs(remit.openingFloat || 2000)})</span>
                        </div>
                        <div className="border-t border-dashed border-gray-300 pt-1 flex justify-between items-center">
                            <span className="text-xs font-extrabold text-gray-900 tracking-wide">CASH TO REMIT</span>
                            <span className="text-sm font-extrabold text-gray-900">{formatCurrency(remit.cashToRemit)}</span>
                        </div>
                    </div>
                </div>

                {/* ── Variance Badge ── */}
                <div className={`rounded-lg px-2.5 py-2 flex items-center justify-between ${remit.variance === 0 ? 'bg-green-50 border border-green-200' :
                    remit.variance > 0 ? 'bg-blue-50 border border-blue-200' :
                        'bg-red-50 border border-red-200'
                    }`}>
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${remit.variance === 0 ? 'text-green-600' :
                        remit.variance > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>Variance</span>
                    <span className={`text-xs font-extrabold ${remit.variance === 0 ? 'text-green-600' :
                        remit.variance > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                        {formatCurrency(remit.variance)} — {remit.variance === 0 ? 'BALANCED' : remit.variance > 0 ? 'OVER' : 'SHORT'}
                    </span>
                </div>
            </div>
        </div>
    );
};

const CalendarTrigger = forwardRef(({ onClick, className }, ref) => (
    <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={className}
        aria-label="Pick date range"
    >
        <FaCalendarAlt className="text-gray-500 text-sm" />
    </button>
));
CalendarTrigger.displayName = "CalendarTrigger";

// ─── Main Page ───────────────────────────────────────────────
const CashRemittance = () => {
    const { isOwner, hasPermission } = useAuth();
    const [remittances, setRemittances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [salesSort, setSalesSort] = useState("");
    const [datePreset, setDatePreset] = useState("today");
    const [dateRange, setDateRange] = useState([null, null]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedRemittance, setSelectedRemittance] = useState(null);
    const [userFilter, setUserFilter] = useState("");
    const [staffList, setStaffList] = useState([]);

    // Opening Floats
    const [globalFloat, setGlobalFloat] = useState(2000);
    const [openingFloatEntries, setOpeningFloatEntries] = useState([]);
    const [showFloatModal, setShowFloatModal] = useState(false);
    const [floatInput, setFloatInput] = useState("");
    const [selectedFloatEmployeeId, setSelectedFloatEmployeeId] = useState("");
    const [savingFloat, setSavingFloat] = useState(false);

    const fetchGlobalFloat = async () => {
        try {
            const res = await fetch(API_ENDPOINTS.globalSettings);
            const data = await res.json();
            if (data.success && data.data) {
                setGlobalFloat(data.data.openingFloat || 2000);
                setOpeningFloatEntries(Array.isArray(data.data.openingFloats) ? data.data.openingFloats : []);
            }
        } catch (err) {
            console.error("Error fetching global settings:", err);
        }
    };

    const handleSaveFloat = async () => {
        const val = parseFloat(floatInput);
        const selectedEmployee = staffList.find((employee) => String(employee._id) === selectedFloatEmployeeId);
        const selectedEmployeeName =
            selectedEmployee?.name ||
            `${selectedEmployee?.firstName || ""} ${selectedEmployee?.lastName || ""}`.trim();

        if (isNaN(val) || val < 0 || !selectedFloatEmployeeId || !selectedEmployeeName) return;
        setSavingFloat(true);
        try {
            const res = await fetch(API_ENDPOINTS.globalSettings, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addOpeningFloat: {
                        employeeId: selectedFloatEmployeeId,
                        employeeName: selectedEmployeeName,
                        amount: val
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                setGlobalFloat(data.data.openingFloat || 2000);
                setOpeningFloatEntries(Array.isArray(data.data.openingFloats) ? data.data.openingFloats : []);
                setFloatInput("");
                setShowFloatModal(false);
            }
        } catch (err) {
            console.error("Error saving float:", err);
        } finally {
            setSavingFloat(false);
        }
    };

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

    useEffect(() => {
        fetchRemittances();
        fetchGlobalFloat();
        (async () => {
            try {
                const res = await fetch(API_ENDPOINTS.employees);
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    setStaffList(
                        data.data.filter(
                            (e) =>
                                e.status === "Active" &&
                                OPENING_FLOAT_ALLOWED_ROLES.has(String(e.role || "").trim())
                        )
                    );
                }
            } catch (err) {
                console.error("Error fetching employees:", err);
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedFloatEmployeeId && staffList.length > 0) {
            setSelectedFloatEmployeeId(String(staffList[0]._id));
        }
    }, [selectedFloatEmployeeId, staffList]);

    const [startDate, endDate] = dateRange;

    const dateFilteredRemittances = useMemo(() => {
        if (datePreset === "all") return remittances;
        if (datePreset === "custom") {
            if (!startDate) return remittances;
            const end = endDate || startDate;
            const lo = startOfDay(startDate) <= startOfDay(end) ? startOfDay(startDate) : startOfDay(end);
            const hi = startOfDay(startDate) <= startOfDay(end) ? startOfDay(end) : startOfDay(startDate);
            return remittances.filter((remit) => isWithinDayBounds(remit, lo, hi));
        }
        const bounds = getPresetBounds(datePreset);
        if (!bounds) return remittances;
        return remittances.filter((remit) => isWithinDayBounds(remit, bounds.start, bounds.end));
    }, [remittances, datePreset, startDate, endDate]);

    const userDropdownOptions = useMemo(() => {
        const map = new Map();
        staffList.forEach((e) => {
            if (e?._id) {
                const label = (e.name || `${e.firstName || ""} ${e.lastName || ""}`).trim() || "Unknown";
                map.set(String(e._id), label);
            }
        });
        remittances.forEach((r) => {
            const id = r.employeeId ? String(r.employeeId) : "";
            if (id && r.employeeName && !map.has(id)) map.set(id, r.employeeName);
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [staffList, remittances]);

    const userFilterLabel = useMemo(() => {
        if (!userFilter) return "";
        return userDropdownOptions.find((o) => o.id === userFilter)?.name || "";
    }, [userFilter, userDropdownOptions]);

    const openingFloatGroups = useMemo(() => {
        const groups = new Map();

        openingFloatEntries
            .filter((entry) => isSameLocalDay(entry?.businessDate || entry?.createdAt))
            .forEach((entry) => {
            const employeeId = String(entry?.employeeId || "");
            if (!employeeId) return;

            const existing = groups.get(employeeId) || {
                employeeId,
                employeeName: entry.employeeName || "Unknown",
                total: 0,
                entries: []
            };

            existing.employeeName = entry.employeeName || existing.employeeName;
            existing.total += Number(entry.amount) || 0;
            existing.entries.push(entry);

            groups.set(employeeId, existing);
        });

        return Array.from(groups.values())
            .map((group) => ({
                ...group,
                entries: [...group.entries].sort(
                    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                )
            }))
            .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }, [openingFloatEntries]);

    const todaysOpeningFloatEntries = useMemo(
        () => openingFloatEntries.filter((entry) => isSameLocalDay(entry?.businessDate || entry?.createdAt)),
        [openingFloatEntries]
    );

    const totalAssignedOpeningFloats = useMemo(
        () => todaysOpeningFloatEntries.reduce((sum, entry) => sum + (Number(entry?.amount) || 0), 0),
        [todaysOpeningFloatEntries]
    );

    const baseFiltered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return dateFilteredRemittances.filter((remit) => {
            const matchesSearch =
                !q ||
                remit.employeeName?.toLowerCase().includes(q) ||
                remit._id.slice(-6).toLowerCase().includes(q);

            const matchesUser =
                !userFilter ||
                String(remit.employeeId || "") === userFilter ||
                (!remit.employeeId && userFilterLabel && remit.employeeName === userFilterLabel);

            const variance = remit.variance || 0;
            let matchesStatus = true;
            if (statusFilter === "BALANCED") matchesStatus = variance === 0;
            if (statusFilter === "OVER") matchesStatus = variance > 0;
            if (statusFilter === "SHORT") matchesStatus = variance < 0;

            return matchesSearch && matchesUser && matchesStatus;
        });
    }, [dateFilteredRemittances, searchTerm, statusFilter, userFilter, userFilterLabel]);

    const displayRows = useMemo(() => {
        if (salesSort === "highest") {
            return [...baseFiltered].sort((a, b) => (b.netSales || 0) - (a.netSales || 0));
        }
        if (salesSort === "lowest") {
            return [...baseFiltered].sort((a, b) => (a.netSales || 0) - (b.netSales || 0));
        }
        return baseFiltered;
    }, [baseFiltered, salesSort]);

    const kpiPeriodLabel = useMemo(() => {
        if (datePreset === "all") return "All dates";
        if (datePreset === "custom" && !startDate) return "Select a range in the calendar";
        if (datePreset === "custom" && startDate && endDate) {
            const lo = startOfDay(startDate) <= startOfDay(endDate) ? startDate : endDate;
            const hi = startOfDay(startDate) <= startOfDay(endDate) ? endDate : startDate;
            const s = lo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const e = hi.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return startOfDay(lo).getTime() === startOfDay(hi).getTime() ? s : `${s} – ${e}`;
        }
        if (datePreset === "custom" && startDate) {
            return startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
        if (datePreset === "today") return "Today";
        if (datePreset === "yesterday") return "Yesterday";
        if (datePreset === "week") return "This week";
        if (datePreset === "month") return "This month";
        return "All dates";
    }, [datePreset, startDate, endDate]);

    /** Same local calendar window as the table; send ms so the server matches without TZ drift from toISOString+setHours. */
    const kpiQueryKey = useMemo(() => {
        if (datePreset === "all") return { all: true };
        if (datePreset === "custom" && !startDate) return { all: true };
        if (datePreset === "custom") {
            const end = endDate || startDate;
            const first = startOfDay(startDate) <= startOfDay(end) ? startDate : end;
            const last = startOfDay(startDate) <= startOfDay(end) ? endDate || startDate : startDate;
            return {
                startMs: startOfDay(first).getTime(),
                endMs: endOfDay(last).getTime()
            };
        }
        const b = getPresetBounds(datePreset);
        if (!b) return { all: true };
        return {
            startMs: startOfDay(b.start).getTime(),
            endMs: endOfDay(b.end).getTime()
        };
    }, [datePreset, startDate, endDate]);

    const [kpiStats, setKpiStats] = useState({
        posNetSales: 0,
        totalRemitted: 0,
        totalVariance: 0,
        unremittedCash: 0
    });
    const [kpiLoading, setKpiLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setKpiLoading(true);
            try {
                const params = new URLSearchParams();
                if (!kpiQueryKey.all) {
                    params.set("startMs", String(kpiQueryKey.startMs));
                    params.set("endMs", String(kpiQueryKey.endMs));
                }
                if (userFilter) params.set("employeeId", userFilter);
                const qs = params.toString();
                const res = await fetch(
                    `${API_ENDPOINTS.remittanceKpiStats}${qs ? `?${qs}` : ""}`
                );
                const data = await res.json();
                if (cancelled) return;
                if (data.success && data.data) {
                    setKpiStats({
                        posNetSales: data.data.posNetSales ?? 0,
                        totalRemitted: data.data.totalRemitted ?? 0,
                        totalVariance: data.data.totalVariance ?? 0,
                        unremittedCash: data.data.unremittedCash ?? 0
                    });
                } else {
                    setKpiStats({
                        posNetSales: 0,
                        totalRemitted: 0,
                        totalVariance: 0,
                        unremittedCash: 0
                    });
                }
            } catch (err) {
                console.error("Error loading remittance KPI stats:", err);
                if (!cancelled) {
                    setKpiStats({
                        posNetSales: 0,
                        totalRemitted: 0,
                        totalVariance: 0,
                        unremittedCash: 0
                    });
                }
            } finally {
                if (!cancelled) setKpiLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [kpiQueryKey, userFilter]);

    useEffect(() => {
        if (displayRows.length === 0) {
            setSelectedRemittance(null);
            return;
        }
        const id = selectedRemittance?._id;
        const still = id && displayRows.some((r) => r._id === id);
        if (!still) setSelectedRemittance(displayRows[0]);
    }, [displayRows, selectedRemittance?._id]);

    const handleDatePresetChange = (e) => {
        const v = e.target.value;
        setDatePreset(v);
        if (v === "all") {
            setDateRange([null, null]);
        } else if (v === "custom") {
            setPickerOpen(true);
        } else {
            const b = getPresetBounds(v);
            if (b) setDateRange([b.start, b.end]);
        }
    };

    const handlePrint = () => {
        if (!selectedRemittance) return;
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
        <div className="p-8 min-h-screen animate-fade-in pb-24" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <Header pageName="Cash Remittance" showBorder={false} profileBackground="" />
            {/* ═══════ ROW 1: KPIs (left) | Opening Float (right) ═══════ */}
            <div className="flex gap-6 items-start mb-6 mt-4">
                {/* Left: 4 KPI Cards */}
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 mb-2">
                        Totals — {kpiPeriodLabel}
                        {userFilterLabel ? ` · ${userFilterLabel}` : ""}
                    </p>
                    <div className={`grid grid-cols-4 gap-3 min-w-0 ${kpiLoading ? "opacity-70" : ""}`}>
                    <KpiCard
                        icon={FaChartLine}
                        label="Total Net Sales"
                        value={kpiLoading ? "…" : formatCurrency(kpiStats.posNetSales)}
                        barGradient="linear-gradient(180deg, #2563EB 0%, #3B82F6 100%)"
                        iconBg="bg-blue-50"
                        iconColor="text-blue-500"
                        textColor="text-blue-500"
                        valueColor="text-blue-600"
                    />
                    <KpiCard
                        icon={FaHandHoldingUsd}
                        label="Total Remitted"
                        value={kpiLoading ? "…" : formatCurrency(kpiStats.totalRemitted)}
                        barGradient="linear-gradient(180deg, #0EA5A4 0%, #22C55E 100%)"
                        iconBg="bg-green-50"
                        iconColor="text-green-500"
                        textColor="text-green-500"
                        valueColor="text-green-600"
                    />
                    <KpiCard
                        icon={FaBalanceScale}
                        label="Total Variance"
                        value={kpiLoading ? "…" : `${kpiStats.totalVariance > 0 ? "+" : ""}${formatCurrency(kpiStats.totalVariance)}`}
                        barGradient="linear-gradient(180deg, #D97706 0%, #F59E0B 100%)"
                        iconBg="bg-amber-50"
                        iconColor="text-amber-500"
                        textColor="text-amber-500"
                        valueColor="text-amber-600"
                    />
                    <KpiCard
                        icon={FaClock}
                        label="Outstanding (Unremitted)"
                        value={kpiLoading ? "…" : formatCurrency(kpiStats.unremittedCash)}
                        barGradient="linear-gradient(180deg, #B91C1C 0%, #EF4444 100%)"
                        iconBg="bg-red-50"
                        iconColor="text-red-500"
                        textColor="text-red-500"
                        valueColor="text-red-600"
                    />
                    </div>
                    {datePreset === "all" && (
                        <p className="text-[10px] text-gray-400 mt-2 leading-snug">
                            All dates: totals include every sale and every slip in the system.
                        </p>
                    )}
                </div>

                {/* Right: Opening Float — white card matching reference */}
                <div className="w-[380px] flex-shrink-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-full">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-3xl font-black text-gray-800">{formatCurrency(totalAssignedOpeningFloats || globalFloat)}</p>
                                <p className="text-sm font-semibold text-gray-400 mt-1">Today's Assigned Opening Floats</p>
                            </div>
                            {isOwner() && (
                                <button
                                    onClick={() => {
                                        setFloatInput("");
                                        setSelectedFloatEmployeeId((prev) => prev || String(staffList[0]?._id || ""));
                                        setShowFloatModal(true);
                                    }}
                                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer shadow-sm"
                                >
                                    <FaPlus className="text-xs" /> New
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════ Opening Float Edit Modal ═══════ */}
            {showFloatModal && (
                <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={() => setShowFloatModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-800">Set Opening Float</h3>
                            <button onClick={() => setShowFloatModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer"><FaTimes /></button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">Assign opening float amounts to eligible staff. Multiple entries for the same cashier are combined, and only today's entries are used in today's remittance.</p>
                        <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] gap-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                    Cashier
                                </label>
                                <select
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 mb-3"
                                    value={selectedFloatEmployeeId}
                                    onChange={(e) => setSelectedFloatEmployeeId(e.target.value)}
                                >
                                    <option value="">Select employee</option>
                                    {staffList.map((employee) => {
                                        const label =
                                            employee.name ||
                                            `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
                                            "Unknown";
                                        return (
                                            <option key={employee._id} value={employee._id}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                    Float Amount
                                </label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 mb-4"
                                    placeholder="e.g. 2000"
                                    value={floatInput}
                                    onChange={e => setFloatInput(e.target.value)}
                                    autoFocus
                                />
                                <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 mb-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-green-600">Total assigned floats</p>
                                    <p className="text-xl font-black text-green-700 mt-1">
                                        {formatCurrency(totalAssignedOpeningFloats)}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-bold text-gray-800">Today's Floats Per Employee</h4>
                                    <span className="text-xs text-gray-400">{todaysOpeningFloatEntries.length} entr{todaysOpeningFloatEntries.length === 1 ? "y" : "ies"}</span>
                                </div>
                                <div className="max-h-[320px] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                                    {openingFloatGroups.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-sm font-semibold text-gray-500">No opening floats assigned for today.</p>
                                            <p className="text-xs text-gray-400 mt-1">Tomorrow will start fresh automatically because only today's entries are counted.</p>
                                        </div>
                                    ) : (
                                        openingFloatGroups.map((group) => (
                                            <div key={group.employeeId} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800">{group.employeeName}</p>
                                                        <p className="text-[11px] text-gray-400">{group.entries.length} float entr{group.entries.length === 1 ? "y" : "ies"}</p>
                                                    </div>
                                                    <div className="text-sm font-black text-green-600">{formatCurrency(group.total)}</div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {group.entries.map((entry) => (
                                                        <div key={entry._id || `${group.employeeId}-${entry.createdAt}`} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2">
                                                            <span>{formatFloatTimestamp(entry.createdAt) || "Saved float"}</span>
                                                            <span className="font-bold text-gray-800">{formatCurrency(entry.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button onClick={() => setShowFloatModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
                            <button
                                onClick={handleSaveFloat}
                                disabled={savingFloat || !floatInput || !selectedFloatEmployeeId}
                                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
                            >
                                {savingFloat ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ ROW 2+3: Left Column (search + table) | Right Column (receipt) ═══════ */}
            <div className="flex gap-6 items-start">
                {/* ─── LEFT COLUMN ─── */}
                <div className="flex-1 min-w-0 space-y-4">
                    {/* Search & Filters */}
                    <div className="flex items-center gap-3">
                        {/* Terminal-style Search Bar */}
                        <div className="relative flex-1">
                            <div
                                className="absolute left-1 top-1/2 transform -translate-y-1/2 w-10 h-9 flex items-center justify-center text-white rounded-xl"
                                style={{ background: "linear-gradient(135deg, #AD7F65 0%, #76462B 100%)" }}
                            >
                                <FaSearch className="text-sm" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search For..."
                                className="w-full h-11 pl-14 pr-4 border border-gray-200 bg-white text-gray-900 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent transition-colors text-sm placeholder-gray-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* Filter dropdowns */}
                        <select
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                            value={salesSort}
                            onChange={(e) => setSalesSort(e.target.value)}
                        >
                            <option value="">By Sales</option>
                            <option value="highest">Highest First</option>
                            <option value="lowest">Lowest First</option>
                        </select>
                        <select
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                        >
                            <option value="">All users</option>
                            {userDropdownOptions.map(({ id, name }) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                        <select
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">By Status</option>
                            <option value="BALANCED">Balanced</option>
                            <option value="OVER">Over</option>
                            <option value="SHORT">Short</option>
                        </select>
                        <select
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                            value={datePreset}
                            onChange={handleDatePresetChange}
                        >
                            <option value="all">All dates</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom range…</option>
                        </select>
                        <div className="relative flex-shrink-0 z-[100]">
                            <DatePicker
                                selectsRange
                                selected={startDate}
                                onChange={(update) => {
                                    setDateRange(update);
                                    setDatePreset("custom");
                                    if (update?.[0] && update?.[1]) setPickerOpen(false);
                                }}
                                startDate={startDate}
                                endDate={endDate}
                                open={pickerOpen}
                                onInputClick={() => setPickerOpen(true)}
                                onClickOutside={() => setPickerOpen(false)}
                                dateFormat="MMM d, yyyy"
                                popperPlacement="bottom-end"
                                popperClassName="z-[100]"
                                customInput={
                                    <CalendarTrigger className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${datePreset === "custom" && startDate && endDate
                                        ? "border-[#AD7F65] bg-amber-50/50"
                                        : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                                        }`} />
                                }
                            />
                        </div>
                    </div>

                    {/* Logs Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date & Time</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cashier</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Net Sales</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Cash to Remit</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Variance</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
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
                                    ) : displayRows.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-16 text-center">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 border border-gray-100">
                                                    <FaFileInvoiceDollar className="text-gray-300 text-2xl" />
                                                </div>
                                                <h3 className="text-sm font-bold text-gray-800 mb-1">No Remittances Found</h3>
                                                <p className="text-xs text-gray-500">
                                                    {searchTerm || statusFilter !== 'ALL' || datePreset !== 'all' || userFilter
                                                        ? "Try adjusting your filters."
                                                        : "No cash remittances have been submitted yet."}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayRows.map((remit) => (
                                            <tr
                                                key={remit._id}
                                                onClick={() => setSelectedRemittance(remit)}
                                                className={`transition-colors cursor-pointer ${selectedRemittance?._id === remit._id
                                                    ? 'bg-green-50/60 border-l-[3px] border-l-[#22C55E]'
                                                    : 'hover:bg-gray-50/50'
                                                    }`}
                                            >
                                                <td className="py-3 px-4">
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {new Date(remit.shiftDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {new Date(remit.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-sm font-semibold text-gray-800">{remit.employeeName}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                        #{remit._id.slice(-6).toUpperCase()}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className="text-sm font-medium text-gray-600">
                                                        {formatCurrency(remit.netSales)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className="text-sm font-bold text-gray-800">
                                                        {formatCurrency(remit.cashToRemit)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`text-sm font-bold ${remit.variance === 0 ? 'text-green-600' :
                                                        remit.variance > 0 ? 'text-blue-600' : 'text-red-600'
                                                        }`}>
                                                        {remit.variance > 0 ? '+' : ''}{formatCurrency(remit.variance)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
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

                    <div className="text-center">
                        <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                            Remittances are automatically recorded here when cashiers submit their end-of-shift reports.
                        </p>
                    </div>
                </div>

                {/* ─── RIGHT COLUMN: Receipt ─── */}
                <div className="w-[380px] flex-shrink-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-6">
                        {/* Receipt Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-800">Cash Turn-Over Slip</h3>
                            <div className="flex items-center gap-1">
                                {selectedRemittance && (
                                    <button onClick={handlePrint} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" title="Print">
                                        <FaPrint className="text-sm" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Receipt Body */}
                        <div id="receipt-print-area">
                            <ReceiptContent remit={selectedRemittance} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashRemittance;
