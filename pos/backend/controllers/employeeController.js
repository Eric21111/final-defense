const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

// In-memory cache for fast PIN logins avoiding O(N) bcrypt hashes. Map<sha256(pin), employeeId>
const pinCache = new Map();

const getFastPinHash = (rawPin) => {
  const hmacSecret = process.env.PIN_SECRET || 'fallback-secret-for-pos-pin';
  return crypto.createHmac('sha256', hmacSecret).update(String(rawPin)).digest('hex');
};

const isPinAlreadyUsedByOther = async (rawPin, excludeEmployeeId = null) => {
  const fastPinHash = getFastPinHash(rawPin);
  const query = excludeEmployeeId
    ? { fastPinHash, _id: { $ne: excludeEmployeeId } }
    : { fastPinHash };
  const existing = await Employee.exists(query);
  return !!existing;
};

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    // Exclude profileImage from the list payload to massively reduce size and increase speed
    const employees = await Employee.find({})
      
      .sort({ dateJoined: -1 })
      .lean();

    // Remove PIN from response
    const employeesWithoutPin = employees.map(emp => {
      const { pin, ...rest } = emp;
      return rest;
    });

    res.json({
      success: true,
      count: employeesWithoutPin.length,
      data: employeesWithoutPin
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employees',
      error: error.message
    });
  }
};

// Get employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // We still return profileImage here if they request the single employee,
    // but in a production system we'd ideally not send it here either, keeping it purely in the `/image` route.
    // However, keeping it for backward compatibility with view/edit components.
    const { pin, ...employeeWithoutPin } = employee;

    res.json({
      success: true,
      data: employeeWithoutPin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching employee',
      error: error.message
    });
  }
};


// Get employee image directly (for massive speed boost on list views)
exports.getEmployeeImage = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select('profileImage').lean();

    if (!employee || !employee.profileImage) {
      return res.status(404).send('No image found');
    }

    // Extract base64 and send as image buffer
    const base64Data = employee.profileImage.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Type', 'image/jpeg'); // Assuming JPEG for now, could parse MIME type
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(imgBuffer);
  } catch (error) {
    console.error('Error fetching employee image:', error);
    res.status(500).send('Error loading image');
  }
};

// Create new employee
exports.createEmployee = async (req, res) => {
  try {
    const {
      firstName,
      middleInitial,
      lastName,
      name,
      contactNo,
      email,
      role,
      pin,
      dateJoined,
      status,
      profileImage,
      permissions,
      dateJoinedActual,
      requiresPinReset,
      sendPinEmail // Flag to send PIN via email
    } = req.body;

    // Validate required fields
    if (!email || !role || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Email, role, and PIN are required'
      });
    }

    // Check if employee with email already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this email already exists'
      });
    }

    // Store the raw PIN before it gets hashed (for email)
    const rawPin = pin;
    if (await isPinAlreadyUsedByOther(rawPin)) {
      return res.status(400).json({
        success: false,
        message: 'Please use other pin'
      });
    }

    // Don't hash PIN here - the model's pre-save hook will handle it
    const employeeData = {
      firstName: firstName || '',
      middleInitial: middleInitial || '',
      lastName: lastName || '',
      name:
        name ||
        [firstName || '', middleInitial || '', lastName || '']
          .map((p) => String(p).trim())
          .filter(Boolean)
          .join(' ')
          .trim(),
      contactNo: contactNo || '',
      email,
      role,
      pin: pin, // Pass raw PIN - model will hash it
      dateJoined: dateJoined || new Date(),
      dateJoinedActual: dateJoinedActual || new Date(),
      status: status || 'Active',
      profileImage: profileImage || '',
      permissions: permissions || {},
      requiresPinReset: requiresPinReset !== undefined ? requiresPinReset : true // Default to true for new employees
    };

    const employee = await Employee.create(employeeData);

    const { pin: _, profileImage: __, ...employeeWithoutPin } = employee.toObject();

    // Send temporary PIN via email automatically
    let emailSent = false;
    console.log('[Employee] Attempting to send welcome email to:', email);
    if (email && (sendPinEmail !== false)) {
      try {
        const storeName = process.env.STORE_NAME || 'Create Your Style';
        console.log('[Employee] Sending PIN email with storeName:', storeName);
        const emailResult = await sendEmail(
          email,
          `Welcome to ${storeName} - Your Temporary PIN`,
          `Welcome to ${storeName}!\n\nYour temporary PIN is: ${rawPin}\n\nPlease change this PIN after your first login for security purposes.\n\nBest regards,\n${storeName} Team`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #AD7F65 0%, #76462B 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0;">Welcome to ${storeName}!</h1>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none;">
                <p style="font-size: 16px; color: #333;">Hello <strong>${firstName || name || 'Team Member'}</strong>,</p>
                <p style="font-size: 16px; color: #333;">Your account has been created successfully. Here is your temporary PIN:</p>
                <div style="background: white; border: 2px dashed #AD7F65; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px;">
                  <p style="font-size: 32px; font-weight: bold; color: #AD7F65; margin: 0; letter-spacing: 8px;">${rawPin}</p>
                </div>
                <p style="font-size: 14px; color: #666;">⚠️ <strong>Important:</strong> Please change this PIN after your first login for security purposes.</p>
                <p style="font-size: 14px; color: #666;">Your role: <strong>${role}</strong></p>
              </div>
              <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">This is an automated message from ${storeName} POS System</p>
              </div>
            </div>
          `
        );
        emailSent = emailResult.success;
        console.log('[Employee] Email send result:', emailResult);
        if (!emailResult.success) {
          console.error('[Employee] Failed to send welcome email:', emailResult.error);
        } else {
          console.log('[Employee] Welcome email sent successfully to:', email);
        }
      } catch (emailError) {
        console.error('[Employee] Error sending welcome email:', emailError);
      }
    } else {
      console.log('[Employee] Skipping email - email:', email, 'sendPinEmail:', sendPinEmail);
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Employee created successfully. Temporary PIN sent to email.'
        : 'Employee created successfully.',
      data: employeeWithoutPin,
      emailSent
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this email already exists'
      });
    }
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating employee',
      error: error.message
    });
  }
};


// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // If PIN is being updated, hash it
    if (updateData.pin) {
      const rawPin = updateData.pin.toString();
      if (await isPinAlreadyUsedByOther(rawPin, id)) {
        return res.status(400).json({
          success: false,
          message: 'Please use other pin'
        });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.pin = await bcrypt.hash(rawPin, salt);

      updateData.fastPinHash = getFastPinHash(rawPin);
    }

    updateData.lastUpdated = Date.now();

    const employee = await Employee.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const { pin, ...employeeWithoutPin } = employee.toObject();

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: employeeWithoutPin
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating employee',
      error: error.message
    });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id).select('_id');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting employee',
      error: error.message
    });
  }
};


// Verify PIN
exports.verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required'
      });
    }

    const hmacSecret = process.env.PIN_SECRET || 'fallback-secret-for-pos-pin';
    const computedFastHash = crypto.createHmac('sha256', hmacSecret).update(pin.toString()).digest('hex');

    // 1. FAST PATH: O(1) exact match lookup using fastPinHash
    const fastEmployee = await Employee.findOne({
      fastPinHash: computedFastHash,
      status: 'Active'
    }).lean();

    if (fastEmployee) {
      // Mark employee as online
      await Employee.findByIdAndUpdate(fastEmployee._id, {
        isOnline: true,
        lastLogin: new Date(),
        lastActive: new Date()
      });
      const { pin: unusedPin, fastPinHash: unusedFastHash, ...employeeWithoutPin } = fastEmployee;
      return res.json({
        success: true,
        message: 'PIN verified successfully (fast path)',
        data: employeeWithoutPin,
        requiresPinReset: fastEmployee.requiresPinReset || false
      });
    }

    // 2. SLOW PATH (Lazy Migration): Fallback to checking all active employees if not found
    const employees = await Employee.find({
      status: 'Active'
    })
      .select('+pin')
      .lean();

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN or insufficient permissions'
      });
    }

    // Check all employees concurrently mapped to promises
    const matchPromises = employees.map(async (emp) => {
      if (!emp.pin) return null;
      try {
        const isMatch = await bcrypt.compare(pin.toString(), emp.pin);
        return isMatch ? emp : null;
      } catch (err) {
        console.error('Bcrypt error on', emp.email, err);
        return null;
      }
    });

    const results = await Promise.all(matchPromises);
    const found = results.find(emp => emp !== null);

    if (found) {
      // Lazy migration: Save the fastPinHash and mark as online
      await Employee.findByIdAndUpdate(found._id, {
        fastPinHash: computedFastHash,
        isOnline: true,
        lastLogin: new Date(),
        lastActive: new Date()
      });

      const { pin: unusedPin, fastPinHash: unusedFastHash, ...employeeWithoutPin } = found;

      return res.json({
        success: true,
        message: 'PIN verified successfully (migrated)',
        data: employeeWithoutPin,
        requiresPinReset: found.requiresPinReset || false
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid PIN or insufficient permissions'
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying PIN',
      error: error.message
    });
  }
};

// Reset PIN
exports.resetPin = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPin, requiresPinReset } = req.body;

    if (!newPin) {
      return res.status(400).json({
        success: false,
        message: 'New PIN is required'
      });
    }

    if (await isPinAlreadyUsedByOther(newPin.toString(), id)) {
      return res.status(400).json({
        success: false,
        message: 'Please use other pin'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newPin.toString(), salt);

    const fastPinHash = getFastPinHash(newPin.toString());

    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        pin: hashedPin,
        fastPinHash: fastPinHash,
        requiresPinReset: requiresPinReset !== undefined ? requiresPinReset : false,
        lastUpdated: Date.now()
      },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'PIN reset successfully'
    });
  } catch (error) {
    console.error('Error resetting PIN:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting PIN',
      error: error.message
    });
  }
};


// Toggle employee status
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const newStatus = employee.status === 'Active' ? 'Inactive' : 'Active';

    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      { status: newStatus, lastUpdated: Date.now() },
      { new: true }
    );

    const { pin, ...employeeWithoutPin } = updatedEmployee.toObject();

    res.json({
      success: true,
      message: `Employee ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully`,
      data: employeeWithoutPin
    });
  } catch (error) {
    console.error('Error toggling employee status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling employee status',
      error: error.message
    });
  }
};

// Get employees by role
exports.getEmployeesByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const employees = await Employee.find({ role })
      
      .sort({ dateJoined: -1 })
      .lean();

    const employeesWithoutPin = employees.map(emp => {
      const { pin, ...rest } = emp;
      return rest;
    });

    res.json({
      success: true,
      count: employeesWithoutPin.length,
      data: employeesWithoutPin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching employees',
      error: error.message
    });
  }
};

// Send temporary PIN via email
exports.sendTemporaryPin = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Generate temporary PIN
    const tempPin = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash and save the temporary PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(tempPin.toString(), salt);

    const hmacSecret = process.env.PIN_SECRET || 'fallback-secret-for-pos-pin';
    const fastPinHash = crypto.createHmac('sha256', hmacSecret).update(tempPin.toString()).digest('hex');

    await Employee.findByIdAndUpdate(id, {
      pin: hashedPin,
      fastPinHash: fastPinHash,
      requiresPinReset: true,
      lastUpdated: Date.now()
    });

    // Send email with temporary PIN
    let emailSent = false;
    if (employee.email) {
      try {
        const storeName = process.env.STORE_NAME || 'Create Your Style';
        const emailResult = await sendEmail(
          employee.email,
          `${storeName} - Your New Temporary PIN`,
          `Your new temporary PIN is: ${tempPin}\n\nPlease change this PIN after logging in for security purposes.\n\nBest regards,\n${storeName} Team`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #AD7F65 0%, #76462B 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0;">PIN Reset</h1>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none;">
                <p style="font-size: 16px; color: #333;">Hello <strong>${employee.firstName || employee.name || 'Team Member'}</strong>,</p>
                <p style="font-size: 16px; color: #333;">Your PIN has been reset. Here is your new temporary PIN:</p>
                <div style="background: white; border: 2px dashed #AD7F65; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px;">
                  <p style="font-size: 32px; font-weight: bold; color: #AD7F65; margin: 0; letter-spacing: 8px;">${tempPin}</p>
                </div>
                <p style="font-size: 14px; color: #666;">⚠️ <strong>Important:</strong> Please change this PIN after logging in for security purposes.</p>
              </div>
              <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">This is an automated message from ${storeName} POS System</p>
              </div>
            </div>
          `
        );
        emailSent = emailResult.success;
        if (!emailResult.success) {
          console.error('Failed to send PIN reset email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    }

    res.json({
      success: true,
      message: emailSent ? 'Temporary PIN sent to email successfully' : 'Temporary PIN generated (email not sent)',
      emailSent
    });
  } catch (error) {
    console.error('Error sending temporary PIN:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending temporary PIN',
      error: error.message
    });
  }
};


// Search employees
exports.searchEmployees = async (req, res) => {
  try {
    const { query } = req.params;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const employees = await Employee.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { middleInitial: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { role: { $regex: query, $options: 'i' } }
      ]
    })
       // Exclude profileImage for search results as well
      .sort({ dateJoined: -1 })
      .lean();

    const employeesWithoutPin = employees.map(emp => {
      const { pin, ...rest } = emp;
      return rest;
    });

    res.json({
      success: true,
      count: employeesWithoutPin.length,
      data: employeesWithoutPin
    });
  } catch (error) {
    console.error('Error searching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching employees',
      error: error.message
    });
  }
};

// Update PIN (alias for resetPin)
exports.updatePin = async (req, res) => {
  try {
    const { id } = req.params;
    const { pin, newPin, requiresPinReset } = req.body;

    const pinToSet = newPin || pin;

    if (!pinToSet) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required'
      });
    }

    if (await isPinAlreadyUsedByOther(pinToSet.toString(), id)) {
      return res.status(400).json({
        success: false,
        message: 'Please use other pin'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pinToSet.toString(), salt);

    const fastPinHash = getFastPinHash(pinToSet.toString());

    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        pin: hashedPin,
        fastPinHash: fastPinHash,
        requiresPinReset: requiresPinReset !== undefined ? requiresPinReset : false,
        lastUpdated: Date.now()
      },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Return employee data without PIN
    const { pin: _, ...employeeWithoutPin } = employee.toObject();

    res.json({
      success: true,
      message: 'PIN updated successfully',
      data: employeeWithoutPin
    });
  } catch (error) {
    console.error('Error updating PIN:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating PIN',
      error: error.message
    });
  }
};

// Logout employee (set isOnline to false)
exports.logoutEmployee = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }
    await Employee.findByIdAndUpdate(employeeId, { isOnline: false });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out employee:', error);
    res.status(500).json({ success: false, message: 'Error logging out', error: error.message });
  }
};

// Heartbeat to keep employee online
exports.employeeHeartbeat = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    await Employee.findByIdAndUpdate(employeeId, {
      isOnline: true,
      lastActive: new Date()
    });

    res.json({ success: true, message: 'Heartbeat received' });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get online employees (with cleanup of stale sessions)
exports.getOnlineEmployees = async (req, res) => {
  try {
    // 1. Cleanup stale sessions (no heartbeat in last 2 minutes)
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);

    await Employee.updateMany(
      {
        isOnline: true,
        role: { $ne: 'Owner' },
        $or: [
          { lastActive: { $lt: twoMinsAgo } },
          // For legacy sessions that logged in before we added lastActive
          { lastActive: null, lastLogin: { $lt: twoMinsAgo } }
        ]
      },
      { $set: { isOnline: false } }
    );

    // 2. Fetch the newly accurate list
    const onlineEmployees = await Employee.find({ isOnline: true, role: { $ne: 'Owner' } })
      .select('-pin -fastPinHash -profileImage')
      .lean();

    res.json({ success: true, data: onlineEmployees });
  } catch (error) {
    console.error('Error fetching online employees:', error);
    res.status(500).json({ success: false, message: 'Error fetching online employees', error: error.message });
  }
};
