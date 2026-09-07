// Compatibility shim. New code must import Auth capabilities from features/auth.
export {
  getCurrentSession,
  signInWithPassword,
  signOutCurrentSession,
  subscribeAuthState,
} from '../features/auth'
