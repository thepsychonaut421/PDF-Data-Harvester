
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
import { PlusCircle, Edit3, Trash2, Save, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    // Default templates can be viewed but not fully edited in terms of core structure (id, isDefault)
    // Name and columns can be 'edited' but it would effectively create a new custom template if saved.
    // For simplicity, let's allow editing their column string, but on save, it will be treated as a new template if ID is a default one.
    // OR, prevent editing default templates' columns here directly.
    // Current approach: allow editing, save will handle logic.
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
    
    // If editing a default template, force creation of a new template instead of overwriting.
    const originalTemplate = editingTemplate.id ? templates.find(t => t.id === editingTemplate.id) : null;
    const isEditingDefaultAndModified = originalTemplate?.isDefault && 
                                     (originalTemplate.name !== templateName || originalTemplate.columns.join(', ') !== editingTemplate.columnsText);


    if (isNewTemplate || isEditingDefaultAndModified) {
      if (templates.some(t => t.name.toLowerCase() === templateName.toLowerCase() && t.id !== editingTemplate.id)) {
        toast({ title: 'Eroare la Adăugare/Salvare ca Nou', description: `Un șablon cu numele "${templateName}" există deja.`, variant: 'destructive' });
        return;
      }
      const newId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      newTemplates = [...templates, { id: newId, name: templateName, columns: columnsArray, isDefault: false }];
      toast({ title: 'Șablon adăugat', description: `Șablonul "${templateName}" a fost adăugat.` });
    } else if (editingTemplate.id && !originalTemplate?.isDefault) { // Editing an existing non-default template
       if (templates.some(t => t.id !== editingTemplate.id && t.name.toLowerCase() === templateName.toLowerCase())) {
        toast({ title: 'Eroare la Salvare', description: `Un alt șablon cu numele "${templateName}" există deja.`, variant: 'destructive' });
        return;
      }
      newTemplates = templates.map(t =>
        t.id === editingTemplate.id ? { ...t, name: templateName, columns: columnsArray, isDefault: false } : t
      );
      toast({ title: 'Șablon salvat', description: `Modificările pentru "${templateName}" au fost salvate.` });
    } else if (originalTemplate?.isDefault && !isEditingDefaultAndModified) {
      // Trying to save a default template without changes
      toast({ title: 'Nicio modificare', description: 'Nu au fost detectate modificări la șablonul implicit.', variant: 'info'});
      setEditingTemplate(null);
      setIsNewTemplate(false);
      return;
    }
     else {
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
            Creați și gestionați șabloane pentru a personaliza coloanele extrase din liniile de produse ale facturilor. Aceste șabloane pot fi folosite atât la încărcarea PDF-urilor (pentru a ghida AI-ul) cât și la exportul CSV în format detaliat.
          </DialogDescription>
        </DialogHeader>

        {editingTemplate ? (
          <div className="space-y-4 py-4">
            <h3 className="text-lg font-semibold">
                {isNewTemplate ? 'Adaugă Șablon Nou' : 
                    (templates.find(t => t.id === editingTemplate.id)?.isDefault ? `Vizualizare Șablon Implicit (Salvarea va crea o copie custom)` : 'Editează Șablon Custom')}
            </h3>
            <div>
              <Label htmlFor="templateName">Nume Șablon</Label>
              <Input
                id="templateName"
                value={editingTemplate.name || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Articole Magazin ABC"
                disabled={templates.find(t => t.id === editingTemplate.id)?.isDefault && editingTemplate.id === 'erpnext-article-default'} // Lock name for ERPNext default
              />
            </div>
            <div>
              <Label htmlFor="templateColumns">Coloane Produs (separate prin virgulă)</Label>
              <Textarea
                id="templateColumns"
                value={editingTemplate.columnsText || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, columnsText: e.target.value }))}
                placeholder="Ex: item_code, name, quantity, price, amount"
                rows={3}
              />
               <p className="text-xs text-muted-foreground mt-1">
                Coloane standard GenAI: item_code, name, quantity, unit, price, discount_value, discount_percent, net_amount, tax_percent, tax_amount, amount (total brut linie).
                <br/> Puteți folosi și denumiri specifice documentelor (ex: Artikelnummer, Denumire Produs, MwSt Satz, Gesamtbetrag).
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
              <ScrollArea className="h-[350px] pr-4">
                <ul className="space-y-2">
                  {templates.map(template => (
                    <li key={template.id} className={`flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/50 ${template.isDefault ? 'border-primary/30' : ''}`}>
                      <div>
                        <p className="font-medium flex items-center">
                          {template.name}
                          {template.isDefault && (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                   <Info className="h-4 w-4 ml-2 text-primary cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>Acesta este un șablon implicit și nu poate fi șters. Editarea numelui sau coloanelor și salvarea va crea un nou șablon personalizat.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-md truncate" title={template.columns.join(', ')}>Coloane: {template.columns.join(', ')}</p>
                      </div>
                      <div className="space-x-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} title={template.isDefault ? "Vizualizează/Copiază Șablon" : "Editează Șablonul"}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {!template.isDefault && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} title="Șterge Șablonul" className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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

