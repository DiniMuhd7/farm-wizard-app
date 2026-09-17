import React from "react";
import { View, TouchableOpacity } from "react-native";

interface HeaderNavigationProps {
  onLeftPress?: () => void;
  onRightPress?: () => void;
  // Pass lucide-react-native icon components, e.g. LeftIcon={ArrowLeft}.
  LeftIcon?: React.ComponentType<{ size?: number; color?: string }>;
  RightIcon?: React.ComponentType<{ size?: number; color?: string }>;
  showLeftButton?: boolean;
  showRightButton?: boolean;
}

const HeaderNavigation: React.FC<HeaderNavigationProps> = ({
  onLeftPress,
  onRightPress,
  LeftIcon,
  RightIcon,
  showLeftButton = true,
  showRightButton = true,
}) => {
  return (
    <View className="w-full px-5 flex-row justify-between items-center mt-10">
      {showLeftButton && (
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center"
          onPress={onLeftPress}
        >
          {LeftIcon ? <LeftIcon size={22} color="#fff" /> : null}
        </TouchableOpacity>
      )}

      {showRightButton && (
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center"
          onPress={onRightPress}
        >
          {RightIcon ? <RightIcon size={22} color="#fff" /> : null}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default HeaderNavigation;
