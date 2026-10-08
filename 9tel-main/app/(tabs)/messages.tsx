import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { MessageCirclePlus, MessageSquareText, Search } from "lucide-react-native";
import KeypadFab from "@/components/KeypadFab";
import { getConversations, type Conversation } from "@/services/messages";
import { FAB_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

const AVATAR_COLORS = ["#F1B296", "#B8D8CB", "#CDD0F6", "#F8D09A"];

function shortTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (days === 0) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return tr("Yesterday");
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function preview(item: Conversation): string {
  const { last } = item;
  const text = last.body?.trim() || (last.mediaUrls?.length ? tr("📷 Photo") : "");
  return last.direction === "outbound" ? tr("You: {{text}}", { text }) : text;
}

export default function MessagesScreen() {
  useTranslation();
  useThemeVersion();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setConversations(await getConversations());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setConversations((current) => current ?? []);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visible = useMemo(() => {
    const q = query.replace(/\s/g, "").toLowerCase();
    if (!conversations) return [];
    return q ? conversations.filter((c) => c.number.includes(q) || c.last.body?.toLowerCase().includes(query.trim().toLowerCase())) : conversations;
  }, [conversations, query]);

  const openChat = (number?: string) => router.push({ pathname: "/(screens)/chat", params: number ? { number } : {} });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{tr("Messages")}</Text>
          <Text style={s.sub}>{tr("SMS & MMS from your 9tel number")}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("New message")} onPress={() => openChat()} style={s.compose}>
          <MessageCirclePlus size={22} color={themeColor("#5147AF")} />
        </Pressable>
      </View>

      <View style={s.search}>
        <Search size={18} color={themeColor("#9894A9")} />
        <TextInput value={query} onChangeText={setQuery} placeholder={tr("Search messages")} placeholderTextColor={themeColor("#9995A8")} style={s.searchInput} />
      </View>

      {conversations === null ? (
        <View style={s.center}><ActivityIndicator color={themeColor("#5F56C6")} /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.number}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={themeColor("#5F56C6")} />}
          ListHeaderComponent={error ? (
            <Pressable onPress={load} style={s.errorBanner}>
              <Text style={s.errorText}>{error}</Text>
              <Text style={s.errorRetry}>{tr("Tap to retry")}</Text>
            </Pressable>
          ) : null}
          ListEmptyComponent={!error ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}><MessageSquareText size={30} color={themeColor("#5F56C6")} /></View>
              <Text style={s.emptyTitle}>{query ? tr("No matches") : tr("No messages yet")}</Text>
              <Text style={s.emptyCopy}>{query ? tr("Try a different name or number.") : tr("Start a conversation with anyone using your 9tel number.")}</Text>
              {!query && (
                <Pressable onPress={() => openChat()} style={s.emptyButton}>
                  <Text style={s.emptyButtonText}>{tr("New message")}</Text>
                </Pressable>
              )}
            </View>
          ) : null}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => openChat(item.number)} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
              <View style={[s.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                <Text style={s.initial}>{item.number.replace(/^\+/, "").slice(0, 1)}</Text>
              </View>
              <View style={s.info}>
                <View style={s.line}>
                  <Text style={[s.name, item.unread > 0 && s.bold]} numberOfLines={1}>{item.number}</Text>
                  <Text style={[s.time, item.unread > 0 && s.timeUnread]}>{shortTime(item.last.createdAt)}</Text>
                </View>
                <View style={s.line}>
                  <Text style={[s.preview, item.unread > 0 && s.previewUnread]} numberOfLines={1}>{preview(item)}</Text>
                  {item.unread > 0 && (
                    <View style={s.badge}><Text style={s.badgeText}>{item.unread > 99 ? "99+" : item.unread}</Text></View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
      <KeypadFab />
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 11 },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 26 },
  sub: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 1 },
  compose: { height: 46, width: 46, borderRadius: 16, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  search: { height: 48, marginHorizontal: 20, marginTop: 18, marginBottom: 8, borderRadius: 16, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, color: "#211B59", fontFamily: "Poppins-Regular", fontSize: 12.5, paddingVertical: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 12, paddingBottom: FAB_CLEARANCE, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 8, borderRadius: 18 },
  rowPressed: { backgroundColor: "#EEECFF" },
  avatar: { height: 52, width: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: "Poppins-SemiBold", fontSize: 20, color: "#3B315F" },
  info: { flex: 1, marginLeft: 13 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { flex: 1, color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 14, marginRight: 8 },
  bold: { fontFamily: "Poppins-SemiBold", color: "#211B59" },
  time: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 10.5 },
  timeUnread: { color: "#5147AF", fontFamily: "Poppins-SemiBold" },
  preview: { flex: 1, color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12, marginTop: 2, marginRight: 8 },
  previewUnread: { color: "#302C4C", fontFamily: "Poppins-Medium" },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#5F56C6", alignItems: "center", justifyContent: "center", marginTop: 2 },
  badgeText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 10 },
  errorBanner: { backgroundColor: "#FFE6E4", borderRadius: 14, padding: 12, marginHorizontal: 8, marginBottom: 8 },
  errorText: { color: "#B8403B", fontFamily: "Poppins-Regular", fontSize: 12 },
  errorRetry: { color: "#B8403B", fontFamily: "Poppins-SemiBold", fontSize: 11.5, marginTop: 3 },
  empty: { alignItems: "center", paddingTop: 70, paddingHorizontal: 30 },
  emptyIcon: { height: 68, width: 68, borderRadius: 24, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 17, marginTop: 16 },
  emptyCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center", marginTop: 4, lineHeight: 19 },
  emptyButton: { marginTop: 18, backgroundColor: "#5F56C6", borderRadius: 15, paddingHorizontal: 22, paddingVertical: 12 },
  emptyButtonText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13 },
});
