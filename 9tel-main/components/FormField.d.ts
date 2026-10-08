import React from "react";
import type { TextInputProps } from "react-native";

export type FormFieldVariant = "default" | "auth" | "light";

export interface FormFieldProps extends TextInputProps {
  title: string;
  value: string;
  placeholder?: string;
  handleChangeText: (text: string) => void;
  otherStyles?: string;
  secureTextEntry?: boolean;
  variant?: FormFieldVariant;
}

declare const FormField: React.FC<FormFieldProps>;

export default FormField;
