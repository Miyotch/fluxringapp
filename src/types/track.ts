export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  artworkUrl: string;
  audioUrl: string;
  previewUrl: string;
  description: string;
  createdAt: Date;
  order: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  userId: string;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  favorites: string[];
  displayName: string;
}

export interface Article {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  publishedAt: Date;
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
