import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

export const colors = {
  background: '#f3f6fb',
  surface: '#ffffff',
  primary: '#087e8b',
  primaryDark: '#06636d',
  ink: '#152638',
  muted: '#718096',
  border: '#e2e8f0',
  pale: '#e9f5f6',
  danger: '#c2413b',
  success: '#17845b',
};

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 18, paddingBottom: 30 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 5 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 5 },
  surface: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '750', marginBottom: 12 },
  sectionHint: { color: colors.muted, fontSize: 12, marginTop: -6, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 2 },
  metric: { width: '48.3%', minHeight: 104, backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 15, marginBottom: 11 },
  metricIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: colors.pale, justifyContent: 'center', alignItems: 'center', marginBottom: 9 },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  metricValue: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 3 },
  button: { minHeight: 44, backgroundColor: colors.primary, paddingHorizontal: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  buttonSecondary: { minHeight: 40, backgroundColor: colors.pale, paddingHorizontal: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonSecondaryText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  buttonDanger: { minHeight: 40, backgroundColor: '#fff0ef', paddingHorizontal: 11, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  buttonDangerText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  iconButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 13 },
  searchInput: { flex: 1, color: colors.ink, paddingVertical: 11, paddingLeft: 9, fontSize: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 15, marginBottom: 11 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 9 },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '750' },
  cardText: { color: colors.muted, fontSize: 13, marginTop: 5, lineHeight: 19 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.pale },
  badgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  empty: { alignItems: 'center', paddingHorizontal: 26, paddingVertical: 30 },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: colors.ink, fontWeight: '750', fontSize: 16 },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20, fontSize: 13 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  errorBox: { backgroundColor: '#fff2f1', borderColor: '#ffd1ce', borderWidth: 1, padding: 15, borderRadius: 14, marginVertical: 8 },
  errorText: { color: '#922f2a', lineHeight: 20, fontSize: 13 },
  field: { marginBottom: 13 },
  fieldLabel: { color: colors.ink, fontWeight: '700', fontSize: 13, marginBottom: 7 },
  input: { minHeight: 47, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, color: colors.ink, backgroundColor: colors.surface, fontSize: 15 },
  picker: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 25, 40, 0.42)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '92%', backgroundColor: colors.background, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingTop: 17, paddingHorizontal: 18, paddingBottom: Platform.OS === 'ios' ? 28 : 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: colors.ink, fontWeight: '800', fontSize: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 11, gap: 8 },
  barLabel: { width: 92, color: colors.muted, fontSize: 12 },
  barTrack: { flex: 1, height: 9, backgroundColor: '#edf1f5', borderRadius: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 8, backgroundColor: colors.primary },
  barValue: { width: 23, textAlign: 'right', color: colors.ink, fontWeight: '700', fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusPicker: { width: 145, height: 41, backgroundColor: '#f7fafc' },
});

export function PageTitle({ title, subtitle, onAdd, addLabel = 'Add new', onRefresh }) {
  return (
    <View style={styles.topRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>METACARE · HOSPITAL</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onAdd ? (
        <TouchableOpacity onPress={onAdd} style={styles.button} accessibilityRole="button">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.buttonText}>{addLabel}</Text>
        </TouchableOpacity>
      ) : onRefresh ? (
        <TouchableOpacity onPress={onRefresh} style={styles.iconButton} accessibilityLabel="Refresh">
          <Ionicons name="refresh" size={19} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ActionButton({ label, icon, onPress, danger = false, disabled = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={danger ? styles.buttonDanger : styles.buttonSecondary}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={15} color={danger ? colors.danger : colors.primaryDark} /> : null}
      <Text style={danger ? styles.buttonDangerText : styles.buttonSecondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SearchBox({ value, onChangeText, placeholder = 'Search' }) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98a5b5"
        style={styles.searchInput}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

export function EmptyState({ title, message, icon = 'folder-open-outline' }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={25} color={colors.primary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function LoadState({ loading, error, onRetry }) {
  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.subtitle}>Loading hospital data…</Text></View>;
  }
  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={onRetry} style={[styles.buttonSecondary, { alignSelf: 'flex-start', marginTop: 12 }]}>
          <Ionicons name="refresh" size={15} color={colors.primaryDark} />
          <Text style={styles.buttonSecondaryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return null;
}

export function FormModal({ visible, title, fields, initialValues = {}, onClose, onSave, saving = false }) {
  const [values, setValues] = useState(initialValues);
  useEffect(() => {
    if (visible) setValues(initialValues || {});
  }, [visible, initialValues]);

  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const submit = () => {
    const missing = fields.find((field) => field.required && !String(values[field.key] ?? '').trim());
    if (missing) {
      Alert.alert('Required field', `${missing.label} is required.`);
      return;
    }
    onSave(values);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Close form">
              <Ionicons name="close" size={21} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {fields.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
                {field.type === 'select' ? (
                  <View style={styles.picker}>
                    <Picker selectedValue={String(values[field.key] ?? '')} onValueChange={(value) => change(field.key, value)}>
                      {!field.required ? <Picker.Item label={field.placeholder || 'Select an option'} value="" /> : null}
                      {field.options.map((option) => (
                        <Picker.Item key={String(option.value)} label={option.label} value={String(option.value)} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <TextInput
                    value={String(values[field.key] ?? '')}
                    onChangeText={(value) => change(field.key, value)}
                    placeholder={field.placeholder || ''}
                    placeholderTextColor="#98a5b5"
                    keyboardType={field.keyboardType || 'default'}
                    autoCapitalize={field.autoCapitalize || 'sentences'}
                    multiline={field.multiline}
                    textAlignVertical={field.multiline ? 'top' : 'center'}
                    style={[styles.input, field.multiline ? { height: 88, paddingTop: 12 } : null]}
                  />
                )}
              </View>
            ))}
            <TouchableOpacity onPress={submit} disabled={saving} style={[styles.button, { marginTop: 4, marginBottom: 18, opacity: saving ? 0.7 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
              <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function confirmDelete(message, action) {
  Alert.alert('Please confirm', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: action },
  ]);
}

export async function exportRows(rows, title, columns, format) {
  if (!rows.length) {
    Alert.alert('Nothing to export', 'There are no rows to export.');
    return;
  }
  const cell = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  if (format === 'csv') {
    const csvCell = (value) => `"${cell(value).replace(/"/g, '""')}"`;
    const csv = [columns.map((column) => csvCell(column.label)).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(','))].join('\r\n');
    await Share.share({ title: `${title} CSV`, message: csv });
    return;
  }

  const escapeHtml = (value) => cell(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join('')}</tr>`).join('');
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const file = await Print.printToFileAsync({
    html: `<html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#152638;padding:22px}h1{color:#087e8b}p{color:#718096}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#087e8b;color:white;text-align:left}td,th{padding:8px;border:1px solid #dce5ed}tr:nth-child(even){background:#f3f6fb}</style><h1>MetaCare · ${escapeHtml(title)}</h1><p>Generated ${escapeHtml(new Date().toLocaleString())}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></html>`,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `${title} PDF` });
  } else {
    Alert.alert('PDF saved', `PDF created at ${file.uri}`);
  }
}
