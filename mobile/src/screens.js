import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest, useApiData, useApiList } from './api';
import {
  ActionButton,
  colors,
  confirmDelete,
  EmptyState,
  exportRows,
  FormModal,
  LoadState,
  PageTitle,
  SearchBox,
  styles,
} from './components';

const EMPTY = {};
const statuses = ['Scheduled', 'Completed', 'Cancelled'];
const genderOptions = ['Male', 'Female', 'Other'].map((value) => ({ label: value, value }));

const patientFields = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'age', label: 'Age', required: true, keyboardType: 'number-pad', placeholder: 'Age in years' },
  { key: 'gender', label: 'Gender', type: 'select', required: true, options: genderOptions },
  { key: 'phone', label: 'Phone', required: true, keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', keyboardType: 'email-address', autoCapitalize: 'none' },
  { key: 'address', label: 'Address', multiline: true },
];

const doctorFields = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'specialization', label: 'Specialization', required: true },
  { key: 'phone', label: 'Phone', required: true, keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', keyboardType: 'email-address', autoCapitalize: 'none' },
];

const patientColumns = [
  { key: 'patient_id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
];

const doctorColumns = [
  { key: 'doctor_id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'specialization', label: 'Specialization' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
];

function displayDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

function displayTime(value) {
  return value ? String(value).slice(0, 5) : '—';
}

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function MetricCard({ icon, label, value, tint }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, tint ? { backgroundColor: tint } : null]}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value ?? 0}</Text>
    </View>
  );
}

function AnalyticsBars({ title, items, labelKey, valueKey }) {
  const maximum = Math.max(1, ...items.map((item) => Number(item[valueKey]) || 0));
  return (
    <View style={styles.surface}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? items.map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        return (
          <View key={`${item[labelKey]}-${index}`} style={styles.barRow}>
            <Text numberOfLines={1} style={styles.barLabel}>{item[labelKey]}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max(5, value / maximum * 100)}%` }]} />
            </View>
            <Text style={styles.barValue}>{value}</Text>
          </View>
        );
      }) : <Text style={styles.subtitle}>No data available yet.</Text>}
    </View>
  );
}

function AssistantModal({ visible, onClose }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    { text: 'Hello! Ask me for a system summary, today’s or upcoming appointments, or help finding a doctor or patient.', from: 'assistant' },
  ]);
  const [sending, setSending] = useState(false);

  const ask = async (value) => {
    const text = value.trim();
    if (!text || sending) return;
    setQuestion('');
    setMessages((current) => [...current, { text, from: 'user' }]);
    setSending(true);
    try {
      const [patients, doctors, appointments, records] = await Promise.all([
        apiRequest('/api/patients'),
        apiRequest('/api/doctors'),
        apiRequest('/api/appointments'),
        apiRequest('/api/records'),
      ]);
      const normalized = text.toLowerCase();
      let reply;
      if (/summary|overview|how many|count|total/.test(normalized)) {
        const scheduled = appointments.appointments.filter((item) => item.status === 'Scheduled').length;
        if (/patient/.test(normalized)) reply = `There are ${patients.patients.length} patients.`;
        else if (/doctor/.test(normalized)) reply = `There are ${doctors.doctors.length} doctors.`;
        else if (/record/.test(normalized)) reply = `There are ${records.records.length} medical records.`;
        else if (/appointment/.test(normalized)) reply = `There are ${appointments.appointments.length} appointments, ${scheduled} scheduled.`;
        else reply = `Current overview: ${patients.patients.length} patients, ${doctors.doctors.length} doctors, ${appointments.appointments.length} appointments (${scheduled} scheduled), and ${records.records.length} medical records.`;
      } else if (/upcoming|next|soon/.test(normalized)) {
        const today = localToday();
        const upcoming = appointments.appointments.filter((item) => item.status === 'Scheduled' && item.appointment_date >= today)
          .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`))
          .slice(0, 8);
        reply = upcoming.length
          ? upcoming.map((item) => `${displayDate(item.appointment_date)} ${displayTime(item.appointment_time)} · ${item.patient} with ${item.doctor}`).join('\n')
          : 'There are no upcoming scheduled appointments.';
      } else if (/today/.test(normalized)) {
        const today = localToday();
        const todayItems = appointments.appointments.filter((item) => item.appointment_date === today)
          .sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time)));
        reply = todayItems.length
          ? todayItems.map((item) => `${displayTime(item.appointment_time)} · ${item.patient} with ${item.doctor} (${item.status})`).join('\n')
          : 'There are no appointments scheduled for today.';
      } else if (/doctor|specialist|specialization/.test(normalized)) {
        const terms = normalized.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !['doctor', 'doctors', 'specialist', 'specialization', 'show', 'find', 'list'].includes(word));
        const matches = doctors.doctors.filter((doctor) => !terms.length || terms.some((term) => `${doctor.name} ${doctor.specialization}`.toLowerCase().includes(term)));
        reply = matches.length ? matches.map((doctor) => `${doctor.name} · ${doctor.specialization} · ${doctor.phone}`).join('\n') : 'No matching doctors found.';
      } else if (/record|diagnosis|prescription/.test(normalized)) {
        const terms = normalized.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !['record', 'records', 'diagnosis', 'prescription', 'show', 'find', 'list'].includes(word));
        const matches = records.records.filter((record) => !terms.length || terms.some((term) => `${record.patient} ${record.doctor} ${record.diagnosis} ${record.prescription || ''}`.toLowerCase().includes(term)));
        reply = matches.length ? matches.slice(0, 8).map((record) => `${displayDate(record.record_date)} · ${record.patient}: ${record.diagnosis} · ${record.prescription || 'No prescription'}`).join('\n') : 'No matching medical records found.';
      } else if (/scheduled|completed|cancel/.test(normalized) && /appointment|status|show|list/.test(normalized)) {
        const status = normalized.includes('cancel') ? 'Cancelled' : normalized.includes('completed') ? 'Completed' : 'Scheduled';
        const matches = appointments.appointments.filter((appointment) => appointment.status === status);
        reply = matches.length ? matches.slice(0, 8).map((item) => `${displayDate(item.appointment_date)} ${displayTime(item.appointment_time)} · ${item.patient} with ${item.doctor}`).join('\n') : `No ${status.toLowerCase()} appointments found.`;
      } else if (/book|schedule an appointment/.test(normalized)) {
        reply = 'Open the Appointments tab, tap Book, select a patient and doctor, enter the date and time, then save. The system prevents double-booking a doctor at the same time.';
      } else {
        const terms = normalized.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 2);
        const matches = patients.patients.filter((patient) => terms.some((term) => `${patient.name} ${patient.phone} ${patient.email || ''}`.toLowerCase().includes(term)));
        reply = matches.length ? matches.map((patient) => `${patient.name} · ${patient.age} · ${patient.phone}`).join('\n') : 'I could not find a matching patient. Try a name, “today”, “upcoming appointments”, “doctors” or “summary”.';
      }
      setMessages((current) => [...current, { text: reply, from: 'assistant' }]);
    } catch (error) {
      setMessages((current) => [...current, { text: error.message, from: 'assistant' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { height: '84%' }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>MetaCare assistant</Text>
              <Text style={styles.subtitle}>Ask about your hospital data</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}><Ionicons name="close" size={21} color={colors.ink} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {messages.map((message, index) => (
              <View key={`${index}-${message.from}`} style={[styles.card, { alignSelf: message.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', backgroundColor: message.from === 'user' ? colors.pale : colors.surface }]}>
                <Text style={styles.cardText}>{message.text}</Text>
              </View>
            ))}
            {sending ? <Text style={styles.subtitle}>Checking hospital data…</Text> : null}
            <View style={styles.actions}>
              {['Summary', "Today’s appointments", 'Upcoming appointments', 'Doctors'].map((chip) => (
                <ActionButton key={chip} label={chip} onPress={() => ask(chip)} disabled={sending} />
              ))}
            </View>
          </ScrollView>
          <View style={styles.inline}>
            <TextInput value={question} onChangeText={setQuestion} onSubmitEditing={() => ask(question)} placeholder="Ask something…" placeholderTextColor="#98a5b5" returnKeyType="send" style={[styles.input, { flex: 1 }]} />
            <TouchableOpacity onPress={() => ask(question)} disabled={sending} style={styles.iconButton} accessibilityLabel="Send question">
              <Ionicons name="send" size={19} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function DashboardScreen({ navigation }) {
  const { data, loading, error, refresh } = useApiData('/api/dashboard');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const counts = data?.counts || {};

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.listContent}>
        <PageTitle
          title="Overview"
          subtitle="A clear picture of today's care."
          onRefresh={refresh}
        />
        <LoadState loading={loading} error={error} onRetry={refresh} />
        {!loading && !error ? (
          <>
            <View style={styles.grid}>
              <MetricCard icon="people" label="Registered patients" value={counts.patients} />
              <MetricCard icon="medkit" label="Medical team" value={counts.doctors} tint="#edf4ff" />
              <MetricCard icon="calendar" label="Scheduled visits" value={counts.scheduled} tint="#fff5e8" />
              <MetricCard icon="document-text" label="Medical records" value={counts.records} tint="#f2edff" />
            </View>

            <View style={styles.surface}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
              <View style={styles.actions}>
                <ActionButton label="Book appointment" icon="calendar-outline" onPress={() => navigation.navigate('Appointments')} />
                <ActionButton label="Add patient" icon="person-add-outline" onPress={() => navigation.navigate('Patients', { openCreate: true })} />
                <ActionButton label="Add doctor" icon="medkit-outline" onPress={() => navigation.navigate('Doctors', { openCreate: true })} />
                <ActionButton label="Add record" icon="document-attach-outline" onPress={() => navigation.navigate('Records', { openCreate: true })} />
                <ActionButton label="Ask assistant" icon="chatbubble-ellipses-outline" onPress={() => setAssistantOpen(true)} />
              </View>
            </View>

            <AnalyticsBars title="Appointment status" items={data.statuses || []} labelKey="status" valueKey="total" />
            <AnalyticsBars title="Doctors by specialty" items={data.specialties || []} labelKey="name" valueKey="total" />
            <AnalyticsBars title="Busiest doctors" items={data.busiest || []} labelKey="name" valueKey="total" />
            <View style={styles.surface}>
              <Text style={styles.sectionTitle}>Patient demographics</Text>
              {data.demographics?.length ? data.demographics.map((item) => (
                <View key={item.gender} style={[styles.inline, { justifyContent: 'space-between', paddingVertical: 6 }]}>
                  <Text style={styles.cardText}>{item.gender}</Text>
                  <Text style={styles.cardTitle}>{item.total} <Text style={styles.cardText}>patients</Text></Text>
                </View>
              )) : <Text style={styles.subtitle}>No patient demographics yet.</Text>}
              {data.demographics?.length ? (
                <Text style={styles.subtitle}>
                  Average age: {Math.round(data.demographics.reduce((sum, item) => sum + Number(item.average_age || 0) * Number(item.total || 0), 0)
                    / Math.max(1, data.demographics.reduce((sum, item) => sum + Number(item.total || 0), 0)))} years
                </Text>
              ) : null}
            </View>

            <View style={styles.surface}>
              <Text style={styles.sectionTitle}>Today's schedule</Text>
              {data.today?.length ? data.today.map((item) => (
                <View key={item.appointment_id} style={[styles.inline, { alignItems: 'flex-start', marginBottom: 12 }]}>
                  <Text style={[styles.badgeText, { minWidth: 49, paddingTop: 3 }]}>{displayTime(item.appointment_time)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.patient}</Text>
                    <Text style={styles.cardText}>with {item.doctor} · {item.status}</Text>
                  </View>
                </View>
              )) : <EmptyState title="No visits today" message="Appointments scheduled for today will appear here." icon="calendar-outline" />}
            </View>

            <View style={styles.surface}>
              <Text style={styles.sectionTitle}>Upcoming appointments</Text>
              {data.upcoming?.length ? data.upcoming.map((item) => (
                <View key={item.appointment_id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{item.patient}</Text>
                    <Text style={styles.badgeText}>{displayDate(item.appointment_date)}</Text>
                  </View>
                  <Text style={styles.cardText}>{displayTime(item.appointment_time)} · {item.doctor}</Text>
                  <Text style={styles.cardText}>{item.reason || 'No reason added'}</Text>
                </View>
              )) : <EmptyState title="Nothing coming up" message="New scheduled appointments will show here." icon="calendar-outline" />}
            </View>
          </>
        ) : null}
      </ScrollView>
      <AssistantModal visible={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </View>
  );
}

export function PatientsScreen({ route, navigation }) {
  const { items, loading, error, refresh } = useApiList('/api/patients', 'patients');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => [item.name, item.phone, item.email, item.address].some((value) => String(value || '').toLowerCase().includes(term))) : items;
  }, [items, search]);

  React.useEffect(() => {
    if (route.params?.openCreate) {
      setEditing(null);
      setFormOpen(true);
      navigation.setParams({ openCreate: false });
    }
  }, [route.params?.openCreate, navigation]);

  const save = async (values) => {
    setSaving(true);
    try {
      await apiRequest(editing ? `/api/patients/${editing.patient_id}` : '/api/patients', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(values),
      });
      setFormOpen(false);
      setEditing(null);
      refresh();
      Alert.alert('Saved', editing ? 'Patient details updated.' : 'Patient registered.');
    } catch (saveError) {
      Alert.alert('Could not save patient', saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (patient) => confirmDelete(
    `Delete ${patient.name}? Their appointments and records will also be deleted.`,
    async () => {
      try {
        await apiRequest(`/api/patients/${patient.patient_id}`, { method: 'DELETE' });
        refresh();
        Alert.alert('Deleted', 'Patient and related data deleted.');
      } catch (deleteError) {
        Alert.alert('Could not delete patient', deleteError.message);
      }
    },
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.patient_id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <>
            <PageTitle title="Patients" subtitle={`${items.length} registered patient${items.length === 1 ? '' : 's'}`} onAdd={() => { setEditing(null); setFormOpen(true); }} />
            <View style={styles.actions}>
              <ActionButton label="Export CSV" icon="share-outline" onPress={() => exportRows(filtered, 'Patients', patientColumns, 'csv')} />
              <ActionButton label="Export PDF" icon="document-text-outline" onPress={() => exportRows(filtered, 'Patients', patientColumns, 'pdf')} />
            </View>
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search name, phone, email" />
            <LoadState loading={loading} error={error} onRetry={refresh} />
          </>
        )}
        ListEmptyComponent={!loading && !error ? <EmptyState title={search ? 'No matches' : 'No patients yet'} message={search ? 'Try a different name, phone, or email.' : 'Register your first patient to get started.'} icon="people-outline" /> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.badgeText}>ID {item.patient_id}</Text>
            </View>
            <Text style={styles.cardText}>{item.gender} · {item.age} years</Text>
            <Text style={styles.cardText}>{item.phone}{item.email ? ` · ${item.email}` : ''}</Text>
            {item.address ? <Text style={styles.cardText}>{item.address}</Text> : null}
            <View style={styles.actions}>
              <ActionButton label="Edit" icon="create-outline" onPress={() => { setEditing(item); setFormOpen(true); }} />
              <ActionButton label="Delete" icon="trash-outline" danger onPress={() => remove(item)} />
            </View>
          </View>
        )}
      />
      <FormModal visible={formOpen} title={editing ? 'Edit patient' : 'Register patient'} fields={patientFields} initialValues={editing || EMPTY} onClose={() => setFormOpen(false)} onSave={save} saving={saving} />
    </View>
  );
}

export function DoctorsScreen({ route, navigation }) {
  const { items, loading, error, refresh } = useApiList('/api/doctors', 'doctors');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => [item.name, item.specialization, item.phone, item.email].some((value) => String(value || '').toLowerCase().includes(term))) : items;
  }, [items, search]);

  React.useEffect(() => {
    if (route.params?.openCreate) {
      setEditing(null);
      setFormOpen(true);
      navigation.setParams({ openCreate: false });
    }
  }, [route.params?.openCreate, navigation]);

  const save = async (values) => {
    setSaving(true);
    try {
      await apiRequest(editing ? `/api/doctors/${editing.doctor_id}` : '/api/doctors', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(values),
      });
      setFormOpen(false);
      setEditing(null);
      refresh();
      Alert.alert('Saved', editing ? 'Doctor details updated.' : 'Doctor added.');
    } catch (saveError) {
      Alert.alert('Could not save doctor', saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (doctor) => confirmDelete(
    `Delete ${doctor.name}? Their appointments and records will also be deleted.`,
    async () => {
      try {
        await apiRequest(`/api/doctors/${doctor.doctor_id}`, { method: 'DELETE' });
        refresh();
        Alert.alert('Deleted', 'Doctor and related data deleted.');
      } catch (deleteError) {
        Alert.alert('Could not delete doctor', deleteError.message);
      }
    },
  );

  return (
    <View style={styles.page}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.doctor_id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <>
            <PageTitle title="Doctors" subtitle={`${items.length} care professional${items.length === 1 ? '' : 's'}`} onAdd={() => { setEditing(null); setFormOpen(true); }} />
            <View style={styles.actions}>
              <ActionButton label="Export CSV" icon="share-outline" onPress={() => exportRows(filtered, 'Doctors', doctorColumns, 'csv')} />
              <ActionButton label="Export PDF" icon="document-text-outline" onPress={() => exportRows(filtered, 'Doctors', doctorColumns, 'pdf')} />
            </View>
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search doctor or specialty" />
            <LoadState loading={loading} error={error} onRetry={refresh} />
          </>
        )}
        ListEmptyComponent={!loading && !error ? <EmptyState title={search ? 'No matches' : 'No doctors yet'} message={search ? 'Try another name or specialty.' : 'Add a doctor to manage the care team.'} icon="medkit-outline" /> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.badgeText}>ID {item.doctor_id}</Text>
            </View>
            <Text style={styles.cardText}>{item.specialization}</Text>
            <Text style={styles.cardText}>{item.phone}{item.email ? ` · ${item.email}` : ''}</Text>
            <View style={styles.actions}>
              <ActionButton label="Edit" icon="create-outline" onPress={() => { setEditing(item); setFormOpen(true); }} />
              <ActionButton label="Delete" icon="trash-outline" danger onPress={() => remove(item)} />
            </View>
          </View>
        )}
      />
      <FormModal visible={formOpen} title={editing ? 'Edit doctor' : 'Add doctor'} fields={doctorFields} initialValues={editing || EMPTY} onClose={() => setFormOpen(false)} onSave={save} saving={saving} />
    </View>
  );
}

function ReceiptModal({ appointment, onClose }) {
  if (!appointment) return null;
  const shareReceipt = async () => {
    const receipt = [
      'METACARE · APPOINTMENT RECEIPT',
      `Appointment #${appointment.appointment_id}`,
      `Patient: ${appointment.patient}`,
      `Doctor: ${appointment.doctor}`,
      `Specialty: ${appointment.specialization || '—'}`,
      `Date: ${displayDate(appointment.appointment_date)}`,
      `Time: ${displayTime(appointment.appointment_time)}`,
      `Status: ${appointment.status}`,
      `Reason: ${appointment.reason || 'Not specified'}`,
    ].join('\n');
    await Share.share({ title: 'Appointment receipt', message: receipt });
  };
  const savePdf = async () => {
    const safe = (value) => String(value || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const file = await Print.printToFileAsync({
      html: `<html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial;color:#152638;padding:30px}header{background:#087e8b;color:white;padding:24px;border-radius:14px}h1{margin:0 0 5px}.details{margin-top:24px;border:1px solid #dce5ed;border-radius:12px;padding:20px}p{line-height:1.6}.label{color:#718096}</style><header><h1>MetaCare</h1>Appointment receipt · #${appointment.appointment_id}</header><div class="details"><p><span class="label">Patient</span><br><b>${safe(appointment.patient)}</b></p><p><span class="label">Care provider</span><br><b>${safe(appointment.doctor)}</b> · ${safe(appointment.specialization)}</p><p><span class="label">Date and time</span><br><b>${safe(displayDate(appointment.appointment_date))} · ${safe(displayTime(appointment.appointment_time))}</b></p><p><span class="label">Status</span><br>${safe(appointment.status)}</p><p><span class="label">Reason</span><br>${safe(appointment.reason)}</p></div></html>`,
    });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Appointment receipt' });
    else Alert.alert('Receipt saved', `PDF created at ${file.uri}`);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Appointment receipt</Text>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}><Ionicons name="close" size={21} color={colors.ink} /></TouchableOpacity>
          </View>
          <View style={styles.surface}>
            <Text style={styles.eyebrow}>APPOINTMENT #{appointment.appointment_id}</Text>
            <Text style={styles.cardTitle}>{appointment.patient}</Text>
            <Text style={styles.cardText}>Care provider · {appointment.doctor}</Text>
            <Text style={styles.cardText}>{appointment.specialization}</Text>
            <View style={styles.divider} />
            <Text style={styles.cardText}>Date · {displayDate(appointment.appointment_date)}</Text>
            <Text style={styles.cardText}>Time · {displayTime(appointment.appointment_time)}</Text>
            <Text style={styles.cardText}>Status · {appointment.status}</Text>
            <Text style={styles.cardText}>Reason · {appointment.reason || 'Not specified'}</Text>
          </View>
          <View style={styles.actions}>
            <ActionButton label="Share receipt" icon="share-outline" onPress={() => shareReceipt().catch((error) => Alert.alert('Could not share receipt', error.message))} />
            <ActionButton label="Save PDF" icon="document-text-outline" onPress={() => savePdf().catch((error) => Alert.alert('Could not create PDF', error.message))} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AppointmentsScreen() {
  const { items: appointments, loading, error, refresh } = useApiList('/api/appointments', 'appointments');
  const { items: patients } = useApiList('/api/patients', 'patients');
  const { items: doctors } = useApiList('/api/doctors', 'doctors');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [receipt, setReceipt] = useState(null);

  const fields = useMemo(() => [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, placeholder: 'Choose patient', options: patients.map((item) => ({ label: `${item.name} · #${item.patient_id}`, value: item.patient_id })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', required: true, placeholder: 'Choose doctor', options: doctors.map((item) => ({ label: `${item.name} · ${item.specialization}`, value: item.doctor_id })) },
    { key: 'appointment_date', label: 'Date', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'appointment_time', label: 'Time', required: true, placeholder: 'HH:MM (24-hour)' },
    { key: 'reason', label: 'Reason for visit', multiline: true },
  ], [patients, doctors]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments.filter((item) => (
      (statusFilter === 'All' || item.status === statusFilter)
      && (!term || [item.patient, item.doctor, item.specialization, item.reason, item.appointment_date].some((value) => String(value || '').toLowerCase().includes(term)))
    ));
  }, [appointments, search, statusFilter]);

  const book = async (values) => {
    setSaving(true);
    try {
      await apiRequest('/api/appointments', { method: 'POST', body: JSON.stringify(values) });
      setFormOpen(false);
      refresh();
      Alert.alert('Booked', 'Appointment booked successfully.');
    } catch (saveError) {
      Alert.alert('Could not book appointment', saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (appointment, status) => {
    if (status === appointment.status) return;
    try {
      await apiRequest(`/api/appointments/${appointment.appointment_id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      refresh();
    } catch (updateError) {
      Alert.alert('Could not update status', updateError.message);
      refresh();
    }
  };

  const remove = (appointment) => confirmDelete(
    `Delete appointment #${appointment.appointment_id} for ${appointment.patient}?`,
    async () => {
      try {
        await apiRequest(`/api/appointments/${appointment.appointment_id}`, { method: 'DELETE' });
        refresh();
        Alert.alert('Deleted', 'Appointment deleted.');
      } catch (deleteError) {
        Alert.alert('Could not delete appointment', deleteError.message);
      }
    },
  );

  const appointmentColumns = [
    { key: 'appointment_id', label: 'ID' },
    { key: 'appointment_date', label: 'Date' },
    { key: 'appointment_time', label: 'Time' },
    { key: 'patient', label: 'Patient' },
    { key: 'doctor', label: 'Doctor' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <View style={styles.page}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.appointment_id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <>
            <PageTitle title="Appointments" subtitle={`${appointments.length} visits · book, update or review`} onAdd={() => setFormOpen(true)} addLabel="Book" />
            <View style={styles.actions}>
              <ActionButton label="Export CSV" icon="share-outline" onPress={() => exportRows(filtered, 'Appointments', appointmentColumns, 'csv')} />
              <ActionButton label="Export PDF" icon="document-text-outline" onPress={() => exportRows(filtered, 'Appointments', appointmentColumns, 'pdf')} />
            </View>
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search patient, doctor or reason" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {['All', ...statuses].map((status) => (
                <TouchableOpacity key={status} onPress={() => setStatusFilter(status)} style={[styles.badge, { marginRight: 7, backgroundColor: statusFilter === status ? colors.primary : colors.surface }]}>
                  <Text style={[styles.badgeText, { color: statusFilter === status ? '#fff' : colors.muted }]}>{status}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <LoadState loading={loading} error={error} onRetry={refresh} />
            {!patients.length || !doctors.length ? (
              <View style={styles.errorBox}><Text style={styles.errorText}>Add at least one patient and one doctor before booking an appointment.</Text></View>
            ) : null}
          </>
        )}
        ListEmptyComponent={!loading && !error ? <EmptyState title="No appointments found" message="Try changing the search or status filter, or book an appointment." icon="calendar-outline" /> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.patient}</Text>
              <Text style={[styles.badgeText, { color: item.status === 'Cancelled' ? colors.danger : item.status === 'Completed' ? colors.success : colors.primaryDark }]}>{item.status}</Text>
            </View>
            <Text style={styles.cardText}>{displayDate(item.appointment_date)} · {displayTime(item.appointment_time)}</Text>
            <Text style={styles.cardText}>{item.doctor} · {item.specialization}</Text>
            <Text style={styles.cardText}>{item.reason || 'No reason recorded'}</Text>
            <View style={[styles.inline, { marginTop: 9 }]}>
              <Text style={[styles.metricLabel, { width: 56 }]}>Status</Text>
              <View style={[styles.picker, styles.statusPicker]}>
                <Picker selectedValue={item.status} onValueChange={(value) => changeStatus(item, value)} style={{ height: 40 }}>
                  {statuses.map((status) => <Picker.Item key={status} label={status} value={status} />)}
                </Picker>
              </View>
            </View>
            <View style={styles.actions}>
              <ActionButton label="Receipt" icon="receipt-outline" onPress={() => setReceipt(item)} />
              <ActionButton label="Delete" icon="trash-outline" danger onPress={() => remove(item)} />
            </View>
          </View>
        )}
      />
      <FormModal visible={formOpen} title="Book an appointment" fields={fields} initialValues={EMPTY} onClose={() => setFormOpen(false)} onSave={book} saving={saving} />
      <ReceiptModal appointment={receipt} onClose={() => setReceipt(null)} />
    </View>
  );
}

export function RecordsScreen({ route, navigation }) {
  const { items: records, loading, error, refresh } = useApiList('/api/records', 'records');
  const { items: patients } = useApiList('/api/patients', 'patients');
  const { items: doctors } = useApiList('/api/doctors', 'doctors');
  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => filter ? records.filter((item) => String(item.patient_id) === String(filter)) : records, [records, filter]);

  React.useEffect(() => {
    if (route.params?.openCreate) {
      setFormOpen(true);
      navigation.setParams({ openCreate: false });
    }
  }, [route.params?.openCreate, navigation]);

  const fields = useMemo(() => [
    { key: 'patient_id', label: 'Patient', type: 'select', required: true, placeholder: 'Choose patient', options: patients.map((item) => ({ label: `${item.name} · #${item.patient_id}`, value: item.patient_id })) },
    { key: 'doctor_id', label: 'Doctor', type: 'select', required: true, placeholder: 'Choose doctor', options: doctors.map((item) => ({ label: item.name, value: item.doctor_id })) },
    { key: 'record_date', label: 'Record date', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'diagnosis', label: 'Diagnosis', required: true, multiline: true },
    { key: 'prescription', label: 'Prescription', multiline: true },
  ], [patients, doctors]);

  const save = async (values) => {
    setSaving(true);
    try {
      await apiRequest('/api/records', { method: 'POST', body: JSON.stringify(values) });
      setFormOpen(false);
      refresh();
      Alert.alert('Saved', 'Medical record added.');
    } catch (saveError) {
      Alert.alert('Could not save record', saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (record) => confirmDelete(
    `Delete the medical record for ${record.patient}?`,
    async () => {
      try {
        await apiRequest(`/api/records/${record.record_id}`, { method: 'DELETE' });
        refresh();
        Alert.alert('Deleted', 'Medical record deleted.');
      } catch (deleteError) {
        Alert.alert('Could not delete record', deleteError.message);
      }
    },
  );

  const recordColumns = [
    { key: 'record_date', label: 'Date' },
    { key: 'patient', label: 'Patient' },
    { key: 'doctor', label: 'Doctor' },
    { key: 'diagnosis', label: 'Diagnosis' },
    { key: 'prescription', label: 'Prescription' },
  ];

  return (
    <View style={styles.page}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.record_id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <>
            <PageTitle title="Medical records" subtitle={`${filtered.length} record${filtered.length === 1 ? '' : 's'} · patient history`} onAdd={() => setFormOpen(true)} addLabel="Add record" />
            <View style={styles.actions}>
              <ActionButton label="Export CSV" icon="share-outline" onPress={() => exportRows(filtered, 'Medical records', recordColumns, 'csv')} />
              <ActionButton label="Export PDF" icon="document-text-outline" onPress={() => exportRows(filtered, 'Medical records', recordColumns, 'pdf')} />
            </View>
            <View style={[styles.picker, { marginBottom: 12 }]}>
              <Picker selectedValue={filter} onValueChange={setFilter}>
                <Picker.Item label="All patients" value="" />
                {patients.map((patient) => <Picker.Item key={patient.patient_id} label={patient.name} value={String(patient.patient_id)} />)}
              </Picker>
            </View>
            <LoadState loading={loading} error={error} onRetry={refresh} />
            {!patients.length || !doctors.length ? (
              <View style={styles.errorBox}><Text style={styles.errorText}>Add at least one patient and one doctor before adding a medical record.</Text></View>
            ) : null}
          </>
        )}
        ListEmptyComponent={!loading && !error ? <EmptyState title="No records found" message="Choose a different patient or add a new medical record." icon="document-text-outline" /> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.patient}</Text>
              <Text style={styles.badgeText}>{displayDate(item.record_date)}</Text>
            </View>
            <Text style={styles.cardText}>Care provider · {item.doctor}</Text>
            <Text style={styles.cardText}>Diagnosis · {item.diagnosis}</Text>
            <Text style={styles.cardText}>Prescription · {item.prescription || 'None recorded'}</Text>
            <View style={styles.actions}>
              <ActionButton label="Delete record" icon="trash-outline" danger onPress={() => remove(item)} />
            </View>
          </View>
        )}
      />
      <FormModal visible={formOpen} title="Add medical record" fields={fields} initialValues={EMPTY} onClose={() => setFormOpen(false)} onSave={save} saving={saving} />
    </View>
  );
}
