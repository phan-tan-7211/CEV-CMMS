# Equipment API ownership

This folder owns Equipment data operations. Route screens do not import these files directly; they import from `../index.ts`.

Current responsibilities:

- `equipmentService.ts`: Equipment Master list/detail and status mutation orchestration.
- `equipmentImageService.ts`: bounded signed-photo URL cache and Storage URL resolution.
- `equipmentStatusService.ts`: Equipment status master RPC operations.
- `equipmentRegistrationService.ts`: Equipment creation plus optional photo upload orchestration.
