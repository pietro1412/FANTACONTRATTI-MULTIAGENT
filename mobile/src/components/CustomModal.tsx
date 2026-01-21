// =============================================================================
// CustomModal - Custom Alert Modal Component
// Replaces native Alert.alert with a styled modal matching app design
// =============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardBorder: '#3d3d5c',
  primary: '#6366F1',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

// =============================================================================
// Types
// =============================================================================

export interface CustomModalButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: CustomModalButton[];
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onClose?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getButtonStyle(style?: 'default' | 'cancel' | 'destructive'): {
  backgroundColor: string;
  textColor: string;
} {
  switch (style) {
    case 'destructive':
      return { backgroundColor: COLORS.error, textColor: COLORS.text };
    case 'cancel':
      return { backgroundColor: COLORS.cardBorder, textColor: COLORS.textSecondary };
    default:
      return { backgroundColor: COLORS.primary, textColor: COLORS.text };
  }
}

function getDefaultIcon(title: string): keyof typeof Ionicons.glyphMap {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('errore') || lowerTitle.includes('error')) {
    return 'alert-circle-outline';
  }
  if (lowerTitle.includes('successo') || lowerTitle.includes('success')) {
    return 'checkmark-circle-outline';
  }
  if (lowerTitle.includes('conferma') || lowerTitle.includes('confirm')) {
    return 'help-circle-outline';
  }
  if (lowerTitle.includes('info')) {
    return 'information-circle-outline';
  }
  return 'information-circle-outline';
}

function getDefaultIconColor(title: string): string {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('errore') || lowerTitle.includes('error')) {
    return COLORS.error;
  }
  if (lowerTitle.includes('successo') || lowerTitle.includes('success') || lowerTitle.includes('copiato')) {
    return COLORS.success;
  }
  if (lowerTitle.includes('conferma') || lowerTitle.includes('confirm')) {
    return COLORS.warning;
  }
  return COLORS.primary;
}

// =============================================================================
// Component
// =============================================================================

export function CustomModal({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  icon,
  iconColor,
  onClose,
}: CustomModalProps): React.JSX.Element {
  const resolvedIcon = icon || getDefaultIcon(title);
  const resolvedIconColor = iconColor || getDefaultIconColor(title);

  const handleButtonPress = (button: CustomModalButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  const handleBackdropPress = () => {
    // Find cancel button or close modal
    const cancelButton = buttons.find(b => b.style === 'cancel');
    if (cancelButton) {
      handleButtonPress(cancelButton);
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: `${resolvedIconColor}20` }]}>
                <Ionicons name={resolvedIcon} size={32} color={resolvedIconColor} />
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message */}
              {message && <Text style={styles.message}>{message}</Text>}

              {/* Buttons */}
              <View style={[styles.buttonContainer, buttons.length > 2 && styles.buttonContainerVertical]}>
                {buttons.map((button, index) => {
                  const buttonStyle = getButtonStyle(button.style);
                  const isVertical = buttons.length > 2;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        { backgroundColor: buttonStyle.backgroundColor },
                        isVertical ? styles.buttonVertical : styles.buttonHorizontal,
                        !isVertical && index === 0 && buttons.length > 1 && styles.buttonFirst,
                      ]}
                      onPress={() => handleButtonPress(button)}
                    >
                      <Text style={[styles.buttonText, { color: buttonStyle.textColor }]}>
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// =============================================================================
// Hook for easier usage
// =============================================================================

export interface UseCustomModalState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: CustomModalButton[];
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

export interface UseCustomModalReturn {
  modalState: UseCustomModalState;
  showModal: (
    title: string,
    message?: string,
    buttons?: CustomModalButton[],
    icon?: keyof typeof Ionicons.glyphMap,
    iconColor?: string
  ) => void;
  hideModal: () => void;
  CustomModalComponent: React.JSX.Element;
}

export function useCustomModal(): UseCustomModalReturn {
  const [modalState, setModalState] = React.useState<UseCustomModalState>({
    visible: false,
    title: '',
    message: undefined,
    buttons: [],
    icon: undefined,
    iconColor: undefined,
  });

  const showModal = React.useCallback(
    (
      title: string,
      message?: string,
      buttons?: CustomModalButton[],
      icon?: keyof typeof Ionicons.glyphMap,
      iconColor?: string
    ) => {
      setModalState({
        visible: true,
        title,
        message,
        buttons: buttons || [{ text: 'OK', style: 'default' }],
        icon,
        iconColor,
      });
    },
    []
  );

  const hideModal = React.useCallback(() => {
    setModalState(prev => ({ ...prev, visible: false }));
  }, []);

  const CustomModalComponent = (
    <CustomModal
      visible={modalState.visible}
      title={modalState.title}
      message={modalState.message}
      buttons={modalState.buttons}
      icon={modalState.icon}
      iconColor={modalState.iconColor}
      onClose={hideModal}
    />
  );

  return {
    modalState,
    showModal,
    hideModal,
    CustomModalComponent,
  };
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonHorizontal: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonVertical: {
    marginVertical: 4,
    width: '100%',
  },
  buttonFirst: {
    marginLeft: 0,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
