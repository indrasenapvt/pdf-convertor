import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { pdfProcessor } from '@/lib/pdf-processor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('No file in request');
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log('File received:', file.name, 'Size:', file.size);

    // Validate file type
    const allowedTypes = ['.zip', '.rar'];
    const fileExtension = path.extname(file.name).toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      console.log('Invalid file type:', fileExtension);
      return NextResponse.json(
        { error: 'Only ZIP and RAR files are allowed' },
        { status: 400 }
      );
    }

    // Save uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const uploadDir = path.join(process.cwd(), 'uploads');
    await writeFile(path.join(process.cwd(), 'uploads', '.gitkeep'), ''); // Ensure directory exists
    const filename = `${Date.now()}_${file.name}`;
    const filepath = path.join(uploadDir, filename);
    
    console.log('Saving file to:', filepath);
    await writeFile(filepath, buffer);

    // Create processing job
    const jobId = await pdfProcessor.createJob('full-process', [file.name]);
    console.log('Created job:', jobId);
    
    // Start processing in background
    setImmediate(() => {
      pdfProcessor.processArchive(jobId, filepath).catch(error => {
      console.error('Processing error:', error);
      });
    });

    console.log('Upload successful, job started');
    return NextResponse.json({
      success: true,
      jobId,
      message: 'File uploaded successfully. Processing started.'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}