import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter, queryClient } from './config/appkit';
import { PaymentProvider, usePayment } from './context/PaymentContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Stepper } from './components/Stepper';
import { Step1Recipient } from './components/Step1Recipient';
import { Step2Details } from './components/Step2Details';
import { Step3Sending } from './components/Step3Sending';
import { Step4Complete } from './components/Step4Complete';
import { NetworkSelectorModal } from './components/NetworkSelectorModal';
import { WalletModal } from './components/WalletModal';
import { ActivityModal } from './components/ActivityModal';

function MainContent() {
  const { currentStep } = usePayment();

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0b0f17] text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />
      <main className="max-w-xl mx-auto px-3 sm:px-4 pt-2 sm:pt-4 pb-12">
        <Stepper />
        {currentStep === 1 && <Step1Recipient />}
        {currentStep === 2 && <Step2Details />}
        {currentStep === 3 && <Step3Sending />}
        {currentStep === 4 && <Step4Complete />}
      </main>
      <NetworkSelectorModal />
      <WalletModal />
      <ActivityModal />
    </div>
  );
}

export function App() {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <PaymentProvider>
            <MainContent />
          </PaymentProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
