import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import BackgroundImage from "@/components/BackgroundImage";
import HeaderNavigation from "@/components/HeaderNavigation";
import { icons, images } from "@/constants";
import {
  scanCommunicationText,
  securityProviderConfig,
  shieldChannels,
  summarizeRisk,
  SecurityFinding,
  ShieldChannel,
} from "@/services/securityMonitor";

type ScanEvent = {
  id: string;
  channel: string;
  preview: string;
  findings: SecurityFinding[];
  scannedAt: string;
};

const statusStyles = {
  protected: "bg-green-600",
  "permission-required": "bg-yellow-600",
  "connector-required": "bg-white/15",
};

const statusLabels = {
  protected: "Protected",
  "permission-required": "Needs permission",
  "connector-required": "Needs connector",
};

const makePreview = (text: string) =>
  text.replace(/\s+/g, " ").trim().slice(0, 140) || "No message text detected";

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <View className="bg-white/10 rounded-2xl p-3 flex-1 mx-1">
    <Text className="text-white text-xl font-pbold text-center">{value}</Text>
    <Text className="text-white/65 text-[11px] text-center mt-1">{label}</Text>
  </View>
);

const ChannelCard = ({ channel }: { channel: ShieldChannel }) => (
  <View className="bg-white/10 rounded-2xl p-3 mb-3">
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <View
          className="w-3 h-12 rounded-full mr-3"
          style={{ backgroundColor: channel.accent }}
        />
        <View className="flex-1">
          <Text className="text-white font-pbold">{channel.name}</Text>
          <Text className="text-white/70 text-xs mt-1">{channel.source}</Text>
        </View>
      </View>
      <View className={`px-2 py-1 rounded-full ${statusStyles[channel.status]}`}>
        <Text className="text-white text-[10px] font-pbold">
          {statusLabels[channel.status]}
        </Text>
      </View>
    </View>

    <View className="mt-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-white/70 text-xs">Shield coverage</Text>
        <Text className="text-white text-xs font-pbold">{channel.coverage}%</Text>
      </View>
      <View className="h-2 bg-black/30 rounded-full overflow-hidden">
        <View
          className="h-2 rounded-full"
          style={{ width: `${channel.coverage}%`, backgroundColor: channel.accent }}
        />
      </View>
    </View>

    <View className="flex-row mt-3">
      <StatPill label="Scanned today" value={`${channel.scannedToday}`} />
      <StatPill label="Blocked" value={`${channel.threatsBlocked}`} />
    </View>

    <Text className="text-[#F2DE9F] text-xs mt-3">
      Permissions: {channel.permissions.join(" · ")}
    </Text>
  </View>
);

const CommunicationMonitor = () => {
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [lastClipboardText, setLastClipboardText] = useState("");
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);

  const scanInboundText = useCallback((channel: string, text: string) => {
    const normalized = text.trim();
    if (!normalized) return;

    setScanEvents((events) => {
      if (events[0]?.preview === makePreview(normalized)) return events;

      return [
        {
          id: `${Date.now()}-${channel}`,
          channel,
          preview: makePreview(normalized),
          findings: scanCommunicationText(normalized),
          scannedAt: new Date().toLocaleTimeString(),
        },
        ...events,
      ].slice(0, 10);
    });
  }, []);

  const scanClipboard = useCallback(async () => {
    if (!monitoringEnabled) return;

    try {
      const text = await Clipboard.getString();
      if (text && text !== lastClipboardText) {
        setLastClipboardText(text);
        scanInboundText("Clipboard", text);
      }
    } catch (e) {
      // Clipboard access can be unavailable on some platforms; ignore quietly.
    }
  }, [lastClipboardText, monitoringEnabled, scanInboundText]);

  useFocusEffect(
    useCallback(() => {
      scanClipboard();
    }, [scanClipboard])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") scanClipboard();
    });

    const interval = setInterval(scanClipboard, 5000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [scanClipboard]);

  const latestFindings = scanEvents.flatMap((event) => event.findings);
  const risk = summarizeRisk(latestFindings);
  const totals = useMemo(
    () => ({
      protectedChannels: shieldChannels.filter((channel) => channel.status === "protected").length,
      scans: shieldChannels.reduce((sum, channel) => sum + channel.scannedToday, 0) + scanEvents.length,
      blocked: shieldChannels.reduce((sum, channel) => sum + channel.threatsBlocked, 0),
      coverage: Math.round(
        shieldChannels.reduce((sum, channel) => sum + channel.coverage, 0) / shieldChannels.length
      ),
    }),
    [scanEvents.length]
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
          Communication Shield
        </Text>
        <Text className="text-white/80 text-center mb-4">
          A playful security cockpit for messages, email, browser links, and approved
          app connectors with clear permission steps and live risk scoring.
        </Text>

        <View className="bg-black/35 rounded-3xl p-4 mb-4 border border-white/10">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-[#F2DE9F] font-pbold">Shield Command Center</Text>
              <Text className="text-white/60 text-xs">Current risk: {risk}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setMonitoringEnabled((enabled) => !enabled)}
              className={`px-4 py-2 rounded-full ${
                monitoringEnabled ? "bg-green-600" : "bg-white/15"
              }`}
            >
              <Text className="text-white text-xs font-pbold">
                {monitoringEnabled ? "Live" : "Paused"}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row -mx-1">
            <StatPill label="Coverage" value={`${totals.coverage}%`} />
            <StatPill label="Scans" value={`${totals.scans}`} />
            <StatPill label="Blocked" value={`${totals.blocked}`} />
          </View>
          <Text className="text-white/70 text-xs mt-3">
            Full access is enabled through user-granted OS permissions, OAuth connectors,
            browser extensions, notification listeners, share-sheet intake, or managed-device
            connectors. Encrypted apps are scanned only through approved access paths.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            className="bg-[#E0C145B8] rounded-full py-3 mt-4"
          >
            <Text className="text-white font-pbold text-center">Open device permissions</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <Text className="text-[#F2DE9F] font-pbold mb-2">Channel shields</Text>
          {shieldChannels.map((channel) => (
            <ChannelCard key={channel.name} channel={channel} />
          ))}
        </View>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <Text className="text-[#F2DE9F] font-pbold mb-1">AI provider</Text>
          <Text className="text-white/80 text-sm">
            Default provider: {securityProviderConfig.provider} · Model: {securityProviderConfig.model}
          </Text>
          <Text className="text-white/60 text-xs mt-1">
            Server deployments should provide {securityProviderConfig.apiKeyEnvName} in Render environment variables.
          </Text>
        </View>

        <View className="bg-black/30 rounded-2xl p-4">
          <Text className="text-white font-pbold text-lg mb-2">Recent shield events</Text>
          {scanEvents.length === 0 ? (
            <Text className="text-white/75 text-sm">
              No inbound text has been received yet. Grant permissions, connect channels,
              or share a suspicious message into Farm Wizard to scan it automatically.
            </Text>
          ) : (
            scanEvents.map((event) => (
              <View key={event.id} className="bg-white/10 rounded-xl p-3 mb-2">
                <Text className="text-white font-pbold">
                  {event.channel} · {event.scannedAt}
                </Text>
                <Text className="text-white/70 text-xs mt-1">{event.preview}</Text>
                {event.findings.length === 0 ? (
                  <Text className="text-green-300 text-xs mt-2">No obvious risky pattern found.</Text>
                ) : (
                  event.findings.map((finding) => (
                    <View key={finding.label} className="mt-2">
                      <Text className="text-white text-xs font-pbold">
                        {finding.severity.toUpperCase()} · {finding.label}
                      </Text>
                      <Text className="text-yellow-100 text-xs">{finding.recommendation}</Text>
                    </View>
                  ))
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CommunicationMonitor;
