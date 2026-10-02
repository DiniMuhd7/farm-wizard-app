import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Check, Gift, ShieldCheck, Sparkles } from "lucide-react-native";
import { createPremiumFlutterwaveCheckout, createPremiumStripeCheckout, getOrderStatus } from "@/services/payments";

interface Props {
  isPremium: boolean;
  onUpgraded: () => void;
  plan: "free" | "premium";
}

export default function NineTelPlanCards({ isPremium, onUpgraded, plan }: Props) {
  const [upgrading, setUpgrading] = useState(false);

  const upgrade = async (provider: "stripe" | "flutterwave") => {
    setUpgrading(true);
    try {
      const { orderId, url } = provider === "stripe"
        ? await createPremiumStripeCheckout()
        : await createPremiumFlutterwaveCheckout();
      await WebBrowser.openBrowserAsync(url);

      const deadline = Date.now() + 2 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const order = await getOrderStatus(orderId).catch(() => null);
        if (order?.status === "paid") {
          onUpgraded();
          Alert.alert("Welcome to Premium", "Your 9tel-to-9tel calls are now ad-free.");
          return;
        }
        if (order?.status === "failed") {
          Alert.alert("Payment didn't go through", "Nothing was charged. You can try again.");
          return;
        }
      }
    } catch (error) {
      Alert.alert("Unable to start payment", (error as Error).message);
    } finally {
      setUpgrading(false);
    }
  };

  if (plan === "free") {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={s.iconWrap}><Gift size={18} color="#5147AF" /></View>
          <View style={s.headerCopy}>
            <Text style={s.cardTitle}>Free 9tel-to-9tel calling</Text>
            <Text style={s.cardSubtitle}>Included with every 9tel account.</Text>
          </View>
          {!isPremium && <View style={s.currentBadge}><Check size={11} color="#FFF" /></View>}
        </View>

        <View style={[s.statusBanner, !isPremium ? s.statusBannerActive : s.statusBannerMuted]}>
          <Text style={[s.statusTitle, !isPremium ? s.statusTitleActive : s.statusTitleMuted]}>
            {!isPremium ? "Current entitlement" : "Also available on your account"}
          </Text>
          <Text style={[s.statusCopy, !isPremium ? s.statusCopyActive : s.statusCopyMuted]}>
            {!isPremium
              ? "Calls to other 9tel users stay free, with a rewarded ad before and after each call."
              : "Premium already removes the ads, so your 9tel-to-9tel calls stay ad-free instead of reverting to Free."}
          </Text>
        </View>

        <View style={s.featureList}>
          <View style={s.featureRow}>
            <Sparkles size={15} color="#5147AF" />
            <Text style={s.featureText}>Eligibility: any caller reaching another confirmed 9tel user.</Text>
          </View>
          <View style={s.featureRow}>
            <Sparkles size={15} color="#5147AF" />
            <Text style={s.featureText}>Ads: rewarded ad before and after each completed 9tel-to-9tel call.</Text>
          </View>
          <View style={s.featureRow}>
            <Sparkles size={15} color="#5147AF" />
            <Text style={s.featureText}>Cost: no prepaid credit needed for 9tel-to-9tel calls.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={[s.iconWrap, s.iconWrapPremium]}><ShieldCheck size={18} color="#FFF" /></View>
        <View style={s.headerCopy}>
          <Text style={s.cardTitle}>Premium 9tel-to-9tel calling</Text>
          <Text style={s.cardSubtitle}>Ad-free calling between 9tel users.</Text>
        </View>
        {isPremium && <View style={s.currentBadge}><Check size={11} color="#FFF" /></View>}
      </View>

      <View style={[s.statusBanner, isPremium ? s.statusBannerActive : s.statusBannerMuted]}>
        <Text style={[s.statusTitle, isPremium ? s.statusTitleActive : s.statusTitleMuted]}>
          {isPremium ? "Premium is active" : "Upgrade when you're ready"}
        </Text>
        <Text style={[s.statusCopy, isPremium ? s.statusCopyActive : s.statusCopyMuted]}>
          {isPremium
            ? "Your account is already entitled to ad-free 9tel-to-9tel calling."
            : "Premium removes both rewarded ads from 9tel-to-9tel calls. Secure checkout opens next, and the app only confirms access after the server reports payment success."}
        </Text>
      </View>

      <View style={s.featureList}>
        <View style={s.featureRow}>
          <Sparkles size={15} color="#5147AF" />
          <Text style={s.featureText}>Eligibility: applies only when both sides of the call are 9tel users.</Text>
        </View>
        <View style={s.featureRow}>
          <Sparkles size={15} color="#5147AF" />
          <Text style={s.featureText}>Ads: none before or after 9tel-to-9tel calls while Premium is active.</Text>
        </View>
        <View style={s.featureRow}>
          <Sparkles size={15} color="#5147AF" />
          <Text style={s.featureText}>Confirmation: activation waits for payment-provider confirmation from the backend.</Text>
        </View>
      </View>

      {!isPremium && (
        <View style={s.upgradeRow}>
          <Pressable style={s.upgradeBtn} disabled={upgrading} onPress={() => upgrade("stripe")}>
            {upgrading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.upgradeText}>Upgrade with card</Text>}
          </Pressable>
          <Pressable style={s.upgradeBtnAlt} disabled={upgrading} onPress={() => upgrade("flutterwave")}>
            <Text style={s.upgradeTextAlt}>Upgrade with Flutterwave</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFF", borderRadius: 22, padding: 18, borderWidth: 1.5, borderColor: "#EDEBF6" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  iconWrapPremium: { backgroundColor: "#5147AF" },
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
  upgradeRow: { marginTop: 16, gap: 10 },
  upgradeBtn: { backgroundColor: "#5147AF", minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  upgradeText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 12 },
  upgradeBtnAlt: { backgroundColor: "#F3F1FF", minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  upgradeTextAlt: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 12 },
});
