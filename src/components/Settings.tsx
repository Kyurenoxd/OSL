import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  favoritesSort: 'votes' | 'players' | 'none';
  setFavoritesSort: (sort: 'votes' | 'players' | 'none') => void;
  autoClose: boolean;
  setAutoClose: (value: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, favoritesSort, setFavoritesSort, autoClose, setAutoClose }) => {
  const { theme, setTheme } = useTheme();
  const [autoStartSort, setAutoStartSort] = useState<'votes' | 'players' | 'favorites' | 'none'>(() => {
    const saved = localStorage.getItem('autoStartSort');
    return (saved as any) || 'none';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [osuPath, setOsuPath] = useState<string>(() => {
    return localStorage.getItem('osuPath') || '';
  });

  useEffect(() => {
    localStorage.setItem('autoStartSort', autoStartSort);
  }, [autoStartSort]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('favoritesSort', favoritesSort);
  }, [favoritesSort]);

  const options = [
    { value: 'none', label: 'None' },
    { value: 'votes', label: 'Votes' },
    { value: 'players', label: 'Players' },
    { value: 'favorites', label: 'Favorites' }
  ];

  const getCurrentLabel = () => {
    return options.find(opt => opt.value === autoStartSort)?.label || 'None';
  };

  const handleChangeOsuPath = async () => {
    try {
      const newPath = await window.electron.changeOsuPath();
      if (newPath) {
        setOsuPath(newPath);
        localStorage.setItem('osuPath', newPath);
      }
    } catch (error) {
      console.error('Failed to change osu! path:', error);
    }
  };

  const handleCreateShortcut = async () => {
    try {
      const success = await window.electron.createShortcut();
      if (success) {
        alert('Desktop shortcut created successfully!');
      } else {
        alert('Failed to create desktop shortcut.');
      }
    } catch (error) {
      console.error('Error creating shortcut:', error);
      alert('Failed to create desktop shortcut.');
    }
  };

  return (
    <div 
      className={`fixed inset-0 bg-black/90 transition-opacity duration-300 ease-in-out z-50 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div 
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
          bg-primary border border-custom rounded-lg w-[500px] p-6 shadow-xl`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-primary">Settings</h2>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-secondary">Auto Start Sort</label>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-secondary border border-custom rounded px-3 py-2 text-primary
                  flex items-center justify-between hover:border-accent transition-all duration-200"
              >
                <span>{getCurrentLabel()}</span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div 
                className={`absolute w-full mt-2 py-1 bg-secondary border border-custom rounded shadow-lg
                  transition-all duration-200 z-50
                  ${isDropdownOpen 
                    ? 'opacity-100 translate-y-0 pointer-events-auto' 
                    : 'opacity-0 -translate-y-2 pointer-events-none'
                  }`}
              >
                {options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setAutoStartSort(option.value as any);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-hover-bg transition-colors duration-150
                      ${autoStartSort === option.value ? 'text-accent' : 'text-primary'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-secondary">osu! Settings</label>
            <div className="space-y-2">
              <button 
                onClick={handleChangeOsuPath}
                className="w-full px-4 py-2 bg-secondary hover:bg-hover-bg rounded transition-colors duration-200
                  flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Change osu! Path
              </button>
              <button 
                onClick={handleCreateShortcut}
                className="w-full px-4 py-2 bg-secondary hover:bg-hover-bg rounded transition-colors duration-200
                  flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Create Desktop Shortcut
              </button>
              {osuPath && (
                <div className="text-xs text-secondary mt-2 break-all">
                  Current path: {osuPath}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-secondary">Theme Settings</label>
            <div className="flex items-center justify-between p-3 bg-secondary rounded">
              <span className="text-sm text-primary">
                {theme === 'dark' ? 'Dark Theme' : 'Light Theme'}
              </span>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 
                  ${theme === 'dark' ? 'bg-accent' : 'bg-gray-400'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300
                    ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-secondary">Favorites Settings</label>
            <div className="flex items-center justify-between p-3 bg-secondary rounded">
              <span className="text-sm text-primary">Filter Favorites</span>
              <button
                onClick={() => setFavoritesSort(favoritesSort === 'none' ? 'players' : 'none')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 
                  ${favoritesSort !== 'none' ? 'bg-accent' : 'bg-gray-400'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300
                    ${favoritesSort !== 'none' ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-secondary">Launch Settings</label>
            <div className="flex items-center justify-between p-3 bg-secondary rounded">
              <span className="text-sm text-primary">Auto close after launch</span>
              <button
                onClick={() => setAutoClose(!autoClose)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 
                  ${autoClose ? 'bg-accent' : 'bg-gray-400'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300
                    ${autoClose ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[-40px] left-0 right-0 flex items-center justify-center space-x-2 text-gray-500">
          <span className="text-lg font-semibold">powered by:</span>
          <span className="text-xl font-bold">KyurenoXD</span>
          <img 
            src="/icon.gif" 
            alt="KyurenoXD" 
            className="w-8 h-8 rounded-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;