import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export interface ProcessingJob {
  id: string;
  type: 'convert' | 'merge' | 'full-process';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  inputFiles: string[];
  outputFile?: string;
  error?: string;
  createdAt: Date;
  steps?: {
    extract: boolean;
    convert: boolean;
    merge: boolean;
  };
}

export class PDFProcessor {
  private jobs: Map<string, ProcessingJob> = new Map();
  private uploadDir = path.join(process.cwd(), 'uploads');
  private outputDir = path.join(process.cwd(), 'outputs');

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  async createJob(type: ProcessingJob['type'], inputFiles: string[]): Promise<string> {
    const jobId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const job: ProcessingJob = {
      id: jobId,
      type,
      status: 'pending',
      progress: 0,
      inputFiles,
      createdAt: new Date(),
      steps: type === 'full-process' ? {
        extract: false,
        convert: false,
        merge: false
      } : undefined
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  private updateJob(jobId: string, updates: Partial<ProcessingJob>) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
      this.jobs.set(jobId, job);
    }
  }

  async processArchive(jobId: string, archivePath: string): Promise<void> {
    try {
      this.updateJob(jobId, { status: 'processing', progress: 10 });

      // Step 1: Extract archive
      const extractDir = path.join(this.uploadDir, `extracted_${jobId}`);
      await this.extractArchive(archivePath, extractDir);
      
      this.updateJob(jobId, { 
        progress: 30,
        steps: { extract: true, convert: false, merge: false }
      });

      // Step 2: Find HTML files
      const htmlFiles = await this.findHtmlFiles(extractDir);
      if (htmlFiles.length === 0) {
        throw new Error('No HTML files found in the archive');
      }

      this.updateJob(jobId, { progress: 40 });

      // Step 3: Convert HTML to PDF
      const pdfDir = path.join(this.outputDir, `pdfs_${jobId}`);
      await fs.mkdir(pdfDir, { recursive: true });
      
      await this.convertHtmlToPdf(extractDir, pdfDir);
      
      this.updateJob(jobId, { 
        progress: 70,
        steps: { extract: true, convert: true, merge: false }
      });

      // Step 4: Merge PDFs
      const mergedPdfPath = path.join(this.outputDir, `merged_${jobId}.pdf`);
      await this.mergePdfs(pdfDir, mergedPdfPath);

      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        outputFile: `merged_${jobId}.pdf`,
        steps: { extract: true, convert: true, merge: true }
      });

      // Cleanup temporary files
      await this.cleanup(extractDir, pdfDir);

    } catch (error) {
      this.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      throw error;
    }
  }

  private async extractArchive(archivePath: string, extractDir: string): Promise<void> {
    await fs.mkdir(extractDir, { recursive: true });
    
    const ext = path.extname(archivePath).toLowerCase();
    
    if (ext === '.zip') {
      const extract = await import('extract-zip');
      await extract(archivePath, { dir: extractDir });
    } else if (ext === '.rar') {
      // Check if unrar is available
      const { spawn } = await import('child_process');
      const checkUnrar = spawn('which', ['unrar']);
      
      const isUnrarAvailable = await new Promise<boolean>((resolve) => {
        checkUnrar.on('close', (code) => {
          resolve(code === 0);
        });
        checkUnrar.on('error', () => {
          resolve(false);
        });
      });
      
      if (!isUnrarAvailable) {
        throw new Error('RAR extraction is not supported on this system. Please install unrar utility or use ZIP files instead. For Ubuntu/Debian: sudo apt-get install unrar');
      }
      
      return new Promise((resolve, reject) => {
        const unrar = spawn('unrar', ['x', '-y', archivePath, extractDir + '/']);
        
        unrar.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`RAR extraction failed with code ${code}`));
          }
        });
        
        unrar.on('error', (error) => {
          reject(new Error(`RAR extraction error: ${error.message}. Please install unrar utility or use ZIP files instead.`));
        });
      });
    } else {
      throw new Error('Unsupported archive format. Please use ZIP or RAR files.');
    }
  }

  private async findHtmlFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDirectory(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && /\.(html|htm)$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
    
    await scanDirectory(dir);
    return files.sort();
  }

  private async convertHtmlToPdf(inputDir: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.resolve(process.cwd(), 'backend', 'convert_with_playwright.py');
      
      const args = [
        pythonScript,
        '--input-dir', inputDir,
        '--pattern', '*.html',
        '--out-dir', outputDir
      ];

      // Try different Python executables
      const pythonExecutables = ['python3', 'python', '/usr/bin/python3', '/usr/local/bin/python3'];
      let python;
      
      for (const executable of pythonExecutables) {
        try {
          python = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
          break;
        } catch (error) {
          continue;
        }
      }
      
      if (!python) {
        reject(new Error('Python executable not found. Please ensure Python 3.x is installed.'));
        return;
      }
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Python stderr:', data.toString());
      });
      
      python.on('close', (code) => {
        console.log(`Python script exited with code: ${code}`);
        console.log('Final stdout:', stdout);
        console.log('Final stderr:', stderr);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`HTML to PDF conversion failed: ${stderr || stdout}`));
        }
      });
      
      python.on('error', (error) => {
        console.error('Python spawn error:', error);
        reject(new Error(`Failed to start Python script: ${error.message}`));
      });
    });
  }

  private async mergePdfs(pdfDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.resolve(process.cwd(), 'backend', 'merge_pdfs.py');
      
      const args = [
        pythonScript,
        '--input-dir', pdfDir,
        '--pattern', '*.pdf',
        '--output', outputPath
      ];

      // Try different Python executables
      const pythonExecutables = ['python3', 'python', '/usr/bin/python3', '/usr/local/bin/python3'];
      let python;
      
      for (const executable of pythonExecutables) {
        try {
          python = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
          break;
        } catch (error) {
          continue;
        }
      }
      
      if (!python) {
        reject(new Error('Python executable not found. Please ensure Python 3.x is installed.'));
        return;
      }
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Merge stdout:', data.toString());
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Merge stderr:', data.toString());
      });
      
      python.on('close', (code) => {
        console.log(`Merge script exited with code: ${code}`);
        console.log('Final stdout:', stdout);
        console.log('Final stderr:', stderr);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`PDF merge failed: ${stderr || stdout}`));
        }
      });
      
      python.on('error', (error) => {
        console.error('Merge spawn error:', error);
        reject(new Error(`Failed to start Python script: ${error.message}`));
      });
    });
  }

  private async cleanup(extractDir: string, pdfDir: string): Promise<void> {
    try {
      await fs.rm(extractDir, { recursive: true, force: true });
      await fs.rm(pdfDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  async downloadFile(filename: string): Promise<string | null> {
    const filePath = path.join(this.outputDir, filename);
    
    if (existsSync(filePath)) {
      return filePath;
    }
    
    return null;
  }
}

export const pdfProcessor = new PDFProcessor();