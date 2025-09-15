const express = require('express');
const multer = require('multer');
const { extractAadharInfo, verifyNameMatch } = require('../utils/geminiAI');
const { supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * POST /api/aadhar-verification/verify
 * Verify Aadhar card and extract information
 */
router.post('/verify', upload.single('aadharImage'), asyncHandler(async (req, res) => {
  const { fullName } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  if (!fullName) {
    return res.status(400).json({
      success: false,
      message: 'Full name is required for verification'
    });
  }

  try {
    // Extract information from Aadhar card using Gemini AI
    const extractedInfo = await extractAadharInfo(file.buffer, file.mimetype);

    if (!extractedInfo.aadharNumber || !extractedInfo.name) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract Aadhar information from the image. Please ensure the image is clear and readable.',
        extractedInfo
      });
    }

    // Verify name match
    const nameMatch = verifyNameMatch(fullName, extractedInfo.name);
    const confidence = extractedInfo.confidence;

    // Check if Aadhar number already exists in database
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('aadhar_number, full_name')
      .eq('aadhar_number', extractedInfo.aadharNumber)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'This Aadhar number is already registered with another account',
        extractedInfo: {
          aadharNumber: extractedInfo.aadharNumber,
          name: extractedInfo.name,
          confidence: confidence
        }
      });
    }

    res.json({
      success: true,
      message: 'Aadhar verification completed',
      extractedInfo: {
        aadharNumber: extractedInfo.aadharNumber,
        name: extractedInfo.name,
        confidence: confidence
      },
      verification: {
        nameMatch: nameMatch,
        confidence: confidence
      }
    });

  } catch (error) {
    console.error('Aadhar verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify Aadhar card. Please try again.',
      error: error.message
    });
  }
}));

/**
 * POST /api/aadhar-verification/save
 * Save verified Aadhar information to database
 */
router.post('/save', asyncHandler(async (req, res) => {
  const { userId, aadharNumber, aadharFrontUrl, aadharBackUrl } = req.body;

  if (!userId || !aadharNumber) {
    return res.status(400).json({
      success: false,
      message: 'User ID and Aadhar number are required'
    });
  }

  try {
    // Update user profile with Aadhar number
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        aadhar_number: aadharNumber,
        aadhar_front_url: aadharFrontUrl || null,
        aadhar_back_url: aadharBackUrl || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Aadhar information saved successfully',
      data: data
    });

  } catch (error) {
    console.error('Error saving Aadhar information:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save Aadhar information',
      error: error.message
    });
  }
}));

module.exports = router;

