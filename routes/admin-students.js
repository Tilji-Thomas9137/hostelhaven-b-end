const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { ValidationError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Middleware to check if user is admin
const adminMiddleware = async (req, res, next) => {
  try {
    const { data: { session } } = await supabase.auth.getUser(req.user.access_token);
    if (!session?.user) {
      throw new ValidationError('Authentication required');
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', session.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'admin') {
      throw new ValidationError('Admin access required');
    }

    req.adminUser = userProfile;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    next(error);
  }
};

/**
 * @route   GET /api/admin/students
 * @desc    Get all students managed by admin
 * @access  Private (Admin)
 */
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('🔍 ADMIN STUDENTS: Fetching all students...');
    
    // Get students from admin_student_management view
    const { data: students, error } = await supabase
      .from('admin_student_overview')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ ADMIN STUDENTS: Query error:', error);
      throw new Error(`Failed to fetch students: ${error.message}`);
    }

    console.log('✅ ADMIN STUDENTS: Found students:', students?.length || 0);

    res.json({
      success: true,
      data: { students: students || [] }
    });

  } catch (error) {
    console.error('❌ ADMIN STUDENTS: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/admin/students
 * @desc    Add new student
 * @access  Private (Admin)
 */
router.post('/', authMiddleware, adminMiddleware, [
  body('admission_number').notEmpty().withMessage('Admission number is required'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('course').notEmpty().withMessage('Course is required'),
  body('batch_year').isInt({ min: 2020, max: 2030 }).withMessage('Valid batch year is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const {
      admission_number,
      full_name,
      email,
      phone_number,
      course,
      batch_year,
      semester,
      admission_status,
      notes
    } = req.body;

    console.log('🔍 ADMIN STUDENTS: Adding new student:', { admission_number, full_name, email });

    // Check if student already exists
    const { data: existingStudent } = await supabase
      .from('admin_student_management')
      .select('id')
      .or(`email.eq.${email},admission_number.eq.${admission_number}`)
      .single();

    if (existingStudent) {
      throw new ValidationError('Student with this email or admission number already exists');
    }

    // Get admin user ID
    const { data: { session } } = await supabase.auth.getUser(req.user.access_token);
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', session.user.id)
      .single();

    // Insert new student
    const { data: newStudent, error } = await supabase
      .from('admin_student_management')
      .insert({
        admission_number,
        full_name,
        email,
        phone_number,
        course,
        batch_year,
        semester: semester || '4th',
        admission_status: admission_status || 'pending',
        room_allocation_status: 'not_allocated',
        created_by: adminUser.id,
        notes
      })
      .select()
      .single();

    if (error) {
      console.error('❌ ADMIN STUDENTS: Insert error:', error);
      throw new Error(`Failed to add student: ${error.message}`);
    }

    console.log('✅ ADMIN STUDENTS: Student added successfully:', newStudent.id);

    res.status(201).json({
      success: true,
      data: { student: newStudent },
      message: 'Student added successfully'
    });

  } catch (error) {
    console.error('❌ ADMIN STUDENTS: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/admin/students/:id
 * @desc    Update student
 * @access  Private (Admin)
 */
router.put('/:id', authMiddleware, adminMiddleware, [
  body('admission_number').optional().notEmpty().withMessage('Admission number cannot be empty'),
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔍 ADMIN STUDENTS: Updating student:', id);

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    updateData.updated_at = new Date().toISOString();

    const { data: updatedStudent, error } = await supabase
      .from('admin_student_management')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ ADMIN STUDENTS: Update error:', error);
      throw new Error(`Failed to update student: ${error.message}`);
    }

    if (!updatedStudent) {
      throw new ValidationError('Student not found');
    }

    console.log('✅ ADMIN STUDENTS: Student updated successfully:', updatedStudent.id);

    res.json({
      success: true,
      data: { student: updatedStudent },
      message: 'Student updated successfully'
    });

  } catch (error) {
    console.error('❌ ADMIN STUDENTS: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/admin/students/:id/allocate-room
 * @desc    Allocate room to student
 * @access  Private (Admin)
 */
router.post('/:id/allocate-room', authMiddleware, adminMiddleware, [
  body('room_id').isUUID().withMessage('Valid room ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const { room_id } = req.body;

    console.log('🔍 ADMIN STUDENTS: Allocating room to student:', { student_id: id, room_id });

    // Get student data
    const { data: student, error: studentError } = await supabase
      .from('admin_student_management')
      .select('*')
      .eq('id', id)
      .single();

    if (studentError || !student) {
      throw new ValidationError('Student not found');
    }

    // Check if room is available
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      throw new ValidationError('Room not found');
    }

    if (room.current_occupancy >= room.capacity) {
      throw new ValidationError('Room is at full capacity');
    }

    // Update student's room allocation status
    const { data: updatedStudent, error: updateError } = await supabase
      .from('admin_student_management')
      .update({
        room_allocation_status: 'allocated',
        allocated_room_id: room_id,
        allocated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ ADMIN STUDENTS: Update error:', updateError);
      throw new Error(`Failed to allocate room: ${updateError.message}`);
    }

    console.log('✅ ADMIN STUDENTS: Room allocated successfully');

    res.json({
      success: true,
      data: { student: updatedStudent },
      message: 'Room allocated successfully'
    });

  } catch (error) {
    console.error('❌ ADMIN STUDENTS: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route   DELETE /api/admin/students/:id
 * @desc    Delete student
 * @access  Private (Admin)
 */
router.delete('/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 ADMIN STUDENTS: Deleting student:', id);

    const { error } = await supabase
      .from('admin_student_management')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ ADMIN STUDENTS: Delete error:', error);
      throw new Error(`Failed to delete student: ${error.message}`);
    }

    console.log('✅ ADMIN STUDENTS: Student deleted successfully');

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    console.error('❌ ADMIN STUDENTS: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/students/:id
 * @desc    Get single student details
 * @access  Private (Admin)
 */
router.get('/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 ADMIN STUDENTS: Fetching student:', id);

    const { data: student, error } = await supabase
      .from('admin_student_overview')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ ADMIN STUDENTS: Query error:', error);
      throw new Error(`Failed to fetch student: ${error.message}`);
    }

    if (!student) {
      throw new ValidationError('Student not found');
    }

    console.log('✅ ADMIN STUDENTS: Student found');

    res.json({
      success: true,
      data: { student }
    });

  } catch (error) {
    console.error('❌ ADMIN STUDENTS: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

module.exports = router;
