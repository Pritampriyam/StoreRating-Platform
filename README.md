
# StoreRating Platform 🌟

A full-stack web application for discovering stores, submitting ratings, and managing store performance. The platform provides separate experiences for **Normal Users, Store Owners, and System Administrators**.

---

## 🚀 Key Features

### 👨‍💼 System Administrator

The administrator can manage the complete platform through the admin dashboard.

- Dashboard statistics:
  - Total Users
  - Total Stores
  - Total Ratings
- Create new users
- Assign user roles:
  - `admin`
  - `owner`
  - `normal`
- Search and filter users
- Sort users by:
  - Name
  - Email
  - Address
  - Role
  - Created Date
- View user details
- Update user information
- Delete users
- Prevent deletion of the primary administrator
- Create stores
- Assign store owners
- Upload store logos
- Update store information
- Delete stores
- View all ratings
- Search and sort ratings
- Delete ratings

### 👤 Normal User

Normal users can:

- Register an account
- Verify their email using a 6-digit OTP
- Log in securely
- Browse available stores
- Search stores
- Sort stores
- View average store ratings
- Submit ratings from 1 to 5
- Update their existing ratings

### 🏪 Store Owner

Store owners can:

- Register as a store owner
- Verify their email
- Log in securely
- View their assigned store
- View average store rating
- View total number of ratings
- Monitor their store performance

The system currently supports **one store per store owner**.

---

## 🔄 Application Workflow

```text
                    ┌─────────────────┐
                    │  React Frontend │
                    │   Port 5173     │
                    └────────┬────────┘
                             │
                       REST API / HTTP
                             │
                             ▼
                    ┌─────────────────┐
                    │ Express Backend │
                    │   Port 5000     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        Authentication   Business Logic   Validation
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌─────────────────┐
                    │     MongoDB     │
                    │    Database     │
                    └─────────────────┘
````

### Authentication Flow

```text
Register
   ↓
Validate Input
   ↓
Hash Password using bcrypt
   ↓
Generate Verification OTP
   ↓
Save User in MongoDB
   ↓
Send OTP through Email
   ↓
User Verifies OTP
   ↓
Login
   ↓
Validate Credentials
   ↓
Generate JWT
   ↓
Access Role-Based Dashboard
```

### Role-Based Access

```text
Admin
  ↓
Admin Dashboard
  ├── User Management
  ├── Store Management
  ├── Rating Management
  └── Dashboard Statistics

Normal User
  ↓
User Dashboard
  ├── Browse Stores
  ├── Search Stores
  ├── View Ratings
  └── Submit / Update Rating

Store Owner
  ↓
Owner Dashboard
  ├── View Assigned Store
  ├── Average Rating
  └── Total Ratings
```

---

## 🛠️ Tech Stack

### Frontend

* React
* Vite
* JavaScript / JSX
* React Router
* CSS
* Lucide React

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT
* bcryptjs
* Nodemailer
* Multer

### Development Tools

* npm
* Vite
* Git
* Visual Studio Code

---

## 🗄️ Database

The application uses **MongoDB** with **Mongoose**.

### Users Collection

```text
users
├── _id
├── name
├── email
├── password
├── address
├── role
├── is_verified
├── verification_code
└── created_at
```

Available roles:

```text
admin
owner
normal
```

### Stores Collection

```text
stores
├── _id
├── name
├── email
├── address
├── logo_url
├── owner_id
└── created_at
```

`owner_id` references the user who owns the store.

### Ratings Collection

```text
ratings
├── _id
├── user_id
├── store_id
├── rating
└── created_at
```

A rating connects a user with a store.

---

## ⭐ Rating System

Users can rate stores from **1 to 5**.

Example:

```text
1 ⭐
2 ⭐
3 ⭐
4 ⭐
5 ⭐
```

The average store rating is calculated from all ratings belonging to that store.

For example:

```text
Ratings:
5, 4, 4, 3

Average:
(5 + 4 + 4 + 3) / 4 = 4.0
```

MongoDB aggregation is used to calculate:

* Average rating
* Total number of ratings

---

## 🔐 Authentication & Security

The application uses multiple security mechanisms.

### Password Hashing

Passwords are never stored as plain text.

```text
User Password
     ↓
bcrypt.hash()
     ↓
Hashed Password
     ↓
MongoDB
```

During login:

```text
Entered Password
       ↓
bcrypt.compare()
       ↓
Stored Password Hash
```

### JWT Authentication

After successful login, the backend generates a JWT.

```text
Login
  ↓
Credentials Verified
  ↓
JWT Generated
  ↓
Frontend
  ↓
Protected API Requests
```

### Role-Based Authorization

The backend checks the user's role before allowing access to protected resources.

```text
admin  → Admin APIs
owner  → Owner APIs
normal → User APIs
```

---

## 📧 Email Verification

The application uses **Nodemailer with Gmail SMTP**.

Email functionality is used for:

* Account verification
* OTP delivery
* Store assignment notifications
* Account-related notifications

### OTP Workflow

```text
User Registration
       ↓
Generate 6-digit OTP
       ↓
Save OTP
       ↓
Send Email
       ↓
User Enters OTP
       ↓
Verify OTP
       ↓
Account Activated
```

---

## 📡 API Endpoints

### Authentication Routes

Base URL:

```text
/api/auth
```

| Method | Endpoint           | Description                           |
| ------ | ------------------ | ------------------------------------- |
| POST   | `/register`        | Register a normal user or store owner |
| POST   | `/login`           | Authenticate user                     |
| POST   | `/verify`          | Verify email using OTP                |
| POST   | `/resend-otp`      | Resend verification OTP               |
| POST   | `/forgot-password` | Password recovery                     |
| PUT    | `/change-password` | Change authenticated user's password  |

---

### Admin Routes

Base URL:

```text
/api/admin
```

| Method | Endpoint       | Description              |
| ------ | -------------- | ------------------------ |
| GET    | `/stats`       | Get dashboard statistics |
| GET    | `/users`       | Get users                |
| POST   | `/users`       | Create user              |
| GET    | `/users/:id`   | Get user details         |
| PUT    | `/users/:id`   | Update user              |
| DELETE | `/users/:id`   | Delete user              |
| GET    | `/stores`      | Get stores               |
| POST   | `/stores`      | Create store             |
| PUT    | `/stores/:id`  | Update store             |
| DELETE | `/stores/:id`  | Delete store             |
| GET    | `/ratings`     | Get ratings              |
| DELETE | `/ratings/:id` | Delete rating            |

---

### User Routes

Base URL:

```text
/api/user
```

| Method | Endpoint       | Description          |
| ------ | -------------- | -------------------- |
| GET    | `/stores`      | Get available stores |
| POST   | `/ratings`     | Submit a rating      |
| PUT    | `/ratings/:id` | Update a rating      |

---

### Owner Routes

Base URL:

```text
/api/owner
```

Owner-specific endpoints are used for retrieving assigned store information and rating statistics.

---

## 📁 Project Structure

### Frontend

```text
frontend/
│
├── public/
│   ├── favicon.png
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   │
│   ├── components/
│   │   ├── Modal.jsx
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   └── StarRating.jsx
│   │
│   ├── pages/
│   │   ├── AdminDashboard.jsx
│   │   ├── Login.jsx
│   │   ├── OwnerDashboard.jsx
│   │   ├── Register.jsx
│   │   ├── UserDashboard.jsx
│   │   └── VerifyEmail.jsx
│   │
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
│
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

### Backend

```text
backend/
│
├── src/
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── ownerController.js
│   │   └── userController.js
│   │
│   ├── middleware/
│   │   └── authentication / authorization
│   │
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── ownerRoutes.js
│   │   └── userRoutes.js
│   │
│   ├── utils/
│   │   └── mailer.js
│   │
│   ├── db.js
│   └── index.js
│
├── uploads/
├── package.json
└── .env
```

---

## ⚙️ Installation

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* MongoDB
* Git

---

## 📥 1. Clone the Repository

```bash
git clone <https://github.com/Pritampriyam/StoreRating-Platform>
cd Roxiler-assignment-main
```

---

## 📦 2. Install Backend Dependencies

```powershell
cd backend
npm install
```

---

## 📦 3. Install Frontend Dependencies

Open another terminal:

```powershell
cd frontend
npm install
```

---

## 🔧 4. Environment Variables

Create a `.env` file inside the `backend` folder.

Example:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail_address
SMTP_PASS=your_gmail_app_password
```

> **Important:** Do not commit your `.env` file or Gmail App Password to GitHub.

---

## ▶️ Running the Application

### Start Backend

Open PowerShell:

```powershell
cd backend
npm start
```

The backend runs on:

```text
http://localhost:5000
```

Expected output:

```text
MongoDB connection established.
MongoDB initialization completed successfully.
Server is running on port 5000
API: http://localhost:5000
```

### Start Frontend

Open another PowerShell:

```powershell
cd frontend
npm run dev
```

The frontend normally runs on:

```text
http://localhost:5173
```

Open the URL in your browser.

---

## 👨‍💼 Default Administrator

During MongoDB initialization, the application creates a default administrator account if one does not already exist.

```text
Email: axxx@gmail.com
Password: xxxxxx
```

The password is stored in MongoDB as a bcrypt hash rather than plain text.

> For production use, change the default credentials and use environment-based configuration.

---

## 🧪 Testing the Application

Recommended testing flow:

### Admin

```text
1. Login as admin
2. Open Admin Dashboard
3. Check dashboard statistics
4. Create a normal user
5. Create a store owner
6. Create a store
7. Assign the owner to the store
8. View stores
9. View users
10. View ratings
```

### Normal User

```text
1. Register
2. Verify email
3. Login
4. Browse stores
5. Search for a store
6. Submit a rating
7. Update the rating
```

### Store Owner

```text
1. Register as owner
2. Verify email
3. Login
4. View assigned store
5. View rating statistics
```

---

## 📊 Store Rating Calculation

Store ratings are calculated dynamically from the ratings collection using MongoDB aggregation.

The backend uses aggregation operations such as:

```javascript
$lookup
$addFields
$avg
$size
$group
$sort
```

This allows the application to calculate store statistics without storing a manually maintained average rating.

---

## 🔒 Important Business Rules

The application implements several business rules:

* Email addresses must be unique.
* Passwords must satisfy the required strength rules.
* Normal users and store owners must verify their email.
* Only users with the `owner` role can be assigned to stores.
* One store owner can currently be assigned to only one store.
* A store cannot be registered multiple times using the same owner email.
* Users can submit and update ratings.
* Store deletion also removes its associated ratings.
* Deleting an owner also removes the associated store.
* The primary admin account cannot be deleted.
* An administrator cannot delete their own admin account.

---

## 🏗️ Architecture

The project follows a layered full-stack architecture.

```text
React UI
   ↓
Components / Pages
   ↓
REST API
   ↓
Express Routes
   ↓
Authentication / Authorization Middleware
   ↓
Controllers
   ↓
Mongoose Models
   ↓
MongoDB
```

External email communication:

```text
Backend
   ↓
Nodemailer
   ↓
Gmail SMTP
   ↓
User Email
```

---

## 🎯 Project Objective

The main objective of StoreRating is to provide a centralized platform where:

* Users can discover and rate stores.
* Store owners can monitor their store performance.
* Administrators can manage users, stores, and ratings.
* Authentication and authorization protect role-specific functionality.
* MongoDB provides flexible and scalable data storage.

---

## 👨‍💻 Author

**Pritam Kumar**

StoreRating Platform — Full Stack Web Application

---

