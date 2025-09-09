import React from 'react';

export default function MyComponent(): JSX.Element {
  const containerStyle: React.CSSProperties = {
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI Symbol', 'Noto Color Emoji', sans-serif",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: '24px',
    color: 'rgb(43, 43, 43)',
    backgroundColor: 'rgb(243, 245, 247)',
    minHeight: '100vh',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    padding: '0 16px',
    background: 'linear-gradient(135deg, rgb(27, 43, 60) 0%, rgb(58, 166, 255) 100%)',
    color: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  };

  const sidebarStyle: React.CSSProperties = {
    width: 256,
    backgroundColor: 'rgb(17, 28, 44)',
    color: '#fff',
    padding: 16,
    minHeight: 'calc(100vh - 64px)',
    boxSizing: 'border-box',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    padding: 24,
    boxSizing: 'border-box',
  };

  const layoutStyle: React.CSSProperties = {
    display: 'flex',
  };

  const linkStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 8,
    color: '#fff',
    textDecoration: 'none',
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png"
            alt="Zira Homes Logo"
            style={{ height: 24, objectFit: 'contain' }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Dashboard</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Property Management</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button aria-label="Notifications" style={{ height: 40, borderRadius: 10 }}>
            🔔
          </button>
          <button aria-label="Profile" style={{ height: 40, borderRadius: 10 }}>
            👤
          </button>
        </div>
      </header>

      <div style={layoutStyle}>
        <aside style={sidebarStyle}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
            <img
              src="/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png"
              alt="Zira Homes"
              style={{ height: 32, objectFit: 'contain' }}
            />
            <span style={{ marginLeft: 8, fontSize: 18, fontWeight: 600 }}>Zira Homes</span>
          </div>

          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>
                <a style={linkStyle} href="/">
                  <span>🏠</span>
                  <span>Dashboard</span>
                </a>
              </li>
              <li>
                <a style={linkStyle} href="/properties">
                  <span>🏘️</span>
                  <span>Properties</span>
                </a>
              </li>
              <li>
                <a style={linkStyle} href="/units">
                  <span>📦</span>
                  <span>Units</span>
                </a>
              </li>
              <li>
                <a style={linkStyle} href="/tenants">
                  <span>👥</span>
                  <span>Tenants</span>
                </a>
              </li>
              <li>
                <a style={linkStyle} href="/leases">
                  <span>📄</span>
                  <span>Leases</span>
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        <main style={mainStyle}>
          <section style={{ maxWidth: 1200 }}>
            <h2 style={{ marginTop: 0 }}>Dashboard</h2>
            <p style={{ color: 'rgb(125,125,125)' }}>Welcome to Zira Homes property management system</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 24 }}>
              <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: 0 }}>Total Properties</h3>
                <p style={{ margin: 0, color: 'rgb(125,125,125)' }}>—</p>
              </div>

              <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: 0 }}>Active Tenants</h3>
                <p style={{ margin: 0, color: 'rgb(125,125,125)' }}>—</p>
              </div>

              <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: 0 }}>Total Units</h3>
                <p style={{ margin: 0, color: 'rgb(125,125,125)' }}>—</p>
              </div>

              <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: 0 }}>Monthly Revenue</h3>
                <p style={{ margin: 0, color: 'rgb(125,125,125)' }}>—</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
