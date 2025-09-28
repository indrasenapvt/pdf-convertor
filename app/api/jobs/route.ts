import { NextResponse } from 'next/server';
import { pdfProcessor } from '@/lib/pdf-processor';

export async function GET() {
  try {
    const jobs = pdfProcessor.getAllJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}