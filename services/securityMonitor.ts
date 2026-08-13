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

export const summarizeRisk = (findings: SecurityFinding[]) => {
  if (findings.some((finding) => finding.severity === "high")) return "High risk";
  if (findings.some((finding) => finding.severity === "medium")) return "Needs review";
  if (findings.length) return "Low risk";
  return "No obvious risk found";
};
