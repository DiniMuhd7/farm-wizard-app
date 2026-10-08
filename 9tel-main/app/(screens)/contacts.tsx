import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Contacts from "expo-contacts";
import { ChevronLeft, MessageCircle, Phone, Search, UsersRound } from "lucide-react-native";
import { getDefaultCallingCode, normalizeDestination } from "@/utils/phone";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

type Entry = { id: string; name: string; number: string };
const AVATAR_COLORS = ["#F1B296", "#B8D8CB", "#CDD0F6", "#F8D09A"];

export default function ContactsScreen() {
  useTranslation();
  useThemeVersion();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [query, setQuery] = useState("");
  const [callingCode, setCallingCode] = useState("+234");

  useEffect(() => {
    getDefaultCallingCode().then(setCallingCode);
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        setDenied(true);
        setEntries([]);
        return;
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
      setEntries(
        data
          .filter((c) => c.name && c.phoneNumbers?.length && c.phoneNumbers[0].number)
          .map((c) => ({ id: c.id as string, name: c.name, number: c.phoneNumbers![0].number as string }))
      );
    })().catch(() => setEntries([]));
  }, []);

  const visible = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.number.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) : entries;
  }, [entries, query]);

  const dest = (e: Entry) => normalizeDestination(e.number, callingCode);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable accessibilityLabel={tr("Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable>
        <Text style={s.title}>{tr("Contacts")}</Text>
      </View>
      <View style={s.search}>
        <Search size={18} color={themeColor("#9894A9")} />
        <TextInput value={query} onChangeText={setQuery} placeholder={tr("Search name or number")} placeholderTextColor={themeColor("#9995A8")} style={s.searchInput} />
      </View>

      {entries === null ? (
        <View style={s.center}><ActivityIndicator color={themeColor("#5F56C6")} /></View>
      ) : denied ? (
        <View style={s.center}>
          <UsersRound size={34} color={themeColor("#5F56C6")} />
          <Text style={s.emptyTitle}>{tr("Allow contacts access")}</Text>
          <Text style={s.emptyCopy}>{tr("9tel needs permission to show your contacts so you can call or message them quickly.")}</Text>
          <Pressable onPress={() => Linking.openSettings()} style={s.button}><Text style={s.buttonText}>{tr("Open settings")}</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(e) => e.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={s.emptyCopy}>{query ? tr("No contacts match your search.") : tr("No contacts with phone numbers found.")}</Text>}
          renderItem={({ item, index }) => (
            <View style={s.row}>
              <View style={[s.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                <Text style={s.initial}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.number} numberOfLines={1}>{item.number}</Text>
              </View>
              <Pressable accessibilityLabel={tr("Message {{name}}", { name: item.name })} onPress={() => router.push({ pathname: "/(screens)/chat", params: { number: dest(item) } })} style={s.action}>
                <MessageCircle size={18} color={themeColor("#5F56C6")} />
              </Pressable>
              <Pressable accessibilityLabel={tr("Call {{name}}", { name: item.name })} onPress={() => router.push({ pathname: "/(screens)/call", params: { number: dest(item) } })} style={s.action}>
                <Phone size={18} color={themeColor("#5F56C6")} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = themedStyles({
  safe: { flex: 1, backgroundColor: "#F8F8FD" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6 },
  back: { height: 42, width: 42, alignItems: "center", justifyContent: "center" },
  title: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 22, marginLeft: 4 },
  search: { height: 48, marginHorizontal: 20, marginTop: 10, marginBottom: 6, borderRadius: 16, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 15 },
  searchInput: { flex: 1, marginLeft: 10, color: "#211B59", fontFamily: "Poppins-Regular", fontSize: 12.5, paddingVertical: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  list: { paddingHorizontal: 14, paddingBottom: 30 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 6 },
  avatar: { height: 46, width: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: "Poppins-SemiBold", fontSize: 18, color: "#3B315F" },
  info: { flex: 1, marginLeft: 12, marginRight: 6 },
  name: { color: "#302C4C", fontFamily: "Poppins-Medium", fontSize: 14 },
  number: { color: "#9693A9", fontFamily: "Poppins-Regular", fontSize: 11.5, marginTop: 1 },
  action: { height: 40, width: 40, borderRadius: 14, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center", marginLeft: 6 },
  emptyTitle: { color: "#211B59", fontFamily: "Poppins-SemiBold", fontSize: 17, marginTop: 14 },
  emptyCopy: { color: "#85829B", fontFamily: "Poppins-Regular", fontSize: 12.5, textAlign: "center", marginTop: 8, lineHeight: 19 },
  button: { marginTop: 18, backgroundColor: "#5F56C6", borderRadius: 15, paddingHorizontal: 22, paddingVertical: 12 },
  buttonText: { color: "#FFF", fontFamily: "Poppins-SemiBold", fontSize: 13 },
});
