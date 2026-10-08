import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { CheckCircle2, CircleAlert, PhoneForwarded } from "lucide-react-native";
import CurrencySelector from "@/components/CurrencySelector";
import { CREDIT_PACKS, formatCents, formatCreditPackPrice } from "@/constants/creditPacks";
import { createCreditsFlutterwaveCheckout, getCreditsBalance, type CreditsBalance } from "@/services/credits";
import { getPaymentPrices, toPaymentInitError, waitForPaymentOutcome, type PaymentCurrency, type PaymentPrices } from "@/services/payments";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

// Prepaid — an additional balance for calls from 9tel to local mobile carriers
// after Airbundle minutes have been used — see
// components/AirbundleCards.tsx). The balance shown here is always a
// fresh read of the authoritative backend value; nothing is ever deducted
// client-side (see services/credits.ts).
export default function PrepaidCard() {
  useTranslation();
  useThemeVersion();
  const [balance, setBalance] = useState<CreditsBalance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<PaymentCurrency>("USD");
  const [prices, setPrices] = useState<PaymentPrices | null>(null);

  const loadBalance = () => {
    setLoadError(null);
    getCreditsBalance()
      .then(setBalance)
      .catch((error) => setLoadError((error as Error).message));
  };

  useEffect(() => {
    loadBalance();
    getPaymentPrices().then(setPrices).catch(() => undefined);
  }, []);

  const priceFor = (pack: (typeof CREDIT_PACKS)[number]) => currency === "NGN" && prices?.ngn.creditPacks[pack.id] != null
    ? `₦${prices.ngn.creditPacks[pack.id].toLocaleString("en-US")}`
    : currency === "NGN" ? tr("Loading current price…") : formatCreditPackPrice(pack, currency);

  const buy = async (packId: string) => {
    if (currency === "NGN" && prices?.ngn.creditPacks[packId] == null) return;
    setBuyingPackId(packId);
    try {
      const { orderId, url } = await createCreditsFlutterwaveCheckout(packId, currency);
      await WebBrowser.openBrowserAsync(url);

      const outcome = await waitForPaymentOutcome(orderId);
      if (outcome === "paid") {
        loadBalance();
        Alert.alert(tr("Credits added"), tr("Your Prepaid balance has been topped up."));
      } else if (outcome === "cancelled") {
        Alert.alert(tr("Payment cancelled"), tr("Nothing was charged. You can try again anytime."));
      } else if (outcome === "failed" || outcome === "refunded") {
        Alert.alert(tr("Payment didn't complete"), tr("Nothing was charged, or your payment was refunded. You can try again."));
      } else {
        Alert.alert(tr("Still processing"), tr("We haven't received confirmation of your payment yet. Your credits will appear once it is confirmed."));
      }
    } catch (error) {
      const paymentError = toPaymentInitError(error);
      Alert.alert(tr("Unable to start payment"), paymentError.message, [
        { text: tr("Not now"), style: "cancel" },
        { text: tr("Retry"), onPress: () => buy(packId) },
      ]);
    } finally {
      setBuyingPackId(null);
    }
  };

  return (
    <View>
      <View style={s.balanceCard}>
        <View style={s.iconWrap}><PhoneForwarded size={16} color={themeColor("#5147AF")} /></View>
        <View style={s.balanceCopy}>
          <Text style={s.balanceLabel}>{tr("Purchased credit balance")}</Text>
          {balance ? (
            <>
              <Text style={s.balanceValue}>{formatCents(balance.balanceCents)}</Text>
              <Text style={s.balanceMeta}>{tr("Current billed rate: {{rate}} per minute", { rate: formatCents(balance.ratePerMinuteCents) })}</Text>
            </>
          ) : loadError ? (
            <Pressable onPress={loadBalance} style={s.inlineRetry}>
              <CircleAlert size={15} color={themeColor("#B04545")} />
              <Text style={s.balanceError}>{loadError} {tr("Tap to retry.")}</Text>
            </Pressable>
          ) : (
            <ActivityIndicator color={themeColor("#5147AF")} size="small" style={s.balanceLoading} />
          )}
        </View>
      </View>

      <View style={s.noteCard}>
        <CheckCircle2 size={16} color={themeColor("#5147AF")} />
        <Text style={s.copy}>
          {tr("Calls to local mobile numbers are billed from this balance per minute. Choose USD or NGN, then secure Flutterwave checkout opens. Credits appear here only after the backend confirms payment.")}
        </Text>
      </View>

      <CurrencySelector value={currency} onChange={setCurrency} disabled={buyingPackId !== null} />

      <View style={s.list}>
        {CREDIT_PACKS.map((pack) => (
          <View key={pack.id} style={s.packCard}>
            <Text style={s.packAmount}>{tr("{{amount}} credits", { amount: formatCents(pack.creditsCents) })}</Text>
            <Text style={s.packMeta}>{tr("Top up securely, then return here for the confirmed balance.")}</Text>
            <View style={s.packActions}>
              <Pressable
                style={s.packBtn}
                disabled={buyingPackId !== null || (currency === "NGN" && prices?.ngn.creditPacks[pack.id] == null)}
                onPress={() => buy(pack.id)}
              >
                {buyingPackId === pack.id ? (
                  <ActivityIndicator color={themeColor("#FFF")} size="small" />
                ) : (
                  <Text style={s.packBtnText}>{priceFor(pack)}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = themedStyles({
  balanceCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: "#EDEBF6", flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  iconWrap: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  balanceCopy: { flex: 1 },
  balanceLabel: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10.5 },
  balanceValue: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 18, marginTop: 2 },
  balanceMeta: { color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 4 },
  inlineRetry: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  balanceError: { color: "#C25454", fontFamily: "Poppins-Medium", fontSize: 11, marginTop: 2, flex: 1 },
  balanceLoading: { alignSelf: "flex-start", marginTop: 4 },
  noteCard: { flexDirection: "row", gap: 10, backgroundColor: "#F3F1FF", borderRadius: 18, padding: 14, marginTop: 14 },
  copy: { flex: 1, color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 10.5, lineHeight: 16 },
  list: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  packCard: { width: "31.5%", backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1.5, borderColor: "#EDEBF6", padding: 12, alignItems: "center" },
  packAmount: { color: "#302C4C", fontFamily: "Poppins-SemiBold", fontSize: 12, textAlign: "center" },
  packMeta: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 6 },
  packActions: { marginTop: 10, width: "100%" },
  packBtn: { backgroundColor: "#5147AF", height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  packBtnText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 11.5 },
});
