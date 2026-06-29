# UW Analytics Foundation Architecture

## Goals
- Preserve the existing dashboard and tracking experience.
- Introduce a modular foundation using ES6 modules.
- Add a storage-backed assignment workflow with IndexedDB.

## Structure
- assets/css/app.css: shared styling for the new module layer.
- assets/js/app.js: bootstrap entry point.
- assets/js/storage.js: IndexedDB helper layer.
- assets/js/assignment.js: assignment/audit model and persistence helpers.
- assets/js/policyLookup.js: policy loading and lookup helpers.
- assets/js/ui.js: assign-tab UI interactions.
