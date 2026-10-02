import { BlurView } from "expo-blur";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

const CustomButton = ({
    title,
    handlePress,
    containerStyles,
    textStyles,
    isLoading,
    disabled = false,
    // bgColor = 'buttonColor'
}) => {
    const isDisabled = isLoading || disabled;

    return (
        // <View className="bg-black/20 opacity-90 flex flex-row justify-center items-center mt-3 p-2 rounded-lg">
        <View className="mt-3 rounded-lg overflow-hidden">
            <BlurView
                intensity={50}
                tint="dark"
                className="rounded-lg p-2 bg-white/10"
                style={{
                    // borderWidth: 1,
                    // borderColor: 'rgba(255, 255, 255, 0.3)',
                    // backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }}
            >
                <TouchableOpacity
                    onPress={handlePress}
                    activeOpacity={0.7}
                    className={`bg-buttonColor rounded-xl min-h-[52px] flex flex-row justify-center items-center shadow-lg shadow-black/50 ${containerStyles} ${isDisabled ? "opacity-50" : ""
                        }`}
                    // style={{ borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' }}
                    style={{
                        // borderWidth: 1,
                        // borderColor: 'rgba(255, 255, 255, 0.2)',
                        // backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isDisabled, busy: isLoading }}
                    disabled={isDisabled}
                >
                    <Text className={`text-white font-primary text-[22px] ${textStyles}`}>
                        {title}
                    </Text>

                    {isLoading && (
                        <ActivityIndicator
                            animating={isLoading}
                            color="#fff"
                            size="small"
                            className="ml-2"
                        />
                    )}
                </TouchableOpacity>
            </BlurView>
        </View>

    );
};

export default CustomButton;
