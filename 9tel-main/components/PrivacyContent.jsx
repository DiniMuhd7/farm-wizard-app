import { themeColor, useThemeVersion } from "@/theme";
import { ScrollView, Text, View } from "react-native";

// Local Privacy Notice content — shown instead of the remote Google
// Drive PDF webview so it works offline and loads instantly.

const SECTIONS = [
  {
    title: null,
    paragraphs: [
      "Last Updated March 22, 2025",
      "Thank you for choosing to be part of our community at Wizard Apps (“Company”, “we”, “us”, or “our”). We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice or our practices regarding your personal information, please contact us at dinisoft.dev@gmail.com.",
      "When you use our mobile application (the “App”) and more generally, any of our services (the “Services”, which include the App), we appreciate that you are trusting us with your personal information. We take your privacy very seriously. In this privacy notice, we seek to explain in the clearest way possible what information we collect, how we use it, and what rights you have in relation to it. If there are any terms in this privacy notice that you do not agree with, please discontinue use of our Services immediately.",
      "This privacy notice applies to all personal information collected through our Services (including the App), as well as any related services, sales, marketing, or events.",
    ],
  },
  {
    title: "Legal Basis & Compliance Statement",
    paragraphs: [
      "This privacy notice is designed to comply with the Nigeria Data Protection Act (NDPA) 2023. As a Nigeria-based company, we recognize that users of our App and Services may be located in different jurisdictions. While Nigerian law serves as the primary governing law, we also consider applicable international data privacy regulations — including the General Data Protection Regulation (GDPR) for European users and the California Consumer Privacy Act (CCPA) for U.S. users — where relevant.",
      "We process your data based on one or more of the following legal bases:",
    ],
    bullets: [
      "Consent – When you provide explicit consent for certain data uses.",
      "Contractual Necessity – When processing is required to provide you with our services.",
      "Legal Obligation – When we must comply with legal or regulatory requirements.",
      "Legitimate Interest – When processing is necessary for our business operations, provided it does not override your rights.",
    ],
  },
  {
    title: "1. What Information Do We Collect?",
    paragraphs: [
      "We automatically collect certain information when you visit, use, or navigate the App. This information does not reveal your specific identity but may include:",
    ],
    bullets: [
      "Log and usage data: IP address, device information, browser type and settings, activity within the App (timestamps, pages viewed, feature usage), and device event information such as crash reports.",
      "Device data: device and application identification numbers, hardware model, operating system, internet service provider and/or mobile carrier.",
      "Location data: precise or imprecise location depending on your device settings. You can opt out of location tracking at any time via your device settings.",
      "Mobile device access: we may request access to features such as camera, contacts, storage, and others. You can modify or revoke access in your device settings.",
      "Push notifications: we may request permission to send you notifications about your account or App features. You can disable these in your device settings.",
    ],
    footer:
      "We also collect information through cookies and similar tracking technologies. Per NDPA 2023, you can withdraw consent at any time via your device settings.",
  },
  {
    title: "2. How Do We Use Your Information?",
    paragraphs: [
      "We process your information based on legitimate business interests, contractual obligations, legal compliance, and/or your consent. We use the information we collect to:",
    ],
    bullets: [
      "Send administrative information such as product updates and policy changes.",
      "Ensure the security of our Services, including fraud monitoring and prevention of unauthorized access.",
      "Enforce our terms, conditions, and policies, and comply with legal requests.",
      "Fulfill and manage your orders, payments, returns, and exchanges.",
      "Administer promotions and competitions.",
      "Deliver and improve our Services and respond to support inquiries.",
      "Send marketing and promotional communications (you can opt out at any time).",
      "Deliver targeted advertising and measure its effectiveness.",
      "Analyze usage trends for business analytics and service improvement, stored in an aggregated, anonymized format.",
    ],
  },
  {
    title: "3. Will Your Information Be Shared With Anyone?",
    paragraphs: [
      "We only share your information with your consent, to comply with laws, to provide services, to protect your rights, or to fulfill business obligations. Situations where we may share your information include:",
    ],
    bullets: [
      "Business transfers: if we undergo a merger, acquisition, asset sale, or financing, your data may be transferred as part of that transaction.",
      "Offer wall (third-party advertising and rewards): if you interact with an offer wall, certain data (e.g. user ID, geographic location, or demographic details) may be shared with the third-party provider to prevent fraud and track rewards.",
      "Third-party disclaimer: when you click an offer wall, you leave our App and enter a third-party website whose privacy policies and terms govern your use of their platform.",
    ],
  },
  {
    title: "4. Do We Use Cookies and Other Tracking Technologies?",
    paragraphs: [
      "Yes. We use cookies, web beacons, pixels, and similar technologies to enhance user experience, monitor analytics and performance, prevent fraud, and deliver relevant advertising.",
    ],
  },
  {
    title: "5. Is Your Information Transferred Internationally?",
    paragraphs: [
      "Our servers are located in Nigeria, and we comply with Nigerian data protection laws, including NDPA 2023. If you access our App from outside Nigeria, your information may be transferred to, stored, and processed in Nigeria and in other countries where we or our third-party service providers operate.",
      "For users in the European Economic Area (EEA), the United Kingdom, or other regions with strict data protection laws, we take necessary measures to ensure adequate protection of your data, including standard contractual clauses (SCCs) or other lawful mechanisms where required.",
    ],
  },
  {
    title: "6. What Is Our Stance on Third-Party Websites?",
    paragraphs: [
      "Our App may contain advertisements, links, or integrations with third-party websites, online services, or mobile applications. These third parties operate independently and have their own privacy policies. We do not control, endorse, or assume responsibility for their content, security, or privacy practices. We recommend reviewing their privacy policies before providing any personal data.",
    ],
  },
  {
    title: "7. How Long Do We Keep Your Information?",
    bullets: [
      "General user data: retained for up to two (2) years after your last interaction with the App, unless otherwise required by law.",
      "Legal and contractual data: retained as necessary to comply with legal obligations under NDPA 2023, GDPR, or other applicable regulations.",
      "Backup and security data: securely held and isolated from active processing until deletion is feasible.",
    ],
    footer:
      "When personal data is no longer required, we will delete it securely or anonymize it so it can no longer be linked to you.",
  },
  {
    title: "8. How Do We Keep Your Information Safe?",
    paragraphs: [
      "We have implemented technical, organizational, and administrative security measures to protect your personal data, including encryption, access controls, regular security audits, and compliance with NDPA 2023, GDPR, and other applicable frameworks.",
      "Despite these precautions, no system is completely secure. If you suspect a security breach, contact us immediately at dinisoft.dev@gmail.com.",
    ],
  },
  {
    title: "9. What Are Your Privacy Rights?",
    paragraphs: [
      "Depending on your location, you may have rights under laws like NDPA 2023, GDPR, and other regulations, including:",
    ],
    bullets: [
      "Right to access a copy of the personal data we hold about you.",
      "Right to correction of inaccurate or incomplete information.",
      "Right to deletion of your personal data, subject to legal limitations.",
      "Right to restrict processing and right to data portability.",
      "Right to object to certain types of processing, including direct marketing.",
      "Right to withdraw consent at any time.",
    ],
    footer:
      "To exercise any of these rights, contact us at dinisoft.dev@gmail.com. EEA and Switzerland residents may also file a complaint with their local data protection authority.",
  },
  {
    title: "10. Controls for Do-Not-Track (DNT) Features",
    paragraphs: [
      "Some browsers and mobile systems have a Do-Not-Track setting. However, no standardized DNT system is currently in place, so we do not respond to DNT signals at this time. If a global standard is adopted in the future, we will update this notice accordingly.",
    ],
  },
  {
    title: "11. Do California Residents Have Specific Privacy Rights?",
    paragraphs: [
      "Yes. Under California Civil Code Section 1798.83 (“Shine The Light” law), California residents can request details about personal data shared with third parties for direct marketing in the past 12 months. If you are under 18 and have a registered account, you may request removal of personal data you publicly posted on our App. To make any California-related requests, contact us at dinisoft.dev@gmail.com with the email associated with your account and a statement confirming you are a California resident.",
    ],
  },
  {
    title: "12. Do We Make Updates to This Notice?",
    paragraphs: [
      "Yes, we update this notice as necessary to stay compliant with relevant laws. Updates will be reflected by an updated “Last Revised” date. If we make material changes, we will notify you via a prominent notice on our platform or direct communication.",
    ],
  },
  {
    title: "13. How Can You Contact Us About This Notice?",
    paragraphs: [
      "Email: dinisoft.dev@gmail.com",
      "Postal Address: Wizard Apps, Block AB9, Damax Plaza, Umaru Musa Yar'adua Way, Millenium City, Kaduna State, Nigeria. Postcode: 800102.",
    ],
  },
  {
    title: "14. How Can You Review, Update, or Delete Your Personal Data?",
    paragraphs: [
      "Depending on the applicable laws in your country, you may have the right to access, correct, or request deletion of the personal data we have collected about you. To submit a request, contact us at dinisoft.dev@gmail.com. We will respond within 30 days, in accordance with relevant laws.",
    ],
  },
];

const PrivacyContent = () => {
  useThemeVersion();
  const ink = { color: themeColor("#000000") };
  const soft = { color: themeColor("#333333") };
  return (
  <ScrollView className="flex-1 rounded-xl" style={{ backgroundColor: themeColor("#FFFFFF", "bg") }} showsVerticalScrollIndicator>
    <View className="p-4">
      <Text style={ink} className="text-xl font-pbold mb-2">Privacy Notice</Text>
      {SECTIONS.map((section, idx) => (
        <View key={section.title || idx} className="mb-3">
          {section.title && (
            <Text style={ink} className="text-base font-psemibold mb-1">{section.title}</Text>
          )}
          {section.paragraphs?.map((p) => (
            <Text key={p} style={soft} className="text-sm leading-5 mb-1">
              {p}
            </Text>
          ))}
          {section.bullets?.map((b) => (
            <View key={b} className="flex-row mb-1 pl-2">
              <Text style={soft} className="text-sm mr-2">{"•"}</Text>
              <Text style={soft} className="text-sm leading-5 flex-1">{b}</Text>
            </View>
          ))}
          {section.footer && (
            <Text style={soft} className="text-sm leading-5 mt-1">{section.footer}</Text>
          )}
        </View>
      ))}
    </View>
  </ScrollView>
  );
};

export default PrivacyContent;
