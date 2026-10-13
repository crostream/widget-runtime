// Shipped .svelte files are preprocessed (the TypeScript in their scripts is
// compiled away), the usual practice for Svelte libraries.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess({ script: true }),
}
