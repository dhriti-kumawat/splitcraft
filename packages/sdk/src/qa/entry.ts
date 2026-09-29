// Entry for the separate QA bundle (splitly-qa.iife.js). The IIFE build assigns
// these exports to `window.splitlyQa`, which `loadQaPanel` waits for.
export { mountQaPanel as mount } from './panel';
