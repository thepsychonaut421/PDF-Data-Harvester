'use client';

import type { FC, ChangeEvent, FocusEvent } from 'react';
import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ExtractedDataItem, SchemaField, Product } from '@/lib/types';
import { CheckCircle2, AlertTriangle, XCircle, Edit3, Save, XIcon as CancelIcon, Trash2, Info } from 'lucide-react';

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
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Validare Necesara</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3.5 w-3.5" /> Eroare{message ? `: ${message}`: ''}</Badge>;
      case 'pending':
         return <Badge variant="secondary">În așteptare</Badge>;
      case 'uploading':
        return <Badge variant="secondary">Se încarcă...</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Se procesează...</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCellClick = (item: ExtractedDataItem, field: SchemaField) => {
    if (field.editable) {
      setEditingCell({ itemId: item.id, fieldKey: field.key });
      const value = item.extractedValues[field.key as keyof typeof item.extractedValues];
      if (field.type === 'products_list' && Array.isArray(value)) {
        setEditValue(JSON.stringify(value, null, 2)); // Edit products as JSON string for simplicity
      } else {
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

      if (fieldSchema?.type === 'number') {
        finalValue = parseFloat(String(editValue));
        if (isNaN(finalValue)) finalValue = itemToUpdate.extractedValues[editingCell.fieldKey as keyof typeof itemToUpdate.extractedValues]; // revert if invalid
      } else if (fieldSchema?.type === 'products_list') {
        try {
          finalValue = JSON.parse(String(editValue));
          if (!Array.isArray(finalValue)) throw new Error("Products must be an array.");
        } catch (error) {
          console.error("Invalid JSON for products:", error);
          // Optionally: show a toast message to the user
          finalValue = itemToUpdate.extractedValues[editingCell.fieldKey as keyof typeof itemToUpdate.extractedValues]; // revert if invalid
        }
      }
      
      onUpdateItem({
        ...itemToUpdate,
        extractedValues: {
          ...itemToUpdate.extractedValues,
          [editingCell.fieldKey]: finalValue,
        },
      });
    }
    setEditingCell(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const renderCellContent = (item: ExtractedDataItem, field: SchemaField) => {
    if (editingCell?.itemId === item.id && editingCell?.fieldKey === field.key) {
      const fieldSchema = schema.find(f => f.key === field.key);
      if (fieldSchema?.type === 'products_list') {
        return (
           <textarea
            value={String(editValue)}
            onChange={handleEditChange}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full p-1 border rounded-md text-sm min-h-[80px] bg-background"
          />
        );
      }
      return (
        <Input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
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

    if (field.type === 'products_list' && Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside text-xs">
          {value.map((p: Product, i: number) => <li key={i}>{p.name} ({p.quantity} x {p.price?.toFixed(2)})</li>)}
        </ul>
      );
    }
    if (field.type === 'number' && typeof value === 'number') {
      return value.toFixed(2);
    }
    return value !== undefined && value !== null ? String(value) : 'N/A';
  };
  
  const dynamicSchema = onDeleteItem ? [...schema, { key: 'actions' as any, label: 'Acțiuni', type: 'actions' as any, editable: false }] : schema;


  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {dynamicSchema.map(field => (
              <TableHead key={field.key} className={field.type === 'actions' ? 'text-right' : ''}>
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
              <TableRow key={item.id} className="hover:bg-muted/50">
                {dynamicSchema.map(field => (
                  <TableCell
                    key={field.key}
                    onClick={() => handleCellClick(item, field)}
                    className={`py-2 px-3 
                                ${field.editable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : ''}
                                ${editingCell?.itemId === item.id && editingCell?.fieldKey === field.key ? 'p-0' : ''}
                                ${field.type === 'actions' ? 'text-right' : ''}
                                `}
                  >
                    {field.type === 'actions' && onDeleteItem ? (
                      <div className="flex justify-end items-center space-x-1">
                        {editingCell?.itemId === item.id && editingCell?.fieldKey !== field.key && (
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
