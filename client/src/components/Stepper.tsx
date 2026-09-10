import React from 'react';
import { usePayment } from '../context/PaymentContext';
import { Check } from 'lucide-react';

export const Stepper: React.FC = () => {
  const { currentStep, setCurrentStep } = usePayment();

  const steps = [
    { number: 1, label: 'Recipient' },
    { number: 2, label: 'Details' },
    { number: 3, label: 'Review' }
  ];

  return (
    <div className="w-full max-w-sm mx-auto py-1 px-4 mb-5">
      <div className="flex items-center justify-between relative">
        {/* Background Connecting Line */}
        <div className="absolute top-3.5 left-8 right-8 h-[2px] bg-gray-200 dark:bg-[#2b3245] -z-0" />

        {/* Dynamic Completed Connecting Line (Green) */}
        <div 
          className="absolute top-3.5 left-8 h-[2px] bg-[#55db9c] transition-all duration-300 -z-0"
          style={{
            width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%'
          }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.number;
          const isActive = currentStep === step.number;

          return (
            <button
              key={step.number}
              onClick={() => setCurrentStep(step.number)}
              className="flex flex-col items-center group cursor-pointer relative z-10 transition-transform hover:scale-105"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-150 ${
                  isCompleted
                    ? 'bg-[#55db9c] text-white shadow-xs'
                    : isActive
                    ? 'bg-[#0052ff] text-white shadow-xs'
                    : 'bg-white dark:bg-[#151922] text-gray-400 dark:text-gray-500 border border-gray-300 dark:border-[#2b3245]'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-semibold transition-colors ${
                  isActive
                    ? 'text-gray-900 dark:text-white font-bold'
                    : isCompleted
                    ? 'text-gray-700 dark:text-gray-300 font-semibold'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};


