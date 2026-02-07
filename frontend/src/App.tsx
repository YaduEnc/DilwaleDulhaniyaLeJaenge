import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import InterestsPage from './pages/InterestsPage'
import ChatPage from './pages/ChatPage'

function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/interests" element={<InterestsPage />} />
            <Route path="/chat" element={<ChatPage />} />
        </Routes>
    )
}

export default App
