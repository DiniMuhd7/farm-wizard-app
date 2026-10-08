import { Pressable, StyleSheet, Text, View } from "react-native";
import { PAYMENT_CURRENCIES, type PaymentCurrency } from "@/services/payments";
import { themedStyles, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

interface Props {
  value: PaymentCurrency;
  onChange: (currency: PaymentCurrency) => void;
  disabled?: boolean;
}

// Shown before every Flutterwave checkout — the person picks the currency
// they pay in (USD or NGN) before payment starts.
export default function CurrencySelector({ value, onChange, disabled = false }: Props) {
  useTranslation();
  useThemeVersion();
  return (
    <View style={s.wrap} accessibilityRole="radiogroup" accessibilityLabel={tr("Payment currency")}>
      <Text style={s.label}>{tr("Pay in")}</Text>
      <View style={s.row}>
        {PAYMENT_CURRENCIES.map((currency) => {
          const active = value === currency;
          return (
            <Pressable
              key={currency}
              accessibilityRole="radio"
              accessibilityLabel={currency}
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(currency)}
              style={[s.option, active && s.optionActive]}
            >
              <Text style={[s.optionText, active && s.optionTextActive]}>{currency}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = themedStyles({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  label: { color: "#514D66", fontFamily: "Poppins-Medium", fontSize: 11.5 },
  row: { flexDirection: "row", gap: 8, backgroundColor: "#EEEAFB", borderRadius: 14, padding: 4 },
  option: { minWidth: 64, minHeight: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  optionActive: { backgroundColor: "#5147AF" },
  optionText: { color: "#6D6890", fontFamily: "Poppins-Medium", fontSize: 12 },
  optionTextActive: { color: "#FFF", fontFamily: "Poppins-SemiBold" },
});
