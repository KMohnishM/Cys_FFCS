import React from 'react';
import Link from 'next/link';
import { UserProgress } from '../lib/useAuthGuard';

interface WorkflowStepsProps {
  currentStep: UserProgress | null;
  showLinks?: boolean;
  animate?: boolean;
  showDetails?: boolean;
}

const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ 
  currentStep,
  showLinks = true,
  animate = true,
  showDetails = false
}) => {
  return (
    <div className="p-4 bg-black/30 rounded-lg border border-cyscom/20">
      <h3 className="text-lg font-medium text-white mb-5">
        <span className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-cyscom" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          Cyscom FFCS Workflow
        </span>
      </h3>
      
      {!showDetails ? (
        // Horizontal timeline view (default)
        <div className="relative flex flex-col md:flex-row items-start justify-between">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-5 left-12 w-[calc(100%-6rem)] h-0.5 bg-gray-700"></div>
          
          {/* Step 1: Departments */}
          <div className={`relative z-10 w-full md:w-28 flex items-center md:flex-col md:items-center mb-3 md:mb-0 ${animate ? 'group' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium 
              ${currentStep === UserProgress.NEEDS_DEPARTMENTS || currentStep === null 
                ? 'bg-cyscom text-black animate-pulse' 
                : 'bg-cyscom text-black'} 
              ${animate ? 'group-hover:scale-110 transition-transform duration-300' : ''}`}
            >
              1
            </div>
            <div className="ml-3 md:ml-0 md:mt-2 text-sm text-white">
              {showLinks ? (
                <Link href="/departments" className={`${animate ? 'hover:text-cyscom transition-colors duration-200' : ''}`}>
                  Choose Departments
                </Link>
              ) : (
                <span>Choose Departments</span>
              )}
            </div>
            {currentStep === UserProgress.NEEDS_DEPARTMENTS && (
              <span className="absolute -top-3 -right-3 md:-top-2 md:-right-2 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyscom opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-cyscom items-center justify-center text-black text-xs">!</span>
              </span>
            )}
          </div>
          
          {/* Step 2: Projects */}
          <div className={`relative z-10 w-full md:w-28 flex items-center md:flex-col md:items-center mb-3 md:mb-0 ${animate ? 'group' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
              ${currentStep === UserProgress.NEEDS_PROJECT 
                ? 'bg-cyscom text-black animate-pulse' 
                : currentStep === UserProgress.COMPLETE || currentStep === null 
                  ? 'bg-cyscom text-black' 
                  : 'bg-gray-700 text-white'}
              ${animate ? 'group-hover:scale-110 transition-transform duration-300' : ''}`}
            >
              2
            </div>
            <div className="ml-3 md:ml-0 md:mt-2 text-sm text-white">
              {showLinks ? (
                <Link href="/projects" className={`${currentStep === UserProgress.NEEDS_DEPARTMENTS ? 'opacity-50 pointer-events-none' : ''} ${animate ? 'hover:text-cyscom transition-colors duration-200' : ''}`}>
                  Join Project
                </Link>
              ) : (
                <span>Join Project</span>
              )}
            </div>
            {currentStep === UserProgress.NEEDS_PROJECT && (
              <span className="absolute -top-3 -right-3 md:-top-2 md:-right-2 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyscom opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-cyscom items-center justify-center text-black text-xs">!</span>
              </span>
            )}
          </div>
          
          {/* Step 3: Contribute */}
          <div className={`relative z-10 w-full md:w-28 flex items-center md:flex-col md:items-center mb-3 md:mb-0 ${animate ? 'group' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
              ${currentStep === UserProgress.COMPLETE 
                ? 'bg-cyscom text-black' 
                : 'bg-gray-700 text-white'}
              ${animate ? 'group-hover:scale-110 transition-transform duration-300' : ''}`}
            >
              3
            </div>
            <div className="ml-3 md:ml-0 md:mt-2 text-sm text-white">
              {showLinks ? (
                <Link href="/contributions" className={`${currentStep !== UserProgress.COMPLETE ? 'opacity-50 pointer-events-none' : ''} ${animate ? 'hover:text-cyscom transition-colors duration-200' : ''}`}>
                  Add Contributions
                </Link>
              ) : (
                <span>Add Contributions</span>
              )}
            </div>
          </div>
          
          {/* Step 4: Reviews */}
          <div className={`relative z-10 w-full md:w-28 flex items-center md:flex-col md:items-center ${animate ? 'group' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium 
              ${currentStep === UserProgress.COMPLETE 
                ? 'bg-cyscom/40 text-white' 
                : 'bg-gray-700 text-white'}
              ${animate ? 'group-hover:scale-110 transition-transform duration-300' : ''}`}
            >
              4
            </div>
            <div className="ml-3 md:ml-0 md:mt-2 text-sm text-white">
              {showLinks ? (
                <span className={`${currentStep !== UserProgress.COMPLETE ? 'opacity-50' : ''}`}>
                  Review Project
                </span>
              ) : (
                <span>Review Project</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Detailed cards view
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1: Select Departments */}
          <div className={`rounded-lg p-4 ${currentStep === UserProgress.NEEDS_DEPARTMENTS ? 'bg-cyscom/20 border border-cyscom/40 animate-pulse-slow' : 'bg-black/30'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === null || currentStep === UserProgress.NEEDS_DEPARTMENTS ? 'bg-cyscom text-black' : 'bg-gray-700 text-white'}`}>
                1
              </div>
              <div className={`text-xs font-medium py-1 px-2 rounded ${currentStep === null || currentStep === UserProgress.NEEDS_DEPARTMENTS ? 'bg-amber-500/20 text-amber-400' : currentStep > UserProgress.NEEDS_DEPARTMENTS ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
                {currentStep === null || currentStep === UserProgress.NEEDS_DEPARTMENTS ? 'Current Step' : currentStep > UserProgress.NEEDS_DEPARTMENTS ? 'Completed' : 'Not Started'}
              </div>
            </div>
            
            <h4 className="text-base font-medium text-white">Select Departments</h4>
            <p className="text-sm text-slate-300 mt-1">Choose two departments that you'd like to contribute to. Each department has different projects and roles available.</p>
            
            <div className="mt-4 space-y-2">
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Required:</span> Select 1-2 departments
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Options:</span> Technical, Development, Events, Social Media, etc.
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Tip:</span> Choose based on your interests and skills!
              </div>
            </div>
            
            {showLinks && (
              <div className="mt-4">
                <Link 
                  href="/departments" 
                  className={`text-sm inline-flex items-center ${currentStep === UserProgress.NEEDS_DEPARTMENTS || currentStep === null ? 'text-cyscom hover:underline' : 'text-slate-500'}`}
                >
                  {currentStep === null || currentStep === UserProgress.NEEDS_DEPARTMENTS ? (
                    <>
                      Go to Departments
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </>
                  ) : currentStep > UserProgress.NEEDS_DEPARTMENTS ? (
                    'Completed'
                  ) : (
                    'Not Available Yet'
                  )}
                </Link>
              </div>
            )}
          </div>
          
          {/* Step 2: Select Project */}
          <div className={`rounded-lg p-4 ${currentStep === UserProgress.NEEDS_PROJECT ? 'bg-cyscom/20 border border-cyscom/40 animate-pulse-slow' : 'bg-black/30'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === UserProgress.NEEDS_PROJECT || (currentStep !== null && currentStep >= UserProgress.NEEDS_PROJECT) ? 'bg-cyscom text-black' : 'bg-gray-700 text-white'}`}>
                2
              </div>
              <div className={`text-xs font-medium py-1 px-2 rounded ${currentStep === UserProgress.NEEDS_PROJECT ? 'bg-amber-500/20 text-amber-400' : (currentStep !== null && currentStep > UserProgress.NEEDS_PROJECT) ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
                {currentStep === UserProgress.NEEDS_PROJECT ? 'Current Step' : (currentStep !== null && currentStep > UserProgress.NEEDS_PROJECT) ? 'Completed' : 'Not Started'}
              </div>
            </div>
            
            <h4 className="text-base font-medium text-white">Join a Project</h4>
            <p className="text-sm text-slate-300 mt-1">Browse available projects within your chosen departments and join one that matches your interests and skills.</p>
            
            <div className="mt-4 space-y-2">
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Required:</span> Join 1 project
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Limit:</span> Maximum 4 members per project
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Tip:</span> Check project descriptions carefully before joining!
              </div>
            </div>
            
            {showLinks && (
              <div className="mt-4">
                <Link 
                  href="/projects" 
                  className={`text-sm inline-flex items-center ${currentStep === UserProgress.NEEDS_PROJECT ? 'text-cyscom hover:underline' : 'text-slate-500'}`}
                >
                  {currentStep === UserProgress.NEEDS_PROJECT ? (
                    <>
                      Browse Projects
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </>
                  ) : (currentStep !== null && currentStep > UserProgress.NEEDS_PROJECT) ? (
                    'Completed'
                  ) : (
                    'Not Available Yet'
                  )}
                </Link>
              </div>
            )}
          </div>
          
          {/* Step 3: Submit Contributions */}
          <div className={`rounded-lg p-4 ${currentStep === UserProgress.COMPLETE ? 'bg-cyscom/20 border border-cyscom/40 animate-pulse-slow' : 'bg-black/30'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === UserProgress.COMPLETE ? 'bg-cyscom text-black' : 'bg-gray-700 text-white'}`}>
                3
              </div>
              <div className={`text-xs font-medium py-1 px-2 rounded ${currentStep === UserProgress.COMPLETE ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
                {currentStep === UserProgress.COMPLETE ? 'Current Step' : 'Not Started'}
              </div>
            </div>
            
            <h4 className="text-base font-medium text-white">Submit Contributions</h4>
            <p className="text-sm text-slate-300 mt-1">Document your work and contributions to earn points. Regular submissions help track your progress and participation.</p>
            
            <div className="mt-4 space-y-2">
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Required:</span> Submit contributions regularly
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Review:</span> Contributions are verified by admins
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-medium text-cyscom">Tip:</span> Include detailed descriptions and images when applicable!
              </div>
            </div>
            
            {showLinks && (
              <div className="mt-4">
                <Link 
                  href="/contributions" 
                  className={`text-sm inline-flex items-center ${currentStep === UserProgress.COMPLETE ? 'text-cyscom hover:underline' : 'text-slate-500'}`}
                >
                  {currentStep === UserProgress.COMPLETE ? (
                    <>
                      Submit Contribution
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </>
                  ) : (
                    'Not Available Yet'
                  )}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="mt-4 text-xs text-center text-slate-400">
        Complete all steps in order to participate fully and earn points
      </div>
    </div>
  );
};

export default WorkflowSteps;