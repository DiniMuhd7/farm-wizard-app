import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, CircleHelp, FileText, Mail, MessageCircle } from "lucide-react-native";
import { router } from "expo-router";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { themedStyles, themeColor, useThemeVersion } from "@/theme";
import { tr } from "@/utils/tr";
import { useTranslation } from "react-i18next";

const supportEmail = "dinisoft.dev@gmail.com";

export default function HelpSupport() {
  useTranslation();
  useThemeVersion();
  const contactSupport = async () => { const url = `mailto:${supportEmail}?subject=9tel%20support`; if (await Linking.canOpenURL(url)) await Linking.openURL(url); else Alert.alert(tr("Contact support"), tr("Email us at {{email}}.", { email: supportEmail })); };
  return <SafeAreaView style={s.safe} edges={["top"]}><ScrollView contentContainerStyle={s.page}>
    <Pressable accessibilityLabel={tr("Go back")} onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color={themeColor("#211B59")} /></Pressable><Text style={s.title}>{tr("Help & support")}</Text><Text style={s.sub}>{tr("Find answers or get in touch with our team.")}</Text>
    <View style={s.hero}><MessageCircle size={26} color={themeColor("#A9662D")}/><View style={{flex:1}}><Text style={s.heroTitle}>{tr("How can we help?")}</Text><Text style={s.heroCopy}>{tr("Our support team is here to help with your account, number, and calls.")}</Text></View></View>
    <Pressable style={s.contact} onPress={contactSupport}><Mail size={19} color={themeColor("#FFF")}/><Text style={s.contactText}>{tr("Email support")}</Text></Pressable>
    <Text style={s.heading}>{tr("QUICK HELP")}</Text><View style={s.group}><Row icon={CircleHelp} label={tr("Getting started")} detail={tr("Set up your number and make your first call")} onPress={() => router.push("/(tabs)/(sub-tabs)/settings")}/><Row icon={CircleHelp} label={tr("Problems with calls")} detail={tr("Check your number and calling preferences")} onPress={() => router.push("/(tabs)/(sub-tabs)/settings")}/><Row icon={FileText} label={tr("Privacy notice")} detail={tr("How we handle your data")} onPress={() => router.push("/(tabs)/(sub-tabs)/privacy-policy")}/></View>
    <Text style={s.note}>{tr("When contacting support, please avoid sending passwords, card numbers, or other sensitive payment information.")}</Text>
  </ScrollView></SafeAreaView>;
}
function Row({icon:Icon,label,detail,onPress}:{icon:any;label:string;detail:string;onPress:()=>void}) {return <Pressable style={s.row} onPress={onPress}><View style={s.icon}><Icon size={19} color={themeColor("#A9662D")}/></View><View style={{flex:1}}><Text style={s.label}>{label}</Text><Text style={s.detail}>{detail}</Text></View><ChevronRight size={19} color={themeColor("#A09BAE")}/></Pressable>}
const s=themedStyles({safe:{flex:1,backgroundColor:"#F8F8FD"},page:{padding:20,paddingBottom:TAB_BAR_CLEARANCE},back:{width:44,height:44,borderRadius:14,backgroundColor:"#FFF",alignItems:"center",justifyContent:"center"},title:{marginTop:20,color:"#211B59",fontFamily:"Poppins-SemiBold",fontSize:26},sub:{color:"#85829B",fontFamily:"Poppins-Regular",fontSize:12,marginTop:2},hero:{marginTop:24,flexDirection:"row",gap:14,backgroundColor:"#FFF0E4",padding:18,borderRadius:22},heroTitle:{color:"#704425",fontFamily:"Poppins-SemiBold",fontSize:14},heroCopy:{color:"#946846",fontFamily:"Poppins-Regular",fontSize:11,lineHeight:17,marginTop:3},contact:{height:52,backgroundColor:"#5147AF",borderRadius:16,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8,marginTop:16},contactText:{color:"#FFF",fontFamily:"Poppins-SemiBold",fontSize:13},heading:{color:"#211B59",fontFamily:"Poppins-SemiBold",fontSize:12,marginTop:28,marginBottom:10},group:{backgroundColor:"#FFF",borderRadius:20,paddingHorizontal:14},row:{flexDirection:"row",alignItems:"center",paddingVertical:14,borderBottomWidth:1,borderColor:"#F1F0F6"},icon:{width:40,height:40,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0E4",marginRight:12},label:{color:"#383452",fontFamily:"Poppins-Medium",fontSize:12.5},detail:{color:"#9693A7",fontFamily:"Poppins-Regular",fontSize:9.5,marginTop:1},note:{color:"#85829B",fontFamily:"Poppins-Regular",fontSize:10.5,lineHeight:17,textAlign:"center",marginTop:22,paddingHorizontal:12}});
