import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, File, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/localAuth";

interface ImportArtigosDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const ImportArtigosDialog = ({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportArtigosDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Limpa o arquivo quando o modal é fechado
    if (!isOpen) {
      setFile(null);
    }
  }, [isOpen]);

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,numero,nome\n157,Roubo\n121,Homicídio Simples";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_codigos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFile = event.target.files[0];
      if (selectedFile && selectedFile.type === "text/csv") {
        setFile(selectedFile);
      } else {
        toast.error("Por favor, selecione um arquivo .csv");
        setFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Nenhum arquivo selecionado.");
      return;
    }

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result;
      try {
        const response = await fetch(
          `/api/artigos/import`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ csvContent }),
          }
        );

        if (!response.ok) {
          let errorMsg = `Falha na importação: ${response.statusText}`;
          try {
            const errorResult = await response.json();
            if (errorResult.error) {
              errorMsg = errorResult.error;
            }
          } catch (e) {
            // A resposta não era JSON, o erro original será usado.
          }
          throw new Error(errorMsg);
        }

        const result = await response.json();
        toast.success(result.message || "Importação concluída com sucesso!");
        onImportSuccess();
        onClose(); // Fecha o modal
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Códigos via Planilha</DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para importar múltiplos códigos de uma só vez.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <h4 className="font-semibold">Passo 1: Baixe o modelo</h4>
            <p className="text-sm text-muted-foreground">
              Clique no botão para baixar a planilha modelo em formato CSV. As colunas necessárias são "numero" e "nome".
            </p>
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Baixar Modelo da Planilha
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Passo 2: Preencha e importe</h4>
            <p className="text-sm text-muted-foreground">
              Selecione o arquivo CSV preenchido para iniciar a importação.
            </p>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
            {!file ? (<Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" />Selecionar Arquivo</Button>) : (<div className="flex items-center justify-between p-2 border rounded-md bg-muted/50"><div className="flex items-center gap-2 text-sm"><File className="h-4 w-4" /><span>{file.name}</span></div><Button variant="ghost" size="icon" onClick={() => setFile(null)}><X className="h-4 w-4" /></Button></div>)}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Fechar</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>) : ("Importar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportArtigosDialog;