
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InvoiceTemplate } from '@/lib/types';
import { PlusCircle, Edit3, Trash2, Save, Info, UploadCloud, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from '@/components/ui/checkbox';

interface TemplateManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  templates: InvoiceTemplate[];
  onTemplatesChange: (templates: InvoiceTemplate[]) => void;
}

const TemplateManagerDialog: FC<TemplateManagerDialogProps> = ({
  isOpen,
  onOpenChange,
  templates,
  onTemplatesChange,
}) => {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<Partial<InvoiceTemplate> & { columnsText?: string } | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);

  // Default template IDs that should not have their `forUpload` status changed by the user
  const lockedForUploadStatusTemplateIds = [
    'erpnext-article-default', 
    'ai-standard-upload-template',
    'comprehensive-invoice-upload-template',
    'comprehensive-invoice-export-template'
  ];

  useEffect(() => {
    if (!isOpen) {
      setEditingTemplate(null);
      setIsNewTemplate(false);
    }
  }, [isOpen]);

  const handleAddNew = () => {
    setEditingTemplate({ id: '', name: '', columnsText: '', forUpload: true }); // Default to upload template
    setIsNewTemplate(true);
  };

  const handleEdit = (template: InvoiceTemplate) => {
    setEditingTemplate({ ...template, columnsText: template.columns.join(', ') });
    setIsNewTemplate(false);
  };

  const handleDelete = (templateId: string) => {
    const templateToDelete = templates.find(t => t.id === templateId);
    if (templateToDelete?.isDefault) {
      toast({ title: 'Operațiune Interzisă', description: 'Șabloanele implicite nu pot fi șterse.', variant: 'warning' });
      return;
    }
    const newTemplates = templates.filter(t => t.id !== templateId);
    onTemplatesChange(newTemplates);
    toast({ title: 'Șablon șters', description: 'Șablonul a fost șters cu succes.' });
  };

  const handleSave = () => {
    if (!editingTemplate || !editingTemplate.name?.trim()) {
      toast({ title: 'Eroare', description: 'Numele șablonului este obligatoriu.', variant: 'destructive' });
      return;
    }

    const columnsArray = editingTemplate.columnsText
      ? editingTemplate.columnsText.split(',').map(col => col.trim().replace(/"/g, '')).filter(col => col.length > 0)
      : [];

    if (columnsArray.length === 0) {
       toast({ title: 'Eroare', description: 'Trebuie specificată cel puțin o coloană.', variant: 'destructive' });
      return;
    }

    let newTemplates;
    const templateName = editingTemplate.name.trim();
    
    const originalTemplate = editingTemplate.id ? templates.find(t => t.id === editingTemplate.id) : null;
    const isEditingDefaultAndModified = originalTemplate?.isDefault && 
                                     (originalTemplate.name !== templateName || 
                                      originalTemplate.columns.join(', ') !== editingTemplate.columnsText ||
                                      originalTemplate.forUpload !== editingTemplate.forUpload);
    
    const finalForUploadStatus = editingTemplate.forUpload;


    if (isNewTemplate || (originalTemplate?.isDefault && isEditingDefaultAndModified)) {
      // Check for name collision only among templates of the same type (upload/export) if it's a new or copied-from-default
      if (templates.some(t => t.name.toLowerCase() === templateName.toLowerCase() && t.forUpload === finalForUploadStatus)) {
        toast({ title: 'Eroare la Adăugare/Salvare ca Nou', description: `Un șablon ${finalForUploadStatus ? 'de upload' : 'de export'} cu numele "${templateName}" există deja.`, variant: 'destructive' });
        return;
      }
      const newId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      newTemplates = [...templates, { id: newId, name: templateName, columns: columnsArray, isDefault: false, forUpload: finalForUploadStatus }];
      toast({ title: `Șablon ${finalForUploadStatus ? 'de upload' : 'de export'} adăugat`, description: `Șablonul "${templateName}" a fost adăugat.` });
    } else if (editingTemplate.id && !originalTemplate?.isDefault) { 
       if (templates.some(t => t.id !== editingTemplate.id && t.name.toLowerCase() === templateName.toLowerCase() && t.forUpload === finalForUploadStatus)) {
        toast({ title: 'Eroare la Salvare', description: `Un alt șablon ${finalForUploadStatus ? 'de upload' : 'de export'} cu numele "${templateName}" există deja.`, variant: 'destructive' });
        return;
      }
      newTemplates = templates.map(t =>
        t.id === editingTemplate.id ? { ...t, name: templateName, columns: columnsArray, isDefault: false, forUpload: finalForUploadStatus } : t
      );
      toast({ title: `Șablon ${finalForUploadStatus ? 'de upload' : 'de export'} salvat`, description: `Modificările pentru "${templateName}" au fost salvate.` });
    } else if (originalTemplate?.isDefault && !isEditingDefaultAndModified) {
      toast({ title: 'Nicio modificare', description: 'Nu au fost detectate modificări la șablonul implicit.', variant: 'default'});
      setEditingTemplate(null);
      setIsNewTemplate(false);
      return;
    }
     else {
      // Should not reach here if logic is correct
      console.warn("Save handler reached unexpected state:", editingTemplate);
      return; 
    }
    onTemplatesChange(newTemplates);
    setEditingTemplate(null);
    setIsNewTemplate(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Gestionare Șabloane de Extragere/Export</DialogTitle>
          <DialogDescription>
            Creați și gestionați șabloane pentru a personaliza coloanele extrase din liniile de produse. Șabloanele de <strong>Upload</strong> ghidează AI-ul la extragerea inițială. Șabloanele de <strong>Export</strong> definesc formatul CSV pentru exportul detaliat.
          </DialogDescription>
        </DialogHeader>

        {editingTemplate ? (
          <div className="space-y-4 py-4">
            <h3 className="text-lg font-semibold">
                {isNewTemplate ? 'Adaugă Șablon Nou' : 
                    (templates.find(t => t.id === editingTemplate.id)?.isDefault ? `Vizualizare Șablon Implicit (Salvarea va crea o copie customizabilă)` : 'Editează Șablon Custom')}
            </h3>
            <div>
              <Label htmlFor="templateName">Nume Șablon</Label>
              <Input
                id="templateName"
                value={editingTemplate.name || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Articole Magazin ABC (Export) sau Detalii Factură Client X (Upload)"
                disabled={templates.find(t => t.id === editingTemplate.id)?.isDefault && lockedForUploadStatusTemplateIds.includes(editingTemplate.id!)} 
              />
            </div>
            <div>
              <Label htmlFor="templateColumns">Coloane Produs (separate prin virgulă)</Label>
              <Textarea
                id="templateColumns"
                value={editingTemplate.columnsText || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, columnsText: e.target.value }))}
                placeholder="Ex: item_code, name, quantity, price, amount (pentru AI Standard) sau Artikelnummer, Artikelbezeichnung etc."
                rows={3}
                 disabled={templates.find(t => t.id === editingTemplate.id)?.isDefault && lockedForUploadStatusTemplateIds.includes(editingTemplate.id!)}
              />
               <p className="text-xs text-muted-foreground mt-1">
                Coloane standard GenAI: item_code, name, quantity, unit, price, discount_value, discount_percent, net_amount, tax_percent, tax_amount, amount (total brut linie).
                <br/> Puteți folosi și denumiri specifice documentelor (ex: Artikelnummer, Denumire Produs, MwSt Satz, Gesamtbetrag). Pentru export ERPNext folosiți: item_code, item_name, qty, uom, rate, amount.
              </p>
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="forUpload"
                    checked={editingTemplate.forUpload}
                    onCheckedChange={(checked) => 
                        setEditingTemplate(prev => ({ ...prev, forUpload: Boolean(checked) }))
                    }
                    disabled={originalTemplate?.isDefault && lockedForUploadStatusTemplateIds.includes(originalTemplate.id)}
                />
                <Label htmlFor="forUpload" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Folosește ca șablon de Upload (ghidare AI la extragere)
                </Label>
                 <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs p-2">
                        <p>Bifați dacă acest șablon definește coloanele pe care AI-ul ar trebui să le caute la încărcarea unui PDF. Lăsați nebifat dacă este un șablon doar pentru formatarea exportului CSV.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>Anulează</Button>
              <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Salvează Șablon</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="my-4">
              <Button onClick={handleAddNew} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Adaugă Șablon Nou
              </Button>
            </div>
            {templates.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nu există șabloane definite.</p>
            ) : (
            <>
            <div>
                <h4 className="text-md font-semibold mb-2 flex items-center"><UploadCloud className="mr-2 h-5 w-5 text-primary" />Șabloane de Upload</h4>
                <ScrollArea className="h-[170px] pr-4 border rounded-md p-2 mb-4">
                <ul className="space-y-2">
                  {templates.filter(t => t.forUpload).map(template => (
                    <li key={template.id} className={`flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/50 ${template.isDefault ? 'border-primary/30' : ''}`}>
                      <div>
                        <p className="font-medium flex items-center">
                          {template.name}
                          {template.isDefault && (
                            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 ml-2 text-primary cursor-help" /></TooltipTrigger><TooltipContent><p>Șablon implicit. Editarea va crea o copie.</p></TooltipContent></Tooltip></TooltipProvider>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-md truncate" title={template.columns.join(', ')}>Coloane: {template.columns.join(', ')}</p>
                      </div>
                      <div className="space-x-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} title={template.isDefault && lockedForUploadStatusTemplateIds.includes(template.id) ? "Vizualizează/Copiază Șablon" : "Editează Șablonul"}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {!(template.isDefault && lockedForUploadStatusTemplateIds.includes(template.id)) && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} title="Șterge Șablonul" className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                   {templates.filter(t => t.forUpload).length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nu sunt șabloane de upload.</p>}
                </ul>
              </ScrollArea>
            </div>
            <div>
                <h4 className="text-md font-semibold mb-2 flex items-center"><Download className="mr-2 h-5 w-5 text-primary" />Șabloane de Export</h4>
                <ScrollArea className="h-[170px] pr-4 border rounded-md p-2">
                <ul className="space-y-2">
                  {templates.filter(t => !t.forUpload).map(template => (
                     <li key={template.id} className={`flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/50 ${template.isDefault ? 'border-primary/30' : ''}`}>
                      <div>
                        <p className="font-medium flex items-center">
                          {template.name}
                           {template.isDefault && (
                            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 ml-2 text-primary cursor-help" /></TooltipTrigger><TooltipContent><p>Șablon implicit. Editarea va crea o copie.</p></TooltipContent></Tooltip></TooltipProvider>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-md truncate" title={template.columns.join(', ')}>Coloane: {template.columns.join(', ')}</p>
                      </div>
                      <div className="space-x-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} title={template.isDefault && lockedForUploadStatusTemplateIds.includes(template.id) ? "Vizualizează/Copiază Șablon" : "Editează Șablonul"}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                         {!(template.isDefault && lockedForUploadStatusTemplateIds.includes(template.id)) && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} title="Șterge Șablonul" className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                  {templates.filter(t => !t.forUpload).length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nu sunt șabloane de export.</p>}
                </ul>
              </ScrollArea>
            </div>
            </>
            )}
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button variant="outline">Închide</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TemplateManagerDialog;
