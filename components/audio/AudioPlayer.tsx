'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  FileAudio
} from 'lucide-react'

interface AudioPlayerProps {
  audioUrl: string
  fileName?: string
  onTimeUpdate?: (currentTime: number) => void
  onPlayStateChange?: (isPlaying: boolean) => void
  className?: string
}

export interface AudioPlayerHandle {
  seekTo: (time: number) => void
  play: () => void
  pause: () => void
}

export const AudioPlayer = React.forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({ audioUrl, fileName, onTimeUpdate, onPlayStateChange, className = '' }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = time
        setCurrentTime(time)
        // Auto-play when seeking from transcript
        if (!isPlaying) {
          audio.play()
          setIsPlaying(true)
          if (onPlayStateChange) {
            onPlayStateChange(true)
          }
        }
      },
      play: () => {
        const audio = audioRef.current
        if (!audio) return
        audio.play()
        setIsPlaying(true)
        if (onPlayStateChange) {
          onPlayStateChange(true)
        }
      },
      pause: () => {
        const audio = audioRef.current
        if (!audio) return
        audio.pause()
        setIsPlaying(false)
        if (onPlayStateChange) {
          onPlayStateChange(false)
        }
      }
    }), [isPlaying, onPlayStateChange])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      setCurrentTime(audio.currentTime)
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime)
      }
    }

    const updateDuration = () => {
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      if (onPlayStateChange) {
        onPlayStateChange(false)
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      if (onPlayStateChange) {
        onPlayStateChange(true)
      }
    }

    const handlePause = () => {
      setIsPlaying(false)
      if (onPlayStateChange) {
        onPlayStateChange(false)
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [onTimeUpdate, onPlayStateChange])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return
    
    const newTime = value[0]
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const skip = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds))
  }

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return
    
    const newVolume = value[0]
    audio.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    
    if (isMuted) {
      audio.volume = volume || 0.5
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  const changePlaybackRate = () => {
    const audio = audioRef.current
    if (!audio) return
    
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
    const currentIndex = rates.indexOf(playbackRate)
    const nextRate = rates[(currentIndex + 1) % rates.length]
    
    audio.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00'
    
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`flex flex-col gap-3 p-4 bg-card border border-border rounded-lg ${className}`}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Timeline */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(-10)}
            title="Skip back 10s"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            onClick={togglePlay}
            className="h-10 w-10"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(10)}
            title="Skip forward 10s"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Playback speed */}
          <Button
            variant="ghost"
            size="sm"
            onClick={changePlaybackRate}
            className="text-xs font-mono w-12"
          >
            {playbackRate}x
          </Button>

          {fileName && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground max-w-[180px]">
              <FileAudio className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{fileName}</span>
            </span>
          )}

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-20"
            />
          </div>
        </div>
      </div>
    </div>
  )
})

AudioPlayer.displayName = 'AudioPlayer'
