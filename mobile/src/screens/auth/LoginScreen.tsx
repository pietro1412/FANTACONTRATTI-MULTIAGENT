// =============================================================================
// LoginScreen - Authentication Screen for FantaContratti Mobile App
// =============================================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useAuth } from '../../store/AuthContext';

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  inputBackground: '#252542',
  primary: '#6366F1',
  primaryPressed: '#4F46E5',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  error: '#EF4444',
  inputBorder: '#374151',
  inputFocusBorder: '#6366F1',
};

// =============================================================================
// Email Validation
// =============================================================================

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// =============================================================================
// LoginScreen Component
// =============================================================================

export default function LoginScreen(): JSX.Element {
  const { login, isLoading: authLoading } = useAuth();

  // Form state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Error state
  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [generalError, setGeneralError] = useState<string>('');

  // Focus state for styling
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // Validation Functions
  // ---------------------------------------------------------------------------

  const validateEmail = useCallback((value: string): boolean => {
    if (!value.trim()) {
      setEmailError('Email obbligatoria');
      return false;
    }
    if (!isValidEmail(value.trim())) {
      setEmailError('Inserisci un indirizzo email valido');
      return false;
    }
    setEmailError('');
    return true;
  }, []);

  const validatePassword = useCallback((value: string): boolean => {
    if (!value) {
      setPasswordError('Password obbligatoria');
      return false;
    }
    setPasswordError('');
    return true;
  }, []);

  // ---------------------------------------------------------------------------
  // Input Change Handlers
  // ---------------------------------------------------------------------------

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      setGeneralError('');
      if (emailError) {
        validateEmail(value);
      }
    },
    [emailError, validateEmail]
  );

  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      setGeneralError('');
      if (passwordError) {
        validatePassword(value);
      }
    },
    [passwordError, validatePassword]
  );

  // ---------------------------------------------------------------------------
  // Login Handler
  // ---------------------------------------------------------------------------

  const handleLogin = useCallback(async () => {
    console.log('[LoginScreen] handleLogin called');
    console.log('[LoginScreen] email:', email, 'password length:', password.length);

    // Dismiss keyboard
    Keyboard.dismiss();

    // Clear previous errors
    setGeneralError('');

    // Validate all fields
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    console.log('[LoginScreen] validation:', { isEmailValid, isPasswordValid });

    if (!isEmailValid || !isPasswordValid) {
      console.log('[LoginScreen] validation failed, returning');
      return;
    }

    setIsSubmitting(true);
    console.log('[LoginScreen] calling login...');

    try {
      await login(email.trim(), password);
      console.log('[LoginScreen] login successful');
      // Navigation will be handled by the auth state change in AppNavigator
    } catch (error) {
      console.log('[LoginScreen] login error:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Si è verificato un errore. Riprova.';
      setGeneralError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login, validateEmail, validatePassword]);

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const isButtonDisabled = isSubmitting || authLoading;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Su web TouchableWithoutFeedback causa problemi con il focus degli input
  const content = (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo and Title Section */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>FC</Text>
            </View>
            <Text style={styles.title}>FantaContratti</Text>
            <Text style={styles.subtitle}>Accedi per gestire le tue leghe</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* General Error Message */}
            {generalError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{generalError}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused,
                  emailError ? styles.inputError : null,
                ]}
                placeholder="Inserisci la tua email"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={handleEmailChange}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => {
                  setEmailFocused(false);
                  validateEmail(email);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!isButtonDisabled}
                returnKeyType="next"
              />
              {emailError ? (
                <Text style={styles.fieldError}>{emailError}</Text>
              ) : null}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  passwordFocused && styles.inputFocused,
                  passwordError ? styles.inputError : null,
                ]}
                placeholder="Inserisci la tua password"
                placeholderTextColor={COLORS.textSecondary}
                value={password}
                onChangeText={handlePasswordChange}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => {
                  setPasswordFocused(false);
                  validatePassword(password);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                editable={!isButtonDisabled}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              {passwordError ? (
                <Text style={styles.fieldError}>{passwordError}</Text>
              ) : null}
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isButtonDisabled && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isButtonDisabled}
              activeOpacity={0.8}
            >
              {isSubmitting || authLoading ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Accedi</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Section */}
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>
              Non hai un account?{' '}
              <Text style={styles.footerLink}>Contatta l'admin della lega</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
  );

  // Su web non usiamo TouchableWithoutFeedback che causa problemi con il focus
  if (Platform.OS === 'web') {
    return content;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      {content}
    </TouchableWithoutFeedback>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  formSection: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  inputFocused: {
    borderColor: COLORS.inputFocusBorder,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 6,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  footerSection: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
