// backend/frontend-mobile/global-polyfill.js
global.ReadableStream = class ReadableStream {
    constructor() {}
    getReader() { return { read: () => Promise.resolve({ done: true }) }; }
  };
  
  global.TextDecoder = class TextDecoder {
    decode() { return ''; }
  };
  
  global.TextEncoder = class TextEncoder {
    encode() { return new Uint8Array(); }
  };
  
  // Autres polyfills si nécessaire