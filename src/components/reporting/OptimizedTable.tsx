import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatValue } from '@/lib/format';
import { TableColumn } from '@/lib/reporting/types';

interface OptimizedTableProps {
  columns: TableColumn[];
  data: any[];
  pageSize?: number;
  maxDisplayRows?: number;
}

export function OptimizedTable({ 
  columns, 
  data, 
  pageSize = 50,
  maxDisplayRows = 100 
}: OptimizedTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const { displayData, totalPages, hasMoreData } = useMemo(() => {
    // Limit data for performance
    const limitedData = showAll ? data : data.slice(0, maxDisplayRows);
    const totalPages = Math.ceil(limitedData.length / pageSize);
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const displayData = limitedData.slice(start, end);
    
    return {
      displayData,
      totalPages,
      hasMoreData: data.length > maxDisplayRows && !showAll
    };
  }, [data, currentPage, pageSize, maxDisplayRows, showAll]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const handleShowAll = () => {
    setShowAll(true);
    setCurrentPage(0);
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for this report
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={`text-${column.align || 'left'}`}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell 
                    key={column.key} 
                    className={`text-${column.align || 'left'}`}
                  >
                    {column.format ? (
                      formatValue(row[column.key], column.format, column.decimals)
                    ) : (
                      row[column.key]?.toString() || '-'
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination and Performance Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {currentPage * pageSize + 1} to{' '}
          {Math.min((currentPage + 1) * pageSize, (showAll ? data.length : Math.min(data.length, maxDisplayRows)))} of{' '}
          {showAll ? data.length : Math.min(data.length, maxDisplayRows)} rows
          {hasMoreData && (
            <>
              {' '}({data.length} total -{' '}
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-primary"
                onClick={handleShowAll}
              >
                show all
              </Button>
              )
            </>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <span>
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages - 1}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}