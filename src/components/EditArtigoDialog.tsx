import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getToken } from "@/lib/localAuth";
import { Loader2 } from "lucide-react";

interface EditArtigoDialogProps {
  artigoId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditArtigoDialog = ({ artigoId, onClose, onSuccess }: EditArtigoDialogProps) => {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (artigoId) {
      const fetchArtigo = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/artigos/${artigoId}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (!response.ok) throw new Error("Falha ao buscar dados do código.");
          const data = await response.json();
          setNumero(data.numero);
          setNome(data.nome);
        } catch (error: any) {
          toast.error(error.message);
          onClose();
        } finally {
          setLoading(false);
        }
      };
      fetchArtigo();
    }
  }, [artigoId, onClose]);

  const handleSave = async () => {
    if (!numero.trim() || !nome.trim()) {
      toast.error("Número e Nome são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/artigos/${artigoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ numero, nome, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Falha ao salvar código.");
      }
      toast.success("Código atualizado com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!artigoId} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Código</DialogTitle>
        </DialogHeader>
        {loading ? (<div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>) : (<div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="numero" className="text-right">Número</Label><Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} className="col-span-3"/></div><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="nome" className="text-right">Nome</Label><Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="col-span-3"/></div></div>)}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditArtigoDialog;