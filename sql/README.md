# HostelHaven Database Migration Guide

This directory contains SQL migration files for the HostelHaven system.

## Files

- `2025-01-15-fix-hostelhaven-schema.sql` - Main schema migration with new tables and updates
- `policies_fix.sql` - Row Level Security (RLS) policies
- `README.md` - This file

## Migration Steps

### 1. Run the Main Schema Migration

Execute the main migration file in your Supabase SQL editor:

```sql
-- Copy and paste the contents of 2025-01-15-fix-hostelhaven-schema.sql
```

This will:
- Create new tables: `admission_registry`, `parents`, `room_requests`, `room_allocations`, `parcels`, `feedback`
- Update existing tables with new columns and constraints
- Convert room types to single/double/triple
- Add capacity management
- Create indexes and triggers
- Enable RLS on new tables

### 2. Run the RLS Policies

Execute the policies file:

```sql
-- Copy and paste the contents of policies_fix.sql
```

This will create comprehensive Row Level Security policies.

### 3. Create Admin User

After migration, you need to create an admin user:

1. **Create auth user in Supabase Dashboard:**
   - Go to Authentication > Users
   - Click "Add user"
   - Set email, password, and confirm email
   - Note the user ID

2. **Update the users table:**
   ```sql
   -- Replace 'your-admin-user-id' with the actual Supabase auth user ID
   INSERT INTO users (id, email, full_name, role, auth_uid, status)
   VALUES (
     uuid_generate_v4(),
     'admin@hostelhaven.com',
     'System Administrator',
     'admin',
     'your-admin-user-id',
     'active'
   );
   
   -- Update auth_uid for existing users if needed
   UPDATE users SET auth_uid = 'your-supabase-auth-uid' WHERE email = 'existing-user@example.com';
   ```

### 4. Seed Admission Registry

Add admission records:

```sql
-- Example admission registry entries
INSERT INTO admission_registry (admission_number, student_name, course, batch_year, parent_name, parent_email, parent_phone, added_by)
VALUES 
    ('ADM001', 'John Doe', 'Computer Science', 2024, 'Jane Doe', 'jane.doe@email.com', '+1234567890', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
    ('ADM002', 'Alice Smith', 'Engineering', 2024, 'Bob Smith', 'bob.smith@email.com', '+1234567891', (SELECT id FROM users WHERE role = 'admin' LIMIT 1));
```

## Important Notes

### Security Considerations

1. **Service Role Key**: Never expose the service role key in client-side code
2. **RLS Policies**: All policies use `auth.uid()` to map Supabase auth users to our users table
3. **Admission Registry**: Only staff can create students - no public registration
4. **Parent Verification**: Parents must verify via OTP before accessing child data

### Data Validation

After migration, check the `pending_data_review` table for any data that needs manual review:

```sql
SELECT * FROM pending_data_review WHERE status = 'pending';
```

### Room Capacity Management

The system now enforces strict capacity limits:
- Single rooms: capacity = 1
- Double rooms: capacity = 2  
- Triple rooms: capacity = 3
- Rooms are hidden when full
- Atomic allocation prevents overbooking

### Testing

1. Verify RLS policies work correctly
2. Test parent OTP verification flow
3. Test room allocation with capacity limits
4. Test parcel token generation and verification
5. Test feedback sentiment analysis

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**: Ensure `auth_uid` is properly set for all users
2. **Foreign Key Constraints**: Check that admission numbers exist in `admission_registry`
3. **Capacity Issues**: Verify room capacity and occupancy calculations

### Rollback

If you need to rollback:

1. Drop new tables in reverse order
2. Remove new columns from existing tables
3. Drop new policies and constraints
4. Restore original room types if needed

## Support

For issues with the migration:
1. Check the `pending_data_review` table
2. Review Supabase logs
3. Verify environment variables are set correctly
4. Ensure all dependencies are installed
