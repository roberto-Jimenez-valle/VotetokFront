// Minimal shim for topojson-client to satisfy TypeScript in SvelteKit
// You can replace this with `@types/topojson-client` for better typings.
declare module 'topojson-client' {
  // We only use `feature` in this project (see src/lib/GlobeGL.svelte).
  // Keep it typed as `any` to avoid pulling extra type deps.
  export function feature(topology: any, object: any): any;
  // Add other exports as needed, e.g.:
  // export function mesh(topology: any, object: any, filter?: any): any;
}
