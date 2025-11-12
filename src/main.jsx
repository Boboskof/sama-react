import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import 'flowbite'

const queryClient = new QueryClient();

const AppRoot = import.meta.env.DEV ? (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
) : (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);

createRoot(document.getElementById('root')).render(AppRoot)
