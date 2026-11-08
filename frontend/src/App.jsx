import { Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import FloatingChat from './components/FloatingChat'
import Home from './pages/Home'
import About from './pages/About'
import Services from './pages/Services'
import FirstAid from './pages/FirstAid'
import Location from './pages/Location'
import Contact from './pages/Contact'
import Chat from './pages/Chat'
import Privacy from './pages/Privacy'
import StaffLogin from './pages/StaffLogin'
import Dashboard from './pages/Dashboard'
import ModulePage from './pages/ModulePage'
import Patients from './pages/Patients'
import Incidents from './pages/Incidents'
import Assessments from './pages/Assessments'
import Treatments from './pages/Treatments'
import Vaccination from './pages/Vaccination'
import Monitoring from './pages/Monitoring'
import Appointments from './pages/Appointments'
import Inventory from './pages/Inventory'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import ChatReviews from './pages/ChatReviews'
import UserAccounts from './pages/UserAccounts'
import SettingsPage from './pages/SettingsPage'
import StaffLayout from './layouts/StaffLayout'
import { STAFF_NAV } from './staffNav'

// Pages that are built. Every other staff link shows a "not available yet" page.
const STAFF_PAGES = {
  '/patients': Patients,
  '/incidents': Incidents,
  '/assessments': Assessments,
  '/treatments': Treatments,
  '/vaccinations': Vaccination,
  '/monitoring': Monitoring,
  '/appointments': Appointments,
  '/inventory': Inventory,
  '/billing': Billing,
  '/reports': Reports,
  '/chatbot-reviews': ChatReviews,
  '/users': UserAccounts,
  '/settings': SettingsPage,
}

function ScrollTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Ina-update ang --sy (posisyon ng scroll) para sa parallax ng hero at page header.
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--sy', `${window.scrollY}px`)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return null
}

function PublicLayout() {
  return (
    <>
      <a href="#content" className="skip">Skip to main content</a>
      <Navbar />
      <main id="content">
        <Outlet />
      </main>
      <Footer />
      <FloatingChat />
    </>
  )
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/first-aid" element={<FirstAid />} />
          <Route path="/location" element={<Location />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/staff-login" element={<StaffLogin />} />
        </Route>

        <Route element={<StaffLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {STAFF_NAV.filter((i) => i.to !== '/dashboard').map((i) => {
            const Page = STAFF_PAGES[i.to]
            return <Route key={i.to} path={i.to} element={Page ? <Page /> : <ModulePage title={i.label} />} />
          })}
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </>
  )
}