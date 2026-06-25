import { useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import { showAudioEngine } from '../../lib/ShowAudioEngine';

interface VideoProjectionWindowProps {
  onClose: () => void;
}

export default function VideoProjectionWindow({ onClose }: VideoProjectionWindowProps) {
  const { playlist, currentTrackIndex, isPlaying } = useStore();
  const currentTrack = playlist[currentTrackIndex];
  const popupRef = useRef<Window | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Open the secondary popup window
    const popup = window.open(
      '',
      'GlowLogicVideoProjection',
      'width=800,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );

    if (!popup) {
      alert('Veuillez autoriser les fenêtres pop-up pour activer la projection vidéo.');
      onClose();
      return;
    }

    popupRef.current = popup;

    // Set title and apply dark styles
    popup.document.title = 'Glow Logic v2 - Projection Vidéo';
    popup.document.body.style.margin = '0';
    popup.document.body.style.padding = '0';
    popup.document.body.style.backgroundColor = '#000000';
    popup.document.body.style.overflow = 'hidden';
    popup.document.body.style.display = 'flex';
    popup.document.body.style.alignItems = 'center';
    popup.document.body.style.justifyContent = 'center';
    popup.document.body.style.width = '100vw';
    popup.document.body.style.height = '100vh';

    // Create container and video element
    const container = popup.document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    popup.document.body.appendChild(container);

    const video = popup.document.createElement('video');
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.objectFit = 'contain';
    video.muted = true; // Mute secondary screen to prevent audio duplication/echo
    video.playsInline = true;
    container.appendChild(video);

    videoRef.current = video;

    // Sync close event
    const handleBeforeUnload = () => {
      onClose();
    };
    popup.addEventListener('beforeunload', handleBeforeUnload);

    // Sync playhead interval loop
    let syncInterval: ReturnType<typeof setInterval>;
    
    if (popup) {
      syncInterval = setInterval(() => {
        if (!video || !video.src) return;
        const mainAudio = showAudioEngine.getAudioElement();
        if (mainAudio) {
          const diff = Math.abs(video.currentTime - mainAudio.currentTime);
          if (diff > 0.15) { // If drift is > 150ms, force resync
            video.currentTime = mainAudio.currentTime;
          }
        }
      }, 500);
    }

    return () => {
      clearInterval(syncInterval);
      popup.removeEventListener('beforeunload', handleBeforeUnload);
      popup.close();
      popupRef.current = null;
      videoRef.current = null;
    };
  }, [onClose]);

  // Sync video content and state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (currentTrack && currentTrack.fileType === 'video' && currentTrack.fileUrl) {
      // Show video element
      video.style.display = 'block';
      if (video.src !== currentTrack.fileUrl) {
        video.src = currentTrack.fileUrl;
        video.load();
      }

      // Sync timecode immediately
      const mainAudio = showAudioEngine.getAudioElement();
      if (mainAudio) {
        video.currentTime = mainAudio.currentTime;
      }

      // Sync play/pause state
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    } else {
      // Hide video element and show plain black
      video.pause();
      video.src = '';
      video.style.display = 'none';
    }
  }, [currentTrack, isPlaying]);

  return null; // This component is a pure controller portal, it doesn't render anything in the parent DOM tree
}
