import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronLeft, PhoneCall, ShieldCheck, Sparkles } from "lucide-react-native";
import { router } from "expo-router";

const benefits = ["Choose a number in an available country", "Make and receive calls with your 9tel number", "Use a verified caller ID when it is available"];

export default function CallingPlan() {
  return <SafeAreaView style={s.safe} edges={["top"]}><ScrollView contentContainerStyle={s.page}>
    <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color="#211B59" /></Pressable>
    <Text style={s.title}>Calling plan</Text><Text style={s.sub}>Your 9tel calling features at a glance.</Text>
    <View style={s.card}><View style={s.badge}><Sparkles size={17} color="#705BC7" /><Text style={s.badgeText}>CURRENT PLAN</Text></View>
      <Text style={s.plan}>9tel calling</Text><Text style={s.copy}>Set up your number and start connecting from one simple place.</Text>
      <View style={s.status}><View style={s.dot} /><Text style={s.statusText}>Available to set up</Text></View>
    </View>
    <Text style={s.heading}>WHAT'S INCLUDED</Text><View style={s.group}>{benefits.map((benefit) => <View key={benefit} style={s.row}><View style={s.icon}><Check size={16} color="#3A9B70" /></View><Text style={s.rowText}>{benefit}</Text></View>)}</View>
    <View style={s.note}><ShieldCheck size={19} color="#5147AF" /><Text style={s.noteText}>Your payment is handled securely when you choose a number. Card details are never stored in the app.</Text></View>
    <Pressable style={s.primary} onPress={() => router.push("/(tabs)/(sub-tabs)/settings")}><PhoneCall size={18} color="#FFF" /><Text style={s.primaryText}>Set up your number</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ safe:{flex:1,backgroundColor:"#F8F8FD"},page:{padding:20,paddingBottom:48},back:{width:44,height:44,borderRadius:14,backgroundColor:"#FFF",alignItems:"center",justifyContent:"center"},title:{marginTop:20,color:"#211B59",fontFamily:"Poppins-SemiBold",fontSize:26},sub:{color:"#85829B",fontFamily:"Poppins-Regular",fontSize:12,marginTop:2},card:{backgroundColor:"#EEE9FF",borderRadius:24,padding:20,marginTop:24},badge:{flexDirection:"row",alignItems:"center",gap:6},badgeText:{color:"#705BC7",fontFamily:"Poppins-SemiBold",fontSize:10},plan:{color:"#30245E",fontFamily:"Poppins-SemiBold",fontSize:22,marginTop:14},copy:{color:"#615B7C",fontFamily:"Poppins-Regular",fontSize:12,lineHeight:19,marginTop:5},status:{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",borderRadius:20,paddingHorizontal:10,paddingVertical:7,marginTop:18},dot:{width:7,height:7,borderRadius:4,backgroundColor:"#43BE89",marginRight:6},statusText:{color:"#357559",fontFamily:"Poppins-Medium",fontSize:10.5},heading:{color:"#211B59",fontFamily:"Poppins-SemiBold",fontSize:12,marginTop:28,marginBottom:10},group:{backgroundColor:"#FFF",borderRadius:20,paddingHorizontal:15},row:{flexDirection:"row",alignItems:"center",paddingVertical:15,borderBottomWidth:1,borderColor:"#F1F0F6"},icon:{width:28,height:28,borderRadius:10,backgroundColor:"#EAF8F1",alignItems:"center",justifyContent:"center",marginRight:11},rowText:{flex:1,color:"#4C4862",fontFamily:"Poppins-Regular",fontSize:12,lineHeight:18},note:{flexDirection:"row",gap:11,backgroundColor:"#EAF2FF",borderRadius:18,padding:15,marginTop:20},noteText:{flex:1,color:"#52617B",fontFamily:"Poppins-Regular",fontSize:11,lineHeight:17},primary:{backgroundColor:"#5147AF",height:52,borderRadius:16,marginTop:24,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8},primaryText:{color:"#FFF",fontFamily:"Poppins-SemiBold",fontSize:13} });
