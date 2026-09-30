import { ScrollView, Text, View } from "react-native";

// Local Terms & Conditions content — shown instead of the remote
// T&C.html webview so it works offline and loads instantly.

const SECTIONS = [
  {
    title: null,
    paragraphs: [
      "Last Updated May 27, 2025",
      "Welcome to Farm Wizard, a mobile app developed by Wizard Apps. By downloading, installing, or using the Farm Wizard app (“the App”), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the App.",
    ],
  },
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      "By accessing or using the App, you confirm that you are at least 18 years old (or have the permission of a parent or guardian if under 18) and that you understand and accept these Terms and our Privacy Policy.",
    ],
  },
  {
    title: "2. Game Overview",
    paragraphs: ["Farm Wizard is a skill-based mobile farming game that allows users to:"],
    bullets: [
      "Plant and grow virtual crops",
      "Earn coins or tokens for in-game actions",
      "Redeem rewards based on gameplay performance and milestones",
    ],
    footer:
      "Please note: Rewards are subject to verification, eligibility, and our internal review process.",
  },
  {
    title: "3. Eligibility",
    paragraphs: [
      "Use of the App is void where prohibited. To be eligible to redeem monetary or non-monetary rewards:",
    ],
    bullets: [
      "You must provide accurate and verifiable user information.",
      "You must not engage in fraudulent or exploitative behavior.",
      "You must reside in a country where our services are legally permitted.",
    ],
  },
  {
    title: "4. Coins, Rewards & Payouts",
    bullets: [
      "Coins earned through gameplay may be exchanged for real-world rewards only as specified within the App.",
      "Payout thresholds must be met before redemption is permitted.",
      "All redemptions are subject to verification to prevent fraud or system abuse.",
      "Wizard Apps reserves the right to modify, suspend, or terminate the rewards program at any time without prior notice.",
    ],
  },
  {
    title: "5. Fair Use Policy",
    bullets: [
      "Users must play fairly. Use of bots, automation, or exploitation of game bugs is strictly prohibited.",
      "Accounts found in violation of this policy may be suspended or permanently banned.",
      "Any attempt to manipulate gameplay mechanics for unfair gain will result in forfeiture of rewards.",
    ],
  },
  {
    title: "6. Data Collection & Privacy",
    paragraphs: [
      "By using the App, you consent to the collection and use of personal and gameplay data as outlined in our Privacy Policy. This includes:",
    ],
    bullets: [
      "Device information",
      "Gameplay behavior",
      "Payout and identity verification data",
    ],
    footer:
      "We do not sell your data to third parties. All information is stored securely and handled in accordance with the Nigeria Data Protection Act (NDPA) 2023 and applicable global standards.",
  },
  {
    title: "7. User Accounts",
    bullets: [
      "You are responsible for keeping your account credentials secure.",
      "You must not share, transfer, or sell your account to another individual.",
      "Multiple accounts per user are not permitted and will be flagged as abuse.",
    ],
  },
  {
    title: "8. Intellectual Property",
    paragraphs: [
      "All content in the App, including graphics, game logic, characters, and branding, is the intellectual property of Wizard Apps. You may not copy, reproduce, or redistribute any part of the App without written permission.",
    ],
  },
  {
    title: "9. Termination",
    paragraphs: [
      "Wizard Apps reserves the right to terminate or suspend access to the App and its reward features at any time for:",
    ],
    bullets: [
      "Breach of terms",
      "Fraudulent activity",
      "Abuse of the system",
      "Legal or technical reasons",
    ],
  },
  {
    title: "10. Disclaimer of Warranties",
    paragraphs: [
      "Farm Wizard is provided “as is” and “as available.” Wizard Apps makes no warranties regarding:",
    ],
    bullets: [
      "Continuous availability",
      "Error-free functionality",
      "Guaranteed earnings",
    ],
    footer:
      "Wizard Apps shall not be liable for losses arising from reliance on the App, delays in payment, or technical failures.",
  },
  {
    title: "11. Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, Wizard Apps shall not be held liable for any indirect, incidental, or consequential damages arising from the use or inability to use the App or from any dispute related to rewards or payouts.",
    ],
  },
  {
    title: "12. Modifications",
    paragraphs: [
      "Wizard Apps may update these Terms at any time. Changes will be communicated via the App or email. Continued use of the App constitutes acceptance of the revised terms.",
    ],
  },
  {
    title: "13. Governing Law",
    paragraphs: [
      "These Terms and Conditions are governed by the laws of the Federal Republic of Nigeria. Any disputes arising shall be resolved in accordance with applicable Nigerian legal procedures.",
    ],
  },
  {
    title: "14. Contact Us",
    paragraphs: [
      "If you have questions or concerns about these Terms, you may contact us at:",
      "dinisoft.dev@gmail.com",
    ],
  },
  {
    title: null,
    paragraphs: [
      "By clicking “Agree” or continuing to use the App, you confirm that you have read, understood, and accepted these Terms and Conditions.",
    ],
  },
];

const TermsContent = () => (
  <ScrollView className="flex-1 bg-[#F8F7FC]" showsVerticalScrollIndicator>
    <View className="p-5">
      <Text className="text-[10px] text-[#827AAE] font-psemibold tracking-[1.5px] mb-2">
        9TEL · YOUR AGREEMENT
      </Text>
      <Text className="text-xl font-pbold text-[#211B59] mb-2">Terms and Conditions</Text>
      {SECTIONS.map((section, idx) => (
        <View key={section.title || idx} className="mb-4">
          {section.title && (
            <Text className="text-[14px] leading-5 font-psemibold text-[#30245E] mb-1.5">
              {section.title}
            </Text>
          )}
          {section.paragraphs?.map((p) => (
            <Text key={p} className="text-xs text-[#57546A] leading-[19px] mb-1.5">
              {p}
            </Text>
          ))}
          {section.bullets?.map((b) => (
            <View key={b} className="flex-row mb-2 pl-1">
              <Text className="text-sm text-[#8272D1] mr-2">{"•"}</Text>
              <Text className="text-xs text-[#57546A] leading-[19px] flex-1">{b}</Text>
            </View>
          ))}
          {section.footer && (
            <Text className="text-xs text-[#57546A] leading-[19px] mt-1">{section.footer}</Text>
          )}
        </View>
      ))}
    </View>
  </ScrollView>
);

export default TermsContent;
