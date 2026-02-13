import React from 'react';

const AppFooter = () => {
  const version = import.meta.env.VITE_APP_VERSION || 'unknown';

  return (
    <div className="text-center pt-8 pb-4">
      <p className="text-xs text-google-text-secondary opacity-50">
        LyricVault v{version} &bull; Designed by McEveritts
      </p>
    </div>
  );
};

export default AppFooter;
