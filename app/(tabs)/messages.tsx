import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ImagePlus, Send } from "lucide-react-native";
import { getMessages, sendMessage, type Message } from "@/services/messages";

const E164 = /^\+[1-9]\d{6,14}$/;

export default function MessagesScreen() {
  const [recipient, setRecipient] = useState("");
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const to = recipient.trim();
    if (!E164.test(to)) return Alert.alert("Enter a number", "Use an E.164 number, for example +2348012345678.");
    setLoading(true);
    try { setMessages(await getMessages(to)); } catch (error) { Alert.alert("Unable to load messages", (error as Error).message); } finally { setLoading(false); }
  };
  const send = async () => {
    const to = recipient.trim();
    const attachments = mediaUrl.trim() ? [mediaUrl.trim()] : [];
    if (!E164.test(to)) return Alert.alert("Enter a number", "Use an E.164 recipient number.");
    if (!draft.trim() && !attachments.length) return;
    setSending(true);
    try {
      const message = await sendMessage(to, draft.trim(), attachments);
      setMessages((current) => [...current, message]);
      setDraft(""); setMediaUrl("");
    } catch (error) { Alert.alert("Unable to send message", (error as Error).message); } finally { setSending(false); }
  };
  return <View style={s.page}>
    <Text style={s.title}>Messages</Text><Text style={s.subtitle}>Send SMS or MMS from your active 9tel number.</Text>
    <View style={s.recipient}><TextInput value={recipient} onChangeText={setRecipient} placeholder="Recipient (+234…)" keyboardType="phone-pad" style={s.input} /><Pressable onPress={load} style={s.load}><Text style={s.loadText}>Open</Text></Pressable></View>
    {loading ? <ActivityIndicator color="#5147AF" style={s.spinner} /> : <FlatList data={messages} keyExtractor={(item) => item._id} contentContainerStyle={s.list} ListEmptyComponent={<Text style={s.empty}>Open a conversation to see messages.</Text>} renderItem={({ item }) => <View style={[s.bubble, item.direction === "outbound" ? s.outbound : s.inbound]}><Text style={[s.body, item.direction === "outbound" && s.outboundText]}>{item.body || "Media message"}</Text>{item.mediaUrls?.length ? <Text style={[s.media, item.direction === "outbound" && s.outboundText]}>Attachment included</Text> : null}</View>} />}
    <TextInput value={mediaUrl} onChangeText={setMediaUrl} placeholder="Optional HTTPS media URL for MMS" autoCapitalize="none" keyboardType="url" style={s.mediaInput} />
    <View style={s.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="Write a message" multiline style={s.draft} /><Pressable accessibilityLabel="Send message" disabled={sending} onPress={send} style={s.send}>{sending ? <ActivityIndicator color="#FFF" /> : <Send color="#FFF" size={20} />}</Pressable></View>
  </View>;
}
const s = StyleSheet.create({ page:{flex:1,backgroundColor:"#FAF9FF",padding:20,paddingTop:64}, title:{fontFamily:"Poppins-SemiBold",fontSize:26,color:"#211B59"}, subtitle:{fontFamily:"Poppins-Regular",fontSize:12,color:"#77738E",marginTop:3,marginBottom:18}, recipient:{flexDirection:"row",gap:8},input:{flex:1,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E4E1F1",borderRadius:13,paddingHorizontal:13,fontFamily:"Poppins-Regular"},load:{backgroundColor:"#5147AF",borderRadius:13,justifyContent:"center",paddingHorizontal:16},loadText:{color:"#FFF",fontFamily:"Poppins-SemiBold"},spinner:{marginTop:30},list:{paddingVertical:18,gap:8,flexGrow:1},empty:{color:"#89859A",fontFamily:"Poppins-Regular",textAlign:"center",marginTop:36},bubble:{maxWidth:"82%",padding:12,borderRadius:15},outbound:{alignSelf:"flex-end",backgroundColor:"#5147AF"},inbound:{alignSelf:"flex-start",backgroundColor:"#FFF",borderWidth:1,borderColor:"#EAE7F3"},body:{fontFamily:"Poppins-Regular",fontSize:13,color:"#211B59"},outboundText:{color:"#FFF"},media:{fontFamily:"Poppins-Regular",fontSize:10,marginTop:4,color:"#77738E"},mediaInput:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E4E1F1",borderRadius:12,padding:10,fontFamily:"Poppins-Regular",fontSize:12,marginBottom:8},composer:{flexDirection:"row",alignItems:"flex-end",gap:8,marginBottom:70},draft:{flex:1,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E4E1F1",borderRadius:16,padding:12,minHeight:48,maxHeight:110,fontFamily:"Poppins-Regular"},send:{width:48,height:48,borderRadius:16,backgroundColor:"#5147AF",alignItems:"center",justifyContent:"center"} });
