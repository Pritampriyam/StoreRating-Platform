const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { sendMail } = require('../utils/mailer');

require('dotenv').config();

const { User } = db;

const JWT_SECRET =
  process.env.JWT_SECRET || 'store_rating_secret_key_123';

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || '7d';

/* =========================================================
   VALIDATION HELPERS
========================================================= */

const validateFields = (
  name,
  email,
  password,
  address,
  isNewUser = true
) => {
  const errors = [];

  // Name validation
  if (isNewUser) {
    if (
      !name ||
      name.trim().length < 2 ||
      name.trim().length > 60
    ) {
      errors.push(
        'Name must be between 2 and 60 characters.'
      );
    }
  }

  // Email validation
  if (isNewUser && email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      errors.push(
        'Please enter a valid email address.'
      );
    }
  }

  // Password validation
  if (password) {
    if (
      password.length < 8 ||
      password.length > 16
    ) {
      errors.push(
        'Password must be between 8 and 16 characters.'
      );
    }

    const hasUppercase = /[A-Z]/.test(password);

    const hasSpecialCharacter =
      /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase) {
      errors.push(
        'Password must include at least one uppercase letter.'
      );
    }

    if (!hasSpecialCharacter) {
      errors.push(
        'Password must include at least one special character.'
      );
    }
  }

  // Address validation
  if (isNewUser) {
    if (!address || address.trim().length === 0) {
      errors.push('Address is required.');
    } else if (address.length > 400) {
      errors.push(
        'Address cannot exceed 400 characters.'
      );
    }
  }

  return errors;
};

/* =========================================================
   OTP GENERATOR
========================================================= */

const generateOtp = () => {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
};

/* =========================================================
   JWT GENERATOR
========================================================= */

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN
    }
  );
};

/* =========================================================
   USER RESPONSE FORMATTER
========================================================= */

const formatUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    address: user.address,
    isVerified: user.is_verified
  };
};

/* =========================================================
   1. REGISTER
========================================================= */

exports.register = async (req, res) => {
  const {
    name,
    email,
    password,
    address
  } = req.body;

  const errors = validateFields(
    name,
    email,
    password,
    address,
    true
  );

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Check existing user
    const existingUser = await User.findOne({
      email: cleanEmail
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Email is already registered.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // Generate OTP
    const verificationCode = generateOtp();

    // Create user in MongoDB
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      address: address.trim(),
      role: 'normal',
      is_verified: false,
      verification_code: verificationCode
    });

    // Send verification email
    await sendMail(
      cleanEmail,
      'Email Verification Code - StoreRating',

      `Welcome to StoreRating!

Your 6-digit verification code is:

${verificationCode}

Please enter this code on the verification page to activate your account.`,

      `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to StoreRating!</h2>

        <p>
          Please verify your email address by entering
          the following 6-digit code:
        </p>

        <div
          style="
            font-size: 24px;
            font-weight: bold;
            color: #6366f1;
            letter-spacing: 2px;
            padding: 10px;
            background: #f3f4f6;
            display: inline-block;
            border-radius: 6px;
            margin: 10px 0;
          "
        >
          ${verificationCode}
        </div>

        <p>
          If you did not request this registration,
          please ignore this email.
        </p>
      </div>
      `
    );

    return res.status(201).json({
      message: 'Registration successful!',
      code: verificationCode,
      userId: user._id
    });

  } catch (err) {
    console.error('Registration error:', err);

    return res.status(500).json({
      error: 'An error occurred during registration.'
    });
  }
};

/* =========================================================
   2. LOGIN
========================================================= */

exports.login = async (req, res) => {
  const {
    email,
    password
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error:
        'Please provide both email and password.'
    });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Find user
    const user = await User.findOne({
      email: cleanEmail
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    // Compare password
    const isPasswordValid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    /*
      Normal users and owners require
      OTP verification before login.
    */
    if (
      user.role === 'normal' ||
      user.role === 'owner'
    ) {
      const code = generateOtp();

      await User.findByIdAndUpdate(
        user._id,
        {
          $set: {
            is_verified: false,
            verification_code: code
          }
        }
      );

      await sendMail(
        user.email,
        'Email Verification Required - StoreRating',

        `Please verify your email address to log in.

Your 6-digit verification code is:

${code}`,

        `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">

          <h2>Account Verification Required</h2>

          <p>
            To access your account, please verify
            your email address.
          </p>

          <div
            style="
              font-size: 24px;
              font-weight: bold;
              color: #6366f1;
              letter-spacing: 2px;
              padding: 10px;
              background: #f3f4f6;
              display: inline-block;
              border-radius: 6px;
              margin: 10px 0;
            "
          >
            ${code}
          </div>

        </div>
        `
      );

      return res.status(400).json({
        error:
          'A verification code has been sent to your email address. Please enter the OTP to log in.',
        unverified: true,
        email: user.email,

        // Keep this only if your frontend needs it during development.
        code
      });
    }

    // Generate JWT for admin
    const token = generateToken(user);

    return res.json({
      message: 'Logged in successfully!',
      token,
      user: formatUser(user)
    });

  } catch (err) {
    console.error('Login error:', err);

    return res.status(500).json({
      error: 'An error occurred during login.'
    });
  }
};

/* =========================================================
   3. CHANGE PASSWORD
========================================================= */

exports.changePassword = async (req, res) => {
  const {
    oldPassword,
    newPassword
  } = req.body;

  const userId = req.user.id;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      error:
        'Please provide both old and new passwords.'
    });
  }

  const errors = validateFields(
    null,
    null,
    newPassword,
    null,
    false
  );

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    // Verify old password
    const isPasswordValid =
      await bcrypt.compare(
        oldPassword,
        user.password
      );

    if (!isPasswordValid) {
      return res.status(400).json({
        error: 'Incorrect old password.'
      });
    }

    // Hash new password
    const hashedNewPassword =
      await bcrypt.hash(newPassword, 10);

    // Update MongoDB document
    user.password = hashedNewPassword;

    await user.save();

    return res.json({
      message: 'Password updated successfully!'
    });

  } catch (err) {
    console.error(
      'Password change error:',
      err
    );

    return res.status(500).json({
      error:
        'An error occurred while updating your password.'
    });
  }
};

/* =========================================================
   4. VERIFY EMAIL / OTP
========================================================= */

exports.verifyEmail = async (req, res) => {
  const {
    email,
    code
  } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      error:
        'Please provide both email and verification code.'
    });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: cleanEmail
    });

    if (!user) {
      return res.status(400).json({
        error:
          'User with this email does not exist.'
      });
    }

    // Compare OTP
    if (
      String(user.verification_code) !==
      String(code)
    ) {
      return res.status(400).json({
        error: 'Invalid verification code.'
      });
    }

    // Mark user verified
    user.is_verified = true;
    user.verification_code = null;

    await user.save();

    // Generate JWT
    const token = generateToken(user);

    return res.json({
      message:
        'Email verified successfully!',
      token,
      user: formatUser(user)
    });

  } catch (err) {
    console.error(
      'Verification error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to verify email.'
    });
  }
};

/* =========================================================
   5. FORGOT PASSWORD
========================================================= */

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error:
        'Please enter your email address.'
    });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: cleanEmail
    });

    if (!user) {
      return res.status(404).json({
        error:
          'No account registered with this email address.'
      });
    }

    /*
      Generate temporary password.
    */
    const tempPassword =
      Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase() +
      Math.floor(
        1000 + Math.random() * 9000
      ) +
      '!';

    const hashedPassword =
      await bcrypt.hash(
        tempPassword,
        10
      );

    // Update MongoDB
    user.password = hashedPassword;
    user.is_verified = false;

    await user.save();

    // Send email
    await sendMail(
      cleanEmail,
      'Password Reset Request - StoreRating',

      `Hello ${user.name},

We received a request to reset your password.

Your new temporary password is:

${tempPassword}

Please log in using this password.
You will be prompted to verify your email.`,

      `
      <div
        style="
          font-family: sans-serif;
          padding: 20px;
          color: #333;
          line-height: 1.6;
        "
      >

        <h2 style="color: #6366f1;">
          Password Reset Request
        </h2>

        <p>
          Hello <strong>${user.name}</strong>,
        </p>

        <p>
          We received a request to reset
          your password.
        </p>

        <p>
          Your temporary password is:
        </p>

        <div
          style="
            padding: 15px;
            background: #f3f4f6;
            border-radius: 8px;
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 1px;
            color: #6366f1;
            display: inline-block;
          "
        >
          ${tempPassword}
        </div>

        <p>
          Please log in using this temporary
          password and change it afterwards.
        </p>

      </div>
      `
    );

    return res.json({
      message:
        'Temporary password sent to email successfully!',

      // Keep only for development/testing.
      code: tempPassword
    });

  } catch (err) {
    console.error(
      'Forgot password error:',
      err
    );

    return res.status(500).json({
      error:
        'An error occurred during password reset.'
    });
  }
};

/* =========================================================
   6. RESEND OTP
========================================================= */

exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error:
        'Please provide your email address.'
    });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: cleanEmail
    });

    if (!user) {
      return res.status(404).json({
        error:
          'No account found with this email address.'
      });
    }

    const newCode = generateOtp();

    // Update MongoDB
    user.verification_code = newCode;
    user.is_verified = false;

    await user.save();

    // Send OTP email
    const emailResult = await sendMail(
      cleanEmail,
      'New Verification Code - StoreRating',

      `Hello ${user.name},

Your new 6-digit verification code is:

${newCode}

Please enter this code on the verification page.`,

      `
      <div
        style="
          font-family: sans-serif;
          padding: 20px;
          color: #333;
          line-height: 1.6;
        "
      >

        <h2 style="color: #6366f1;">
          New Verification Code
        </h2>

        <p>
          Hello <strong>${user.name}</strong>,
        </p>

        <p>
          You requested a new verification code.
        </p>

        <div
          style="
            font-size: 28px;
            font-weight: bold;
            color: #6366f1;
            letter-spacing: 4px;
            padding: 12px 20px;
            background: #f3f4f6;
            display: inline-block;
            border-radius: 8px;
            margin: 12px 0;
          "
        >
          ${newCode}
        </div>

        <p style="color: #666;">
          If you did not request this,
          please ignore this email.
        </p>

      </div>
      `
    );

    if (
      emailResult &&
      emailResult.error
    ) {
      return res.status(500).json({
        error:
          'Failed to send verification email. Please try again.'
      });
    }

    return res.json({
      message:
        'A new verification code has been sent to your email!'
    });

  } catch (err) {
    console.error(
      'Resend OTP error:',
      err
    );

    return res.status(500).json({
      error:
        'Failed to resend verification code.'
    });
  }
};