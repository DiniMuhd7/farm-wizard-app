import { BlurView } from "expo-blur";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Modal, View } from "react-native";
import CustomButton from "./CustomButton";

const ConfirmModal = ({
  visible,
  onConfirm,
  onCancel,
  message = "Are you sure you want to proceed?",
  confirmTitle = "Confirm",
  confirmBtnText = "OK",
  cancelBtnText = "Cancel",
}: any) => (
  <Modal
    transparent
    visible={visible}
    animationType="fade"
    onRequestClose={onCancel}
  >
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>{confirmTitle}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={onCancel}>
            <Text style={styles.cancelText}>{cancelBtnText}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={onConfirm}>
            <Text style={styles.confirmText}>{confirmBtnText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: 300,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  message: {
    marginVertical: 15,
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    marginLeft: 15,
  },
  cancelText: {
    color: "#666",
    fontSize: 16,
  },
  confirmText: {
    color: "#007AFF",
    fontSize: 16,
  },
});

export default ConfirmModal;
// native confirmation
export const showConfirmDialog = () => {
  Alert.alert(
    "Confirm",
    "Are you sure you want to proceed?",
    [
      {
        text: "Cancel",
        onPress: () => console.log("Cancelled"),
        style: "cancel",
      },
      {
        text: "OK",
        onPress: () => console.log("Confirmed"),
      },
    ],
    { cancelable: false }
  );
};

export const CustomConfirmDialog = ({
  visible,
  onClose,
  onConfirmPress,
  onCancelPress,
  messageText = "The magic’s eager, but your coins are few! Let’s visit the shop and fill that pouch.",
  imageSource,
  confirmButtonText = "Ok",
  concelButtonText = "Cancel",
}: any) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <BlurView
          intensity={50}
          tint="dark"
          className="flex-1 items-center justify-center"
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View className="flex-1 w-full bg-[#857f6e85] opacity-2 rounded-lg p-2 justify-center items-center">
              {imageSource && (
                <Image source={imageSource} className="w-40 h-40 mb-2" />
              )}

              <Text
                className="text-center text-xl px-2 font-secondary my-10"
                style={{
                  color: "#fff",
                  textAlign: "center",
                  paddingHorizontal: 10,
                }}
              >
                {messageText}
              </Text>
              <View className="flex-row w-full justify-center items-center gap-x-10">
                <CustomButton
                  title={confirmButtonText}
                  handlePress={onConfirmPress}
                  containerStyles="w-[150px] "
                  textStyles="font-pbold text-white"
                  isLoading={false}
                />
                <CustomButton
                  title={concelButtonText}
                  handlePress={onCancelPress}
                  containerStyles="w-[150px] "
                  textStyles="font-pbold text-white"
                  isLoading={false}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </BlurView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
