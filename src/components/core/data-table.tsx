
'use client';

import type { FC, ChangeEvent } from 'react';
import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ExtractedDataItem, SchemaField, Product, InvoiceTemplate } from '@/lib/types';
import { CheckCircle2, AlertTriangle, XCircle, Save, XIcon as CancelIcon, Trash2, Info, Loader2, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface DataTableProps {
  data: ExtractedDataItem[];
  schema: SchemaField[];
  onUpdateItem: (item: ExtractedDataItem) => void;
  onDeleteItem?: (itemId: string) => void;
  templates: InvoiceTemplate[]; 
}

const DataTable: FC<DataTableProps> = ({ data, schema, onUpdateItem, onDeleteItem, templates }) => {
  const [editingCell, setEditingCell] = useState<{ itemId: string; fieldKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string | number | Product[] | null | undefined>('');


  const StatusBadge: FC<{ status: ExtractedDataItem['status'], message?: string }> = ({ status, message }) => {
    switch (status) {
      case 'processed':
        return <Badge variant="default" className="bg-success hover:bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Procesat</Badge>;
      case 'needs_validation':
        return <Badge variant="warning"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Validare</Badge>;
      case 'error':
        return <Badge variant="destructive" title={message}><XCircle className="mr-1 h-3.5 w-3.5" /> Eroare</Badge>;
      case 'pending':
         return <Badge variant="secondary">În așteptare</Badge>;
      case 'uploading':
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Se încarcă...</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-primary/80 hover:bg-primary text-primary-foreground"><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Se procesează...</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCellClick = (item: ExtractedDataItem, field: SchemaField) => {
    if (field.editable && field.key !== 'activeTemplateName') { // activeTemplateName is not directly editable
      setEditingCell({ itemId: item.id, fieldKey: field.key });
      let valueToEdit: any;
      if (field.key === 'fileName' || field.key === 'status' || field.key === 'actions') {
         valueToEdit = item[field.key as keyof typeof item];
      } else {
        valueToEdit = item.extractedValues[field.key as keyof typeof item.extractedValues];
      }

      if (field.type === 'products_list' && Array.isArray(valueToEdit)) {
        setEditValue(JSON.stringify(valueToEdit, null, 2));
      } else if (field.type === 'number' || field.key === 'totalPrice' || field.key === 'subtotal' || field.key === 'totalDiscountAmount' || field.key === 'totalTaxAmount') {
        setEditValue(valueToEdit === null || valueToEdit === undefined ? '' : String(valueToEdit));
      } else {
        setEditValue(valueToEdit !== undefined && valueToEdit !== null ? String(valueToEdit) : '');
      }
    }
  };

  const handleEditChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const itemToUpdate = data.find(d => d.id === editingCell.itemId);
    if (itemToUpdate) {
      let finalValue: any = editValue;
      const fieldSchema = schema.find(f => f.key === editingCell.fieldKey);

      if (fieldSchema?.type === 'number' || fieldSchema?.key === 'totalPrice' || fieldSchema?.key === 'subtotal' || fieldSchema?.key === 'totalDiscountAmount' || fieldSchema?.key === 'totalTaxAmount' ) {
        if (String(editValue).trim() === '') {
          finalValue = null;
        } else {
          // Replace comma with dot and remove non-numeric characters except dot and minus
          const cleanedValue = String(editValue).replace(',', '.').replace(/[^\d.-]/g, '');
          finalValue = parseFloat(cleanedValue);
          if (isNaN(finalValue)) {
             finalValue = itemToUpdate.extractedValues[editingCell.fieldKey as keyof typeof itemToUpdate.extractedValues]; 
          }
        }
      } else if (fieldSchema?.type === 'products_list') {
        try {
          finalValue = JSON.parse(String(editValue));
          if (!Array.isArray(finalValue)) { 
            throw new Error("Produsele trebuie să fie un array.");
          }
          // Further validation for product structure can be added here if needed
        } catch (error) {
          console.error("JSON invalid pentru produse:", error);
          finalValue = itemToUpdate.extractedValues[editingCell.fieldKey as keyof typeof itemToUpdate.extractedValues]; 
        }
      }
      
      const updatedExtractedValues = {
        ...itemToUpdate.extractedValues,
        [editingCell.fieldKey]: finalValue,
      };

      onUpdateItem({
        ...itemToUpdate,
        extractedValues: updatedExtractedValues,
        // Change status if it was in a state that implies data issues, and an editable field was changed
        status: (itemToUpdate.status === 'needs_validation' || itemToUpdate.status === 'error') && fieldSchema?.editable ? 'processed' : itemToUpdate.status,
      });
    }
    setEditingCell(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement || e.currentTarget.id.startsWith('input-totalPrice-') || e.currentTarget.id.startsWith('input-subtotal-') || e.currentTarget.id.startsWith('input-totalDiscountAmount-') || e.currentTarget.id.startsWith('input-totalTaxAmount-') )) { 
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const renderCellContent = (item: ExtractedDataItem, field: SchemaField) => {
    const isCurrentlyEditing = editingCell?.itemId === item.id && editingCell?.fieldKey === field.key;

    if (isCurrentlyEditing) {
      if (field.type === 'products_list') {
        return (
           <Textarea
            value={String(editValue)}
            onChange={handleEditChange}
            onBlur={saveEdit} 
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full p-1 border rounded-md text-sm min-h-[120px] bg-background resize-y"
          />
        );
      }
      return (
        <Input
          id={`input-${field.key}-${item.id}`}
          type={(field.type === 'number' || field.key === 'totalPrice' || field.key === 'subtotal' || field.key === 'totalDiscountAmount' || field.key === 'totalTaxAmount') ? 'text' : field.type === 'date' ? 'date' : 'text'} // Use text for numbers to allow comma input initially
          value={String(editValue)}
          onChange={handleEditChange}
          onBlur={saveEdit} 
          onKeyDown={handleKeyDown}
          autoFocus
          // step={(field.type === 'number' || field.key === 'totalPrice') ? "0.01" : undefined}
          className="w-full p-1 h-8 text-sm bg-background"
        />
      );
    }

    let value: any;
    if (field.key === 'fileName') value = item.fileName;
    else if (field.key === 'status') return <StatusBadge status={item.status} message={item.errorMessage} />;
    else if (field.key === 'activeTemplateName') { 
        const template = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
        value = template ? template.name : 'AI Standard Ext.';
    }
    else value = item.extractedValues[field.key as keyof typeof item.extractedValues];

    const currency = item.extractedValues.currency || '';

    if (field.type === 'products_list' && Array.isArray(value)) {
      const templateUsed = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
      return (
        <ul className="list-disc list-inside text-xs space-y-1 max-w-md">
          {value.map((p: Product, i: number) => {
            let displayTitle = '';
            let displaySummary = '';

            if (templateUsed && templateUsed.columns.length > 0) {
                displayTitle = templateUsed.columns.map(colKey => `${colKey}: ${p[colKey] !== undefined && p[colKey] !== null ? String(p[colKey]) : 'N/A'}`).join(' | ');
                displaySummary = templateUsed.columns.map(colKey => `${p[colKey] !== undefined && p[colKey] !== null ? String(p[colKey]) : 'N/A'}`).slice(0,3).join(' | ') + (templateUsed.columns.length > 3 ? '...' : '');
            } else {
                // Generic display if no template or template has no columns
                const pName = p.name || 'N/A';
                const pQty = (p.quantity !== undefined && p.quantity !== null) ? p.quantity : 'N/A';
                const pPrice = (p.price !== undefined && p.price !== null) ? (typeof p.price === 'number' ? p.price.toFixed(2) : String(p.price)) + ' ' + currency : 'N/A';
                const pAmount = (p.amount !== undefined && p.amount !== null) ? (typeof p.amount === 'number' ? p.amount.toFixed(2) : String(p.amount)) + ' ' + currency : 'N/A';
                displayTitle = `Name: ${pName} | Qty: ${pQty} | Price: ${pPrice} | Amount: ${pAmount}`;
                displaySummary = `${pName} (Qty: ${pQty}, Amt: ${pAmount.split(' ')[0]}...)`;
            }
             return (
              <li key={i} className="truncate" title={displayTitle}>
                {displaySummary}
              </li>
            );
          })}
        </ul>
      );
    }
    if ((field.type === 'number' || field.key === 'totalPrice' || field.key === 'subtotal' || field.key === 'totalDiscountAmount' || field.key === 'totalTaxAmount') && (value === null || value === undefined)) {
        return <span className="text-muted-foreground">N/A</span>;
    }
    if ((field.type === 'number' || field.key === 'totalPrice' || field.key === 'subtotal' || field.key === 'totalDiscountAmount' || field.key === 'totalTaxAmount') && typeof value === 'number') {
      return `${value.toFixed(2)} ${currency}`;
    }
    
    if ((field.key === 'currency' || field.key === 'documentLanguage' || field.key === 'paymentTerms' || field.key === 'invoiceNumber' || field.key === 'dueDate') && (value === null || value === undefined || String(value).trim() === '')) {
        return <span className="text-muted-foreground">N/A</span>;
    }
    
    return value !== undefined && value !== null ? String(value) : <span className="text-muted-foreground">N/A</span>;
  };
  
  const dynamicSchema = useMemo(() => {
    let currentSchema = [...schema];
    if(onDeleteItem && !currentSchema.find(f => f.key === 'actions')) {
      currentSchema.push({ key: 'actions' as any, label: 'Acțiuni', type: 'actions' as any, editable: false, tooltip: 'Acțiuni rapide: vizualizează PDF, salvează/anulează editarea, șterge.' });
    }
    return currentSchema;
  }, [schema, onDeleteItem]);


  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-full"> 
        <TableHeader>
          <TableRow>
            {dynamicSchema.map(field => (
              <TableHead 
                key={field.key} 
                className={`
                  ${field.type === 'actions' ? 'text-right w-[140px] sticky right-0 bg-card z-10 shadow-sm' : ''} 
                  ${field.type === 'products_list' ? 'w-[35%] min-w-[300px]' : ''} 
                  ${field.key === 'fileName' ? 'w-[20%] min-w-[200px]' : ''} 
                  ${field.key === 'status' ? 'w-[160px]' : ''}
                  ${field.key === 'activeTemplateName' ? 'w-[180px]' : ''}
                  whitespace-nowrap px-3 py-2 text-sm
                `}
              >
                <div className="flex items-center">
                  {field.label}
                  {field.tooltip && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 ml-1.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs p-2">
                          <p>{field.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={dynamicSchema.length} className="h-24 text-center">
                Nicio dată disponibilă. Încărcați fișiere PDF pentru a începe.
              </TableCell>
            </TableRow>
          ) : (
            data.map(item => (
              <TableRow key={item.id} className={`hover:bg-muted/50 ${editingCell?.itemId === item.id ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                {dynamicSchema.map(field => (
                  <TableCell
                    key={field.key}
                    onClick={() => handleCellClick(item, field)}
                    className={`py-2 px-3 align-top text-sm
                                ${field.editable && field.key !== 'activeTemplateName' ? 'cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20' : ''}
                                ${editingCell?.itemId === item.id && editingCell?.fieldKey === field.key ? 'p-0 relative z-20' : ''}
                                ${field.type === 'actions' ? 'text-right align-middle sticky right-0 bg-card z-10 shadow-sm' : ''}
                                ${field.type !== 'products_list' ? 'whitespace-nowrap' : ''}
                                `}
                  >
                    {field.type === 'actions' && onDeleteItem ? (
                      <div className="flex justify-end items-center space-x-1">
                        {editingCell?.itemId === item.id && (
                          <>
                            <Button variant="ghost" size="icon" onClick={saveEdit} className="h-7 w-7 text-success hover:text-success/80" title="Salvează Modificările">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-7 w-7 text-destructive hover:text-destructive/80" title="Anulează Editarea">
                              <CancelIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {item.rawPdfUrl && (
                           <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80">
                             <a href={item.rawPdfUrl} target="_blank" rel="noopener noreferrer" title="Previzualizează PDF Original">
                               <Info className="h-4 w-4" />
                             </a>
                           </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item.id)} className="h-7 w-7 text-destructive hover:text-destructive/80" title="Șterge Înregistrarea">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      renderCellContent(item, field)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default DataTable;
