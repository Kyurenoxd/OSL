import { useState, useEffect } from 'react'
import type { Server } from './types/Server'
import type { ServerPlaytime } from './types/PlaytimeStats'
import Settings from './components/Settings'
import WelcomeModal from './components/WelcomeModal'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import PlaytimeStats from './components/PlaytimeStats'
import FAQ from './components/FAQ'

// Создаем отдельный компонент для основного содержимого
function AppContent() {
  const { theme } = useTheme(); // Используем хук useTheme здесь
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'votes' | 'players' | 'none'>('none')
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Server[]>(() => {
    const saved = localStorage.getItem('favoriteServers')
    return saved ? JSON.parse(saved) : []
  })
  const [favoritesSort, setFavoritesSort] = useState<'votes' | 'players' | 'none'>(() => {
    const saved = localStorage.getItem('favoritesSort')
    return (saved as 'votes' | 'players' | 'none') || 'none'
  })
  const [selectedServerDetails, setSelectedServerDetails] = useState<{
    name: string;
    image: string;
  } | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [osuPath, setOsuPath] = useState<string>(() => {
    return localStorage.getItem('osuPath') || ''
  })
  const [showWelcome, setShowWelcome] = useState(() => {
    const isFirstLaunch = !localStorage.getItem('hasLaunched');
    const hasOsuPath = localStorage.getItem('osuPath');
    
    if (isFirstLaunch) {
      localStorage.setItem('hasLaunched', 'true');
    }
    
    return isFirstLaunch || !hasOsuPath;
  })
  const [autoClose, setAutoClose] = useState(() => {
    return localStorage.getItem('autoClose') === 'true';
  });
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isFAQOpen, setIsFAQOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('autoClose', autoClose.toString());
  }, [autoClose]);

  useEffect(() => {
    setLoading(true)
    setError(null)
    console.log('Fetching servers...')
    
    fetch('https://osu-server-list.com/api/v2/client/servers?key=PfGLccr8pA5nOp1')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        console.log('Received data:', data)
        setServers(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching servers:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Проверяем путь к osu! при запуске
  useEffect(() => {
    if (!osuPath && showWelcome) {
      setShowWelcome(true)
    }
  }, [])

  // Функция выбора пути к osu!
  const selectOsuPath = async () => {
    try {
      console.log('Opening file dialog...');
      const filePath = await window.electron.openFileDialog();
      console.log('Selected file path:', filePath);
      
      if (filePath) {
        if (!filePath.toLowerCase().endsWith('.exe')) {
          console.error('Invalid file type - not an .exe');
          alert('Please select an .exe file!');
          return null;
        }
        console.log('Setting osu path:', filePath);
        setOsuPath(filePath);
        localStorage.setItem('osuPath', filePath);
        console.log('Saved osu path to localStorage');
        setShowWelcome(false);
        return filePath;
      }
      console.log('No file selected');
      return null;
    } catch (error) {
      console.error('Failed to select file:', error);
      return null;
    }
  };

  // Функция запуска сервера
  const launchServer = async () => {
    try {
      if (!selectedServerDetails || !osuPath) return;
      
      const server = servers.find(s => s.name === selectedServerDetails.name);
      if (!server) throw new Error('Server not found');

      // Получаем текущие статистики
      const stats: ServerPlaytime[] = JSON.parse(localStorage.getItem('playtimeStats') || '[]');
      const now = new Date().toISOString();
      
      // Ограничиваем историю до 5 серверов
      if (stats.length >= 5 && !stats.find(s => s.serverId === server.id)) {
        stats.sort((a, b) => b.totalPlaytime - a.totalPlaytime);
        stats.pop();
      }

      // Находим или создаем статистику для сервера
      let serverStats = stats.find(s => s.serverId === server.id);
      if (!serverStats) {
        serverStats = {
          serverId: server.id,
          serverName: server.name,
          serverImage: server.image ? (
            server.image.startsWith('http') ? server.image : `https://${server.image}`
          ) : '/logo.png',
          totalPlaytime: 0,
          lastSession: {
            start: now
          }
        };
        stats.push(serverStats);
      } else {
        // Обновляем имя и изображение сервера
        serverStats.serverName = server.name;
        serverStats.serverImage = server.image ? (
          server.image.startsWith('http') ? server.image : `https://${server.image}`
        ) : '/logo.png';
        
        // Если есть незавершенная сессия, сохраняем накопленное время
        if (serverStats.lastSession && !serverStats.lastSession.end) {
          const sessionStart = new Date(serverStats.lastSession.start);
          const sessionEnd = new Date();
          const playedMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 60000);
          serverStats.totalPlaytime += playedMinutes;
        }
        // Начинаем новую сессию
        serverStats.lastSession = {
          start: now
        };
      }

      // Сохраняем обновленную статистику
      localStorage.setItem('playtimeStats', JSON.stringify(stats));

      // Устанавливаем статус активной сессии
      setIsSessionActive(true);

      // Запускаем osu! и ждем завершения процесса
      await window.electron.launchOsu([osuPath], server.devserver);
      
      // После завершения процесса обновляем статистику и статус
      setIsSessionActive(false);
      
      // Завершаем текущую сессию и сохраняем время
      const endStats = JSON.parse(localStorage.getItem('playtimeStats') || '[]');
      const currentServerStats = endStats.find((s: ServerPlaytime) => s.serverId === server.id);
      if (currentServerStats && currentServerStats.lastSession && !currentServerStats.lastSession.end) {
        const sessionStart = new Date(currentServerStats.lastSession.start);
        const sessionEnd = new Date();
        const playedMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 60000);
        currentServerStats.totalPlaytime += playedMinutes;
        currentServerStats.lastSession.end = sessionEnd.toISOString();
        localStorage.setItem('playtimeStats', JSON.stringify(endStats));
      }
      
      if (autoClose) {
        window.electron.close();
      }
    } catch (error) {
      setIsSessionActive(false);
      console.error('Failed to launch osu:', error);
      alert('Failed to launch osu! Please check the path and try again.');
    }
  };

  const handleLaunch = () => {
    if (selectedServerDetails) {
      launchServer()
    }
  }

  // Функция для сортировки серверов
  const getSortedServers = () => {
    let serversToSort = showFavorites ? [...favorites] : [...servers];

    // Если отображаются избранные и включена фильтрация избранного
    if (showFavorites && favoritesSort !== 'none') {
      serversToSort.sort((a, b) => b.players - a.players);
    } 
    // Иначе применяем обычную сортировку
    else if (!showFavorites) {
      if (sortBy === 'votes') {
        serversToSort.sort((a, b) => b.votes - a.votes);
      } else if (sortBy === 'players') {
        serversToSort.sort((a, b) => b.players - a.players);
      }
    }

    return serversToSort;
  }

  // Функция для управления избранными серверами
  const toggleFavorite = (server: Server) => {
    const isFavorite = favorites.some(fav => fav.id === server.id)
    let newFavorites: Server[]
    
    if (isFavorite) {
      newFavorites = favorites.filter(fav => fav.id !== server.id)
    } else {
      newFavorites = [...favorites, server]
    }
    
    setFavorites(newFavorites)
    localStorage.setItem('favoriteServers', JSON.stringify(newFavorites))
  }

  const openInBrowser = (url: string) => {
    try {
      window.electron.openExternal(url)
    } catch (error) {
      console.error('Failed to open URL:', error)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="h-screen w-screen bg-primary text-primary flex flex-col overflow-hidden">
      {/* Кнопки управления окном в правом верхнем углу */}
      <div className="fixed top-0 right-0 flex items-center z-50">
        <button
          onClick={() => window.electron.minimize()}
          className="h-8 w-12 hover:bg-hover-bg transition-colors duration-200 flex items-center justify-center titlebar-button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => window.electron.close()}
          className="h-8 w-12 hover:bg-red-500 hover:text-white transition-colors duration-200 flex items-center justify-center titlebar-button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Основной контент */}
      <div className="flex-1 relative">
        {/* Боковая панель - обновляем отступ сверху */}
        <div className="fixed left-0 top-0 h-[calc(100vh-60px)] w-64 bg-secondary border-r border-custom p-4">
          <div className="flex items-center mb-8">
            <img src="/logo.png" alt="OSL" className="w-12 h-12" />
            <div className="ml-3">
              <h1 className="text-xl font-bold text-primary">OSL</h1>
              <p className="text-sm text-secondary">OsuListLauncher</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={() => openInBrowser('https://osu-server-list.com/')}
              className={`w-full text-left px-4 py-2 transition-colors duration-200 ${
                theme === 'dark'
                  ? 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              osu-server-list.com
            </button>
            <button 
              onClick={() => openInBrowser('https://discord.gg/AyEFRYHjb4')}
              className="w-full text-left px-4 py-2 hover-bg rounded block"
            >
              Discord
            </button>
            <button 
              onClick={() => openInBrowser('https://discord.gg/AyEFRYHjb4')}
              className="w-full text-left px-4 py-2 hover-bg rounded block"
            >
              Help
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)} 
              className="w-full text-left px-4 py-2 hover-bg rounded"
            >
              Settings
            </button>
            <button 
              onClick={() => setIsStatsOpen(true)} 
              className="w-full text-left px-4 py-2 hover-bg rounded block"
            >
              Playtime Stats
            </button>
            <button 
              onClick={() => setIsFAQOpen(true)} 
              className="w-full text-left px-4 py-2 hover-bg rounded block"
            >
              FAQ & Help
            </button>
          </div>
        </div>

        {/* Панель сортировки и фильтрации - обновляем отступ слева */}
        <div className="ml-64 pt-4 px-6 flex items-center space-x-4 border-b border-custom pb-4">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Sort by:</span>
            <button 
              onClick={() => setSortBy('votes')}
              className={`px-3 py-1 rounded transition-all duration-200 ${
                sortBy === 'votes' 
                  ? 'bg-purple-500 bg-opacity-20 text-purple-500' 
                  : theme === 'dark' 
                    ? 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Votes
            </button>
            <button 
              onClick={() => setSortBy('players')}
              className={`px-3 py-1 rounded transition-all duration-200 ${
                sortBy === 'players' 
                  ? 'bg-green-500 bg-opacity-20 text-green-500' 
                  : theme === 'dark'
                    ? 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Players
            </button>
          </div>
          <div className="h-6 w-px bg-[#2a2a2a]"></div>
          <button 
            onClick={() => setShowFavorites(!showFavorites)}
            className={`px-3 py-1 rounded flex items-center transition-all duration-200 ${
              showFavorites 
                ? 'bg-yellow-500 bg-opacity-20 text-yellow-500' 
                : theme === 'dark'
                  ? 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Favorites ({favorites.length})
          </button>
          <div className="h-6 w-px bg-[#2a2a2a]"></div>
          <button 
            onClick={() => {
              setLoading(true);
              fetch('https://osu-server-list.com/api/v2/client/servers?key=PfGLccr8pA5nOp1')
                .then(res => {
                  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                  return res.json();
                })
                .then(data => {
                  setServers(data);
                  setLoading(false);
                })
                .catch(err => {
                  setError(err.message);
                  setLoading(false);
                });
            }}
            className={`px-3 py-1 rounded flex items-center transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            disabled={loading}
          >
            <svg 
              className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Основной контент - обновляем отступы */}
        <div className="ml-64 p-6 mb-[60px] h-[calc(100vh-60px)]">
          <div className="overflow-y-auto custom-scrollbar pr-4 h-full">
            {loading ? (
              <div className="text-center py-4 text-primary">Loading servers...</div>
            ) : error ? (
              <div className="text-red-500 text-center py-4">Error: {error}</div>
            ) : servers.length === 0 ? (
              <div className="text-center py-4 text-primary">No servers found</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {getSortedServers().map(server => (
                  <div 
                    key={server.id} 
                    className={`server-card p-4 w-full transform transition-all duration-300 ease-in-out ${
                      theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <div className="relative">
                            <img 
                              src={server.image} 
                              alt={server.name} 
                              className="w-16 h-16 rounded"
                              onError={(e) => {
                                e.currentTarget.src = '/logo.png'
                              }}
                            />
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${
                              server.players > 0 ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center">
                                  <h2 className="text-lg font-bold">{server.name}</h2>
                                  <button 
                                    onClick={() => toggleFavorite(server)}
                                    className={`ml-2 p-1 rounded-full transition-all duration-300 transform hover:scale-110 ${
                                      favorites.some(fav => fav.id === server.id)
                                        ? 'text-yellow-500 hover:text-yellow-600'
                                        : 'text-gray-400 hover:text-[#6528F7]'
                                    }`}
                                  >
                                    {favorites.some(fav => fav.id === server.id) ? (
                                      // Звезда для избранного
                                      <svg 
                                        className="w-5 h-5 transform transition-transform duration-300 animate-[wiggle_0.3s_ease-in-out]" 
                                        fill="currentColor" 
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ) : (
                                      // Плюсик для добавления в избранное
                                      <svg 
                                        className="w-5 h-5 transition-transform duration-300" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path 
                                          strokeLinecap="round" 
                                          strokeLinejoin="round" 
                                          strokeWidth={2} 
                                          d="M12 4v16m8-8H4" 
                                        />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                                <a 
                                  href={server.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-sm text-gray-400 mt-1 block transition-colors duration-200 ${
                                    theme === 'dark' 
                                      ? 'hover:text-white' 
                                      : 'hover:text-[#6528F7]'
                                  }`}
                                >
                                  {server.url}
                                </a>
                              </div>
                              <div className="flex space-x-3">
                                <div className="px-3 py-1 bg-opacity-20 bg-green-500 rounded-full flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                  <span className="text-green-500 font-medium">{server.players} online</span>
                                </div>
                                <div className="px-3 py-1 bg-opacity-20 bg-purple-500 rounded-full flex items-center">
                                  <svg className="w-4 h-4 text-purple-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="text-purple-500 font-medium">{server.votes}</span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-400">
                              <span>Server: {server.devserver}</span>
                              <span className="ml-2">Added: {server.timestamp}</span>
                            </div>
                          </div>
                        </div>

                        {/* Кнопки справа */}
                        <div className="flex items-center space-x-2 ml-4">
                          <button 
                            onClick={() => openInBrowser(server.url)}
                            className={`px-3 py-1 rounded transition-colors duration-200 ${
                              theme === 'dark'
                                ? 'bg-[#0b0c0b] hover:bg-[#1a1a1a] text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            View
                          </button>
                          <button 
                            onClick={() => openInBrowser(`https://osu-server-list.com/server/${server.safe_name}/vote`)}
                            className={`px-3 py-1 rounded transition-colors duration-200 ${
                              theme === 'dark'
                                ? 'bg-[#0b0c0b] hover:bg-[#1a1a1a] text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            Vote
                          </button>
                          <button 
                            onClick={() => setSelectedServerDetails({
                              name: server.name,
                              image: server.image
                            })}
                            className="px-4 py-2 bg-[#6528F7] hover:bg-[#5020C9] rounded text-white"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Нижняя панель */}
        <div className="fixed bottom-0 left-0 right-0 h-[60px] flex items-center justify-between px-4 bottom-panel border-t">
          <div className="flex items-center ml-64">
            {selectedServerDetails && (
              <div className="flex items-center">
                <img 
                  src={selectedServerDetails.image} 
                  alt={selectedServerDetails.name}
                  className="w-8 h-8 rounded mr-3"
                  onError={(e) => {
                    e.currentTarget.src = '/logo.png'
                  }}
                />
                <div className="flex flex-col">
                  <span className="font-bold">{selectedServerDetails.name}</span>
                  <div className="flex items-center text-sm">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      isSessionActive ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <span className={`${
                      isSessionActive ? 'text-green-500' : 'text-gray-400'
                    }`}>
                      {isSessionActive ? 'Active' : 'Not Active'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={selectOsuPath}
              className={`px-4 py-2 rounded text-sm flex items-center ${
                !osuPath 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : theme === 'dark'
                    ? 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <svg 
                className="w-4 h-4 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                />
              </svg>
              {osuPath ? 'Change Path' : 'Select osu!.exe'}
            </button>
            <button 
              className={`px-6 py-2 rounded ${
                selectedServerDetails
                  ? 'bg-[#6528F7] hover:bg-[#5020C9] text-white'
                  : theme === 'dark'
                    ? 'bg-[#1a1a1a] text-gray-600'
                    : 'bg-gray-100 text-gray-400'
              }`}
              disabled={!selectedServerDetails}
              onClick={handleLaunch}
            >
              Launch
            </button>
          </div>
        </div>

        {/* Модальные окна */}
        <WelcomeModal 
          isOpen={showWelcome}
          onClose={() => setShowWelcome(false)}
          onSelectPath={selectOsuPath}
        />

        <Settings 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          favoritesSort={favoritesSort}
          setFavoritesSort={setFavoritesSort}
          autoClose={autoClose}
          setAutoClose={setAutoClose}
        />

        <PlaytimeStats 
          isOpen={isStatsOpen}
          onClose={() => setIsStatsOpen(false)}
          isSessionActive={isSessionActive}
        />

        <FAQ 
          isOpen={isFAQOpen}
          onClose={() => setIsFAQOpen(false)}
        />
      </div>
    </div>
  )
}

// Основной компонент App теперь только оборачивает контент в ThemeProvider
function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App