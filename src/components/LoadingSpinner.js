import React from 'react';

const LoadingSpinner = ({ text = 'Loading...', logoUrl }) => (
  <div className="flex flex-col items-center justify-center h-screen">
    <img src={logoUrl} alt="Logo" className="h-20 w-20 mb-4" />
    <p>{text}</p>
  </div>
);

export default LoadingSpinner; 