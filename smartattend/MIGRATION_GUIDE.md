# SmartAttend Migration Guide: Removing Clerk Authentication

## Changes Made

### 1. Updated Database Schema
- Removed `clerkId` field from User documents
- Added `approvalStatus`, `isApproved`, `approvedBy`, `approvedAt` fields for admin approval workflow
- All users now use email-based IDs: `user:email@example.com`

### 2. Authentication System
- **Removed**: Clerk authentication completely
- **Updated**: All authentication now uses NextAuth.js with credentials provider
- **Added**: Admin approval requirement for student accounts

### 3. Student Registration Flow
1. Students register via `/student-register` page
2. Account created with `approvalStatus: 'pending'`
3. Admin reviews and approves/rejects via `/admin/student-approvals`
4. Only approved students can log in

### 4. Files Modified
- `src/models/schemas.js` - Updated user schema
- `src/lib/auth-helper.js` - Removed Clerk, added approval check
- `src/lib/api-helper.js` - Added approval status validation
- `src/pages/_app.js` - Removed ClerkProvider
- `src/pages/api/auth/[...nextauth].js` - Added approval check
- `src/pages/api/auth/register.js` - Updated for new schema
- `src/pages/api/admin/student-approvals.js` - Updated approval logic
- `src/pages/student/dashboard.js` - Removed Clerk references
- `src/pages/login.js` - Updated registration links
- `package.json` - Removed Clerk dependencies

### 5. New Files Created
- `src/pages/student-register.js` - Traditional registration form

### 6. Files to Remove (Optional)
- `src/pages/api/clerk-webhook.js` - No longer needed
- `src/pages/sign-in/[[...index]].js` - Clerk sign-in page
- `src/pages/sign-up/[[...index]].js` - Clerk sign-up page

## Next Steps

1. **Install Dependencies**: Run `npm install` to update package.json
2. **Remove Clerk Files**: Delete the Clerk-specific pages mentioned above
3. **Environment Variables**: Remove Clerk-related environment variables
4. **Test Registration**: Test the new student registration flow
5. **Admin Setup**: Ensure admin accounts exist to approve students

## Admin Account Creation

To create admin accounts, you'll need to insert them directly into CouchDB or create an admin registration endpoint.

Example admin document:
```json
{
  "_id": "user:admin@school.edu",
  "type": "user",
  "role": "admin",
  "name": "System Administrator",
  "email": "admin@school.edu",
  "password": "$2a$10$hashedpassword",
  "isApproved": true,
  "approvalStatus": "approved"
}
```

## Migration Complete

Your SmartAttend system now uses traditional authentication with admin approval for students!