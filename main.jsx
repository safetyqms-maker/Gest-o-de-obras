import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import Obras from './Obras.jsx';
import ObraDetalhe from './ObraDetalhe.jsx';
import Financeiro from './Financeiro.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="obras" element={<Obras />} />
          <Route path="obras/:id" element={<ObraDetalhe />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
