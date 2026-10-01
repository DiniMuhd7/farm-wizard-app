import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Check, Gift, ShieldCheck } from "lucide-react-native";
import { createPremiumFlutterwaveCheckout, createPremiumStripeCheckout, getOrderStatus } from "@/services/payments";

interface Props {
  isPremium: boolean;
  onUpgraded: () => void;
}

// Free vs Premium — both are 9tel-to-9tel calling, the choice is only
// about rewarded ads: Free shows one before and after every call (see
// app/(screens)/call.tsx's ad-gate/post-call-ad phases); Premium is
// ad-free. Pay As You Go (carrier calls) is a separate card — see
// components/PayAsYouGoCard.tsx — since it governs a different kind of
// call entirely.
export default function NineTelPlanCards({ isPremium, onUpgraded }: Props) {
  const [upgrading, setUpgrading] = useState(false);

  const upgrade = async (provider: "stripe" | "flutterwave") => {
    setUpgrading(true);
    try {
      const { orderId, url } = provider === "stripe"
        ? await createPremiumStripeCheckout()
        : await createPremiumFlutterwaveCheckout();
      await WebBrowser.openBrowserAsync(url);

      // Same "poll briefly after returning from checkout" approach as the
      // number-purchase flow in settings.tsx — actual confirmation only
      // ever comes from the provider's webhook on the backend.
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

  return (
    <View>
      <View style={s.headingRow}>
        <Text style={s.heading}>9TEL TO 9TEL</Text>
        <Text style={s.count}>Free or Premium</Text>
      </View>
      <View style={s.list}>
        <View style={[s.card, !isPremium && s.cardSelected]}>
          <View style={s.cardTop}>
            <View style={s.iconWrap}><Gift size={16} color="#5147AF" /></View>
            <Text style={s.cardTitle}>Free</Text>
            {!isPremium && <View style={s.currentBadge}><Check size={11} color="#FFF" /></View>}
          </View>
          <Text style={s.cardCopy}>
            Call other 9tel users at no cost. A short rewarded ad plays before and after each call.
          </Text>
        </View>

        <View style={[s.card, isPremium && s.cardSelected]}>
          <View style={s.cardTop}>
            <View style={[s.iconWrap, s.iconWrapPremium]}><ShieldCheck size={16} color="#FFF" /></View>
            <Text style={s.cardTitle}>Premium</Text>
            {isPremium && <View style={s.currentBadge}><Check size={11} color="#FFF" /></View>}
          </View>
          <Text style={s.cardCopy}>Ad-free 9tel-to-9tel calling. No rewarded ads before or after calls.</Text>
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
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 27, marginBottom: 10 },
  heading: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  count: { color: "#8D899F", fontFamily: "Poppins-Regular", fontSize: 10 },
  list: { gap: 10 },
  card: { backgroundColor: "#FFF", borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: "#EDEBF6" },
  cardSelected: { borderColor: "#5147AF", backgroundColor: "#F3F1FF" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: { width: 30, height: 30, borderRadius: 11, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  iconWrapPremium: { backgroundColor: "#5147AF" },
  cardTitle: { flex: 1, color: "#302C4C", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  currentBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#3A9B70", alignItems: "center", justifyContent: "center" },
  cardCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11, lineHeight: 17, marginTop: 8 },
  upgradeRow: { marginTop: 12, gap: 8 },
  upgradeBtn: { backgroundColor: "#5147AF", height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  upgradeText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 12 },
  upgradeBtnAlt: { backgroundColor: "#F3F1FF", height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  upgradeTextAlt: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 12 },
});
