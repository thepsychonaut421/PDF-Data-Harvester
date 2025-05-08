'use client';

import type { ChangeEvent, DragEvent, FC } from 'react';
import { useState, useCallback, useMemo } from 'react';
import { UploadCloud, FileText, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PdfStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface UploadableFile {
  file: File;
  id: string;
  status: PdfStatus;
  progress: number; // 0-100
  errorMessage?: string;
}

interface PdfUploaderProps {
  onUploadFiles: (files: File[]) => Promise<void>; // Simulates upload and processing
  isProcessing: boolean;
}

const PdfUploader: FC<PdfUploaderProps> = ({ onUploadFiles, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadableFile[]>([]);

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files)
        .filter(file => file.type === 'application/pdf')
        .map(file => ({
          file,
          id: `${file.name}-${file.lastModified}`,
          status: 'pending' as PdfStatus,
          progress: 0,
        }));
      setUploadedFiles(prevFiles => [...prevFiles, ...newFiles.filter(nf => !prevFiles.some(pf => pf.id === nf.id))]);
    }
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
        .filter(file => file.type === 'application/pdf')
        .map(file => ({
          file,
          id: `${file.name}-${file.lastModified}`,
          status: 'pending' as PdfStatus,
          progress: 0,
        }));
      setUploadedFiles(prevFiles => [...prevFiles, ...newFiles.filter(nf => !prevFiles.some(pf => pf.id === nf.id))]);
      e.target.value = ''; // Reset file input
    }
  }, []);

  const removeFile = (id: string) => {
    setUploadedFiles(files => files.filter(file => file.id !== id));
  };

  const handleUpload = async () => {
    const filesToUpload = uploadedFiles.filter(uf => uf.status === 'pending').map(uf => uf.file);
    if (filesToUpload.length === 0) return;

    // Visually mark files as uploading
    setUploadedFiles(prev => prev.map(uf => filesToUpload.includes(uf.file) ? {...uf, status: 'uploading', progress: 10} : uf));
    
    await onUploadFiles(filesToUpload);
    
    // After onUploadFiles resolves, status updates will come from parent via props affecting ExtractedData
    // For demo, we can clear pending files or assume parent handles their transition.
    // For now, we'll rely on the parent component to update statuses which will then reflect in DataDashboard.
    // PdfUploader mainly handles initial selection and triggering the upload.
    // To give feedback, we could simulate progress here if onUploadFiles provided callbacks
    setUploadedFiles(prev => prev.map(uf => filesToUpload.includes(uf.file) ? {...uf, progress: 100, status: 'processing'} : uf));

  };
  
  const filesReadyToUpload = useMemo(() => uploadedFiles.filter(f => f.status === 'pending').length > 0, [uploadedFiles]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <UploadCloud className="mr-2 h-6 w-6" />
          Încarcă Fișiere PDF
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <div>
            <label
              htmlFor="dropzone-file"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer 
                          bg-secondary hover:bg-muted transition-colors
                          ${dragActive ? 'border-primary' : 'border-border'}`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className={`w-10 h-10 mb-3 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className={`mb-2 text-sm ${dragActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  <span className="font-semibold">Click pentru a încărca</span> sau trage fișierele aici
                </p>
                <p className="text-xs text-muted-foreground">PDF (max. 10MB per fișier)</p>
              </div>
              <input id="dropzone-file" type="file" className="hidden" multiple accept=".pdf" onChange={handleChange} />
            </label>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-md font-medium text-foreground">Fișiere selectate:</h3>
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {uploadedFiles.map(item => (
                  <li key={item.id} className="flex items-center justify-between p-3 bg-background border rounded-md">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-6 w-6 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground truncate max-w-xs">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                       {item.status === 'uploading' && <Progress value={item.progress} className="w-24 h-2" />}
                       {item.status === 'pending' && <Badge variant="outline">În așteptare</Badge>}
                       {item.status === 'uploading' && <Badge variant="secondary">Se încarcă...</Badge>}
                       {item.status === 'processing' && <Badge variant="default" className="bg-blue-500 hover:bg-blue-600"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Se procesează</Badge>}
                       {/* Final statuses will be shown in DataDashboard. Uploader might clear files or show temporary success. */}
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(item.id)} className="h-7 w-7">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Elimină fișier</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            type="button"
            onClick={handleUpload}
            disabled={!filesReadyToUpload || isProcessing}
            className="w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Se Procesează...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Încarcă și Procesează Fișiere
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PdfUploader;
