import { Tabs, useRouter } from "expo-router";
// import { icons } from "../../constants";
import CustomBottomTab from "@/components/CustomBottomTab";
import BannerAdComponent from "../../utils/BannerAdComponent";
import { useLoginContext } from "../../context/LoginProvider";

const TabsLayout = () => {
  const router = useRouter();
  const { user } = useLoginContext();
  if (!user) {
    router.replace('/');
  }
  const isPremiumUser = user?.isPremium === true;
  return (
    // <Tabs
    //   screenOptions={{
    //     tabBarShowLabel: false,
    //     tabBarStyle: {
    //       position: "absolute",
    //       bottom: 0,
    //       backgroundColor: "transparent",
    //       elevation: 0,
    //       borderTopWidth: 0,
    //       height: 0, // hide actual tab bar visuals
    //     },
    //   }}
    // >
    //   {/* Center Floating FAB */}
    //   <Tabs.Screen
    //     name="home"
    //     options={{
    //       headerShown: false,
    //       tabBarButton: (props) => (
    //         <FloatingTabButton
    //           icon={icons.hat}
    //           onPress={() => router.push("/home")}
    //           style={{
    //             position: "absolute",
    //             bottom: 40,
    //             left: "90%", // Centered
    //           }}
    //         />
    //       ),
    //     }}
    //   />

    //   {/* Right Floating Button */}
    //   <Tabs.Screen
    //     name="profile"
    //     options={{
    //       headerShown: false,
    //       tabBarButton: (props) => (
    //         <FloatingTabButton
    //           icon={icons.stats}
    //           //onPress={() => router.push("/profile")}
    //           style={{
    //             position: "absolute",
    //             bottom: 20, // a bit lower
    //             right: 25, // right side
    //           }}
    //         />
    //       ),
    //     }}
    //   />
    // </Tabs>
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => <CustomBottomTab {...props} />}
      >
        <Tabs.Screen
          name="farmPerformance"
          options={{
            headerShown: false,
          }}
        />
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
        <Tabs.Screen
          name="(sub-tabs)/claimScreen"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="(sub-tabs)/requestReceived"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="(sub-tabs)/withdrawalRequest"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="(sub-tabs)/userWithdrawals"
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="(sub-tabs)/withdrawalCompleted"
          options={{
            tabBarButton: () => null,
          }}
        />


      </Tabs>
      {/* <Tabs
        screenOptions={{
          tabBarShowLabel: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "transparent",
            elevation: 0,
            height: 0, // hide native tab bar
            borderTopWidth: 0,
          },
        }}
      >
        {/* Center Floating Home FAB */}
      {/* <Tabs.Screen
          name="home"
          options={{
            headerShown: false,
            tabBarButton: () => (
              <FloatingTabButton
                icon={icons.home}
                onPress={() => router.push("/(tabs)/home")}
                style={{ position: "absolute", bottom: 5, left: 180 }}
              />
            ),
          }}
        /> */}

      {/* Right-side Floating FAB */}
      {/* <Tabs.Screen
          name="profile"
          options={{
            headerShown: false,
            tabBarButton: () => (
              <FloatingTabButton
                icon={icons.stats}
                onPress={() => router.push("/(screens)/profile")}
                style={{ position: "absolute", bottom: 25, right: 170 }}
              />
            ),
          }}
        /> */}

      {/* Left-side Floating FAB (New!) */}
      {/* <Tabs.Screen
          name="claimScreen"
          options={{
            headerShown: false,
            tabBarButton: () => (
              <FloatingTabButton
                icon={icons.stats}
                onPress={() => router.push("/settings")}
                style={{ position: "absolute", bottom: 30, left: 55 }}
              />
            ),
          }}
        />
      </Tabs>  */}
      {!isPremiumUser &&
        <BannerAdComponent />
      }
    </>

  );
};

export default TabsLayout;
/* 
import { Image, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { icons } from "../../constants";

const TabIcon = ({ icon, color, focused }) => {
  return (
    <View className="flex items-center justify-center bg-[#FFEB90] w-12 h-12 rounded-full shadow-md">
      <Image
        source={icon}
        resizeMode="contain"
        className="w-6 h-6"
        tintColor="#fff"
      // tintColor={color}
      />
      {/* <Text
        className={`${focused ? "font-psemibold" : "font-pregular"} text-xs w-full text-center`}
        style={{ color: color }}
      >
        {name}
      </Text> 
    </View>
  );
};

const TabsLayout = () => {
  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#FFD84F", // warm yellow
          tabBarInactiveTintColor: "#FFEFB5",
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: "transparent", // Transparent to blend with bg
            borderTopWidth: 0,
            height: 60,
            // height: 50,
            position: "absolute",
            // bottom: 20,
            left: 10,
            right: 10,
            marginHorizontal: -90,
            borderRadius: 30,
            // shadowColor: "#000",
            // shadowOffset: { width: 0, height: 5 },
            // shadowOpacity: 0.15,
            // shadowRadius: 6.27,
            // elevation: 10,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            headerShown: false,
            height: 70,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={icons.home} color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </>
  );
};

export default TabsLayout;
*/
