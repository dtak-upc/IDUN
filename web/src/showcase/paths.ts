/// <reference types="vite/client" />
export const publicBase = import.meta.env.BASE_URL;
export const publicFile = (path: string) => publicBase + path.replace(/^\/+/, '');
