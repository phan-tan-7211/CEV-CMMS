let pendingCreateAction: string | null = null

export function setPendingCreateAction(action: string) {
  pendingCreateAction = action
}

export function consumePendingCreateAction() {
  const action = pendingCreateAction
  pendingCreateAction = null
  return action
}
