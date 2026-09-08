import Sidebar, { BottomTabBar } from './_components/Sidebar'
import Topbar from './_components/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#080E1A', color: '#F4F7FB' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main className="st-main-wrap" style={{ flex: 1, overflowY: 'auto', background: '#080E1A' }}>
          <div className="st-dashboard-shell">{children}</div>
        </main>
      </div>
      <BottomTabBar />
    </div>
  )
}
