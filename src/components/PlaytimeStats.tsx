import React, { useEffect, useCallback } from 'react';
import type { ServerPlaytime } from '../types/PlaytimeStats';

interface PlaytimeStatsProps {
  isOpen: boolean;
  onClose: () => void;
  isSessionActive: boolean;
}

const PlaytimeStats: React.FC<PlaytimeStatsProps> = ({ isOpen, onClose, isSessionActive }) => {
    const [stats, setStats] = React.useState<ServerPlaytime[]>(() => {
      const saved = localStorage.getItem('playtimeStats');
      return saved ? JSON.parse(saved) : [];
    });

  const updateStats = useCallback(() => {
    const currentStats = JSON.parse(localStorage.getItem('playtimeStats') || '[]');
    const now = new Date();

    // Обновляем время только для активных сессий и только если сессия действительно активна
    const updatedStats = currentStats.map((stat: ServerPlaytime) => {
      if (stat.lastSession && !stat.lastSession.end && isSessionActive) {
        const sessionStart = new Date(stat.lastSession.start);
        const playedMinutes = Math.floor((now.getTime() - sessionStart.getTime()) / 60000);
        const updatedStat = {
          ...stat,
          totalPlaytime: stat.totalPlaytime + playedMinutes
        };
        return updatedStat;
      }
      return stat;
    });

    // Сохраняем обновленную статистику
    localStorage.setItem('playtimeStats', JSON.stringify(updatedStats));
    setStats(updatedStats);
  }, [isSessionActive]);

  // Обновляем статистику каждую минуту только если есть активная сессия
  useEffect(() => {
    if (isOpen && isSessionActive) {
      updateStats(); // Обновляем сразу при открытии
      const interval = setInterval(updateStats, 60000);
      return () => {
        clearInterval(interval);
        updateStats(); // Обновляем при закрытии
      };
    }
  }, [isOpen, isSessionActive, updateStats]);

  // Обновляем статистику при открытии
  useEffect(() => {
    if (isOpen) {
      const savedStats = localStorage.getItem('playtimeStats');
      if (savedStats) {
        setStats(JSON.parse(savedStats));
      }
    }
  }, [isOpen]);

  const formatPlaytime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${remainingMinutes}m`;
    return `${hours}h ${remainingMinutes}m`;
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
          <h2 className="text-xl font-bold text-primary">Playtime Statistics</h2>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
          {stats.length === 0 ? (
            <div className="text-center text-secondary py-8">
              No playtime data yet. Start playing to see statistics!
            </div>
          ) : (
            stats
              .sort((a, b) => b.totalPlaytime - a.totalPlaytime)
              .map(server => (
                <div 
                  key={server.serverId}
                  className="flex items-center justify-between bg-secondary p-4 rounded-lg"
                >
                  <div className="flex items-center">
                    <img 
                      src={server.serverImage} 
                      alt={server.serverName}
                      className="w-10 h-10 rounded mr-3 object-cover bg-secondary"
                      onError={(e) => {
                        const currentSrc = e.currentTarget.src;
                        if (!currentSrc.startsWith('https://')) {
                          e.currentTarget.src = currentSrc.replace('http://', 'https://');
                        } else {
                          e.currentTarget.src = '/logo.png';
                          e.currentTarget.classList.add('p-1');
                        }
                      }}
                      loading="lazy"
                    />
                    <span className="font-bold text-primary">{server.serverName}</span>
                  </div>
                  <span className="text-accent font-bold">
                    {formatPlaytime(server.totalPlaytime)}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaytimeStats; 