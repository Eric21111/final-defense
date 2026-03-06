const BrandPartner = require('../models/BrandPartner');

const formatValidationError = (message) => ({
  success: false,
  message,
});

exports.getBrandPartners = async (req, res) => {
  try {
    const partners = await BrandPartner.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: partners,
    });
  } catch (error) {
    console.error('Error fetching brand partners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brand partners.',
    });
  }
};

exports.createBrandPartner = async (req, res) => {
  try {
    const { brandName, email, contactNumber, contactPerson, logo } = req.body;

    if (!brandName || !brandName.trim()) {
      return res.status(400).json(formatValidationError('Brand name is required.'));
    }

    const normalizedBrandName = brandName.trim();

    const existing = await BrandPartner.findOne({ brandName: normalizedBrandName });
    if (existing) {
      return res.status(409).json(formatValidationError('Brand name already exists.'));
    }

    const newPartner = await BrandPartner.create({
      brandName: normalizedBrandName,
      email: email?.trim() || '',
      contactNumber: contactNumber?.trim() || '',
      contactPerson: contactPerson?.trim() || '',
      logo: logo || '',
      status: 'active', // Default status
    });

    res.status(201).json({
      success: true,
      data: newPartner,
    });
  } catch (error) {
    console.error('Error creating brand partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create brand partner.',
    });
  }
};

exports.updateBrandPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { brandName, email, contactNumber, contactPerson, logo, status } = req.body;

    const partner = await BrandPartner.findById(id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Brand partner not found.',
      });
    }

    if (brandName) {
      const normalizedBrandName = brandName.trim();
      if (normalizedBrandName !== partner.brandName) {
        const existing = await BrandPartner.findOne({ brandName: normalizedBrandName });
        if (existing) {
          return res.status(409).json(formatValidationError('Brand name already exists.'));
        }
        partner.brandName = normalizedBrandName;
      }
    }

    if (email !== undefined) partner.email = email.trim();
    if (contactNumber !== undefined) partner.contactNumber = contactNumber.trim();
    if (contactPerson !== undefined) partner.contactPerson = contactPerson.trim();
    if (logo !== undefined) partner.logo = logo;
    if (status !== undefined) partner.status = status;

    await partner.save();

    res.json({
      success: true,
      data: partner,
    });
  } catch (error) {
    console.error('Error updating brand partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update brand partner.',
    });
  }
};

exports.deleteBrandPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const partner = await BrandPartner.findByIdAndDelete(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Brand partner not found.',
      });
    }

    res.json({
      success: true,
      message: 'Brand partner deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting brand partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete brand partner.',
    });
  }
};
