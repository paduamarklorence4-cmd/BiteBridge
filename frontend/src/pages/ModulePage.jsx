// Temporary page for modules whose backend is not built yet. It has no fake data and no dead buttons.
export default function ModulePage({ title }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="st-sub">This module is not available yet.</p>
      <div className="st-card st-notice">
        <p style={{ margin: 0 }}>
          The {title.toLowerCase()} page will appear here once its backend is added. Nothing on this page is saved or
          sample data.
        </p>
      </div>
    </>
  )
}