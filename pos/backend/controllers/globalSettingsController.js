const GlobalSettings = require("../models/GlobalSettings");

const startOfLocalDay = (value = new Date()) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toNumericFloat = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeOpeningFloatEntry = (entry = {}) => {
    const employeeId = String(entry.employeeId || "").trim();
    const employeeName = String(entry.employeeName || "").trim();
    const amount = toNumericFloat(entry.amount, NaN);

    if (!employeeId || !employeeName || !Number.isFinite(amount)) {
        return null;
    }

    return {
        employeeId,
        employeeName,
        amount,
        createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
        businessDate: entry.businessDate
            ? startOfLocalDay(entry.businessDate)
            : startOfLocalDay(entry.createdAt || new Date()),
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
        const { openingFloat, openingFloats, addOpeningFloat } = req.body;
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
            settings.openingFloats.push(normalizedEntry);
        }

        if (
            openingFloat === undefined &&
            !Array.isArray(openingFloats) &&
            !addOpeningFloat
        ) {
            return res.status(400).json({
                success: false,
                message: "No settings update payload provided",
            });
        } else {
        }

        await settings.save();
        res.json({ success: true, data: settings, message: "Settings updated successfully" });
    } catch (error) {
        console.error("Error updating global settings:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
