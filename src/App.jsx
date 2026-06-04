import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Roster from './pages/Roster'
import Strategy from './pages/Strategy'
import Links from './pages/Links'
import History from './pages/History'
import Jerseys from './pages/Jerseys'
import Contribute from './pages/Contribute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="roster" element={<Roster />} />
        <Route path="strategy" element={<Strategy />} />
        <Route path="links" element={<Links />} />
        <Route path="history" element={<History />} />
        <Route path="jerseys" element={<Jerseys />} />
        <Route path="contribute" element={<Contribute />} />
      </Route>
    </Routes>
  )
}
