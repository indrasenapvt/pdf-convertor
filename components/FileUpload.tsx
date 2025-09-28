"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileArchive, CircleCheck as CheckCircle, Circle as XCircle, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadProps {
  onUploadComplete: (jobId: string) => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      toast.success('File uploaded successfully! Processing started.');
      onUploadComplete(result.jobId);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/vnd.rar': ['.rar']
    },
    maxFiles: 1,
    disabled: uploading
  });

  return (
    <Card className="border-2 border-dashed transition-colors duration-200 hover:border-blue-400">
      <CardContent className="p-8">
        <div
          {...getRootProps()}
          className={`
            text-center cursor-pointer transition-all duration-200
            ${isDragActive && !isDragReject ? 'scale-105' : ''}
            ${isDragReject ? 'border-red-300 bg-red-50' : ''}
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center space-y-4">
            {uploading ? (
              <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
            ) : (
              <div className="relative">
                <FileArchive className="h-16 w-16 text-gray-400" />
                <Upload className="h-6 w-6 text-blue-500 absolute -top-1 -right-1 bg-white rounded-full p-1" />
              </div>
            )}
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {uploading ? 'Uploading...' : 'Upload Archive File'}
              </h3>
              
              {uploading ? (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-64" />
                  <p className="text-sm text-gray-500">
                    {uploadProgress}% uploaded
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-gray-600">
                    {isDragActive
                      ? isDragReject
                        ? 'File type not supported'
                        : 'Drop your archive here'
                      : 'Drag & drop your ZIP or RAR file here, or click to browse'
                    }
                  </p>
                  <p className="text-sm text-gray-500">
                    Supported formats: ZIP, RAR (max 100MB)
                  </p>
                </div>
              )}
            </div>
            
            {!uploading && (
              <Button variant="outline" className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert className="mt-4 border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}