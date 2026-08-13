import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
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
  summarizeRisk,
  SecurityFinding,
} from "@/services/securityMonitor";

type Channel = {
  name: string;
  status: "active" | "permission-required" | "connector-required";
  source: string;
};

type ScanEvent = {
  id: string;
  channel: string;
  preview: string;
  findings: SecurityFinding[];
  scannedAt: string;
};

const CHANNELS: Channel[] = [
  {
    name: "WhatsApp",
    status: "connector-required",
    source: "Share-sheet or approved Business API connector",
  },
  {
    name: "Telegram",
    status: "connector-required",
    source: "Bot/webhook connector or share-sheet intake",
  },
  {
    name: "iMessage",
    status: "permission-required",
    source: "iOS share-sheet intake only",
  },
  {
    name: "SMS",
    status: "permission-required",
    source: "OS permission / share-sheet intake",
  },
  {
    name: "Email",
    status: "connector-required",
    source: "Mail provider OAuth connector",
  },
  {
    name: "Clipboard",
    status: "active",
    source: "Auto-scans copied text when this screen is active",
  },
];

const statusStyles = {
  active: "bg-green-600",
  "permission-required": "bg-yellow-600",
  "connector-required": "bg-white/15",
};

const statusLabels = {
  active: "Active",
  "permission-required": "Needs permission",
  "connector-required": "Needs connector",
};

const makePreview = (text: string) =>
  text.replace(/\s+/g, " ").trim().slice(0, 140) || "No message text detected";

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
          Automatically monitors approved communication-channel inputs for phishing,
          credential harvesting, data exfiltration, and social-engineering patterns.
        </Text>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[#F2DE9F] font-pbold">Live monitoring</Text>
            <TouchableOpacity
              onPress={() => setMonitoringEnabled((enabled) => !enabled)}
              className={`px-3 py-1.5 rounded-full ${
                monitoringEnabled ? "bg-green-600" : "bg-white/15"
              }`}
            >
              <Text className="text-white text-xs font-pbold">
                {monitoringEnabled ? "On" : "Paused"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text className="text-white/75 text-sm">
            This app cannot silently read encrypted WhatsApp, Telegram, or iMessage
            conversations. It can auto-scan text delivered through approved connectors,
            share-sheet intake, or copied text while this screen is active.
          </Text>
        </View>

        <View className="bg-black/30 rounded-2xl p-4 mb-4">
          <Text className="text-[#F2DE9F] font-pbold mb-2">Channel access</Text>
          {CHANNELS.map((channel) => (
            <View key={channel.name} className="bg-white/10 rounded-xl p-3 mb-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-white font-pbold">{channel.name}</Text>
                <View className={`px-2 py-1 rounded-full ${statusStyles[channel.status]}`}>
                  <Text className="text-white text-[10px] font-pbold">
                    {statusLabels[channel.status]}
                  </Text>
                </View>
              </View>
              <Text className="text-white/70 text-xs mt-1">{channel.source}</Text>
            </View>
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
          <Text className="text-white font-pbold text-lg mb-2">Current risk: {risk}</Text>
          {scanEvents.length === 0 ? (
            <Text className="text-white/75 text-sm">
              No inbound communication text has been received yet. Copy or share a message
              into Farm Wizard to scan it automatically.
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
