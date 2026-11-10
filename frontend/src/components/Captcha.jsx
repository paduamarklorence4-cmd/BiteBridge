import ReCAPTCHA from 'react-google-recaptcha'

export default function Captcha({ onVerified }) {
  return (
    <ReCAPTCHA
      sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
      onChange={(token) => onVerified(token || '')}
      onExpired={() => onVerified('')}
    />
  )
}