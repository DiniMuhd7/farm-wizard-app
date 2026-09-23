import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";
import PrivacyContent from "@/components/PrivacyContent";

export default function PrivacyPolicy() {
  return <SafeAreaView style={s.safe} edges={["top"]}><ScrollView contentContainerStyle={s.page}>
    <View style={s.top}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}><ChevronLeft size={23} color="#211B59" /></Pressable><Text style={s.title}>Privacy notice</Text></View>
    <View style={s.content}><PrivacyContent /></View>
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#F8F8FD"},page:{padding:20,paddingBottom:44},top:{flexDirection:"row",alignItems:"center",gap:14},back:{width:44,height:44,borderRadius:14,backgroundColor:"#FFF",alignItems:"center",justifyContent:"center"},title:{color:"#211B59",fontFamily:"Poppins-SemiBold",fontSize:20},content:{marginTop:20,backgroundColor:"#FFF",borderRadius:20,padding:16}});
