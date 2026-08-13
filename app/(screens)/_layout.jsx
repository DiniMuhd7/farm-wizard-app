import { Stack } from "expo-router";

export default function ScreenLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="selectSeed" />
      <Stack.Screen name="inventory" />
      <Stack.Screen name="plantScreen" />
      <Stack.Screen name="gameOver" />
      <Stack.Screen name="harvest" />
      <Stack.Screen name="sessionStarted" />
      <Stack.Screen name="questsAchievements" />
      <Stack.Screen name="cosmetics" />
      <Stack.Screen name="referral" />
      <Stack.Screen name="dailyChallenge" />
      <Stack.Screen name="farm" />
      <Stack.Screen name="shorts" />
      <Stack.Screen name="communicationMonitor" />
      <Stack.Screen name="agentSupervisor" />
      <Stack.Screen name="transactionSuccess" />
    </Stack>
  );
}
