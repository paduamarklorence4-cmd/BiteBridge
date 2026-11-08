import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Menu, X, LogIn } from 'lucide-react'
import { CLINIC } from '../config'

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/services', label: 'Services' },
  { to: '/first-aid', label: 'First Aid Guide' },
  { to: '/location', label: 'Location' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/chat', label: 'Chat with Us' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(false)
  const [logoOk, setLogoOk] = useState(true)
  const { pathname } = useLocation()
  const overHero = pathname === '/' && !solid && !open

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`nav ${overHero ? 'nav-clear' : 'nav-solid'}`}>
      <div className="container nav-inner">
        <Link to="/" className="brand" aria-label={`${CLINIC.name} home`}>
          {logoOk && (
            <img
              src="/images/ez-animal-bite-center-logo.png"
              alt=""
              className="brand-logo"
              onError={() => setLogoOk(false)}
            />
          )}
          <span className="brand-text">
            <span className="brand-ez">EZ</span> Animal Bite Center
          </span>
        </Link>

        <nav id="main-nav" className={`nav-links ${open ? 'is-open' : ''}`} aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
          <Link to="/staff-login" className="btn btn-sm btn-light nav-login">
            <LogIn size={16} strokeWidth={1.75} aria-hidden="true" /> Staff Login
          </Link>
        </nav>

        <button
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>
  )
}

