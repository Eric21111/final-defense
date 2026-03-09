const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/emailService');

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    // Exclude profileImage from the list payload to massively reduce size and increase speed
    const employees = await Employee.find({})
      .select('-profileImage')
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
      .select('-profileImage')
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

    // Don't hash PIN here - the model's pre-save hook will handle it
    const employeeData = {
      firstName: firstName || '',
      lastName: lastName || '',
      name: name || `${firstName || ''} ${lastName || ''}`.trim(),
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
      const salt = await bcrypt.genSalt(10);
      updateData.pin = await bcrypt.hash(updateData.pin, salt);
    }

    updateData.lastUpdated = Date.now();

    const employee = await Employee.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-profileImage');

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

    // Get only active managers/admins/owners with pin for comparison
    // Use .select('+pin') only — don't mix with explicit field list which breaks the +pin modifier
    // Exclude profileImage to keep memory clean
    const employees = await Employee.find({
      status: 'Active',
      role: { $in: ['Manager', 'Admin', 'Owner', 'Super Admin'] }
    })
      .select('+pin')
      .lean();

    if (employees.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN or insufficient permissions'
      });
    }

    // Run bcrypt comparisons concurrently and return IMMEDIATELY when the first match is found.
    // Node.js will use the UV thread pool to process hashes in parallel, drastically reducing wait times.
    const matchPromises = employees.map(emp => {
      return new Promise(async (resolve, reject) => {
        if (!emp.pin) return reject(new Error('No PIN'));
        try {
          const isMatch = await bcrypt.compare(pin, emp.pin);
          if (isMatch) resolve(emp);
          else reject(new Error('Mismatch'));
        } catch (err) {
          console.error('Bcrypt error on', emp.email, err);
          reject(err);
        }
      });
    });

    try {
      const matchedEmployee = await Promise.any(matchPromises);

      const { pin: _, profileImage: __, ...employeeWithoutPin } = matchedEmployee;

      return res.json({
        success: true,
        message: 'PIN verified successfully',
        data: employeeWithoutPin,
        requiresPinReset: matchedEmployee.requiresPinReset || false
      });
    } catch (aggregateError) {
      // Promise.any throws AggregateError if ALL promises reject (i.e. no PIN matched)
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN or insufficient permissions'
      });
    }
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

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newPin, salt);

    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        pin: hashedPin,
        requiresPinReset: requiresPinReset !== undefined ? requiresPinReset : false,
        lastUpdated: Date.now()
      },
      { new: true }
    ).select('-profileImage');

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
    const employee = await Employee.findById(id).select('-profileImage');

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
    ).select('-profileImage');

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
      .select('-profileImage')
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
    const employee = await Employee.findById(id).select('-profileImage');

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
    const hashedPin = await bcrypt.hash(tempPin, salt);

    await Employee.findByIdAndUpdate(id, {
      pin: hashedPin,
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
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { role: { $regex: query, $options: 'i' } }
      ]
    })
      .select('-profileImage') // Exclude profileImage for search results as well
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

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pinToSet, salt);

    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        pin: hashedPin,
        requiresPinReset: requiresPinReset !== undefined ? requiresPinReset : false,
        lastUpdated: Date.now()
      },
      { new: true }
    ).select('-profileImage');

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
