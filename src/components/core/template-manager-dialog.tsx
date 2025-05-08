
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
import { PlusCircle, Edit3, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (!isOpen) {
      setEditingTemplate(null);
      setIsNewTemplate(false);
    }
  }, [isOpen]);

  const handleAddNew = () => {
    setEditingTemplate({ id: '', name: '', columnsText: '' });
    setIsNewTemplate(true);
  };

  const handleEdit = (template: InvoiceTemplate) => {
    setEditingTemplate({ ...template, columnsText: template.columns.join(', ') });
    setIsNewTemplate(false);
  };

  const handleDelete = (templateId: string) => {
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
      ? editingTemplate.columnsText.split(',').map(col => col.trim()).filter(col => col.length > 0)
      : [];

    if (columnsArray.length === 0) {
       toast({ title: 'Eroare', description: 'Trebuie specificată cel puțin o coloană.', variant: 'destructive' });
      return;
    }

    let newTemplates;
    const templateName = editingTemplate.name.trim();

    if (isNewTemplate) {
      // Check for duplicate name before adding
      if (templates.some(t => t.name.toLowerCase() === templateName.toLowerCase())) {
        toast({ title: 'Eroare la Adăugare', description: `Un șablon cu numele "${templateName}" există deja.`, variant: 'destructive' });
        return;
      }
      const newId = `template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      newTemplates = [...templates, { id: newId, name: templateName, columns: columnsArray }];
      toast({ title: 'Șablon adăugat', description: `Șablonul "${templateName}" a fost adăugat.` });
    } else if (editingTemplate.id) {
       // Check for duplicate name before saving (if name changed)
       if (templates.some(t => t.id !== editingTemplate.id && t.name.toLowerCase() === templateName.toLowerCase())) {
        toast({ title: 'Eroare la Salvare', description: `Un alt șablon cu numele "${templateName}" există deja.`, variant: 'destructive' });
        return;
      }
      newTemplates = templates.map(t =>
        t.id === editingTemplate.id ? { ...t, name: templateName, columns: columnsArray } : t
      );
      toast({ title: 'Șablon salvat', description: `Modificările pentru "${templateName}" au fost salvate.` });
    } else {
      return; // Should not happen
    }
    onTemplatesChange(newTemplates);
    setEditingTemplate(null);
    setIsNewTemplate(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Gestionare Șabloane de Extragere</DialogTitle>
          <DialogDescription>
            Creați și gestionați șabloane pentru a personaliza coloanele extrase din liniile de produse ale facturilor.
          </DialogDescription>
        </DialogHeader>

        {editingTemplate ? (
          <div className="space-y-4 py-4">
            <h3 className="text-lg font-semibold">{isNewTemplate ? 'Adaugă Șablon Nou' : 'Editează Șablon'}</h3>
            <div>
              <Label htmlFor="templateName">Nume Șablon</Label>
              <Input
                id="templateName"
                value={editingTemplate.name || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Articole Magazin ABC"
              />
            </div>
            <div>
              <Label htmlFor="templateColumns">Coloane Linie Produs (separate prin virgulă)</Label>
              <Textarea
                id="templateColumns"
                value={editingTemplate.columnsText || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, columnsText: e.target.value }))}
                placeholder="Ex: ArtNr, Denumire Produs, Cantitate, Pret Unitar"
                rows={3}
              />
               <p className="text-xs text-muted-foreground mt-1">
                Exemplu: Artikelnummer, Artikelbezeichnung, Menge, Einzelpreis, Gesamtpreis
              </p>
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
              <ScrollArea className="h-[300px] pr-4">
                <ul className="space-y-2">
                  {templates.map(template => (
                    <li key={template.id} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/50">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground">Coloane: {template.columns.join(', ')}</p>
                      </div>
                      <div className="space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} title="Editează">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} title="Șterge" className="text-destructive hover:text-destructive/80">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
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
