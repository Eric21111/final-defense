const GlobalSettings = require("../models/GlobalSettings");

const startOfLocalDay = (value = new Date()) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toNumericFloat = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const trimStr = (value, maxLen) => {
    if (value === undefined || value === null) return "";
    const s = String(value).trim();
    return maxLen && s.length > maxLen ? s.slice(0, maxLen) : s;
};

const normalizeOpeningFloatEntry = (entry = {}) => {
    const id = String(entry._id || entry.id || "").trim();
    const employeeId = String(entry.employeeId || "").trim();
    const employeeName = String(entry.employeeName || "").trim();
    const employeeRole = String(entry.employeeRole || "").trim();
    const amount = toNumericFloat(entry.amount, NaN);

    if (!employeeId || !employeeName || !Number.isFinite(amount)) {
        return null;
    }

    return {
        ...(id ? { _id: id } : {}),
        employeeId,
        employeeName,
        employeeRole,
        amount,
        createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
        businessDate: entry.businessDate
            ? startOfLocalDay(entry.businessDate)
            : startOfLocalDay(entry.createdAt || new Date()),
        updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : null,
    };
};

// GET /api/global-settings
exports.getGlobalSettings = async (req, res) => {
    try {
        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = await GlobalSettings.create({});
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error("Error fetching global settings:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// PUT /api/global-settings
exports.updateGlobalSettings = async (req, res) => {
    try {
        const {
            openingFloat,
            openingFloats,
            addOpeningFloat,
            updateOpeningFloat,
            removeOpeningFloat,
            storeName,
            receiptTagline,
            receiptAddress,
            receiptContactNumber,
            receiptThankYouMessage,
            receiptDisclaimer,
        } = req.body;
        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = await GlobalSettings.create({});
        }

        if (openingFloat !== undefined) {
            settings.openingFloat = toNumericFloat(openingFloat, settings.openingFloat || 2000);
        }

        if (Array.isArray(openingFloats)) {
            settings.openingFloats = openingFloats
                .map(normalizeOpeningFloatEntry)
                .filter(Boolean);
        }

        if (addOpeningFloat) {
            const normalizedEntry = normalizeOpeningFloatEntry(addOpeningFloat);
            if (!normalizedEntry) {
                return res.status(400).json({
                    success: false,
                    message: "Employee and amount are required for opening float entry",
                });
            }
            // Enforce "once per day" per employee (no stacking).
            // If an entry exists for this employee for today's businessDate, overwrite it.
            const today = startOfLocalDay(new Date());
            const employeeIdStr = String(normalizedEntry.employeeId || "").trim();

            const existing = (settings.openingFloats || []).find((row) => {
                const rowEmp = String(row?.employeeId || "").trim();
                if (!rowEmp || rowEmp !== employeeIdStr) return false;
                const rowDate = row?.businessDate || row?.createdAt;
                if (!rowDate) return false;
                return startOfLocalDay(rowDate).getTime() === today.getTime();
            });

            if (existing) {
                existing.amount = normalizedEntry.amount;
                existing.employeeName = normalizedEntry.employeeName;
                existing.employeeRole = normalizedEntry.employeeRole;
                existing.businessDate = today;
                existing.updatedAt = new Date();
            } else {
                normalizedEntry.businessDate = today;
                settings.openingFloats.push(normalizedEntry);
            }
        }

        if (updateOpeningFloat) {
            const entryId = String(updateOpeningFloat.entryId || updateOpeningFloat._id || "").trim();
            const nextAmount = toNumericFloat(updateOpeningFloat.amount, NaN);

            if (!entryId || !Number.isFinite(nextAmount)) {
                return res.status(400).json({
                    success: false,
                    message: "Entry id and amount are required to update opening float",
                });
            }

            const entry = settings.openingFloats.id(entryId);
            if (!entry) {
                return res.status(404).json({
                    success: false,
                    message: "Opening float entry not found",
                });
            }

            entry.amount = nextAmount;
            if (updateOpeningFloat.employeeName) {
                entry.employeeName = String(updateOpeningFloat.employeeName).trim();
            }
            if (updateOpeningFloat.employeeRole !== undefined) {
                entry.employeeRole = String(updateOpeningFloat.employeeRole || "").trim();
            }
            entry.businessDate = startOfLocalDay(new Date());
            entry.updatedAt = new Date();
        }

        if (removeOpeningFloat) {
            const entryId = String(removeOpeningFloat.entryId || removeOpeningFloat._id || "").trim();
            if (!entryId) {
                return res.status(400).json({
                    success: false,
                    message: "Entry id is required to remove opening float",
                });
            }

            const entry = settings.openingFloats.id(entryId);
            if (!entry) {
                return res.status(404).json({
                    success: false,
                    message: "Opening float entry not found",
                });
            }

            entry.deleteOne();
        }

        if (storeName !== undefined) {
            const t = trimStr(storeName, 120);
            if (t) settings.storeName = t;
        }
        if (receiptTagline !== undefined) {
            settings.receiptTagline = trimStr(receiptTagline, 200);
        }
        if (receiptAddress !== undefined) {
            const t = trimStr(receiptAddress, 200);
            settings.receiptAddress = t || "Pasonanca, Zamboanga City";
        }
        if (receiptContactNumber !== undefined) {
            const t = trimStr(receiptContactNumber, 60);
            settings.receiptContactNumber = t || "+631112224444";
        }
        if (receiptThankYouMessage !== undefined) {
            const t = trimStr(receiptThankYouMessage, 300);
            settings.receiptThankYouMessage = t || "Thank you for your purchase!";
        }
        if (receiptDisclaimer !== undefined) {
            const t = trimStr(receiptDisclaimer, 300);
            settings.receiptDisclaimer = t || "This is not an official receipt";
        }

        const hasOpeningFloatPayload =
            openingFloat !== undefined ||
            Array.isArray(openingFloats) ||
            !!addOpeningFloat ||
            !!updateOpeningFloat ||
            !!removeOpeningFloat;

        const hasReceiptPayload =
            storeName !== undefined ||
            receiptTagline !== undefined ||
            receiptAddress !== undefined ||
            receiptContactNumber !== undefined ||
            receiptThankYouMessage !== undefined ||
            receiptDisclaimer !== undefined;

        if (!hasOpeningFloatPayload && !hasReceiptPayload) {
            return res.status(400).json({
                success: false,
                message: "No settings update payload provided",
            });
        }

        await settings.save();
        res.json({ success: true, data: settings, message: "Settings updated successfully" });
    } catch (error) {
        console.error("Error updating global settings:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
