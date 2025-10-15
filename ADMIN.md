# Admin Credentials

This document contains the admin credentials for the Cyscom FFCS Portal.

## Admin User
- **Email:** admin@vitstudent.ac.in
- **Password:** cyscom2025admin
- **Role:** admin

## Super Admin User
- **Email:** superadmin@vitstudent.ac.in
- **Password:** cyscom2025superadmin
- **Role:** superadmin

## Setting Up Admin Users

To create or update these admin users, run:

```bash
# First, set the path to your Firebase service account JSON
# On Windows:
set GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json

# On Linux/Mac:
export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json

# Then run:
npm run setup-admin
```

**Note:** In a production environment, use more secure passwords and keep this file private!

## Admin Features

### Admin
- Verify contributions
- Assign points to users
- Manage departments and users

### Super Admin
- All admin capabilities
- Add/remove departments and projects
- Override user department selections