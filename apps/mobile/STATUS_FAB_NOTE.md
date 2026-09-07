# Equipment status add button

The Equipment Status screen keeps the add-status action as a fixed bottom-right FAB, matching the reference interaction.

Rules:
- the FAB stays anchored to the bottom-right of the visible screen;
- the scroll content reserves enough bottom padding for roughly one status row plus FAB clearance;
- when the status list is full, the user can scroll the last row above the FAB so Edit/Delete/Lock actions are never covered;
- the FAB opens only the create-status dialog; Edit/Delete remain row actions.
