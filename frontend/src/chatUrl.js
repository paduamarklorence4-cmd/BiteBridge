// One source of truth for the public chatbot address.
// The homepage buttons and the QR code both use this, so they always lead to the same place.
// For printed posters, set VITE_PUBLIC_URL in frontend/.env to the deployed website, e.g.
//   VITE_PUBLIC_URL=https://your-deployed-site.example
export const CHAT_PATH = '/chat'

const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '')
export const CHAT_URL = `${base}${CHAT_PATH}`