import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { PhoneForwarded } from "lucide-react-native";
import { CREDIT_PACKS, formatCents } from "@/constants/creditPacks";
import { createCreditsFlutterwaveCheckout, createCreditsStripeCheckout } from "@/services/credits";
import { getCreditsBalance, type CreditsBalance } from "@/services/credits";
import { getOrderStatus } from "@/services/payments";

// Pay As You Go — prepaid balance for calls from 9tel to local mobile
// carriers (not 9tel-to-9tel, which is Free/Premium — see
// components/NineTelPlanCards.tsx). The balance shown here is always a
// fresh read of the authoritative backend value; nothing is ever deducted
// client-side (see services/credits.ts).
export default function PayAsYouGoCard() {
  const [balance, setBalance] = useState<CreditsBalance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);

  const loadBalance = () => {
    setLoadError(null);
    getCreditsBalance()
      .then(setBalance)
      .catch((error) => setLoadError((error as Error).message));
  };

  useEffect(() => {
    loadBalance();
  }, []);

  const buy = async (packId: string, provider: "stripe" | "flutterwave") => {
    setBuyingPackId(packId);
    try {
      const { orderId, url } = provider === "stripe"
        ? await createCreditsStripeCheckout(packId)
        : await createCreditsFlutterwaveCheckout(packId);
      await WebBrowser.openBrowserAsync(url);

      const deadline = Date.now() + 2 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const order = await getOrderStatus(orderId).catch(() => null);
        if (order?.status === "paid") {
          loadBalance();
          Alert.alert("Credits added", "Your Pay As You Go balance has been topped up.");
          return;
        }
        if (order?.status === "failed" || order?.status === "refunded") {
          Alert.alert("Payment didn't complete", "Nothing was charged, or your payment was refunded. You can try again.");
          return;
        }
      }
    } catch (error) {
      Alert.alert("Unable to start payment", (error as Error).message);
    } finally {
      setBuyingPackId(null);
    }
  };

  return (
    <View>
      <View style={s.headingRow}>
        <Text style={s.heading}>PAY AS YOU GO · 9TEL TO MOBILE</Text>
        <Text style={s.count}>Credits</Text>
      </View>
      <View style={s.balanceCard}>
        <View style={s.iconWrap}><PhoneForwarded size={16} color="#5147AF" /></View>
        <View style={s.balanceCopy}>
          <Text style={s.balanceLabel}>Available balance</Text>
          {balance ? (
            <Text style={s.balanceValue}>{formatCents(balance.balanceCents)}</Text>
          ) : loadError ? (
            <Pressable onPress={loadBalance}><Text style={s.balanceError}>{loadError} Tap to retry.</Text></Pressable>
          ) : (
            <ActivityIndicator color="#5147AF" size="small" style={s.balanceLoading} />
          )}
        </View>
      </View>
      <Text style={s.copy}>Calls to local mobile numbers are billed from this balance per minute. Top up to keep calling.</Text>
      <View style={s.list}>
        {CREDIT_PACKS.map((pack) => (
          <View key={pack.id} style={s.packCard}>
            <Text style={s.packAmount}>{formatCents(pack.creditsCents)} credits</Text>
            <View style={s.packActions}>
              <Pressable
                style={s.packBtn}
                disabled={buyingPackId !== null}
                onPress={() => buy(pack.id, "stripe")}
              >
                {buyingPackId === pack.id ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={s.packBtnText}>{formatCents(pack.priceUsdCents)}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 27, marginBottom: 10 },
  heading: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 11, letterSpacing: 0.8 },
  count: { color: "#8D899F", fontFamily: "Poppins-Regular", fontSize: 10 },
  balanceCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: "#EDEBF6", flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  balanceCopy: { flex: 1 },
  balanceLabel: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10.5 },
  balanceValue: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 18, marginTop: 2 },
  balanceError: { color: "#C25454", fontFamily: "Poppins-Medium", fontSize: 11, marginTop: 2 },
  balanceLoading: { alignSelf: "flex-start", marginTop: 4 },
  copy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 10.5, lineHeight: 16, marginTop: 10 },
  list: { flexDirection: "row", gap: 10, marginTop: 12 },
  packCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1.5, borderColor: "#EDEBF6", padding: 12, alignItems: "center" },
  packAmount: { color: "#302C4C", fontFamily: "Poppins-SemiBold", fontSize: 12, textAlign: "center" },
  packActions: { marginTop: 10, width: "100%" },
  packBtn: { backgroundColor: "#5147AF", height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  packBtnText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 11.5 },
});
