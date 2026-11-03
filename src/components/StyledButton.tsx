import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Variant = 'primary' | 'danger' | 'secondary' | 'outline';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/**
 * Reusable styled button with built-in haptic feedback, loading state, and icon support.
 * Replaces all usages of the default React Native `<Button>` component.
 */
export default function StyledButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}: Props) {
  const handlePress = () => {
    if (loading || disabled) return;
    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
    onPress();
  };

  const variantStyles = VARIANT_MAP[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles.button,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.spinnerColor} size="small" />
      ) : (
        <>
          {icon && (
            <Icon
              name={icon}
              size={20}
              color={variantStyles.iconColor}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[styles.text, variantStyles.text, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const VARIANT_MAP: Record<
  Variant,
  { button: ViewStyle; text: TextStyle; iconColor: string; spinnerColor: string }
> = {
  primary: {
    button: {
      backgroundColor: '#007AFF',
      shadowColor: '#007AFF',
    },
    text: { color: '#FFFFFF' },
    iconColor: '#FFFFFF',
    spinnerColor: '#FFFFFF',
  },
  danger: {
    button: {
      backgroundColor: '#FF3B30',
      shadowColor: '#FF3B30',
    },
    text: { color: '#FFFFFF' },
    iconColor: '#FFFFFF',
    spinnerColor: '#FFFFFF',
  },
  secondary: {
    button: {
      backgroundColor: '#1C1C1E',
      shadowColor: '#000000',
    },
    text: { color: '#FFFFFF' },
    iconColor: '#FFFFFF',
    spinnerColor: '#FFFFFF',
  },
  outline: {
    button: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: '#007AFF',
      shadowColor: 'transparent',
    },
    text: { color: '#007AFF' },
    iconColor: '#007AFF',
    spinnerColor: '#007AFF',
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
});
