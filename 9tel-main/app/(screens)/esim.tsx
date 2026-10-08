import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CircleAlert, CircleCheck, ChevronLeft, ChevronRight, Globe2, QrCode, SimCard, Wifi } from "lucide-react-native";
import { getEsimSupport } from "@/modules/esim-support";
import CurrencySelector from "@/components/CurrencySelector";
import { createEsimCheckout, getEsimPlans, getMyEsims, type EsimPlan, type EsimProfile } from "@/services/esim";
import { getPaymentPrices, toPaymentInitError, waitForPaymentOutcome, type PaymentCurrency, type PaymentPrices } from "@/services/payments";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

export default function EsimScreen() {
  useTranslation();
  useThemeVersion();
  const [tab, setTab] = useState<"plans" | "mine">("plans");
  const [plans, setPlans] = useState<EsimPlan[] | null>(null);
  const [mine, setMine] = useState<EsimProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<PaymentCurrency>("USD");
  const [prices, setPrices] = useState<PaymentPrices | null>(null);
  const [buying, setBuying] = useState(false);
  const support = useMemo(() => getEsimSupport(), []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, m] = await Promise.all([getEsimPlans(), getMyEsims()]);
      setPlans(p);
      setMine(m);
      setCountry((current) => current ?? p[0]?.countryCode ?? null);
      if (m.length && !p.length) setTab("mine");
    } catch (e) {
      setError((e as Error).message);
      setPlans((c) => c ?? []);
      setMine((c) => c ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    getPaymentPrices().then(setPrices).catch(() => undefined);
  }, [load]);

  const countries = useMemo(() => {
    const seen = new Map<string, string>();
    (plans ?? []).forEach((p) => seen.set(p.countryCode, p.country));
    return [...seen].map(([code, name]) => ({ code, name }));
  }, [plans]);

  const visible = useMemo(() => (plans ?? []).filter((p) => p.countryCode === country), [plans, country]);
  const selected = visible.find((p) => p.id === selectedId) ?? visible[0] ?? null;

  const priceFor = (plan: EsimPlan) => {
    if (currency === "USD") return `$${plan.priceUsd.toFixed(2)}`;
    const ngn = prices?.ngn.esim?.[plan.id];
    return ngn != null ? `₦${ngn.toLocaleString("en-US")}` : tr("Loading price…");
  };
  const ngnReady = !selected || currency !== "NGN" || prices?.ngn.esim?.[selected.id] != null;

  const buy = async () => {
    if (!selected || !ngnReady) return;
    if (support === "unsupported") {
      const proceed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          tr("This phone doesn't support eSIM"),
          tr("You can still buy this plan, but only if you'll install it on a different eSIM-capable phone."),
          [{ text: tr("Cancel"), style: "cancel", onPress: () => resolve(false) }, { text: tr("Buy anyway"), onPress: () => resolve(true) }],
          { onDismiss: () => resolve(false) }
        )
      );
      if (!proceed) return;
    }
    setBuying(true);
    try {
      const { orderId, url } = await createEsimCheckout(selected.id, currency);
      await WebBrowser.openBrowserAsync(url);
      const outcome = await waitForPaymentOutcome(orderId);
      if (outcome === "paid") {
        const profiles = await getMyEsims();
        setMine(profiles);
        setTab("mine");
        if (profiles[0]) router.push({ pathname: "/(screens)/esim-detail", params: { id: profiles[0].id } });
      } else if (outcome === "cancelled") {
        Alert.alert(tr("Payment cancelled"), tr("Nothing was charged. You can try again anytime."));
      } else if (outcome === "failed" || outcome === "refunded") {
        Alert.alert(tr("Payment didn't complete"), tr("Nothing was charged, or your payment was refunded. You can try again."));
      } else {
        Alert.alert(tr("Still processing"), tr("We haven't received confirmation yet. Your eSIM will appear under My eSIMs once the payment is confirmed."));
        load();
      }
    } catch (e) {
      Alert.alert(tr("Unable to start payment"), toPaymentInitError(e).message);
    } finally {
      setBuying(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={tr("Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{tr("eSIM")}</Text>
      </View>

      <View style={s.segment} accessibilityRole="tablist">
        {([["plans", tr("Data plans")], ["mine", `${tr("My eSIMs")}${mine?.length ? ` (${mine.length})` : ""}`]] as const).map(([id, label]) => (
          <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[s.segTab, tab === id && s.segTabActive]}>
            <Text style={[s.segText, tab === id && s.segTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {plans === null ? (
        <View style={s.center}><ActivityIndicator color={themeColor("#5F56C6")} /></View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={load} style={s.retry}><Text style={s.retryText}>{tr("Try again")}</Text></Pressable>
        </View>
      ) : tab === "plans" ? (
        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
          <View style={[s.support, support === "supported" ? s.supportOk : support === "unsupported" ? s.supportNo : s.supportUnknown]}>
            {support === "supported" ? <CircleCheck size={20} color={themeColor("#2EAF7D")} /> : <CircleAlert size={20} color={support === "unsupported" ? "#D9534F" : "#B8860B"} />}
            <View style={{ flex: 1 }}>
              <Text style={s.supportTitle}>
                {support === "supported" ? tr("Your phone supports eSIM") : support === "unsupported" ? tr("Your phone doesn't support eSIM") : tr("Couldn't check eSIM support")}
              </Text>
              <Text style={s.supportCopy}>
                {support === "supported"
                  ? tr("You can install a data plan on this phone. It must also be carrier-unlocked.")
                  : support === "unsupported"
                    ? tr("Plans can't be installed on this phone. You can still buy one for another eSIM-capable phone.")
                    : tr("Check your phone's settings for “Add eSIM” or “Mobile Service”. Update the app to enable automatic checking.")}
              </Text>
            </View>
          </View>

          <View style={s.hero}>
            <SimCard size={22} color={themeColor("#FFF")} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{tr("Mobile data without a physical SIM")}</Text>
              <Text style={s.heroCopy}>{tr("Pick a country, pay, and install in minutes.")}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {countries.map((c) => (
              <Pressable key={c.code} onPress={() => { setCountry(c.code); setSelectedId(null); }} style={[s.chip, country === c.code && s.chipActive]}>
                <Globe2 size={14} color={country === c.code ? "#FFF" : "#5147AF"} />
                <Text style={[s.chipText, country === c.code && s.chipTextActive]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {visible.map((plan) => {
            const active = selected?.id === plan.id;
            return (
              <Pressable key={plan.id} accessibilityRole="radio" accessibilityState={{ selected: active }} disabled={buying} onPress={() => setSelectedId(plan.id)} style={[s.plan, active && s.planActive]}>
                <View style={s.planIcon}><Wifi size={19} color={themeColor("#5147AF")} /></View>
                <View style={s.planInfo}>
                  <Text style={s.planData}>{plan.dataGB} GB</Text>
                  <Text style={s.planDays}>{tr("Valid for {{days}} days after install", { days: plan.validityDays })}</Text>
                </View>
                <Text style={s.planPrice}>{priceFor(plan)}</Text>
              </Pressable>
            );
          })}
          {!visible.length && <Text style={s.empty}>{tr("No plans available right now.")}</Text>}

          {selected && (
            <>
              <CurrencySelector value={currency} onChange={setCurrency} disabled={buying} />
              <Pressable accessibilityRole="button" disabled={buying || !ngnReady} onPress={buy} style={[s.pay, (buying || !ngnReady) && s.payDisabled]}>
                {buying ? <ActivityIndicator color={themeColor("#FFF")} /> : <Text style={s.payText}>{tr("Pay {{price}} with Flutterwave", { price: priceFor(selected) })}</Text>}
              </Pressable>
              <Text style={s.fine}>{tr("Your eSIM is created only after payment is confirmed. If it can't be issued, you're refunded automatically.")}</Text>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
          {mine && mine.length === 0 && (
            <View style={s.emptyBox}>
              <View style={s.emptyIcon}><QrCode size={30} color={themeColor("#5F56C6")} /></View>
              <Text style={s.emptyTitle}>{tr("No eSIMs yet")}</Text>
              <Text style={s.emptyCopy}>{tr("Buy a data plan and it will show up here, ready to install.")}</Text>
              <Pressable onPress={() => setTab("plans")} style={s.retry}><Text style={s.retryText}>{tr("Browse plans")}</Text></Pressable>
            </View>
          )}
          {(mine ?? []).map((e) => (
            <Pressable key={e.id} onPress={() => router.push({ pathname: "/(screens)/esim-detail", params: { id: e.id } })} style={s.plan}>
              <View style={s.planIcon}><SimCard size={19} color={themeColor("#5147AF")} /></View>
              <View style={s.planInfo}>
                <Text style={s.planData}>{e.country} · {e.dataGB} GB</Text>
                <Text style={s.planDays}>{tr("{{days}} days · bought {{date}}", { days: e.validityDays, date: new Date(e.purchasedAt).toLocaleDateString([], { month: "short", day: "numeric" }) })}</Text>
              </View>
              <ChevronRight size={19} color={themeColor("#A09BAE")} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  segment: { flexDirection: "row", backgroundColor: "#ECEAF7", borderRadius: 16, padding: 4, marginHorizontal: 20, marginTop: 8 },
  segTab: { flex: 1, paddingVertical: 10, borderRadius: 13, alignItems: "center" },
  segTabActive: { backgroundColor: "#FFF" },
  segText: { color: "#85829B", fontFamily: "Poppins-Medium", fontSize: 12.5 },
  segTextActive: { color: "#5147AF", fontFamily: "Poppins-SemiBold" },
  page: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  support: { flexDirection: "row", gap: 12, borderRadius: 18, padding: 14, alignItems: "flex-start", marginBottom: 12, borderWidth: 1 },
  supportOk: { backgroundColor: "#E8F7F0", borderColor: "#BFE6D3" },
  supportNo: { backgroundColor: "#FFECEA", borderColor: "#F5C6C3" },
  supportUnknown: { backgroundColor: "#FFF6DD", borderColor: "#F0DFA6" },
  supportTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 13 },
  supportCopy: { color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 2, lineHeight: 17 },
  hero: { flexDirection: "row", gap: 12, backgroundColor: "#4B41B5", borderRadius: 20, padding: 16, alignItems: "flex-start" },
  heroTitle: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  heroCopy: { color: "#D9D5FF", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 3, lineHeight: 17 },
  chips: { gap: 8, paddingVertical: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEECFF", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9 },
  chipActive: { backgroundColor: "#5F56C6" },
  chipText: { color: "#5147AF", fontFamily: "Poppins-Medium", fontSize: 12 },
  chipTextActive: { color: "#FFF" },
  plan: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: "#EDEBF6" },
  planActive: { borderColor: "#5F56C6", backgroundColor: "#F6F5FF" },
  planIcon: { height: 42, width: 42, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  planInfo: { flex: 1, marginLeft: 12 },
  planData: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 15 },
  planDays: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 1 },
  planPrice: { color: "#4B41B5", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  pay: { backgroundColor: "#5F56C6", borderRadius: 18, height: 54, alignItems: "center", justifyContent: "center", marginTop: 16 },
  payDisabled: { backgroundColor: "#C9C5EC" },
  payText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  fine: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5, textAlign: "center", marginTop: 10, lineHeight: 16 },
  empty: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center", marginTop: 20 },
  errorText: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center" },
  retry: { marginTop: 16, backgroundColor: "#5F56C6", borderRadius: 15, paddingHorizontal: 22, paddingVertical: 12 },
  retryText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13 },
  emptyBox: { alignItems: "center", paddingTop: 50 },
  emptyIcon: { height: 68, width: 68, borderRadius: 24, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 17, marginTop: 16 },
  emptyCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center", marginTop: 4 },
});
