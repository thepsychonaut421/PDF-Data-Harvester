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
import type { ExtractedDataItem, SchemaField, Product } from '@/lib/types';
import { CheckCircle2, AlertTriangle, XCircle, Save, XIcon as CancelIcon, Trash2, Info, Loader2 } from 'lucide-react';

interface DataTableProps {
  data: ExtractedDataItem[];
  schema: SchemaField[];
  onUpdateItem: (item: ExtractedDataItem) => void;
  onDeleteItem?: (itemId: string) => void; // Optional delete functionality
}

const DataTable: FC<DataTableProps> = ({ data, schema, onUpdateItem, onDeleteItem }) => {
  const [editingCell, setEditingCell] = useState<{ itemId: string; fieldKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string | number | Product[]>('');

  const StatusBadge: FC<{ status: ExtractedDataItem['status'], message?: string }> = ({ status, message }) => {
    switch (status) {
      case 'processed':
        return <Badge variant="default" className="bg-success hover:bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Procesat</Badge>;
      case 'needs_validation':
        return <Badge variant="warning"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Validare Necesara</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3.5 w-3.5" /> Eroare{message ? `: ${message}`: ''}</Badge>;
      case 'pending':
         return <Badge variant="secondary">În așteptare</Badge>;
      case 'uploading':
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Se încarcă...</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-primary/80 hover:bg-primary"><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Se procesează...</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCellClick = (item: ExtractedDataItem, field: SchemaField) => {
    if (field.editable) {
      setEditingCell({ itemId: item.id, fieldKey: field.key });
      const value = item.extractedValues[field.key as keyof typeof item.extractedValues];
      if (field.type === 'products_list' && Array.isArray(value)) {
         // Ensure price is a number or undefined, default to 0 if it's missing for editing
        const productsWithSanitizedPrice = value.map(p => ({...p, price: typeof p.price === 'number' ? p.price : 0}));
        setEditValue(JSON.stringify(productsWithSanitizedPrice, null, 2));
      } else if (field.key === 'totalPrice' && typeof value === 'number') {
        setEditValue(value); 
      }
      else {
        setEditValue(value !== undefined && value !== null ? String(value) : '');
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

      if ((fieldSchema?.type === 'number' || editingCell.fieldKey === 'totalPrice') ) {
        finalValue = parseFloat(String(editValue));
        if (isNaN(finalValue)) finalValue = itemToUpdate.extractedValues[editingCell.fieldKey as keyof typeof itemToUpdate.extractedValues];
      } else if (fieldSchema?.type === 'products_list') {
        try {
          finalValue = JSON.parse(String(editValue));
          if (!Array.isArray(finalValue) || !finalValue.every(p => typeof p.name === 'string' && typeof p.quantity === 'number' && (typeof p.price === 'number' || p.price === undefined))) {
            throw new Error("Produsele trebuie să fie un array de {name: string, quantity: number, price?: number}.");
          }
          // Ensure price is a number, default to 0 if missing after parsing
          finalValue = finalValue.map((p: any) => ({...p, price: typeof p.price === 'number' ? p.price : 0 }))

        } catch (error) {
          console.error("JSON invalid pentru produse:", error);
          finalValue = itemToUpdate.extractedValues[editingCell.fieldKey as keyof typeof itemToUpdate.extractedValues]; 
        }
      }
      
      onUpdateItem({
        ...itemToUpdate,
        extractedValues: {
          ...itemToUpdate.extractedValues,
          [editingCell.fieldKey]: finalValue,
        },
        status: 'processed' // Mark as processed after edit
      });
    }
    setEditingCell(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement)) { 
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
      const fieldSchema = schema.find(f => f.key === field.key);
      if (fieldSchema?.type === 'products_list') {
        return (
           <Textarea // Use ShadCN Textarea
            value={String(editValue)}
            onChange={handleEditChange}
            onBlur={saveEdit} // Save on blur for textarea too for consistency
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full p-1 border rounded-md text-sm min-h-[100px] bg-background resize-y"
          />
        );
      }
      return (
        <Input
          type={(field.type === 'number' || field.key === 'totalPrice') ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={String(editValue)}
          onChange={handleEditChange}
          onBlur={saveEdit} 
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full p-1 h-8 text-sm bg-background"
        />
      );
    }

    let value: any;
    if (field.key === 'fileName') value = item.fileName;
    else if (field.key === 'status') return <StatusBadge status={item.status} message={item.errorMessage} />;
    else value = item.extractedValues[field.key as keyof typeof item.extractedValues];

    const currency = item.extractedValues.currency || '';

    if (field.type === 'products_list' && Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside text-xs space-y-1">
          {value.map((p: Product, i: number) => (
            <li key={i}>
              {p.name} ({p.quantity} x {(p.price ?? 0).toFixed(2)} {currency})
            </li>
          ))}
        </ul>
      );
    }
    if ((field.type === 'number' || field.key === 'totalPrice') && typeof value === 'number') {
      return `${value.toFixed(2)} ${currency}`;
    }
    
    if (field.key === 'currency' || field.key === 'documentLanguage') {
        return value || 'N/A';
    }

    return value !== undefined && value !== null ? String(value) : 'N/A';
  };
  
  const dynamicSchema = useMemo(() => {
    let currentSchema = [...schema];
    if(onDeleteItem && !currentSchema.find(f => f.key === 'actions')) {
      currentSchema.push({ key: 'actions' as any, label: 'Acțiuni', type: 'actions' as any, editable: false });
    }
    return currentSchema;
  }, [schema, onDeleteItem]);


  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {dynamicSchema.map(field => (
              <TableHead key={field.key} className={`${field.type === 'actions' ? 'text-right w-[120px]' : ''} ${field.type === 'products_list' ? 'w-[35%]' : ''} ${field.key === 'fileName' ? 'w-[25%]' : ''} ${field.key === 'status' ? 'w-[150px]' : ''}`}>
                {field.label}
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
              <TableRow key={item.id} className={`hover:bg-muted/50 ${editingCell?.itemId === item.id ? 'bg-muted/80 dark:bg-muted/30' : ''}`}>
                {dynamicSchema.map(field => (
                  <TableCell
                    key={field.key}
                    onClick={() => handleCellClick(item, field)}
                    className={`py-2 px-3 align-top
                                ${field.editable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : ''}
                                ${editingCell?.itemId === item.id && editingCell?.fieldKey === field.key ? 'p-0' : ''}
                                ${field.type === 'actions' ? 'text-right align-middle' : ''}
                                `}
                  >
                    {field.type === 'actions' && onDeleteItem ? (
                      <div className="flex justify-end items-center space-x-1">
                        {editingCell?.itemId === item.id && (
                          <>
                            <Button variant="ghost" size="icon" onClick={saveEdit} className="h-7 w-7 text-green-600 hover:text-green-700">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-7 w-7 text-red-600 hover:text-red-700">
                              <CancelIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {item.rawPdfUrl && (
                           <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80">
                             <a href={item.rawPdfUrl} target="_blank" rel="noopener noreferrer" title="Previzualizează PDF">
                               <Info className="h-4 w-4" />
                             </a>
                           </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item.id)} className="h-7 w-7 text-destructive hover:text-destructive/80" title="Șterge">
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
