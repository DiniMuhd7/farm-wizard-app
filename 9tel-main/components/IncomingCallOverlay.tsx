import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Phone, PhoneOff } from "lucide-react-native";
import type { IncomingCall } from "@/services/voice";

interface Props {
  call: IncomingCall | null;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallOverlay({ call, onAccept, onDecline }: Props) {
  return (
    <Modal visible={!!call} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.safe}>
        <View style={styles.top}>
          <Text style={styles.brand}>9tel</Text>
          <Text style={styles.label}>Incoming call</Text>
        </View>

        <View style={styles.contact}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{(call?.from ?? "?").replace(/^\+/, "").slice(0, 1)}</Text>
          </View>
          <Text style={styles.number}>{call?.from ?? ""}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionWrap} onPress={onDecline}>
            <View style={[styles.action, styles.decline]}>
              <PhoneOff color="#FFF" size={26} />
            </View>
            <Text style={styles.actionLabel}>Decline</Text>
          </Pressable>
          <Pressable style={styles.actionWrap} onPress={onAccept}>
            <View style={[styles.action, styles.accept]}>
              <Phone color="#FFF" size={26} fill="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#211B59", padding: 23, justifyContent: "space-between" },
  top: { marginTop: 40 },
  brand: { color: "#FFF", fontSize: 27, fontFamily: "Poppins-Bold", letterSpacing: -1 },
  label: { color: "#CFCBFF", fontSize: 13, fontFamily: "Poppins-Medium", marginTop: 9 },
  contact: { alignItems: "center" },
  avatar: {
    height: 148,
    width: 148,
    borderRadius: 74,
    backgroundColor: "#F1B296",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 7,
    borderColor: "rgba(255,255,255,.13)",
  },
  initial: { fontSize: 58, color: "#6A3156", fontFamily: "Poppins-SemiBold" },
  number: { color: "#D0CCFC", fontSize: 15, fontFamily: "Poppins-Regular", marginTop: 18 },
  actions: { flexDirection: "row", justifyContent: "space-around", marginBottom: 56 },
  actionWrap: { alignItems: "center" },
  action: {
    height: 68,
    width: 68,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 7,
  },
  decline: { backgroundColor: "#EF6C6B", shadowColor: "#EF6C6B" },
  accept: { backgroundColor: "#5F56C6", shadowColor: "#5147B6" },
  actionLabel: { color: "#D9D6FC", fontSize: 12, fontFamily: "Poppins-Medium", marginTop: 10 },
});
