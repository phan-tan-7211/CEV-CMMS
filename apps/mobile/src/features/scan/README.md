# Scan feature

This feature has two intentionally separate scanner modes:

- Smart Home Scan: resolves a scanned code through the scan search repository and routes workflow results.
- Simple Scanner: returns scanned text only and never performs a server lookup.

Do not merge these responsibilities. Forms and list barcode inputs should use Simple Scanner; Home/Operator quick lookup should use Smart Home Scan.
