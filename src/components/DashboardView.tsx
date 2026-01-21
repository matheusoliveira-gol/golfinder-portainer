import { useEffect, useState } from "react";
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getToken } from "@/lib/localAuth";
import { Users, Building, FileText } from "lucide-react";
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChartData {
  name: string;
  [key: string]: number | string;
}

const DashboardView = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pessoas: 0, condominios: 0, artigos: 0 });
  const [artigosChartData, setArtigosChartData] = useState<ChartData[]>([]);
  const [condominiosChartData, setCondominiosChartData] = useState<ChartData[]>([]);
  const [pessoasMesChartData, setPessoasMesChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = getToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [pessoasRes, artigosRes, condominiosRes, pessoasArtigosRes, pessoasCondominiosRes] = await Promise.all([
          fetch(`/api/pessoas`, { headers }),
          fetch(`/api/artigos`, { headers }),
          fetch(`/api/condominios`, { headers }),
          fetch(`/api/pessoas_artigos`, { headers }),
          fetch(`/api/pessoas_condominios`, { headers }),
        ]);

        if (!pessoasRes.ok || !artigosRes.ok || !condominiosRes.ok || !pessoasArtigosRes.ok || !pessoasCondominiosRes.ok) {
          throw new Error("Falha ao carregar dados para o dashboard.");
        }

        const pessoas = await pessoasRes.json();
        const artigos = await artigosRes.json();
        const condominios = await condominiosRes.json();
        const pessoasArtigos = await pessoasArtigosRes.json();
        const pessoasCondominios = await pessoasCondominiosRes.json();

        // 1. Stats Cards
        setStats({
          pessoas: pessoas.length,
          condominios: condominios.length,
          artigos: artigos.length,
        });

        // 2. Gráfico de Artigos mais recorrentes
        const artigoCounts = pessoasArtigos.reduce((acc: any, pa: any) => {
          acc[pa.artigo_id] = (acc[pa.artigo_id] || 0) + 1;
          return acc;
        }, {});

        const artigosData = Object.keys(artigoCounts)
          .map(artigoId => {
            const artigo = artigos.find((a: any) => a.id === artigoId);
            return {
              name: artigo ? `Cód. ${artigo.numero}` : 'Desconhecido',
              Ocorrências: artigoCounts[artigoId],
            };
          })
          .sort((a, b) => b.Ocorrências - a.Ocorrências)
          .slice(0, 10); // Top 10
        setArtigosChartData(artigosData);

        // 3. Gráfico de Condomínios com mais ocorrências
        const condominioCounts = pessoasCondominios.reduce((acc: any, pc: any) => {
          acc[pc.condominio_id] = (acc[pc.condominio_id] || 0) + 1;
          return acc;
        }, {});

        const condominiosData = Object.keys(condominioCounts)
          .map(condominioId => {
            const condominio = condominios.find((c: any) => c.id === condominioId);
            return {
              name: condominio ? condominio.nome : 'Desconhecido',
              Ocorrências: condominioCounts[condominioId],
            };
          })
          .sort((a, b) => b.Ocorrências - a.Ocorrências)
          .slice(0, 10); // Top 10
        setCondominiosChartData(condominiosData);

        // 4. Gráfico de Pessoas cadastradas por mês (últimos 6 meses)
        const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
        const monthlyCounts: { [key: string]: number } = {};

        // Inicializa os últimos 6 meses com 0
        for (let i = 0; i < 6; i++) {
          const monthKey = format(subMonths(new Date(), i), 'MMM/yy', { locale: ptBR });
          monthlyCounts[monthKey] = 0;
        }

        pessoas.forEach((p: any) => {
          const createdAt = new Date(p.created_at);
          if (createdAt >= sixMonthsAgo) {
            const monthKey = format(createdAt, 'MMM/yy', { locale: ptBR });
            if (monthlyCounts.hasOwnProperty(monthKey)) {
              monthlyCounts[monthKey]++;
            }
          }
        });

        const pessoasMesData = Object.keys(monthlyCounts)
          .map(monthKey => ({
            name: monthKey.charAt(0).toUpperCase() + monthKey.slice(1),
            Pessoas: monthlyCounts[monthKey],
          }))
          .reverse(); // Para ordenar do mais antigo para o mais novo
        setPessoasMesChartData(pessoasMesData);

      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943'];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pessoas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pessoas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Condomínios</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.condominios}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Códigos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.artigos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Códigos Mais Recorrentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={artigosChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
                <Bar dataKey="Ocorrências" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Condomínios com Mais Ocorrências</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={condominiosChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} interval={0} />
                <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
                <Bar dataKey="Ocorrências" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Novas Pessoas Cadastradas (Últimos 6 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pessoasMesChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Pessoas" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardView;