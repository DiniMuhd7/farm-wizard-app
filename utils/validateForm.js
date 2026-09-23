export const validateForm = (fields, options = {}) => {
  const errors = {};
  // Sign-up and password-reset require a password unconditionally; editing
  // an existing account shouldn't — validateForm was shared by all three
  // with no way to opt out, so leaving the password fields blank to "just
  // change my name" was previously impossible.
  const requirePassword = options.requirePassword !== false;

  // Full Name
  if (!fields.fullName?.trim() || fields.fullName.length < 4) {
    errors.fullName = "Full Name is required, morethan 4 character ";
  }

  // Email
  if (!fields.email?.includes("@") || !/\S+@\S+\.\S+/.test(fields.email)) {
    errors.email = "Enter a valid email address";
  }

  // Password — validated if either required, or the user typed something
  // (an attempted password change still has to meet the same rules).
  if (requirePassword || fields.password) {
    if (!fields.password || fields.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    if (fields.cpassword !== fields.password) {
      errors.cpassword = "Passwords do not match";
    }
  }

  // Language
  if (!fields.selectedLanguage) {
    errors.language = "Please select a language";
  }

  // Country
  if (!fields.selectedCountry) {
    errors.country = "Please select a country";
  }

  const isValid = Object.keys(errors).length === 0;

  return { isValid, errors };
};
