import './App.css'
import ServerList from './components/ServerList'
import { useServerData } from './hooks/useServerData'

function App() {
  const { databases, loading, refreshing, error, lastFetched, retry } = useServerData()

  return (
    <div className="app">
      <ServerList
        databases={databases}
        loading={loading}
        refreshing={refreshing}
        error={error}
        lastFetched={lastFetched}
        onRetry={retry}
      />
    </div>
  )
}

export default App
