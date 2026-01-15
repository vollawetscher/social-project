'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileAudio, X } from 'lucide-react'
import { toast } from 'sonner'

interface AudioUploaderProps {
  onFileSelected: (file: File) => void
}

export function AudioUploader({ onFileSelected }: AudioUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptedFormats = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/webm',
  ]

  const acceptedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.webm']

  const validateFile = (file: File): boolean => {
    if (!acceptedFormats.some((format) => file.type === format)) {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!acceptedExtensions.includes(extension)) {
        toast.error('Ungültiges Dateiformat. Erlaubt sind: MP3, WAV, M4A, MP4, WebM')
        return false
      }
    }

    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Datei ist zu groß. Maximale Größe: 100MB')
      return false
    }

    return true
  }

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file)
      onFileSelected(file)
      toast.success('Datei ausgewählt: ' + file.name)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedExtensions.join(',')}
              onChange={handleInputChange}
              className="hidden"
            />

            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />

            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Audiodatei hochladen
            </h3>

            <p className="text-sm text-slate-600 mb-4">
              Ziehen Sie eine Datei hierher oder klicken Sie zum Auswählen
            </p>

            <p className="text-xs text-slate-500">
              Unterstützte Formate: MP3, WAV, M4A, MP4, WebM (max. 100MB)
            </p>

            <Button type="button" className="mt-4">
              Datei auswählen
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <FileAudio className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-slate-600">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              Andere Datei auswählen
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedExtensions.join(',')}
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
