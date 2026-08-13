import React, { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import BackgroundImage from "@/components/BackgroundImage";
import HeaderNavigation from "@/components/HeaderNavigation";
import { icons, images } from "@/constants";
import {
  scanAgentActivity,
  securityProviderConfig,
  summarizeRisk,
  SecurityFinding,
} from "@/services/securityMonitor";

const AgentSupervisor = () => {
  const [activityLog, setActivityLog] = useState("");
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  const onAudit = () => {
    setFindings(scanAgentActivity(activityLog));
    setHasScanned(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-green-200">
      <BackgroundImage
        source={images.background}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />
      <HeaderNavigation
        onLeftPress={() => router.back()}
        onRightPress={() => null}
        leftIcon={icons.back}
        rightIcon={icons.settings}
        showLeftButton={true}
        showRightButton={false}
      />

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: 28 }}>
        <Text className="text-white text-2xl font-primary text-center mb-2">
          AI Agent Supervisor
        </Text>
        <Text className="text-white/80 text-center mb-4">
          Audit active agent activity for unsanctioned outreach, out-of-scope tool use,
          and attempts to rewrite operating policies.
        </Text>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <Text className="text-[#F2DE9F] font-pbold mb-2">Supervision checks</Text>
          {[
            "External outreach requires explicit user approval.",
            "Tool calls must match the approved task scope.",
            "Agents may not modify their own policies, prompts, or guardrails.",
          ].map((item) => (
            <Text key={item} className="text-white/85 text-sm mb-1">• {item}</Text>
          ))}
        </View>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <Text className="text-white font-pbold mb-2">Paste agent process log</Text>
          <TextInput
            value={activityLog}
            onChangeText={setActivityLog}
            multiline
            textAlignVertical="top"
            placeholder="Example: agent plans to send email, call API, change policy, then run shell..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            className="min-h-[170px] rounded-xl bg-white/10 text-white p-3"
          />
          <TouchableOpacity
            onPress={onAudit}
            className="bg-[#E0C145B8] rounded-full py-3 mt-4"
          >
            <Text className="text-white font-pbold text-center">Audit agent activity</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <Text className="text-[#F2DE9F] font-pbold mb-1">Default model provider</Text>
          <Text className="text-white/80 text-sm">
            {securityProviderConfig.provider} is selected for these security features using {securityProviderConfig.model}.
          </Text>
          <Text className="text-white/60 text-xs mt-1">
            Keep the OpenAI key server-side as {securityProviderConfig.apiKeyEnvName}; do not ship it in the Expo client.
          </Text>
        </View>

        {hasScanned && (
          <View className="bg-black/30 rounded-2xl p-4">
            <Text className="text-white font-pbold text-lg mb-2">
              Result: {summarizeRisk(findings)}
            </Text>
            {findings.length === 0 ? (
              <Text className="text-white/75 text-sm">
                No obvious unsafe agent pattern was found by the local pre-screen. Continue enforcing allowlists and explicit approvals.
              </Text>
            ) : (
              findings.map((finding) => (
                <View key={finding.label} className="bg-white/10 rounded-xl p-3 mb-2">
                  <Text className="text-white font-pbold">
                    {finding.severity.toUpperCase()} · {finding.label}
                  </Text>
                  <Text className="text-white/75 text-xs mt-1">{finding.evidence}</Text>
                  <Text className="text-yellow-100 text-xs mt-1">{finding.recommendation}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AgentSupervisor;
