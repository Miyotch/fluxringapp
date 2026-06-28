import { ref, getDownloadURL, uploadBytes } from 'firebase/storage'
import { storage } from './firebase'

// 作品画像の URL を取得（CloudFlare CDN への移行前はここを使う）
export const getArtworkImageUrl = (artworkId: string) =>
  getDownloadURL(ref(storage, `artworks/${artworkId}/image.jpg`))

// 作家アバターの URL を取得
export const getArtistAvatarUrl = (artistId: string) =>
  getDownloadURL(ref(storage, `artists/${artistId}/avatar.jpg`))

// 音源プレビューの URL を取得（30秒）
export const getPreviewAudioUrl = (artworkId: string) =>
  getDownloadURL(ref(storage, `artworks/${artworkId}/preview.m4a`))

// 音源フル（購入後のみ呼ぶ）
export const getFullAudioUrl = (artworkId: string) =>
  getDownloadURL(ref(storage, `artworks/${artworkId}/full.m4a`))
