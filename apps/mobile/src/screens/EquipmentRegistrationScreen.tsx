import App from '../../App'

/**
 * Transitional screen boundary for the existing equipment registration flow.
 * The large legacy App.tsx form stays behavior-identical for this batch while
 * navigation and Home are split into screen modules. The form internals can be
 * extracted incrementally without coupling Home/navigation to them.
 */
export function EquipmentRegistrationScreen() {
  return <App />
}
