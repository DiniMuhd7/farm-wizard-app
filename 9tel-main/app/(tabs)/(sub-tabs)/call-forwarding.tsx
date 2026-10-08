import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BellOff, CheckCircle2, ChevronLeft, Info, PhoneForwarded, PhoneOff } from "lucide-react-native";
import { getForwarding, saveForwarding, type ForwardingMode } from "@/services/forwarding";
import { getCreditsBalance, type CreditsBalance } from "@/services/credits";
import { E164 } from "@/services/messages";
import { formatCents } from "@/constants/creditPacks";
import { getDefaultCallingCode, normalizeDestination } from "@/utils/phone";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

const MODES: { id: ForwardingMode; title: string; copy: string; icon: any }[] = [
  { id: "no_answer", title: "When I don't answer", copy: "Your app rings first. If you're busy, don't pick up, or the app can't be reached, the call goes to your other number.", icon: BellOff },
  { id: "always", title: "Always forward", copy: "Calls skip the app and go straight to your other number.", icon: PhoneForwarded },
];

export default function CallForwarding() {
  useTranslation();
  useThemeVersion();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasNumber, setHasNumber] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<ForwardingMode>("no_answer");
  const [number, setNumber] = useState("");
  const [saved, setSaved] = useState<{ enabled: boolean; mode: ForwardingMode; number: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [callingCode, setCallingCode] = useState("+234");
  const [balance, setBalance] = useState<CreditsBalance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getForwarding();
      setHasNumber(data.hasNumber);
      setEnabled(data.forwarding.enabled);
      setMode(data.forwarding.mode);
      setNumber(data.forwarding.number ?? "");
      setSaved(data.forwarding);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
    getCreditsBalance().then(setBalance).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    getDefaultCallingCode().then(setCallingCode);
  }, [load]);

  const destination = number.trim() ? normalizeDestination(number, callingCode) : "";
  const dirty = !saved || saved.enabled !== enabled || saved.mode !== mode || (saved.number ?? "") !== destination;
  const lowBalance = balance !== null && balance.ratePerMinuteCents > 0 && balance.balanceCents < balance.ratePerMinuteCents;

  const save = async () => {
    if (enabled && !E164.test(destination)) {
      return setFormError(tr("Enter a valid phone number, e.g. +2348012345678 or 0801 234 5678."));
    }
    setFormError(null);
    setSaving(true);
    try {
      const result = await saveForwarding({ enabled, mode, number: destination || null });
      setSaved(result);
      setNumber(result.number ?? "");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={tr("Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{tr("Call forwarding")}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={themeColor("#5F56C6")} /></View>
      ) : loadError ? (
        <View style={s.center}>
          <Text style={s.errorText}>{loadError}</Text>
          <Pressable onPress={load} style={s.retry}><Text style={s.retryText}>{tr("Try again")}</Text></Pressable>
        </View>
      ) : !hasNumber ? (
        <View style={s.center}>
          <PhoneOff size={32} color={themeColor("#5F56C6")} />
          <Text style={s.emptyTitle}>{tr("You need a 9tel number first")}</Text>
          <Text style={s.emptyCopy}>{tr("Call forwarding applies to calls made to your 9tel number.")}</Text>
          <Pressable onPress={() => router.push("/(tabs)/(sub-tabs)/settings")} style={s.retry}><Text style={s.retryText}>{tr("Get a number")}</Text></Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{tr("Forward my calls")}</Text>
                <Text style={s.cardCopy}>{enabled ? tr("Calls to your 9tel number are forwarded.") : tr("Calls ring in the 9tel app only.")}</Text>
              </View>
              <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: "#5F56C6", false: "#D8D5E8" }} thumbColor="#FFF" />
            </View>

            <Text style={s.heading}>{tr("FORWARD TO")}</Text>
            <TextInput
              value={number}
              onChangeText={(v) => { setNumber(v); setFormError(null); }}
              placeholder={tr("Phone number, e.g. +234 801 234 5678")}
              placeholderTextColor={themeColor("#9995A8")}
              keyboardType="phone-pad"
              style={s.input}
            />

            <Text style={s.heading}>{tr("WHEN")}</Text>
            {MODES.map(({ id, title, copy, icon: Icon }) => {
              const active = mode === id;
              return (
                <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => setMode(id)} style={[s.mode, active && s.modeActive]}>
                  <View style={s.modeIcon}><Icon size={19} color={themeColor("#5147AF")} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modeTitle}>{tr(title)}</Text>
                    <Text style={s.modeCopy}>{tr(copy)}</Text>
                  </View>
                  <View style={[s.radio, active && s.radioActive]}>{active ? <View style={s.radioDot} /> : null}</View>
                </Pressable>
              );
            })}

            <View style={[s.note, enabled && lowBalance && s.noteWarn]}>
              <Info size={17} color={enabled && lowBalance ? "#B8403B" : "#5147AF"} />
              <View style={{ flex: 1 }}>
                <Text style={s.noteText}>
                  {tr("Forwarded calls are charged to your Prepaid balance at carrier rates{{balance}}. If your balance can't cover a call, it won't be forwarded and will ring in the app as usual.", { balance: balance ? tr(" (balance {{amount}})", { amount: formatCents(balance.balanceCents) }) : "" })}
                </Text>
                {enabled && lowBalance ? (
                  <Pressable onPress={() => router.push("/(tabs)/(sub-tabs)/calling-plan")}><Text style={s.topUp}>{tr("Your balance is too low — top up")}</Text></Pressable>
                ) : null}
              </View>
            </View>

            {formError ? <Text style={s.formError}>{formError}</Text> : null}
            <Pressable accessibilityRole="button" disabled={saving || !dirty} onPress={save} style={[s.save, (saving || !dirty) && s.saveDisabled]}>
              {saving ? <ActivityIndicator color={themeColor("#FFF")} /> : (
                <View style={s.saveRow}>
                  {justSaved ? <CheckCircle2 size={18} color={themeColor("#FFF")} /> : null}
                  <Text style={s.saveText}>{justSaved ? tr("Saved") : tr("Save changes")}</Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  page: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 20, padding: 16 },
  cardTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 15 },
  cardCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 1 },
  heading: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  input: { backgroundColor: "#FFF", borderRadius: 16, paddingHorizontal: 16, height: 52, color: "#211B59", fontFamily: "Poppins-Regular", fontSize: 14 },
  mode: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFF", borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: "#EDEBF6" },
  modeActive: { borderColor: "#5F56C6", backgroundColor: "#F6F5FF" },
  modeIcon: { height: 40, width: 40, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  modeTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 13.5 },
  modeCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 11, marginTop: 2, lineHeight: 16 },
  radio: { height: 22, width: 22, borderRadius: 11, borderWidth: 2, borderColor: "#CFCBE6", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: "#5F56C6" },
  radioDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: "#5F56C6" },
  note: { flexDirection: "row", gap: 10, backgroundColor: "#EEECFF", borderRadius: 16, padding: 14, marginTop: 8, alignItems: "flex-start" },
  noteWarn: { backgroundColor: "#FFE6E4" },
  noteText: { color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 11.5, lineHeight: 17 },
  topUp: { color: "#B8403B", fontFamily: "Poppins-SemiBold", fontSize: 11.5, marginTop: 6 },
  formError: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 14 },
  save: { backgroundColor: "#5F56C6", borderRadius: 18, height: 54, alignItems: "center", justifyContent: "center", marginTop: 18 },
  saveDisabled: { backgroundColor: "#C9C5EC" },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  errorText: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center" },
  retry: { marginTop: 16, backgroundColor: "#5F56C6", borderRadius: 15, paddingHorizontal: 22, paddingVertical: 12 },
  retryText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13 },
  emptyTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 17, marginTop: 14 },
  emptyCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center", marginTop: 4 },
});
