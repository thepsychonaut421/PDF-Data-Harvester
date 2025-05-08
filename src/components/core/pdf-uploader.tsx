
'use client';

import type { ChangeEvent, DragEvent, FC } from 'react';
import { useState, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface PdfUploaderProps {
  onUploadFiles: (files: File[]) => Promise<void>;
  isProcessing: boolean;
}

const PdfUploader: FC<PdfUploaderProps> = ({ onUploadFiles, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processSelectedFiles = (incomingFiles: FileList | null) => {
    if (incomingFiles && incomingFiles.length > 0) {
      const newPdfFiles = Array.from(incomingFiles).filter(file => file.type === 'application/pdf');
      // Add only new files, prevent duplicates based on name and lastModified
      setSelectedFiles(prevFiles => {
        const currentFileSignatures = new Set(prevFiles.map(f => `${f.name}-${f.lastModified}`));
        const filesToAdd = newPdfFiles.filter(nf => !currentFileSignatures.has(`${nf.name}-${nf.lastModified}`));
        return [...prevFiles, ...filesToAdd];
      });
    }
  };

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processSelectedFiles(e.dataTransfer.files);
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    processSelectedFiles(e.target.files);
    if (e.target) { // Reset file input to allow re-uploading the same file(s)
      e.target.value = '';
    }
  }, []);


  const handleUploadAndProcess = async () => {
    if (selectedFiles.length === 0 || isProcessing) return;
    await onUploadFiles(selectedFiles);
    setSelectedFiles([]); // Clear selection after initiating upload
  };
  

  return (
    <div className="space-y-3">
      <label
        htmlFor="dropzone-file-input" // Changed ID for clarity
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer 
                    bg-secondary hover:bg-muted transition-colors
                    ${dragActive ? 'border-primary' : 'border-border'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          <UploadCloud className={`w-8 h-8 mb-2 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className={`text-sm ${dragActive ? 'text-primary' : 'text-muted-foreground'}`}>
            <span className="font-semibold">Alege fișiere</span> sau trage aici
          </p>
          <p className="text-xs text-muted-foreground">Doar fișiere PDF</p>
        </div>
        <input id="dropzone-file-input" type="file" className="hidden" multiple accept=".pdf" onChange={handleChange} />
      </label>

      {selectedFiles.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedFiles.length} fișier(e) selectate: {selectedFiles.map(f => f.name).join(', ')}
        </div>
      )}

      <Button
        type="button"
        onClick={handleUploadAndProcess}
        disabled={selectedFiles.length === 0 || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Se Procesează...
          </>
        ) : (
          <>
            <UploadCloud className="mr-2 h-4 w-4" />
            Încarcă și Procesează ({selectedFiles.length})
          </>
        )}
      </Button>
    </div>
  );
};

export default PdfUploader;
