import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ban, ChevronLeft, ShieldCheck } from "lucide-react-native";
import { blockNumber, getBlockedNumbers, unblockNumber, type BlockedNumber } from "@/services/blocked";
import { E164 } from "@/services/messages";
import { getDefaultCallingCode, normalizeDestination } from "@/utils/phone";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

export default function BlockedNumbers() {
  useTranslation();
  useThemeVersion();
  const [items, setItems] = useState<BlockedNumber[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [callingCode, setCallingCode] = useState("+234");

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await getBlockedNumbers());
    } catch (e) {
      setLoadError((e as Error).message);
      setItems((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    getDefaultCallingCode().then(setCallingCode);
  }, [load]);

  const add = async () => {
    const destination = normalizeDestination(number, callingCode);
    if (!number.trim() || !E164.test(destination)) {
      return setFormError(tr("Enter a valid phone number, e.g. +2348012345678 or 0801 234 5678."));
    }
    setFormError(null);
    setSaving(true);
    try {
      const created = await blockNumber(destination, label.trim());
      setItems((current) => [created, ...(current ?? [])]);
      setNumber("");
      setLabel("");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: BlockedNumber) =>
    Alert.alert(tr("Unblock {{name}}?", { name: item.label || item.number }), tr("They'll be able to call and text you again."), [
      { text: tr("Cancel"), style: "cancel" },
      {
        text: tr("Unblock"),
        onPress: async () => {
          try {
            await unblockNumber(item.id);
            setItems((current) => (current ?? []).filter((x) => x.id !== item.id));
          } catch (e) {
            Alert.alert(tr("Couldn't unblock"), (e as Error).message);
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={tr("Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{tr("Blocked numbers")}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={s.info}>
                <ShieldCheck size={18} color={themeColor("#5147AF")} />
                <Text style={s.infoText}>{tr("Blocked numbers can't ring you or send you texts. They hear that you're unavailable and won't be told they're blocked.")}</Text>
              </View>

              <View style={s.form}>
                <TextInput value={number} onChangeText={(v) => { setNumber(v); setFormError(null); }} placeholder={tr("Phone number")} placeholderTextColor={themeColor("#9995A8")} keyboardType="phone-pad" style={s.input} />
                <TextInput value={label} onChangeText={setLabel} placeholder={tr("Name (optional)")} placeholderTextColor={themeColor("#9995A8")} maxLength={60} style={s.input} />
                {formError ? <Text style={s.formError}>{formError}</Text> : null}
                <Pressable accessibilityRole="button" disabled={saving || !number.trim()} onPress={add} style={[s.blockBtn, (saving || !number.trim()) && s.blockBtnDisabled]}>
                  {saving ? <ActivityIndicator color={themeColor("#FFF")} /> : <Text style={s.blockBtnText}>{tr("Block number")}</Text>}
                </Pressable>
                <Text style={s.tip}>{tr("Tip: press and hold a number in Recent calls to block it quickly.")}</Text>
              </View>

              {loadError ? (
                <Pressable onPress={load} style={s.errorBanner}>
                  <Text style={s.errorText}>{loadError}</Text>
                  <Text style={s.errorRetry}>{tr("Tap to retry")}</Text>
                </Pressable>
              ) : null}
              {items && items.length > 0 ? <Text style={s.heading}>{tr("BLOCKED ({{count}})", { count: items.length })}</Text> : null}
            </View>
          }
          ListEmptyComponent={
            items === null ? (
              <View style={s.center}><ActivityIndicator color={themeColor("#5F56C6")} /></View>
            ) : loadError ? null : (
              <View style={s.empty}>
                <View style={s.emptyIcon}><Ban size={28} color={themeColor("#5F56C6")} /></View>
                <Text style={s.emptyTitle}>{tr("No blocked numbers")}</Text>
                <Text style={s.emptyCopy}>{tr("Numbers you block will appear here.")}</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={s.rowIcon}><Ban size={18} color={themeColor("#D9534F")} /></View>
              <View style={s.rowInfo}>
                <Text style={s.rowNumber} numberOfLines={1}>{item.label || item.number}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {item.label ? `${item.number} · ` : ""}{tr("Blocked {{date}}", { date: new Date(item.blockedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) })}
                </Text>
              </View>
              <Pressable accessibilityLabel={tr("Unblock {{name}}", { name: item.label || item.number })} onPress={() => remove(item)} style={s.unblock}>
                <Text style={s.unblockText}>{tr("Unblock")}</Text>
              </Pressable>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  list: { padding: 20, paddingBottom: TAB_BAR_CLEARANCE },
  info: { flexDirection: "row", gap: 10, backgroundColor: "#EEECFF", borderRadius: 16, padding: 14, alignItems: "flex-start" },
  infoText: { flex: 1, color: "#514D66", fontFamily: "Poppins-Regular", fontSize: 11.5, lineHeight: 17 },
  form: { backgroundColor: "#FFF", borderRadius: 20, padding: 14, marginTop: 14 },
  input: { backgroundColor: "#F3F2FA", borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 10, color: "#211B59", fontFamily: "Poppins-Regular", fontSize: 13.5 },
  formError: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 11.5, marginBottom: 8 },
  blockBtn: { backgroundColor: "#D9534F", borderRadius: 15, height: 50, alignItems: "center", justifyContent: "center" },
  blockBtnDisabled: { backgroundColor: "#E9B5B3" },
  blockBtnText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  tip: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5, textAlign: "center", marginTop: 10 },
  heading: { color: "#908CA2", fontFamily: "Poppins-SemiBold", fontSize: 10, letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  center: { paddingTop: 40, alignItems: "center" },
  errorBanner: { backgroundColor: "#FFE6E4", borderRadius: 14, padding: 12, marginTop: 14 },
  errorText: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 12 },
  errorRetry: { color: "#B8403B", fontFamily: "Poppins-SemiBold", fontSize: 11.5, marginTop: 3 },
  empty: { alignItems: "center", paddingTop: 36 },
  emptyIcon: { height: 62, width: 62, borderRadius: 22, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 16, marginTop: 14 },
  emptyCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 3 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 18, padding: 12, marginBottom: 8 },
  rowIcon: { height: 40, width: 40, borderRadius: 14, backgroundColor: "#FFE6E4", alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  rowNumber: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 14 },
  rowSub: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5, marginTop: 1 },
  unblock: { backgroundColor: "#EEECFF", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8 },
  unblockText: { color: "#5147AF", fontFamily: "Poppins-SemiBold", fontSize: 11.5 },
});
