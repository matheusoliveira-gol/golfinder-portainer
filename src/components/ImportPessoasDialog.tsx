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

interface ImportPessoasDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportPessoasDialog = ({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportPessoasDialogProps) => {
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
    const headers = "nome,rg,cpf,data_nascimento,nome_mae,nome_pai,observacao,residencial,condominio_nome,data_vinculo_condominio,artigos_numeros";
    const example = `"João da Silva","","111.222.333-44","1990-01-15","Maria da Silva","José da Silva","Observação sobre João","Sim","Condomínio Exemplo 1","2023-10-26","157;121"`;
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${example}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_pessoas.csv");
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
          `/api/pessoas/import`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ csvContent }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          let errorMsg = result.error || `Falha na importação: ${response.statusText}`;
          if (result.errors && result.errors.length > 0) {
              errorMsg += ` Detalhes: ${result.errors.join('; ')}`;
          }
          throw new Error(errorMsg);
        }
        
        toast.success(result.message || "Importação concluída com sucesso!");
        if (result.errors && result.errors.length > 0) {
            toast.warning(`Houveram ${result.errors.length} linhas com erros. Verifique o console para detalhes.`);
            console.warn("Erros na importação:", result.errors);
        }

        onImportSuccess();
        onClose(); // Fecha o modal
      } catch (error: any) {
        toast.error(error.message, { duration: 10000 });
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
          <DialogTitle>Importar Pessoas via Planilha</DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para importar múltiplas pessoas, incluindo vínculos com condomínios e códigos.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <h4 className="font-semibold">Passo 1: Entenda e baixe o modelo</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                A planilha possui colunas para os dados da pessoa e seus vínculos. As colunas mais importantes são:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><b>condominio_nome:</b> O nome exato do condomínio já cadastrado no sistema.</li>
                <li><b>artigos_numeros:</b> Os números dos códigos (artigos) associados. Para mais de um, separe com ponto e vírgula (ex: <code>157;121</code>).</li>
                <li><b>residencial:</b> Indique com "Sim" ou "Não" se a pessoa é residente no condomínio informado. Este campo não aceita múltiplos valores.</li>
              </ul>
              <p className="pt-2">
                Clique no botão para baixar a planilha modelo em formato CSV.
              </p>
            </div>
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 mt-2">
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