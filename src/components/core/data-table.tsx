
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
import { CheckCircle2, AlertTriangle, XCircle, Save, XIcon as CancelIcon, Trash2, Info, Loader2 } from 'lucide-react';

interface DataTableProps {
  data: ExtractedDataItem[];
  schema: SchemaField[];
  onUpdateItem: (item: ExtractedDataItem) => void;
  onDeleteItem?: (itemId: string) => void;
  templates: InvoiceTemplate[]; 
}

const DataTable: FC<DataTableProps> = ({ data, schema, onUpdateItem, onDeleteItem, templates }) => {
  const [editingCell, setEditingCell] = useState<{ itemId: string; fieldKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string | number | Product[] | null>(''); // Allow null for totalPrice

  const StatusBadge: FC<{ status: ExtractedDataItem['status'], message?: string }> = ({ status, message }) => {
    switch (status) {
      case 'processed':
        return <Badge variant="default" className="bg-success hover:bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Procesat</Badge>;
      case 'needs_validation':
        return <Badge variant="warning"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Validare</Badge>;
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
      let valueToEdit: any;
      if (field.key === 'fileName' || field.key === 'status' || field.key === 'actions' || field.key === 'activeTemplateName') {
        valueToEdit = item[field.key as keyof typeof item];
      } else {
        valueToEdit = item.extractedValues[field.key as keyof typeof item.extractedValues];
      }

      if (field.type === 'products_list' && Array.isArray(valueToEdit)) {
        setEditValue(JSON.stringify(valueToEdit, null, 2));
      } else if (field.key === 'totalPrice') {
        setEditValue(valueToEdit === null ? '' : String(valueToEdit)); // Handle null for totalPrice input
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

      if (editingCell.fieldKey === 'totalPrice') {
        if (String(editValue).trim() === '') {
          finalValue = null;
        } else {
          finalValue = parseFloat(String(editValue));
          if (isNaN(finalValue)) {
             finalValue = itemToUpdate.extractedValues.totalPrice; // Revert if invalid number
          }
        }
      } else if (fieldSchema?.type === 'number') {
        finalValue = parseFloat(String(editValue));
        if (isNaN(finalValue)) {
            finalValue = itemToUpdate.extractedValues[editingCell.fieldKey as keyof typeof itemToUpdate.extractedValues];
        }
      } else if (fieldSchema?.type === 'products_list') {
        try {
          finalValue = JSON.parse(String(editValue));
          if (!Array.isArray(finalValue)) { 
            throw new Error("Produsele trebuie să fie un array.");
          }
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
        status: (itemToUpdate.status === 'needs_validation' || itemToUpdate.status === 'error') && fieldSchema?.editable ? 'processed' : itemToUpdate.status,
      });
    }
    setEditingCell(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement || e.currentTarget.id === `input-totalPrice-${editingCell?.itemId}`)) { 
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
            className="w-full p-1 border rounded-md text-sm min-h-[100px] bg-background resize-y"
          />
        );
      }
      return (
        <Input
          id={`input-${field.key}-${item.id}`} // Unique ID for inputs
          type={(field.key === 'totalPrice' || field.type === 'number') ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={String(editValue)}
          onChange={handleEditChange}
          onBlur={saveEdit} 
          onKeyDown={handleKeyDown}
          autoFocus
          step={(field.key === 'totalPrice' || field.type === 'number') ? "0.01" : undefined}
          className="w-full p-1 h-8 text-sm bg-background"
        />
      );
    }

    let value: any;
    if (field.key === 'fileName') value = item.fileName;
    else if (field.key === 'status') return <StatusBadge status={item.status} message={item.errorMessage} />;
    else if (field.key === 'activeTemplateName') value = item.activeTemplateName || 'Standard';
    else value = item.extractedValues[field.key as keyof typeof item.extractedValues];

    const currency = item.extractedValues.currency || '';

    if (field.type === 'products_list' && Array.isArray(value)) {
      const templateUsed = item.activeTemplateName ? templates.find(t => t.name === item.activeTemplateName) : null;
      return (
        <ul className="list-disc list-inside text-xs space-y-1 max-w-md">
          {value.map((p: Product, i: number) => (
            <li key={i} className="truncate" title={ // Add title for full view on hover
              templateUsed && templateUsed.columns.length > 0 ? (
                templateUsed.columns.map(colKey => `${colKey}: ${p[colKey] !== undefined && p[colKey] !== null ? String(p[colKey]) : 'N/A'}`).join(' | ')
              ) : (
                `${p.name || 'N/A'} (Qty: ${p.quantity !== undefined ? p.quantity : 'N/A'}, Price: ${p.price !== undefined && p.price !== null ? (p.price || 0).toFixed(2) + ' ' + currency : 'N/A'})`
              )
            }>
              {templateUsed && templateUsed.columns.length > 0 ? (
                templateUsed.columns.map(colKey => `${p[colKey] !== undefined && p[colKey] !== null ? String(p[colKey]) : 'N/A'}`).slice(0,2).join(' | ') + (templateUsed.columns.length > 2 ? '...' : '') // Show first few columns
              ) : (
                `${p.name || 'N/A'} (Qty: ${p.quantity !== undefined ? p.quantity : 'N/A'}, ...)`
              )}
            </li>
          ))}
        </ul>
      );
    }
    if (field.key === 'totalPrice' && (value === null || value === undefined)) {
        return 'N/A';
    }
    if ((field.type === 'number' || field.key === 'totalPrice') && typeof value === 'number') {
      return `${value.toFixed(2)} ${currency}`;
    }
    
    if ((field.key === 'currency' || field.key === 'documentLanguage') && (value === null || value === undefined)) {
        return 'N/A';
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
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-full"> 
        <TableHeader>
          <TableRow>
            {dynamicSchema.map(field => (
              <TableHead 
                key={field.key} 
                className={`
                  ${field.type === 'actions' ? 'text-right w-[120px] sticky right-0 bg-card z-10' : ''} 
                  ${field.type === 'products_list' ? 'w-[30%] min-w-[250px]' : ''} 
                  ${field.key === 'fileName' ? 'w-[20%] min-w-[180px]' : ''} 
                  ${field.key === 'status' ? 'w-[150px]' : ''}
                  ${field.key === 'activeTemplateName' ? 'w-[150px]' : ''}
                  whitespace-nowrap px-3 py-2
                `}
              >
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
                                ${field.type === 'actions' ? 'text-right align-middle sticky right-0 bg-card z-10' : ''}
                                ${field.type !== 'products_list' ? 'whitespace-nowrap' : ''}
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
