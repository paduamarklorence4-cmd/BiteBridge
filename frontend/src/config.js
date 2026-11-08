// Single source of truth for clinic information. Edit here only.
export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'
export const FACEBOOK_URL = import.meta.env.VITE_FACEBOOK_URL || 'https://www.facebook.com/search/top?q=EZ%20Animal%20Bite%20Clinic'

export const CLINIC = {
  name: 'EZ Animal Bite Center',
  phoneDisplay: '0948 983 8158',
  phoneLink: 'tel:+639489838158',
  smsLink: 'sms:+639489838158',
  email: 'ex.animalbitecenters@gmail.com',
  emailLink: 'mailto:ex.animalbitecenters@gmail.com',
  gmailLink: 'https://mail.google.com/mail/?view=cm&fs=1&to=ex.animalbitecenters@gmail.com',
  facebookName: 'EZ Animal Bite Clinic',
  address: 'C3 Road, Brgy. Sapul, Calapan City',
  mapsUrl:
    'https://maps.app.goo.gl/GaGSY9nhD2F24Mqd7',
  mapsEmbed:
    'https://www.google.com/maps?q=EZ+ABC%2C+C3+Road%2C+Brgy.+Sapul%2C+Calapan+City&output=embed',
}

// open/close in minutes from midnight, Philippine time. day: 0 = Sunday
export const HOURS = [
  { day: 'Monday', label: '8:00 AM–5:00 PM', dow: 1, open: 480, close: 1020 },
  { day: 'Tuesday', label: '8:00 AM–5:00 PM', dow: 2, open: 480, close: 1020 },
  { day: 'Wednesday', label: '8:00 AM–5:00 PM', dow: 3, open: 480, close: 1020 },
  { day: 'Thursday', label: '8:00 AM–5:00 PM', dow: 4, open: 480, close: 1020 },
  { day: 'Friday', label: '8:00 AM–5:00 PM', dow: 5, open: 480, close: 1020 },
  { day: 'Saturday', label: '8:00 AM–5:00 PM', dow: 6, open: 480, close: 1020 },
  { day: 'Sunday', label: '8:00 AM–12:00 NN', dow: 0, open: 480, close: 720 },
]

// IMPORTANT: confirm this list with the clinic before publishing.
export const SERVICES = [
  {
    icon: 'Stethoscope',
    title: 'Animal Bite Assessment',
    text: 'Have a bite or scratch from a dog, cat, or other animal checked by clinic staff.',
  },
  {
    icon: 'Droplets',
    title: 'Wound Care Guidance',
    text: 'Get advice on how wounds should be cleaned and cared for after an animal bite.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Rabies Exposure Information',
    text: 'Ask the clinic what a possible rabies exposure means and what steps to take next.',
  },
  {
    icon: 'MessageCircleQuestion',
    title: 'Questions and Follow-ups',
    text: 'Call or message the clinic if you have questions about your visit or schedule.',
  },
]

