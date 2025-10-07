const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

/**
 * Call AI microservice for sentiment analysis
 */
const analyzeSentiment = async (text) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:5000';
    
    const response = await fetch(`${aiServiceUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`AI service responded with status: ${response.status}`);
    }

    const result = await response.json();
    return {
      label: result.sentiment || 'neutral',
      score: result.score || 0.0
    };
  } catch (error) {
    console.error('AI sentiment analysis failed:', error);
    // Return neutral sentiment as fallback
    return {
      label: 'neutral',
      score: 0.0
    };
  }
};

/**
 * @route   POST /api/feedback
 * @desc    Submit feedback with sentiment analysis
 * @access  Private (Student)
 */
router.post('/', [
  authMiddleware,
  authorize(['student']),
  body('feedback_type')
    .isIn(['mess', 'general', 'facilities'])
    .withMessage('Invalid feedback type'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('text_content')
    .optional()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Text content must be between 10 and 1000 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { feedback_type, rating, text_content } = req.body;

  try {
    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new ValidationError('User profile not found');
    }

    // Analyze sentiment if text content is provided
    let sentimentLabel = 'neutral';
    let sentimentScore = 0.0;
    
    if (text_content) {
      const sentiment = await analyzeSentiment(text_content);
      sentimentLabel = sentiment.label;
      sentimentScore = sentiment.score;
    }

    // Create feedback record
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .insert({
        student_profile_id: userProfile.id,
        feedback_type,
        rating,
        text_content,
        sentiment_label: sentimentLabel,
        sentiment_score: sentimentScore,
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (feedbackError) {
      throw new ValidationError('Failed to submit feedback');
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: { feedback }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/feedback/student
 * @desc    Get student's feedback history
 * @access  Private (Student)
 */
router.get('/student', [
  authMiddleware,
  authorize(['student'])
], asyncHandler(async (req, res) => {
  try {
    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new ValidationError('User profile not found');
    }

    // Get feedback history
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('*')
      .eq('student_profile_id', userProfile.id)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      throw new ValidationError('Failed to fetch feedback history');
    }

    res.json({
      success: true,
      data: { feedback }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/feedback/analytics
 * @desc    Get feedback analytics (staff only)
 * @access  Private (Staff)
 */
router.get('/analytics', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant', 'warden'])
], asyncHandler(async (req, res) => {
  try {
    const { timeframe = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(timeframe));

    // Get sentiment counts
    const { data: sentimentCounts, error: sentimentError } = await supabase
      .from('feedback')
      .select('sentiment_label')
      .gte('created_at', daysAgo.toISOString());

    if (sentimentError) {
      throw new ValidationError('Failed to fetch sentiment data');
    }

    // Count sentiments
    const sentimentStats = sentimentCounts.reduce((acc, item) => {
      acc[item.sentiment_label] = (acc[item.sentiment_label] || 0) + 1;
      return acc;
    }, {});

    // Get feedback by type
    const { data: typeCounts, error: typeError } = await supabase
      .from('feedback')
      .select('feedback_type')
      .gte('created_at', daysAgo.toISOString());

    if (typeError) {
      throw new ValidationError('Failed to fetch type data');
    }

    const typeStats = typeCounts.reduce((acc, item) => {
      acc[item.feedback_type] = (acc[item.feedback_type] || 0) + 1;
      return acc;
    }, {});

    // Get average ratings
    const { data: ratingData, error: ratingError } = await supabase
      .from('feedback')
      .select('rating')
      .gte('created_at', daysAgo.toISOString())
      .not('rating', 'is', null);

    if (ratingError) {
      throw new ValidationError('Failed to fetch rating data');
    }

    const avgRating = ratingData.length > 0 
      ? ratingData.reduce((sum, item) => sum + item.rating, 0) / ratingData.length 
      : 0;

    // Get recent feedback
    const { data: recentFeedback, error: recentError } = await supabase
      .from('feedback')
      .select(`
        *,
        user_profiles!inner(
          admission_number,
          users!inner(full_name)
        )
      `)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) {
      throw new ValidationError('Failed to fetch recent feedback');
    }

    res.json({
      success: true,
      data: {
        sentiment: sentimentStats,
        types: typeStats,
        averageRating: Math.round(avgRating * 100) / 100,
        totalFeedback: sentimentCounts.length,
        recentFeedback
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/feedback/all
 * @desc    Get all feedback (staff only)
 * @access  Private (Staff)
 */
router.get('/all', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant', 'warden'])
], asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, feedback_type, sentiment_label } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('feedback')
      .select(`
        *,
        user_profiles!inner(
          admission_number,
          users!inner(full_name)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (feedback_type) {
      query = query.eq('feedback_type', feedback_type);
    }

    if (sentiment_label) {
      query = query.eq('sentiment_label', sentiment_label);
    }

    const { data: feedback, error, count } = await query;

    if (error) {
      throw new ValidationError('Failed to fetch feedback');
    }

    res.json({
      success: true,
      data: {
        feedback,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;
