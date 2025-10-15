import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

export default function SetupPage() {
  const [setupComplete, setSetupComplete] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSetupAdmin = async () => {
    setLoading(true)
    try {
      // Get Firebase methods from window (firebase is loaded in the admin-tools.js script)
      const setupAdminFunc = (window as any).setupAdmin;
      
      if (!setupAdminFunc) {
        throw new Error('Admin setup function not found. Please make sure the admin-tools.js script is loaded.');
      }
      
      await setupAdminFunc();
      setSetupComplete(true);
    } catch (error) {
      console.error('Setup failed:', error);
      alert('Setup failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-black to-slate-900 p-4">
      <Head>
        <title>Initial Setup - Cyscom FFCS Portal</title>
      </Head>
      
      <div className="p-8 bg-pagebg/60 backdrop-blur-md rounded-xl shadow-lg text-center max-w-lg w-full">
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyscom">Initial Setup</h1>
          <p className="mt-4 text-slate-300">
            This page allows you to create admin users for the Cyscom FFCS Portal.
          </p>
        </div>
        
        <div className="mt-8">
          {setupComplete ? (
            <div className="space-y-6">
              <div className="p-4 bg-green-900/30 border border-green-500/30 rounded-md">
                <p className="text-green-400 font-medium">Setup complete!</p>
                <p className="mt-2 text-slate-300">
                  Admin users have been created successfully. You can now log in with the admin credentials.
                </p>
              </div>
              
              <div className="text-sm text-slate-300 p-4 bg-black/30 rounded-md">
                <h3 className="font-medium mb-2">Admin Credentials:</h3>
                <p><strong>Email:</strong> admin@vitstudent.ac.in</p>
                <p><strong>Password:</strong> cyscom2025admin</p>
                <div className="mt-3">
                  <h3 className="font-medium mb-2">Super Admin Credentials:</h3>
                  <p><strong>Email:</strong> superadmin@vitstudent.ac.in</p>
                  <p><strong>Password:</strong> cyscom2025superadmin</p>
                </div>
              </div>
              
              <Link href="/" className="block w-full px-4 py-3 bg-cyscom rounded-lg text-black font-medium hover:bg-cyscom/90 transition-all">
                Go to Login Page
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-amber-900/30 border border-amber-500/30 rounded-md text-left">
                <p className="text-amber-400 font-medium">Warning:</p>
                <p className="mt-2 text-slate-300">
                  This page should only be used for initial setup. Running this more than once will reset the admin passwords.
                </p>
              </div>
              
              <button 
                onClick={handleSetupAdmin}
                disabled={loading}
                className="w-full px-4 py-3 bg-cyscom rounded-lg text-black font-medium hover:bg-cyscom/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    Setting up...
                  </span>
                ) : (
                  'Create Admin Users'
                )}
              </button>
              
              <Link href="/" className="block text-slate-400 hover:text-white">
                Cancel and return to login
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Include admin-tools.js script */}
      <script src="/js/admin-tools.js"></script>
    </div>
  )
}