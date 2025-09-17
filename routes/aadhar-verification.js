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

  // Fail fast only if neither Gemini nor OpenRouter keys are configured
  const hasGeminiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())
    || (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim())
    || (process.env.GOOGLE_GEMINI_API_KEY && process.env.GOOGLE_GEMINI_API_KEY.trim());
  const hasOpenRouterKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim();
  if (!hasGeminiKey && !hasOpenRouterKey) {
    return res.status(503).json({
      success: false,
      message: 'Aadhar verification temporarily unavailable. No AI provider configured on server.',
    });
  }

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

    // Accept if we have at least a valid 12-digit Aadhar number; name is optional
    const isValidAadhar = extractedInfo.aadharNumber && /^\d{12}$/.test(String(extractedInfo.aadharNumber));
    if (!isValidAadhar) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract Aadhar information from the image. Please ensure the image is clear and readable.',
        extractedInfo
      });
    }

    // Verify name match
    const nameMatch = extractedInfo.name ? verifyNameMatch(fullName, extractedInfo.name) : false;
    const confidence = extractedInfo.confidence;

    // Check if Aadhar number already exists in database
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('aadhar_number')
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
        name: extractedInfo.name || null,
        confidence: confidence
      },
      verification: {
        nameMatch: nameMatch,
        confidence: confidence
      }
    });

  } catch (error) {
    console.error('Aadhar verification error:', error);
    // Map known Gemini key issues to clearer HTTP statuses
    if (error.code === 'GEMINI_API_KEY_MISSING') {
      return res.status(503).json({
        success: false,
        message: 'Aadhar verification temporarily unavailable. Server missing Gemini API key.',
        error: error.message
      });
    }
    if (error.code === 'GEMINI_API_KEY_INVALID') {
      return res.status(503).json({
        success: false,
        message: 'Aadhar verification temporarily unavailable. Gemini API key invalid on server.',
        error: error.message
      });
    }
    if (error.code === 'AI_JSON_PARSE_FAILED') {
      return res.status(502).json({
        success: false,
        message: 'Aadhar parsing failed. Please try a clearer image.',
        error: error.message
      });
    }
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

