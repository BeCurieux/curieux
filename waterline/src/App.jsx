import useWaterline from './hooks/useWaterline.js'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import MarginsScreen from './components/screens/MarginsScreen.jsx'
import CostInputsScreen from './components/screens/CostInputsScreen.jsx'
import AlertsScreen from './components/screens/AlertsScreen.jsx'
import PlansScreen from './components/screens/PlansScreen.jsx'
import Drawer from './components/Drawer.jsx'
import Onboarding from './components/Onboarding.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  const v = useWaterline()
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: '#F1EFE9' }}>
      <Sidebar v={v} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#F1EFE9', position: 'relative' }}>
        <Topbar v={v} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 30px 40px' }}>
          {v.isNavMargins && <MarginsScreen v={v} />}
          {v.isNavCosts && <CostInputsScreen v={v} />}
          {v.isNavAlerts && <AlertsScreen v={v} />}
          {v.isNavPlans && <PlansScreen v={v} />}
        </div>

        {v.showDrawer && <Drawer v={v} />}
        {v.showToast && <Toast message={v.toast} />}
      </main>

      {v.onboarding && <Onboarding v={v} />}
    </div>
  )
}
