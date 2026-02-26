// =============================================================================
// LeagueSettingsScreen - Edit League Settings (Admin Only)
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLeague } from '@/store/LeagueContext';
import { adminApi } from '@/services/api';

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardBorder: '#3d3d5c',
  primary: '#6366F1',
  primaryPressed: '#4F46E5',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  inputBackground: '#1f1f3a',
  inputBorder: '#3d3d5c',
  inputFocusBorder: '#6366F1',
};

// Validation constants from backend
const VALIDATION = {
  name: { min: 3, max: 50 },
  description: { max: 500 },
  maxParticipants: { min: 2, max: 20 },
  initialBudget: { min: 100, max: 10000 },
};

// =============================================================================
// Types
// =============================================================================

interface FormData {
  name: string;
  description: string;
  initialBudget: string;
  maxParticipants: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  initialBudget?: string;
  maxParticipants?: string;
}

// =============================================================================
// Sub-Components
// =============================================================================

interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  numberOfLines?: number;
  error?: string;
  maxLength?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  helpText?: string;
  editable?: boolean;
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  error,
  maxLength,
  icon,
  helpText,
  editable = true,
}: FormInputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputContainer}>
      <View style={styles.labelContainer}>
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={COLORS.textSecondary}
            style={styles.labelIcon}
          />
        )}
        <Text style={styles.label}>{label}</Text>
      </View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        editable={editable}
      />
      {helpText && !error && (
        <Text style={styles.helpText}>{helpText}</Text>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {maxLength && (
        <Text style={styles.charCount}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function LeagueSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { selectedLeague, selectedMember, refreshLeagueData } = useLeague();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    initialBudget: '',
    maxParticipants: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Check if user is admin and league is in DRAFT status
  const isAdmin = selectedMember?.role === 'ADMIN';
  const isLeagueStarted = selectedLeague?.status === 'ACTIVE';

  // =============================================================================
  // Effects
  // =============================================================================

  useEffect(() => {
    if (selectedLeague) {
      setFormData({
        name: selectedLeague.name || '',
        description: selectedLeague.description || '',
        initialBudget: String(selectedLeague.config?.initialBudget || 500),
        maxParticipants: String(selectedLeague.maxParticipants || 8),
      });
    }
  }, [selectedLeague]);

  // =============================================================================
  // Validation
  // =============================================================================

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Il nome della lega e obbligatorio';
    } else if (formData.name.trim().length < VALIDATION.name.min) {
      newErrors.name = `Il nome deve avere almeno ${VALIDATION.name.min} caratteri`;
    } else if (formData.name.trim().length > VALIDATION.name.max) {
      newErrors.name = `Il nome non puo superare ${VALIDATION.name.max} caratteri`;
    }

    // Validate description
    if (formData.description.length > VALIDATION.description.max) {
      newErrors.description = `La descrizione non puo superare ${VALIDATION.description.max} caratteri`;
    }

    // Validate initialBudget (only if league not started)
    if (!isLeagueStarted) {
      const budget = parseInt(formData.initialBudget, 10);
      if (isNaN(budget)) {
        newErrors.initialBudget = 'Il budget deve essere un numero';
      } else if (budget < VALIDATION.initialBudget.min) {
        newErrors.initialBudget = `Il budget minimo e ${VALIDATION.initialBudget.min}`;
      } else if (budget > VALIDATION.initialBudget.max) {
        newErrors.initialBudget = `Il budget massimo e ${VALIDATION.initialBudget.max}`;
      }
    }

    // Validate maxParticipants (only if league not started)
    if (!isLeagueStarted) {
      const maxPart = parseInt(formData.maxParticipants, 10);
      if (isNaN(maxPart)) {
        newErrors.maxParticipants = 'Il numero deve essere valido';
      } else if (maxPart < VALIDATION.maxParticipants.min) {
        newErrors.maxParticipants = `Minimo ${VALIDATION.maxParticipants.min} partecipanti`;
      } else if (maxPart > VALIDATION.maxParticipants.max) {
        newErrors.maxParticipants = `Massimo ${VALIDATION.maxParticipants.max} partecipanti`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isLeagueStarted]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleFieldChange = useCallback(
    (field: keyof FormData) => (value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setHasChanges(true);
      // Clear error for this field
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const handleSave = useCallback(async () => {
    if (!selectedLeague) return;

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      // Build update data - only include fields that can be modified
      const updateData: {
        name?: string;
        description?: string;
        initialBudget?: number;
        maxParticipants?: number;
      } = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      // Only include budget and participants if league hasn't started
      if (!isLeagueStarted) {
        updateData.initialBudget = parseInt(formData.initialBudget, 10);
        updateData.maxParticipants = parseInt(formData.maxParticipants, 10);
      }

      const response = await adminApi.updateLeague(selectedLeague.id, updateData);

      if (response.success) {
        Alert.alert('Successo', 'Impostazioni salvate con successo', [
          {
            text: 'OK',
            onPress: () => {
              refreshLeagueData();
              setHasChanges(false);
              navigation.goBack();
            },
          },
        ]);
      } else {
        Alert.alert('Errore', response.message || 'Impossibile salvare le impostazioni');
      }
    } catch (error) {
      console.error('[LeagueSettings] Save error:', error);
      Alert.alert('Errore', 'Si e verificato un errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  }, [selectedLeague, formData, validateForm, refreshLeagueData, navigation, isLeagueStarted]);

  const handleGoBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Modifiche non salvate',
        'Hai delle modifiche non salvate. Vuoi uscire senza salvare?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Esci',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [hasChanges, navigation]);

  // =============================================================================
  // Render
  // =============================================================================

  // Not admin
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.centerTitle}>Accesso Riservato</Text>
          <Text style={styles.centerText}>
            Solo gli admin della lega possono modificare le impostazioni.
          </Text>
        </View>
      </View>
    );
  }

  // No league selected
  if (!selectedLeague) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.centerTitle}>Nessuna Lega</Text>
          <Text style={styles.centerText}>
            Seleziona una lega per modificarne le impostazioni.
          </Text>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Banner for started leagues */}
        {isLeagueStarted && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color={COLORS.warning} />
            <Text style={styles.infoBannerText}>
              La lega e gia avviata. Alcune impostazioni non possono essere modificate.
            </Text>
          </View>
        )}

        {/* League Name */}
        <FormInput
          label="Nome Lega"
          value={formData.name}
          onChangeText={handleFieldChange('name')}
          placeholder="Es. Lega Fantacalcio 2024"
          error={errors.name}
          maxLength={VALIDATION.name.max}
          icon="trophy-outline"
        />

        {/* Description */}
        <FormInput
          label="Descrizione"
          value={formData.description}
          onChangeText={handleFieldChange('description')}
          placeholder="Descrivi la tua lega (opzionale)"
          multiline
          numberOfLines={4}
          error={errors.description}
          maxLength={VALIDATION.description.max}
          icon="document-text-outline"
        />

        {/* Initial Budget */}
        <FormInput
          label="Budget Iniziale"
          value={formData.initialBudget}
          onChangeText={handleFieldChange('initialBudget')}
          placeholder="500"
          keyboardType="numeric"
          error={errors.initialBudget}
          icon="wallet-outline"
          helpText={
            isLeagueStarted
              ? 'Non modificabile dopo l\'avvio della lega'
              : `Valore tra ${VALIDATION.initialBudget.min} e ${VALIDATION.initialBudget.max}`
          }
          editable={!isLeagueStarted}
        />

        {/* Max Participants */}
        <FormInput
          label="Numero Massimo Partecipanti"
          value={formData.maxParticipants}
          onChangeText={handleFieldChange('maxParticipants')}
          placeholder="8"
          keyboardType="numeric"
          error={errors.maxParticipants}
          icon="people-outline"
          helpText={
            isLeagueStarted
              ? 'Non modificabile dopo l\'avvio della lega'
              : `Valore tra ${VALIDATION.maxParticipants.min} e ${VALIDATION.maxParticipants.max}`
          }
          editable={!isLeagueStarted}
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.text} />
              <Text style={styles.saveButtonText}>Salva Modifiche</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleGoBack}
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>Annulla</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  centerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}20`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${COLORS.warning}40`,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.warning,
    marginLeft: 10,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelIcon: {
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: COLORS.inputFocusBorder,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: COLORS.card,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginLeft: 4,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
