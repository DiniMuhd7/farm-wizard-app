import { useState } from "react";

export const useFormValidation = (rules) => {
  const [errors, setErrors] = useState({});

  const validate = (fields) => {
    const newErrors = {};

    for (const field in rules) {
      const value = fields[field];
      const validators = rules[field];

      for (const validator of validators) {
        const error = validator(value, fields);
        if (error) {
          newErrors[field] = error;
          break; // stop after first error per field
        }
      }
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  return { errors, validate };
};
