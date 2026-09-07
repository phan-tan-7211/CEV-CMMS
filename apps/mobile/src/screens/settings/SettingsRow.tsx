import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type IconName = keyof typeof Ionicons.glyphMap

type Props = {
  icon: IconName
  label: string
  value?: string
  onPress?: () => void
  toggleValue?: boolean
  onToggle?: (value: boolean) => void
  destructive?: boolean
  disabled?: boolean
}

export function SettingsRow({ icon, label, value, onPress, toggleValue, onToggle, destructive, disabled }: Props) {
  const isToggle = typeof toggleValue === 'boolean' && Boolean(onToggle)
  return (
    <Pressable
      accessibilityRole={isToggle ? undefined : 'button'}
      disabled={disabled || isToggle}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={19} color={destructive ? '#D92D20' : '#475467'} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, destructive && styles.danger]}>{label}</Text>
        {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      </View>
      {isToggle ? (
        <Switch value={toggleValue} onValueChange={onToggle} trackColor={{ false: '#D0D5DD', true: '#84ADFF' }} thumbColor={toggleValue ? '#155EEF' : '#F2F4F7'} />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={21} color="#B0B7C3" />
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  pressed: { backgroundColor: '#F9FAFB' },
  disabled: { opacity: 0.58 },
  iconWrap: { width: 34, height: 34, marginRight: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  iconWrapDanger: { backgroundColor: '#FEF3F2' },
  copy: { flex: 1, minWidth: 0, paddingRight: 10 },
  label: { fontSize: 14.5, lineHeight: 19, fontWeight: '700', color: '#1D2939' },
  value: { marginTop: 2, fontSize: 11.5, lineHeight: 15, color: '#98A2B3' },
  danger: { color: '#D92D20' },
})