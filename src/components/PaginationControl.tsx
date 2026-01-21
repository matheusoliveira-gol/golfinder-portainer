import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const PaginationControl = ({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlProps) => {
  const getPageNumbers = () => {
    const pageNeighbours = 2;
    const totalNumbers = pageNeighbours * 2 + 3; // 2 before, 2 after, current
    const totalBlocks = totalNumbers + 2; // with ellipsis

    if (totalPages <= totalBlocks) {
      const pages = [];
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    const pages: (number | string)[] = [];

    const startPage = Math.max(2, currentPage - pageNeighbours);
    const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours);

    pages.push(1);
    if (startPage > 2) {
      pages.push("...");
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages - 1) {
      pages.push("...");
    }
    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-sm text-muted-foreground">
        Página {currentPage} de {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => onPageChange(1)} disabled={currentPage === 1} className="h-9 w-9">
          <ChevronsLeft className="h-4 w-4" />
          <span className="sr-only">Primeira página</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        <div className="hidden md:flex items-center gap-1">
          {getPageNumbers().map((page, index) =>
            typeof page === "string" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">...</span>
            ) : (
              <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => onPageChange(page)} className="w-9 h-9 p-0">
                {page}
              </Button>
            )
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          Próximo
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="h-9 w-9">
          <ChevronsRight className="h-4 w-4" />
          <span className="sr-only">Última página</span>
        </Button>
      </div>
    </div>
  );
};