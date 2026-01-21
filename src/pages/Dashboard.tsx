import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, LogOut, Plus, Users, FileText, Building, UserCog, Upload } from "lucide-react";
import { toast } from "sonner";
import golpheLogo from "@/assets/golphe-logo.png";
import PessoasList from "@/components/PessoasList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArtigosList from "@/components/ArtigosList";
import CondominiosList from "@/components/CondominiosList";
import UsersList from "@/components/UsersList";
import GroupPermissions from "@/components/GroupPermissions";
import CreateUserDialog from "@/components/CreateUserDialog";
import { signOut, getCurrentUser, isAuthenticated } from "@/lib/localAuth";
import DashboardView from "@/components/DashboardView";
import ImportArtigosDialog from "@/components/ImportArtigosDialog";
import { ImportPessoasDialog } from "@/components/ImportPessoasDialog";
import ImportCondominiosDialog from "@/components/ImportCondominiosDialog";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshUsers, setRefreshUsers] = useState(0);
  const [refreshCondominios, setRefreshCondominios] = useState(0);
  const [refreshPessoas, setRefreshPessoas] = useState(0);
  const [refreshArtigos, setRefreshArtigos] = useState(0);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isPessoasImportModalOpen, setPessoasImportModalOpen] = useState(false);
  const [isArtigosImportModalOpen, setArtigosImportModalOpen] = useState(false);
  const lastTab = sessionStorage.getItem("lastTab");
  const defaultTab = location.state?.defaultTab || lastTab || "dashboard";

  useEffect(() => {
    // Verificar autenticação
    if (!isAuthenticated()) {
      navigate("/auth");
      return;
    }
    
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, [navigate]);

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-primary text-primary-foreground shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={golpheLogo} alt="GolFind" className="h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold">GolFind</h1>
              <p className="text-sm opacity-90">Sistema de Gestão</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs
          defaultValue={defaultTab}
          className="w-full"
          onValueChange={(value) => sessionStorage.setItem("lastTab", value)}
        >
          <TabsList className="grid w-full max-w-5xl grid-cols-5">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="pessoas" className="gap-2">
              <Users className="h-4 w-4" />
              Pessoas
            </TabsTrigger>
            <TabsTrigger value="artigos" className="gap-2">
              <FileText className="h-4 w-4" />
              Códigos
            </TabsTrigger>
            <TabsTrigger value="condominios" className="gap-2">
              <Building className="h-4 w-4" />
              Condomínios
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <UserCog className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5" />
                  Visão Geral
                </CardTitle>
                <CardDescription>Análise de dados do sistema.</CardDescription>
              </CardHeader>
              <CardContent><DashboardView /></CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pessoas" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Pessoas Cadastradas
                    </CardTitle>
                    <CardDescription>
                      Gerencie as pessoas do sistema
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPessoasImportModalOpen(true)}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Importar Planilha
                    </Button>
                    <Button onClick={() => navigate("/cadastrar-pessoa")} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Nova Pessoa
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PessoasList key={refreshPessoas} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="artigos" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Códigos Cadastrados
                    </CardTitle>
                    <CardDescription>
                      Gerencie os códigos do sistema
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setArtigosImportModalOpen(true)}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Importar Planilha
                    </Button>
                    <Button onClick={() => navigate("/cadastrar-artigo")} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Novo Código
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ArtigosList key={refreshArtigos} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="condominios" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Condomínios Cadastrados
                    </CardTitle>
                    <CardDescription>
                      Gerencie os condomínios do sistema
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setImportModalOpen(true)}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Importar Planilha
                    </Button>
                    <Button onClick={() => navigate("/cadastrar-condominio")} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Novo Condomínio
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CondominiosList key={refreshCondominios} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserCog className="h-5 w-5" />
                      Gestão de Usuários
                    </CardTitle>
                    <CardDescription>
                      Gerencie usuários e permissões do sistema
                    </CardDescription>
                  </div>
                  <CreateUserDialog onUserCreated={() => setRefreshUsers(prev => prev + 1)} />
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="usuarios" className="w-full">
                  <TabsList>
                    <TabsTrigger value="usuarios">Usuários</TabsTrigger>
                    <TabsTrigger value="permissoes">Permissões de Grupos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="usuarios" className="mt-4">
                    <UsersList key={refreshUsers} />
                  </TabsContent>

                  <TabsContent value="permissoes" className="mt-4">
                    <GroupPermissions />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <ImportCondominiosDialog
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => setRefreshCondominios((prev) => prev + 1)}
      />
      <ImportArtigosDialog
        isOpen={isArtigosImportModalOpen}
        onClose={() => setArtigosImportModalOpen(false)}
        onImportSuccess={() => setRefreshArtigos((prev) => prev + 1)}
      />
      <ImportPessoasDialog
        isOpen={isPessoasImportModalOpen}
        onClose={() => setPessoasImportModalOpen(false)}
        onImportSuccess={() => setRefreshPessoas((prev) => prev + 1)}
      />
    </div>
  );
};

export default Dashboard;
