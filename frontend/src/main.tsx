import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import './index.css';
import App from './App.tsx';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Live-ops dashboard: keep data fresh, don't spam on focus.
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5_000,
        },
    },
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <TooltipProvider delayDuration={200}>
                    <App />
                    <Toaster richColors position="top-right" />
                </TooltipProvider>
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>
);
