import { LandingPage } from '@/components/LandingPage';
import { useState } from 'react';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'auth'>('landing');

  const handleGetStarted = () => {
    setCurrentView('auth');
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  if (currentView === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // Placeholder for auth/main app - this will be implemented later
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-amber-400 mb-4">🚧 Coming Soon</h1>
        <p className="text-gray-300 mb-6">
          Authentication and main app features are under construction
        </p>
        <button
          onClick={handleBackToLanding}
          className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold px-6 py-3 rounded-lg"
        >
          ← Back to Landing
        </button>
      </div>
    </div>
  );
}

export default App;