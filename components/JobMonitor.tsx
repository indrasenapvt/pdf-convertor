"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, CircleCheck as CheckCircle, Circle as XCircle, Clock, Loader as Loader2, Archive, FileImage, Merge } from 'lucide-react';
import { toast } from 'sonner';

interface ProcessingJob {
  id: string;
  type: 'convert' | 'merge' | 'full-process';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  inputFiles: string[];
  outputFile?: string;
  error?: string;
  createdAt: string;
  steps?: {
    extract: boolean;
    convert: boolean;
    merge: boolean;
  };
}

interface JobMonitorProps {
  refreshTrigger?: number;
}

export function JobMonitor({ refreshTrigger }: JobMonitorProps) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(fetchJobs, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async (filename: string) => {
    try {
      const response = await fetch(`/api/download/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Download started!');
      } else {
        toast.error('Download failed');
      }
    } catch (error) {
      toast.error('Download error');
    }
  };

  const getStatusIcon = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ProcessingJob['status']) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getStepIcon = (completed: boolean, isActive: boolean) => {
    if (completed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (isActive) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    } else {
      return <Clock className="h-4 w-4 text-gray-300" />;
    }
  };

  const getCurrentStep = (job: ProcessingJob) => {
    if (!job.steps) return null;
    if (!job.steps.extract) return 'extract';
    if (!job.steps.convert) return 'convert';
    if (!job.steps.merge) return 'merge';
    return 'completed';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading jobs...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing Jobs</CardTitle>
        <CardDescription>
          Monitor your PDF processing tasks
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No jobs yet</p>
            <p className="text-sm">Upload an archive to start processing</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className="font-medium">
                      Archive Processing
                    </span>
                  </div>
                  {getStatusBadge(job.status)}
                </div>

                {job.status === 'processing' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Progress value={job.progress} className="h-2" />
                      <p className="text-xs text-gray-500">
                        {job.progress}% complete
                      </p>
                    </div>

                    {job.steps && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Processing Steps:</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            {getStepIcon(job.steps.extract, getCurrentStep(job) === 'extract')}
                            <span className={job.steps.extract ? 'text-green-700' : 'text-gray-500'}>
                              Extract
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getStepIcon(job.steps.convert, getCurrentStep(job) === 'convert')}
                            <span className={job.steps.convert ? 'text-green-700' : 'text-gray-500'}>
                              Convert
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getStepIcon(job.steps.merge, getCurrentStep(job) === 'merge')}
                            <span className={job.steps.merge ? 'text-green-700' : 'text-gray-500'}>
                              Merge
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  <p className="font-medium">Input Files:</p>
                  <ul className="list-disc list-inside ml-2">
                    {(job.inputFiles ?? []).slice(0, 2).map((file, idx) => (
                      <li key={idx} className="truncate">{file}</li>
                    ))}
                    {(job.inputFiles ?? []).length > 2 && (
                      <li>... and {(job.inputFiles ?? []).length - 2} more</li>
                    )}
                  </ul>
                </div>

                {job.outputFile && (
                  <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">
                        {job.outputFile}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleDownload(job.outputFile!)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                )}

                {job.error && (
                  <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-700">
                      {job.error}
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-gray-400">
                  {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}