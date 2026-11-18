// Registers the bench's module loader WITHOUT its headless stand-ins, so tests can import the
// real game store. (module.register copies process.env into the hooks thread at this point.)
process.env.LOADER_NO_STUBS = '1';
const { register } = await import('node:module');
register('../bench/loader.mjs', import.meta.url);
