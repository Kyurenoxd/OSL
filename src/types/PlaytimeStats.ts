export interface ServerPlaytime {
  serverId: number;
  serverName: string;
  serverImage: string;
  totalPlaytime: number; // в минутах
  lastSession: {
    start: string;
    end?: string;
  };
}

export interface PlaytimeData {
  servers: ServerPlaytime[];
  totalPlaytime: number;
  favoritesPlaytime: number;
  lastServer?: string;
} 