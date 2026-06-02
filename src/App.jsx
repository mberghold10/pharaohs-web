import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Roster from './pages/Roster'
import Strategy from './pages/Strategy'
import Links from './pages/Links'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="roster" element={<Roster />} />
        <Route path="strategy" element={<Strategy />} />
        <Route path="links" element={<Links />} />
      </Route>
    </Routes>
  )
}
