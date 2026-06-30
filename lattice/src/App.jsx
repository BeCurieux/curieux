import useLattice from './hooks/useLattice.js'
import Topbar from './components/Topbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toast from './components/Toast.jsx'
import HomeScreen from './components/screens/HomeScreen.jsx'
import BundlesScreen from './components/screens/BundlesScreen.jsx'
import FeedsScreen from './components/screens/FeedsScreen.jsx'
import SubsScreen from './components/screens/SubsScreen.jsx'
import InventoryScreen from './components/screens/InventoryScreen.jsx'
import PerformanceScreen from './components/screens/PerformanceScreen.jsx'
import AnalyticsScreen from './components/screens/AnalyticsScreen.jsx'
import { SHADOW_APP } from './lib/styles.js'

export default function App() {
  const v = useLattice()
  return (
    <div
      style={{
        width: 1340, maxWidth: '100%', margin: '28px auto', borderRadius: 16, overflow: 'hidden',
        // a barely-there vertical blush keeps the warm card feeling soft
        background: 'linear-gradient(180deg,#f6f0ea 0%,#f4efe7 38%)',
        boxShadow: SHADOW_APP, position: 'relative',
      }}
    >
      <Topbar v={v} />
      <div style={{ display: 'flex' }}>
        <Sidebar v={v} />
        <div style={{ flex: 1, minWidth: 0, padding: '28px 32px' }}>
          {v.isHome && <HomeScreen v={v} />}
          {v.isBundles && <BundlesScreen v={v} />}
          {v.isFeeds && <FeedsScreen v={v} />}
          {v.isSubs && <SubsScreen v={v} />}
          {v.isInventory && <InventoryScreen v={v} />}
          {v.isPerformance && <PerformanceScreen v={v} />}
          {v.isAnalytics && <AnalyticsScreen v={v} />}
        </div>
      </div>
      {v.showToast && <Toast message={v.toast} />}
    </div>
  )
}
