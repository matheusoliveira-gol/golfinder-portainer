import { useEffect, useState } from "react";
import { getToken } from "@/lib/localAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Pencil, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaginationControl } from "./PaginationControl";
import EditArtigoDialog from "./EditArtigoDialog";

interface Artigo {
  id: string;
  numero: string;
  nome: string;
  created_at: string;
}

const ArtigosList = () => {
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 10;

  const fetchArtigos = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/artigos`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        if (!response.ok) {
          throw new Error("Falha ao buscar códigos.");
        }

        const data: Artigo[] = await response.json();
        data.sort((a, b) => Number(a.numero) - Number(b.numero));
        setArtigos(data);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
  
  useEffect(() => {
    fetchArtigos();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/api/artigos/${deleteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Falha ao excluir código.');
      }

      toast.success("Código excluído com sucesso!");
      fetchArtigos();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleteId(null);
    }
  };

  // Lógica de Filtro
  const filteredArtigos = artigos.filter(
    (artigo) =>
      artigo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artigo.numero.toLowerCase().includes(searchTerm.toLowerCase())
  );
  // Lógica da Paginação
  const totalPages = Math.ceil(filteredArtigos.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredArtigos.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return <p className="text-center text-muted-foreground">Carregando códigos...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Número</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[200px]">Data de Criação</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.length > 0 ? (
              <>
                {currentItems.map((artigo) => (
                  <TableRow key={artigo.id}>
                    <TableCell className="font-medium">{artigo.numero}</TableCell>
                    <TableCell>{artigo.nome}</TableCell>
                    <TableCell>
                      {new Date(artigo.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditId(artigo.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(artigo.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {currentItems.length < itemsPerPage &&
                  Array.from({ length: itemsPerPage - currentItems.length }).map((_, index) => (
                    <TableRow key={`empty-${index}`} className="h-14"><TableCell colSpan={4} /></TableRow>
                  ))}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
                  Nenhum código encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <PaginationControl
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este código? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditArtigoDialog
        artigoId={editId}
        onClose={() => setEditId(null)}
        onSuccess={fetchArtigos}
      />
    </div>
  );
};

export default ArtigosList;