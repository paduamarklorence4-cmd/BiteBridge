import ResourcePage, { Badge } from '../components/ResourcePage'
import TabbedPage from '../components/TabbedPage'

const settings = {
  title: 'Settings',
  subtitle: 'System settings. Be careful: some values (such as observation_days and near_expiry_days) change how alerts are calculated. Check contact details with the center before changing them.',
  singular: 'setting',
  base: '/settings',
  perms: { view: 'settings.manage', manage: 'settings.manage' },
  searchPlaceholder: 'Search key or value',
  columns: [
    { key: 'setting_key', label: 'Key', render: (r) => <code>{r.setting_key}</code> },
    { key: 'setting_value', label: 'Value', render: (r) => (r.setting_value?.length > 70 ? `${r.setting_value.slice(0, 70)}…` : r.setting_value || '—') },
    { key: 'is_public', label: 'Public', render: (r) => (Number(r.is_public) === 1 ? <Badge tone="amber">Public</Badge> : <Badge tone="gray">Private</Badge>) },
    { key: 'updated_at', label: 'Updated', type: 'datetime' },
    { key: 'updated_by_name', label: 'Updated by' },
  ],
  fields: [
    { key: 'setting_key', label: 'Key', type: 'text', maxLength: 80, required: true, createOnly: true, hint: 'Lowercase letters, numbers, and underscores. It cannot be changed later.' },
    { key: 'setting_value', label: 'Value', type: 'textarea' },
    { key: 'is_public', label: 'Visibility', type: 'select', options: [{ value: '0', label: 'Private' }, { value: '1', label: 'Public (may be shown on the website)' }] },
  ],
  details: [
    { key: 'setting_key', label: 'Key' }, { key: 'setting_value', label: 'Value' },
    { key: 'is_public', label: 'Public', type: 'bool' }, { key: 'updated_at', label: 'Updated', type: 'datetime' }, { key: 'updated_by_name', label: 'Updated by' },
  ],
}

const activity = {
  title: 'Activity log',
  subtitle: 'Important actions taken in the system (read only).',
  singular: 'entry',
  base: '/activity',
  readOnly: true,
  noView: true,
  perms: { view: 'activity.view', manage: 'activity.view' },
  searchPlaceholder: 'Search user, action, module, or description',
  columns: [
    { key: 'created_at', label: 'When', type: 'datetime' },
    { key: 'username', label: 'User' },
    { key: 'action', label: 'Action' },
    { key: 'module', label: 'Module' },
    { key: 'description', label: 'Description' },
    { key: 'ip_address', label: 'IP address' },
  ],
  fields: [],
  details: [],
}

export default function SettingsPage() {
  return (
    <TabbedPage tabs={[
      { key: 'settings', label: 'Settings', perm: 'settings.manage', element: <ResourcePage cfg={settings} /> },
      { key: 'activity', label: 'Activity log', perm: 'activity.view', element: <ResourcePage cfg={activity} /> },
    ]} />
  )
}