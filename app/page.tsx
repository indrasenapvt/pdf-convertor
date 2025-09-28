"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/FileUpload';
import { JobMonitor } from '@/components/JobMonitor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileArchive, Zap, Shield, Clock, ArrowRight } from 'lucide-react';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = (jobId: string) => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PDF Processing Suite
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload ZIP or RAR files containing HTML files. We'll extract, convert to styled PDFs, and merge them into a single document.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-8">
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardHeader>
              <CardTitle className="text-xl text-center">How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4 text-center">
                <div className="flex flex-col items-center space-y-2">
                  <div className="p-3 bg-white/20 rounded-full">
                    <FileArchive className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">1. Upload Archive</h3>
                  <p className="text-sm opacity-90">ZIP or RAR file with HTML files</p>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="p-3 bg-white/20 rounded-full">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">2. Extract & Convert</h3>
                  <p className="text-sm opacity-90">HTML files to styled PDFs</p>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="p-3 bg-white/20 rounded-full">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">3. Merge PDFs</h3>
                  <p className="text-sm opacity-90">Combine into single document</p>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="p-3 bg-white/20 rounded-full">
                    <Clock className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">4. Download</h3>
                  <p className="text-sm opacity-90">Get your merged PDF</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2 space-y-6">
            <FileUpload onUploadComplete={handleUploadComplete} />
            
            {/* Requirements */}
            <Alert>
              <ArrowRight className="h-4 w-4" />
              <AlertDescription>
                <strong>Requirements:</strong> Python 3.x with Playwright and PyPDF libraries installed.
                For RAR files: unrar utility must be installed (Ubuntu/Debian: sudo apt-get install unrar).
                <strong> ZIP files are recommended for better compatibility.</strong>
              </AlertDescription>
            </Alert>
          </div>

          {/* Job Monitor */}
          <div>
            <JobMonitor refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </div>
    </div>
  );
}