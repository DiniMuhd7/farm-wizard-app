import React, { useMemo, useState } from "react";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import BackgroundImage from "@/components/BackgroundImage";
import HeaderNavigation from "@/components/HeaderNavigation";
import { icons, images } from "@/constants";
import {
  agentRuntimeSignals,
  scanAgentRuntimeSignals,
  securityProviderConfig,
  summarizeRisk,
} from "@/services/securityMonitor";

const permissionLanes = [
  {
    title: "Task manager",
    access: "Usage access / MDM process inventory",
    description: "Reviews foreground services, background workers, and suspicious persistence signals.",
  },
  {
    title: "Browser processes",
    access: "Extension / web-filter connector",
    description: "Detects agent workspaces, tool portals, risky downloads, and external outreach attempts.",
  },
  {
    title: "Automation permissions",
    access: "Accessibility and notification audit",
    description: "Flags scripted actions that can message contacts, move files, or operate other apps.",
  },
];

const confidenceColor = (confidence: number) => {
  if (confidence >= 80) return "#EF4444";
  if (confidence >= 70) return "#F59E0B";
  return "#22C55E";
};

const AgentSupervisor = () => {
  const [hasScanned, setHasScanned] = useState(false);
  const scannedSignals = useMemo(() => scanAgentRuntimeSignals(agentRuntimeSignals), []);
  const findings = hasScanned ? scannedSignals.flatMap((signal) => signal.findings) : [];
  const risk = summarizeRisk(findings);
  const averageConfidence = Math.round(
    scannedSignals.reduce((sum, signal) => sum + signal.confidence, 0) / scannedSignals.length
  );

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
          AI Agent Guard
        </Text>
        <Text className="text-white/80 text-center mb-4">
          A professional device-level guard that checks task-manager, browser, and
          automation signals for AI agents operating outside approved boundaries.
        </Text>

        <View className="bg-black/35 rounded-3xl p-4 mb-4 border border-white/10">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              <Text className="text-[#F2DE9F] font-pbold">Agent radar</Text>
              <Text className="text-white/70 text-xs mt-1">
                Paste-based audits have been removed. Guard now models runtime scanning
                from permissioned task-manager, browser, and automation connectors.
              </Text>
            </View>
            <View className="w-24 h-24 rounded-full border-8 border-[#E0C145] items-center justify-center bg-white/10">
              <Text className="text-white text-2xl font-pbold">{averageConfidence}%</Text>
              <Text className="text-white/60 text-[10px]">confidence</Text>
            </View>
          </View>

          <View className="flex-row mt-4">
            <View className="bg-white/10 rounded-2xl p-3 flex-1 mr-2">
              <Text className="text-white text-xl font-pbold">{scannedSignals.length}</Text>
              <Text className="text-white/65 text-[11px]">Signals ready</Text>
            </View>
            <View className="bg-white/10 rounded-2xl p-3 flex-1 ml-2">
              <Text className="text-white text-xl font-pbold">{hasScanned ? findings.length : "—"}</Text>
              <Text className="text-white/65 text-[11px]">Findings</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setHasScanned(true)}
            className="bg-[#E0C145B8] rounded-full py-3 mt-4"
          >
            <Text className="text-white font-pbold text-center">Scan device agent activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            className="bg-white/10 rounded-full py-3 mt-2"
          >
            <Text className="text-white font-pbold text-center">Manage permissions</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <Text className="text-[#F2DE9F] font-pbold mb-2">Required permission lanes</Text>
          {permissionLanes.map((lane) => (
            <View key={lane.title} className="bg-white/10 rounded-xl p-3 mb-2">
              <View className="flex-row justify-between">
                <Text className="text-white font-pbold">{lane.title}</Text>
                <Text className="text-green-300 text-xs font-pbold">Ready</Text>
              </View>
              <Text className="text-[#F2DE9F] text-xs mt-1">{lane.access}</Text>
              <Text className="text-white/70 text-xs mt-1">{lane.description}</Text>
            </View>
          ))}
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
            <Text className="text-white font-pbold text-lg mb-2">Result: {risk}</Text>
            {scannedSignals.map((signal) => (
              <View key={`${signal.appName}-${signal.processName}`} className="bg-white/10 rounded-2xl p-3 mb-3">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-3">
                    <Text className="text-white font-pbold">{signal.appName}</Text>
                    <Text className="text-white/65 text-xs mt-1">{signal.processName}</Text>
                    <Text className="text-[#F2DE9F] text-xs mt-1">{signal.permission}</Text>
                  </View>
                  <Text className="text-white/70 text-xs">{signal.lastSeen}</Text>
                </View>
                <View className="mt-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-white/70 text-xs">AI-agent likelihood</Text>
                    <Text className="text-white text-xs font-pbold">{signal.confidence}%</Text>
                  </View>
                  <View className="h-2 bg-black/30 rounded-full overflow-hidden">
                    <View
                      className="h-2 rounded-full"
                      style={{
                        width: `${signal.confidence}%`,
                        backgroundColor: confidenceColor(signal.confidence),
                      }}
                    />
                  </View>
                </View>
                {signal.findings.map((finding) => (
                  <View key={finding.label} className="mt-3 bg-black/20 rounded-xl p-2">
                    <Text className="text-white text-xs font-pbold">
                      {finding.severity.toUpperCase()} · {finding.label}
                    </Text>
                    <Text className="text-white/70 text-xs mt-1">{finding.evidence}</Text>
                    <Text className="text-yellow-100 text-xs mt-1">{finding.recommendation}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AgentSupervisor;
