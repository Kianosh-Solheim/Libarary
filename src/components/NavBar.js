import React from 'react';
import { User, Trash2 } from 'lucide-react';

const NavBar = ({ userRole, onLogout, onGoHome, onViewAccount, logoUrl, appName }) => {
  return (
    <nav className="bg-white shadow-md p-4 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-full" />
        <button 
          onClick={onGoHome} 
          className="text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors duration-200"
        >
          {appName || 'My Library'}
        </button>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={onViewAccount}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <User size={20} />
          <span>My Account</span>
        </button>
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <Trash2 size={20} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default NavBar; 