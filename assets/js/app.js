import { initializeStorage } from './storage.js';
import { loadPolicies } from './policyLookup.js';
import { initializeAssignmentUi } from './ui.js';
import { getAssignments } from './assignmentService.js';

async function bootstrap() {
  try {
    await initializeStorage();
    await loadPolicies();
    window.__assignmentStorage = { getAssignments };
    await initializeAssignmentUi();
    console.info('UW Analytics foundation initialized.');
  } catch (error) {
    console.error('Foundation bootstrap failed:', error);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('uw:bootstrap-error', { detail: error }));
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});
