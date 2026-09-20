import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BarChart3, Clock3, UserRound } from "lucide-react-native";

const TAB_META: Record<string, { label: string; icon: any }> = {
  recent: { label: "Recent", icon: Clock3 },
  stats: { label: "Stats", icon: BarChart3 },
  profile: { label: "Profile", icon: UserRound },
};

// Drives the actual Tab Navigator via the navigation/state props React
// Navigation passes a custom tabBar, instead of calling Expo Router's
// router.replace() independently of it. The previous version's
// router.replace(path) changed the URL first, and the Tab Navigator's own
// internal state (which `active` was actually read from, via a separate
// usePathname() call) only caught up a beat later — so the first tap often
// produced no visible change, and it took a second tap once things had
// settled. navigation.navigate() updates the same navigator these tab
// screens already belong to, synchronously, in one press.
export default function CustomBottomTab({ state, navigation }: BottomTabBarProps) {
  const visibleRoutes = state.routes.filter((route) => TAB_META[route.name]);

  return (
    <View style={s.wrap}>
      <View style={s.bar}>
        {visibleRoutes.map((route) => {
          const meta = TAB_META[route.name];
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const active = state.index === routeIndex;
          const Icon = meta.icon;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!active && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={onPress}
              style={s.tab}
            >
              <View style={[s.icon, active && s.activeIcon]}>
                <Icon size={20} color={active ? "#FFF" : "#9692A7"} strokeWidth={active ? 2.6 : 2} />
              </View>
              <Text style={[s.label, active && s.activeLabel]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#F0EFF5", paddingTop: 8, paddingBottom: 20 },
  bar: { flexDirection: "row", justifyContent: "space-around" },
  tab: { alignItems: "center", minWidth: 72 },
  icon: { height: 33, width: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  activeIcon: { backgroundColor: "#625BC1" },
  label: { fontFamily: "Poppins-Regular", fontSize: 10.5, color: "#9692A7", marginTop: 3 },
  activeLabel: { color: "#5147AF", fontFamily: "Poppins-SemiBold" },
});
