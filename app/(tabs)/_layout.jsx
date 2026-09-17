import { Redirect, Tabs } from "expo-router";
import CustomBottomTab from "@/components/CustomBottomTab";
import BannerAdComponent from "../../utils/BannerAdComponent";
import { useLoginContext } from "../../context/LoginProvider";

const TabsLayout = () => {
  const { user, loading } = useLoginContext();

  // Never call router.replace() during render. `user` is null on the very
  // first render of this layout, so doing that fired a navigation on every
  // render pass: replace('/') -> index sees a restored session -> <Redirect>
  // back to /(tabs)/home -> user still null -> replace('/') ... an unbounded
  // render/navigate loop that presents as a blank, frozen app. Declarative
  // <Redirect> runs after commit and does not loop.
  if (loading) return null;
  if (!user) return <Redirect href="/" />;

  const isPremiumUser = user?.isPremium === true;
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => <CustomBottomTab {...props} />}
      >
        <Tabs.Screen name="home" options={{ headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="recent" options={{ headerShown: false }} />
        <Tabs.Screen name="stats" options={{ headerShown: false }} />
        <Tabs.Screen name="profile" options={{ headerShown: false }} />
        <Tabs.Screen
          name="(sub-tabs)/settings"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="(sub-tabs)/editProfile"
          options={{
            tabBarButton: () => null,
          }}
        />
      </Tabs>
      {!isPremiumUser &&
        <BannerAdComponent />
      }
    </>
  );
};

export default TabsLayout;
