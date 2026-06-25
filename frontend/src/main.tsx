import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '@/store';
import { TooltipProvider } from '@/components/Tooltip';
import { Toaster } from '@/components/Sonner';
import GlobalSpinner from '@/components/GlobalSpinner';
import './index.css';
import App from '@/App';

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
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter basename={import.meta.env.VITE_BASE_URL ?? '/'}>
                        <TooltipProvider delayDuration={200}>
                            <GlobalSpinner />
                            <App />
                            <Toaster richColors position="top-right" />
                        </TooltipProvider>
                    </BrowserRouter>
                </QueryClientProvider>
            </PersistGate>
        </Provider>
    </StrictMode>
);
