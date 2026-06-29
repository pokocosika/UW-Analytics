import { initializeStorage } from './storage.js';
import { loadPolicies } from './policyLookup.js';
import { initializeAssignmentUi } from './ui.js';

async function bootstrap() {
  try {
    await initializeStorage();
    await loadPolicies();
    await initializeAssignmentUi();
    console.info('UW Analytics foundation initialized.');
  } catch (error) {
    console.error('Foundation bootstrap failed:', error);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});
