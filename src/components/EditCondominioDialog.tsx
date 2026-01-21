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

interface EditCondominioDialogProps {
  condominioId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditCondominioDialog = ({ condominioId, onClose, onSuccess }: EditCondominioDialogProps) => {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (condominioId) {
      const fetchCondominio = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/condominios/${condominioId}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (!response.ok) throw new Error("Falha ao buscar dados do condomínio.");
          const data = await response.json();
          setNome(data.nome);
        } catch (error: any) {
          toast.error(error.message);
          onClose();
        } finally {
          setLoading(false);
        }
      };
      fetchCondominio();
    }
  }, [condominioId, onClose]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("O nome do condomínio é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/condominios/${condominioId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ nome }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Falha ao salvar condomínio.");
      }
      toast.success("Condomínio atualizado com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!condominioId} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Condomínio</DialogTitle>
        </DialogHeader>
        {loading ? (<div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>) : (<div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="nome" className="text-right">Nome</Label><Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="col-span-3"/></div></div>)}
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

export default EditCondominioDialog;