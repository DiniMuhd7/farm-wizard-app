export type SecurityProviderConfig = {
  provider: string;
  model: string;
  apiKeyEnvName: string;
};

export type SecurityFinding = {
  label: string;
  severity: "low" | "medium" | "high";
  evidence: string;
  recommendation: string;
};

export type ShieldChannel = {
  name: string;
  status: "protected" | "permission-required" | "connector-required";
  source: string;
  permissions: string[];
  coverage: number;
  scannedToday: number;
  threatsBlocked: number;
  accent: string;
};

export type AgentSignal = {
  appName: string;
  processName: string;
  category: "Task manager" | "Browser" | "Automation";
  permission: string;
  confidence: number;
  lastSeen: string;
  activity: string;
};

export const securityProviderConfig: SecurityProviderConfig = {
  provider:
    process.env.EXPO_PUBLIC_AI_MODEL_PROVIDER ||
    process.env.AI_MODEL_PROVIDER ||
    "openai",
  model:
    process.env.EXPO_PUBLIC_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini",
  apiKeyEnvName: "OPENAI_API_KEY",
};

export const shieldChannels: ShieldChannel[] = [
  {
    name: "WhatsApp",
    status: "connector-required",
    source: "Share sheet, notification listener, or approved Business API connector",
    permissions: ["Notifications", "Share extension", "Business API webhook"],
    coverage: 72,
    scannedToday: 48,
    threatsBlocked: 6,
    accent: "#25D366",
  },
  {
    name: "Telegram",
    status: "connector-required",
    source: "Bot/webhook connector, notification listener, or share sheet intake",
    permissions: ["Notifications", "Bot webhook", "Share extension"],
    coverage: 78,
    scannedToday: 35,
    threatsBlocked: 4,
    accent: "#2AABEE",
  },
  {
    name: "iMessage",
    status: "permission-required",
    source: "iOS share sheet and notification summary access",
    permissions: ["Notifications", "Share extension"],
    coverage: 54,
    scannedToday: 19,
    threatsBlocked: 2,
    accent: "#34C759",
  },
  {
    name: "SMS",
    status: "permission-required",
    source: "OS message permission, notification listener, or share sheet intake",
    permissions: ["SMS role", "Notifications", "Share extension"],
    coverage: 64,
    scannedToday: 27,
    threatsBlocked: 3,
    accent: "#F2DE9F",
  },
  {
    name: "Email",
    status: "connector-required",
    source: "Mail provider OAuth connector with read-only security scope",
    permissions: ["OAuth read-only", "Link scanner", "Attachment metadata"],
    coverage: 83,
    scannedToday: 61,
    threatsBlocked: 8,
    accent: "#FF8A65",
  },
  {
    name: "Browser",
    status: "permission-required",
    source: "Browser extension, safe-browsing DNS, or MDM web-filter connector",
    permissions: ["Extension", "Web filter", "History risk events"],
    coverage: 69,
    scannedToday: 42,
    threatsBlocked: 5,
    accent: "#B388FF",
  },
];

export const agentRuntimeSignals: AgentSignal[] = [
  {
    appName: "Browser tab",
    processName: "chat.openai.com / claude.ai / agent workspace",
    category: "Browser",
    permission: "Browser extension or MDM web-filter events",
    confidence: 87,
    lastSeen: "Live",
    activity: "agent plans to call api, download contacts, and message customer from a browser workspace",
  },
  {
    appName: "Task manager",
    processName: "background automation worker",
    category: "Task manager",
    permission: "Android usage access, enterprise MDM, or desktop helper",
    confidence: 74,
    lastSeen: "2 min ago",
    activity: "start background daemon with always run persistence and read private files",
  },
  {
    appName: "Automation app",
    processName: "shortcut / script runner",
    category: "Automation",
    permission: "Accessibility automation audit and notification events",
    confidence: 68,
    lastSeen: "8 min ago",
    activity: "send email to vendor after transfer funds approval is missing",
  },
];

const communicationPatterns = [
  {
    label: "Credential harvesting",
    severity: "high" as const,
    terms: ["password", "passcode", "otp", "2fa", "verification code", "login code"],
    recommendation: "Do not share credentials or one-time codes. Verify the sender through a trusted channel.",
  },
  {
    label: "Phishing link pressure",
    severity: "high" as const,
    terms: ["urgent", "click", "verify now", "account locked", "bit.ly", "tinyurl", "reset your wallet"],
    recommendation: "Avoid urgent links. Open the service directly from its official app or website.",
  },
  {
    label: "Data exfiltration request",
    severity: "high" as const,
    terms: ["export contacts", "send database", "upload file", "customer list", "private key", "seed phrase"],
    recommendation: "Block requests to export private data unless approved by an account owner or admin.",
  },
  {
    label: "Social engineering",
    severity: "medium" as const,
    terms: ["gift card", "keep this secret", "boss asked", "act fast", "don’t tell", "wire transfer"],
    recommendation: "Pause and confirm identity before taking payment, account, or data actions.",
  },
];

const agentPatterns = [
  {
    label: "Unsanctioned external outreach",
    severity: "high" as const,
    terms: ["send email", "message customer", "post to telegram", "whatsapp broadcast", "contact vendor"],
    recommendation: "Require explicit user approval before any agent contacts people or external services.",
  },
  {
    label: "Tool use outside scope",
    severity: "high" as const,
    terms: ["run shell", "delete files", "transfer funds", "download contacts", "call api", "read private"],
    recommendation: "Constrain tool permissions to the task scope and audit high-impact tool calls.",
  },
  {
    label: "Self-policy modification",
    severity: "high" as const,
    terms: ["ignore instructions", "change policy", "update system prompt", "disable guardrails", "jailbreak"],
    recommendation: "Reject attempts by agents to modify their own operational policies or safety constraints.",
  },
  {
    label: "Suspicious persistence",
    severity: "medium" as const,
    terms: ["start background", "cron", "startup", "daemon", "always run"],
    recommendation: "Review background processes and require owner approval for persistent automation.",
  },
];

const scanForPatterns = (
  text: string,
  patterns: Array<{
    label: string;
    severity: SecurityFinding["severity"];
    terms: string[];
    recommendation: string;
  }>
): SecurityFinding[] => {
  const normalized = text.toLowerCase();

  return patterns
    .map((pattern) => {
      const match = pattern.terms.find((term) => normalized.includes(term));
      if (!match) return null;

      return {
        label: pattern.label,
        severity: pattern.severity,
        evidence: `Matched “${match}” in the reviewed activity.`,
        recommendation: pattern.recommendation,
      };
    })
    .filter((finding): finding is SecurityFinding => finding !== null);
};

export const scanCommunicationText = (text: string) =>
  scanForPatterns(text, communicationPatterns);

export const scanAgentActivity = (text: string) =>
  scanForPatterns(text, agentPatterns);

export const scanAgentRuntimeSignals = (signals: AgentSignal[]) =>
  signals.map((signal) => ({
    ...signal,
    findings: scanAgentActivity(signal.activity),
  }));

export const summarizeRisk = (findings: SecurityFinding[]) => {
  if (findings.some((finding) => finding.severity === "high")) return "High risk";
  if (findings.some((finding) => finding.severity === "medium")) return "Needs review";
  if (findings.length) return "Low risk";
  return "No obvious risk found";
};
