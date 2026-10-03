import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Check, ShieldCheck, Sparkles } from "lucide-react-native";
import CurrencySelector from "@/components/CurrencySelector";
import { AIRBUNDLES, formatAirbundleMinutes, formatAirbundlePrice, type AirbundleId } from "@/constants/airbundles";
import { createAirbundleFlutterwaveCheckout, getPaymentPrices, toPaymentInitError, waitForPaymentOutcome, type PaymentCurrency, type PaymentPrices } from "@/services/payments";

interface Props {
  // Whether the account currently has an active Airbundle (the account's
  // `isPremium` flag — an internal name kept for backward compatibility).
  isActive: boolean;
  onPurchased: () => void;
}

export default function AirbundleCards({ isActive, onPurchased }: Props) {
  const [buying, setBuying] = useState(false);
  const [currency, setCurrency] = useState<PaymentCurrency>("USD");
  const [prices, setPrices] = useState<PaymentPrices | null>(null);
  const [selectedId, setSelectedId] = useState<AirbundleId>(
    () => AIRBUNDLES.find((bundle) => bundle.popular)?.id ?? AIRBUNDLES[0].id,
  );
  const selected = AIRBUNDLES.find((bundle) => bundle.id === selectedId) ?? AIRBUNDLES[0];
  const priceFor = (bundle: typeof selected) => currency === "NGN" && prices?.ngn.airbundles[bundle.id] != null
    ? `₦${prices.ngn.airbundles[bundle.id].toLocaleString("en-US")}`
    : currency === "NGN" ? "Loading current price…" : formatAirbundlePrice(bundle, currency);

  useEffect(() => {
    getPaymentPrices().then(setPrices).catch(() => undefined);
  }, []);

  const ngnPriceReady = currency !== "NGN" || prices?.ngn.airbundles[selected.id] != null;

  const buy = async () => {
    if (!ngnPriceReady) return;
    setBuying(true);
    try {
      const { orderId, url } = await createAirbundleFlutterwaveCheckout(selected.id, currency);
      await WebBrowser.openBrowserAsync(url);

      const outcome = await waitForPaymentOutcome(orderId);
      if (outcome === "paid") {
        onPurchased();
        Alert.alert("Airbundle added", `${formatAirbundleMinutes(selected)} are now on your account for calls to 9tel users and local mobile carriers.`);
      } else if (outcome === "cancelled") {
        Alert.alert("Payment cancelled", "Nothing was charged. You can try again anytime.");
      } else if (outcome === "failed" || outcome === "refunded") {
        Alert.alert("Payment didn't go through", "Nothing was charged, or your payment was refunded. You can try again.");
      } else {
        Alert.alert("Still processing", "We haven't received confirmation of your payment yet. Your Airbundle will appear once it is confirmed.");
      }
    } catch (error) {
      const paymentError = toPaymentInitError(error);
      Alert.alert("Unable to start payment", paymentError.message);
    } finally {
      setBuying(false);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={[s.iconWrap, s.iconWrapAirbundle]}><ShieldCheck size={18} color="#FFF" /></View>
        <View style={s.headerCopy}>
          <Text style={s.cardTitle}>Airbundle</Text>
          <Text style={s.cardSubtitle}>Minute bundles for calls to 9tel users and local mobile carriers.</Text>
        </View>
        {isActive && <View style={s.currentBadge}><Check size={11} color="#FFF" /></View>}
      </View>

      <View style={[s.statusBanner, isActive ? s.statusBannerActive : s.statusBannerMuted]}>
        <Text style={[s.statusTitle, isActive ? s.statusTitleActive : s.statusTitleMuted]}>
          {isActive ? "Airbundle is active" : "Choose a bundle"}
        </Text>
        <Text style={[s.statusCopy, isActive ? s.statusCopyActive : s.statusCopyMuted]}>
          {isActive
            ? "Your account has active Airbundle minutes. Buy another bundle anytime to add more minutes."
            : "Pick a bundle, choose USD or NGN, and pay securely with Flutterwave. Minutes are added only after the payment is confirmed."}
        </Text>
      </View>

      <View style={s.bundleList} accessibilityRole="radiogroup" accessibilityLabel="Airbundle minutes">
        {AIRBUNDLES.map((bundle) => {
          const active = bundle.id === selected.id;
          return (
            <Pressable
              key={bundle.id}
              accessibilityRole="radio"
              accessibilityLabel={`${formatAirbundleMinutes(bundle)}, ${priceFor(bundle)}`}
              accessibilityState={{ selected: active, disabled: buying }}
              disabled={buying}
              onPress={() => setSelectedId(bundle.id)}
              style={[s.bundleRow, active && s.bundleRowActive]}
            >
              <View>
                <Text style={s.bundleMinutes}>{formatAirbundleMinutes(bundle)}</Text>
                {bundle.popular && <Text style={s.bundlePopular}>Most popular</Text>}
              </View>
              <Text style={s.bundlePrice}>{priceFor(bundle)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.featureList}>
        <View style={s.featureRow}>
          <Sparkles size={15} color="#5147AF" />
          <Text style={s.featureText}>Use your included minutes for 9tel and local mobile-carrier calls.</Text>
        </View>
        <View style={s.featureRow}>
          <Sparkles size={15} color="#5147AF" />
          <Text style={s.featureText}>Activation waits for payment confirmation from the backend.</Text>
        </View>
      </View>

      <CurrencySelector value={currency} onChange={setCurrency} disabled={buying} />

      <View style={s.upgradeRow}>
        <Pressable style={s.upgradeBtn} disabled={buying || !ngnPriceReady} onPress={buy} accessibilityRole="button">
          {buying ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={s.upgradeText}>Pay {priceFor(selected)} with Flutterwave</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFF", borderRadius: 22, padding: 18, borderWidth: 1.5, borderColor: "#EDEBF6" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  iconWrapAirbundle: { backgroundColor: "#5147AF" },
  cardTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 15 },
  cardSubtitle: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 3 },
  currentBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#3A9B70", alignItems: "center", justifyContent: "center" },
  statusBanner: { borderRadius: 18, padding: 14, marginTop: 16 },
  statusBannerActive: { backgroundColor: "#EAF8EF" },
  statusBannerMuted: { backgroundColor: "#F3F1FF" },
  statusTitle: { fontFamily: "Poppins-SemiBold", fontSize: 12 },
  statusTitleActive: { color: "#22583D" },
  statusTitleMuted: { color: "#352E74" },
  statusCopy: { fontFamily: "Poppins-Regular", fontSize: 11, lineHeight: 17, marginTop: 4 },
  statusCopyActive: { color: "#2E664A" },
  statusCopyMuted: { color: "#5D5A76" },
  featureList: { gap: 11, marginTop: 16 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  featureText: { flex: 1, color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 11.5, lineHeight: 17 },
  bundleList: { gap: 10, marginTop: 16 },
  bundleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: "#EDEBF6", borderRadius: 16, padding: 14 },
  bundleRowActive: { borderColor: "#5147AF", backgroundColor: "#F3F1FF" },
  bundleMinutes: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 13 },
  bundlePopular: { color: "#3A9B70", fontFamily: "Poppins-Medium", fontSize: 10, marginTop: 2 },
  bundlePrice: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  upgradeRow: { marginTop: 16, gap: 10 },
  upgradeBtn: { backgroundColor: "#5147AF", minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  upgradeText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 12 },
});
