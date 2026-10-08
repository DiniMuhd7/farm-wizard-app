import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowUp, ChevronLeft, CircleAlert, Phone, Video } from "lucide-react-native";
import { cleanNumber, E164, getMessages, sendMessage, type Message } from "@/services/messages";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

type Item = Message & { pending?: boolean; failed?: boolean };
type Row = { type: "day"; id: string; label: string } | { type: "msg"; id: string; message: Item };

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (diff === 0) return tr("Today");
  if (diff === 1) return tr("Yesterday");
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export default function ChatScreen() {
  useTranslation();
  useThemeVersion();
  const params = useLocalSearchParams<{ number?: string }>();
  const initial = Array.isArray(params.number) ? params.number[0] : params.number;
  const [recipient, setRecipient] = useState(initial ?? "");
  const [locked, setLocked] = useState(Boolean(initial)); // true once the recipient is fixed
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(Boolean(initial));
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Row>>(null);

  const peer = cleanNumber(recipient);
  const peerValid = E164.test(peer);

  const refresh = useCallback(async (number: string, silent = false) => {
    try {
      const fetched = await getMessages(number);
      // Keep unsent/failed local messages visible alongside what the server has.
      setItems((current) => [...fetched, ...current.filter((m) => m.pending || m.failed)]);
      setLoadError(null);
    } catch (e) {
      if (!silent) setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!locked || !peerValid) return;
    refresh(peer);
    const timer = setInterval(() => refresh(peer, true), 8000); // pick up replies
    return () => clearInterval(timer);
  }, [locked, peer, peerValid, refresh]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = "";
    for (const message of items) {
      const label = dayLabel(message.createdAt);
      if (label !== lastDay) {
        out.push({ type: "day", id: `day-${message.createdAt}-${label}`, label });
        lastDay = label;
      }
      out.push({ type: "msg", id: message._id, message });
    }
    return out;
  }, [items]);

  const send = async (retry?: Item) => {
    const body = (retry?.body ?? draft).trim();
    if (!body || !peerValid) return;
    const tempId = retry?._id ?? `tmp-${Date.now()}`;
    const optimistic: Item = {
      _id: tempId, direction: "outbound", from: "", to: peer, body, mediaUrls: [],
      status: "sending", createdAt: new Date().toISOString(), pending: true,
    };
    setItems((current) => retry ? current.map((m) => (m._id === tempId ? optimistic : m)) : [...current, optimistic]);
    if (!retry) setDraft("");
    setLocked(true);
    try {
      const saved = await sendMessage(peer, body);
      setItems((current) => current.map((m) => (m._id === tempId ? saved : m)));
    } catch (e) {
      setItems((current) => current.map((m) => (m._id === tempId ? { ...m, pending: false, failed: true, status: (e as Error).message } : m)));
    }
  };

  const failedMessage = items.find((m) => m.failed)?.status;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={tr("Go back")} onPress={() => router.back()} style={s.iconButton}>
          <ChevronLeft size={23} color={themeColor("#211B59")} />
        </Pressable>
        {locked ? (
          <>
            <View style={s.avatar}><Text style={s.avatarText}>{peer.replace(/^\+/, "").slice(0, 1)}</Text></View>
            <View style={s.headerInfo}>
              <Text style={s.headerTitle} numberOfLines={1}>{peer}</Text>
              <Text style={s.headerSub}>{tr("SMS · MMS")}</Text>
            </View>
            <Pressable accessibilityLabel={tr("Voice call")} onPress={() => router.push({ pathname: "/(screens)/call", params: { number: peer } })} style={s.iconButton}>
              <Phone size={19} color={themeColor("#5147AF")} />
            </Pressable>
            <Pressable accessibilityLabel={tr("Video call")} onPress={() => router.push({ pathname: "/(screens)/call", params: { number: peer, video: "true" } })} style={s.iconButton}>
              <Video size={20} color={themeColor("#5147AF")} />
            </Pressable>
          </>
        ) : (
          <View style={s.toWrap}>
            <Text style={s.toLabel}>{tr("To")}</Text>
            <TextInput
              autoFocus
              value={recipient}
              onChangeText={setRecipient}
              placeholder="+234 801 234 5678"
              placeholderTextColor={themeColor("#9995A8")}
              keyboardType="phone-pad"
              style={s.toInput}
            />
          </View>
        )}
      </View>
      {!locked && recipient.length > 0 && !peerValid && (
        <Text style={s.hint}>{tr("Enter the full number with country code, e.g. +2348012345678.")}</Text>
      )}

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {loading ? (
          <View style={s.center}><ActivityIndicator color={themeColor("#5F56C6")} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.id}
            contentContainerStyle={s.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={loadError ? (
              <Pressable onPress={() => refresh(peer)} style={s.errorBanner}>
                <Text style={s.errorText}>{loadError} {tr("Tap to retry.")}</Text>
              </Pressable>
            ) : null}
            ListEmptyComponent={<Text style={s.empty}>{locked ? tr("No messages yet. Say hello 👋") : tr("Enter a number to start a conversation.")}</Text>}
            renderItem={({ item: row }) => {
              if (row.type === "day") return <Text style={s.day}>{row.label}</Text>;
              const m = row.message;
              const mine = m.direction === "outbound";
              return (
                <View style={[s.bubbleWrap, mine ? s.mineWrap : s.theirsWrap]}>
                  <Pressable disabled={!m.failed} onPress={() => send(m)} style={[s.bubble, mine ? s.mine : s.theirs, m.failed && s.failed]}>
                    {m.body ? <Text style={[s.body, mine && s.mineText]}>{m.body}</Text> : null}
                    {m.mediaUrls?.length ? <Text style={[s.media, mine && s.mineText]}>{m.mediaUrls.length > 1 ? tr("📎 {{count}} attachments", { count: m.mediaUrls.length }) : tr("📎 1 attachment")}</Text> : null}
                  </Pressable>
                  <View style={s.meta}>
                    {m.failed && <CircleAlert size={11} color={themeColor("#D9534F")} />}
                    <Text style={[s.metaText, m.failed && s.metaFailed]}>
                      {m.failed ? tr("Not sent · tap to retry") : m.pending ? tr("Sending…") : new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {mine && !m.pending && !m.failed && m.status === "delivered" ? ` · ${tr("Delivered")}` : ""}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
        {failedMessage ? <Text style={s.failReason}>{failedMessage}</Text> : null}
        <View style={s.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={tr("Message")}
            placeholderTextColor={themeColor("#9995A8")}
            multiline
            maxLength={1600}
            style={s.input}
          />
          <Pressable
            accessibilityLabel={tr("Send message")}
            disabled={!draft.trim() || !peerValid}
            onPress={() => send()}
            style={[s.send, (!draft.trim() || !peerValid) && s.sendDisabled]}
          >
            <ArrowUp size={21} color={themeColor("#FFF")} strokeWidth={2.6} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#EEEDF5", gap: 6 },
  iconButton: { height: 42, width: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatar: { height: 40, width: 40, borderRadius: 20, backgroundColor: "#CDD0F6", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Poppins-SemiBold", fontSize: 16, color: "#3B315F" },
  headerInfo: { flex: 1, marginLeft: 4 },
  headerTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 15 },
  headerSub: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5 },
  toWrap: { flex: 1, flexDirection: "row", alignItems: "center", height: 44, borderRadius: 14, backgroundColor: "#F3F2FA", paddingHorizontal: 12 },
  toLabel: { color: "#85829B", fontFamily: "Poppins-Medium", fontSize: 13, marginRight: 10 },
  toInput: { flex: 1, color: "#211B59", fontFamily: "Poppins-Regular", fontSize: 14, paddingVertical: 0 },
  hint: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 11, paddingHorizontal: 18, paddingTop: 8 },
  list: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
  empty: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center", marginTop: 60 },
  day: { alignSelf: "center", color: "#85829B", fontFamily: "Poppins-Medium", fontSize: 10.5, backgroundColor: "#EEECF8", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginVertical: 12, overflow: "hidden" },
  bubbleWrap: { marginBottom: 6, maxWidth: "80%" },
  mineWrap: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirsWrap: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 19 },
  mine: { backgroundColor: "#5F56C6", borderBottomRightRadius: 6 },
  theirs: { backgroundColor: "#FFF", borderBottomLeftRadius: 6, borderWidth: 1, borderColor: "#EAE7F3" },
  failed: { backgroundColor: "#E38A86" },
  body: { fontFamily: "Poppins-Regular", fontSize: 13.5, color: "#211B59", lineHeight: 20 },
  mineText: { color: "#FFF" },
  media: { fontFamily: "Poppins-Regular", fontSize: 11, color: "#77738E", marginTop: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2, marginHorizontal: 4 },
  metaText: { color: "#A09BAE", fontFamily: "Poppins-Regular", fontSize: 9.5 },
  metaFailed: { color: "#D9534F" },
  errorBanner: { backgroundColor: "#FFE6E4", borderRadius: 12, padding: 10, marginBottom: 10 },
  errorText: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 11.5 },
  failReason: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 11, paddingHorizontal: 18, paddingBottom: 4 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#EEEDF5" },
  input: { flex: 1, backgroundColor: "#F3F2FA", borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, minHeight: 44, maxHeight: 120, fontFamily: "Poppins-Regular", fontSize: 14, color: "#211B59" },
  send: { height: 44, width: 44, borderRadius: 22, backgroundColor: "#5F56C6", alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: "#C9C5EC" },
});
