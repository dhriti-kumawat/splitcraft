// Entry for the CDN script tag (splitcraft.iife.js → window.splitcraft). The same public
// API as the npm package minus npm-only parts (init, variant / ready / subscribe), which
// keeps the file inside its budget. The script starts itself from its data-project.
export {
  activate,
  injectStyles,
  isEnabled,
  onceInView,
  onRouteChange,
  start,
  trackEvent,
  VERSION,
  waitForElement,
} from './index';
