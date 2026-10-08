import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Clock3, Home, MessageCircle, UserRound } from "lucide-react-native";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";
import { themedStyles, useThemeVersion } from "@/theme";

const TAB_META: Record<string, { label: string; icon: any }> = {
  home: { label: "Home", icon: Home },
  recent: { label: "Recent", icon: Clock3 },
  messages: { label: "Messages", icon: MessageCircle },
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
  useThemeVersion();
  useTranslation();
  const visibleRoutes = state.routes.filter((route) => TAB_META[route.name]);

  return (
    <View style={s.wrap}>
      <View style={s.bar}>
        {visibleRoutes.map((route) => {
          const meta = TAB_META[route.name];
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const currentName = state.routes[state.index]?.name;
          const isCurrent = state.index === routeIndex;
          // The keypad ("dialer") is a hidden tab reached from the FAB; keep
          // Home highlighted while it is open.
          const active = isCurrent || (route.name === "home" && currentName === "dialer");
          const Icon = meta.icon;

          const navigateToTab = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isCurrent && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tr(meta.label)}
              accessibilityState={{ selected: active }}
              // onPressIn, not onPress: onPress only fires after a full
              // touch-down-then-up cycle that also has to pass React
              // Native's own "was this a tap or the start of a drag"
              // check (PRESS_RETENTION_OFFSET) — any small thumb movement,
              // which is completely normal when reaching for a tab at the
              // bottom of the screen, can get silently treated as a
              // cancelled press, so onPress never fires at all. The next,
              // more careful/stationary tap then works — which is exactly
              // "requires multiple taps". onPressIn fires immediately on
              // touch-down, before that cancellation logic applies.
              onPressIn={navigateToTab}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={s.tab}
            >
              <View style={[s.icon, active && s.activeIcon]}>
                <Icon size={20} color={active ? "#FFF" : "#9692A7"} strokeWidth={active ? 2.6 : 2} />
              </View>
              <Text style={[s.label, active && s.activeLabel]}>{tr(meta.label)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = themedStyles({
  wrap: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#F0EFF5", paddingTop: 8, paddingBottom: 20 },
  bar: { flexDirection: "row", justifyContent: "space-around" },
  // flex: 1 (instead of a shrink-to-content minWidth) makes each tab's
  // Pressable span its full share of the bar's width, so the press target
  // covers the whole column — including the gap next to a short label like
  // "Stats" — not just the icon/label's own intrinsic size.
  tab: { flex: 1, alignItems: "center", paddingVertical: 2, minWidth: 72 },
  icon: { height: 33, width: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  activeIcon: { backgroundColor: "#625BC1" },
  label: { fontFamily: "Poppins-Regular", fontSize: 10.5, color: "#9692A7", marginTop: 3 },
  activeLabel: { color: "#5147AF", fontFamily: "Poppins-SemiBold" },
});
