# Smart Home Scan flow

Home scan is a workflow lookup, not a form input scanner.

## Entry points

- Home quick action `Quét` -> normal smart scan flow.
- Operator center bottom-nav scan -> smart scan with `operatorFlow=true`.

## Routing contract

`camera/manual code -> scanSearch -> server lookup + Request Portal settings -> loading sheet -> result router`

Supported result states in the mobile contract:

1. `not-found`
2. `asset`
3. `part`
4. `multiple`
5. `request-portal-asset`
6. `request-portal-multiple`

Loading is a separate UI state before a result is available.

Current production adapter can resolve canonical Equipment IDs only. Part, mixed-result, and Request Portal branches remain structurally available but must not fabricate data until their backend contracts exist.

## Operator behavior

- Asset result: open Equipment Detail directly, without the result sheet.
- Unsupported/not-found result: show a short message and re-enable scan after the configured delay.

## Simple scanner

`SimpleScannerScreen` is intentionally separate: it only returns scanned text to its caller and performs no lookup.
