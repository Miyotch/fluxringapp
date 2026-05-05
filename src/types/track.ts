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
  paidMusic: boolean;
  // Mode & environment
  frequencyMode: boolean;
  melodyMode: boolean;
  earphoneOptimized: boolean;
  speakerOptimized: boolean;
  // Space tuning
  noiseLevel: number;
  toneCharacter: number;
  rhythmIntensity: number;
  // Advanced protocol
  justIntonation: boolean;
  equalTemperament: boolean;
  rootFrequency: string;
  brainwaveEntrainment: string;
  pinkNoiseFluctuation: boolean;
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
  subtitle: string;
  /** HTML body (rendered from rich-text editor). Stored as `descriptions` in Firestore. */
  descriptions: string;
  /** Sort field. Stored as `date` in Firestore (Timestamp). */
  date: Date;
  published: boolean;
  /** Pinned items, render first. */
  stable: boolean;
  /** Optional. When non-empty, tapping the article opens this URL in the system browser.
   *  Stored as `external_link` (snake_case) in Firestore. */
  externalLink: string;
  /** Image URL. Stored as `thumbnail` in Firestore. */
  thumbnail: string;
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
